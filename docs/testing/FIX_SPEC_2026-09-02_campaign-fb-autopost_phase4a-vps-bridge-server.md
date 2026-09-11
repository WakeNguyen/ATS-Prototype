# FIX SPEC — PHẦN 4a: Xây Dựng HTTP Bridge Server Trên VPS (Cầu Nối n8n ↔ Playwright)

**Từ:** Claude (Architect/QA)
**Gửi:** Antigravity (Implementer)
**Ngày:** 2026-09-02
**Bối cảnh:** Đây là phần hạ tầng còn thiếu đã được xác nhận qua kiểm tra trực tiếp trên VPS (SSH, phối hợp cùng User) — Phương án A (HTTP Microservice Bridge) trong `docs/architecture/PLAN_2026-09-02_campaign-fb-autopost-integration.md` mục 11.1 mới chỉ là đề xuất kiến trúc, CHƯA có code thật: không có process PM2 nào, không có container Docker nào cho bridge, không có file server nào tồn tại. Spec này giao AG viết đúng phần lõi còn thiếu đó.

**Bằng chứng khảo sát VPS (để AG đối chiếu, không cần điều tra lại):**
- `pm2`: chưa cài trên VPS.
- 5 container hiện có: `n8n-n8n-1`, `n8n-n8n-worker-1` (worker thật thực thi workflow, do `EXECUTIONS_MODE: queue`), `n8n-nocodb-1`, `n8n-postgres-1`, `n8n-redis-1`. Không có container nào cho bridge.
- 3 script (`run-batch.js`, `warm-and-join.js`, `post-to-group.js`) nằm tại `/opt/n8n/facebook auto posting 2.0/` trên HOST (Ubuntu 24.04, ngoài Docker). Playwright + Chromium + toàn bộ lib hệ thống (`libnss3`, `libgbm1`...) đã cài đầy đủ và test thành công tại đây (`npx playwright install --with-deps chromium` chạy OK sau khi `chmod +x node_modules/.bin/playwright`).
- Container `n8n`/`n8n-worker` mount `/tmp:/tmp` từ host (bind mount) — đây là kênh trao đổi file giữa n8n và bridge.
- Network Docker: `n8n_default`, gateway **`172.18.0.1`**, container `n8n` ở `172.18.0.4`, `n8n-worker` ở `172.18.0.2`. Không có `host.docker.internal` (`ExtraHosts: []`).

---

## 0. Phạm vi

✅ Trong phạm vi:
1. File mới `bridge-server.js` đặt ngay trong `/opt/n8n/facebook auto posting 2.0/` trên VPS (cùng thư mục với 3 script hiện có, tái dùng `node_modules/playwright` đã cài sẵn ở đó).
2. Cập nhật `package.json` trong thư mục đó nếu cần thêm dependency (khuyến nghị dùng module `http` built-in của Node, KHÔNG cần thêm Express — giữ tối giản theo mục 1.4 GEMINI.md, ưu tiên giải pháp dễ tuỳ chỉnh, ít phụ thuộc).
3. Cấu hình PM2 chạy `bridge-server.js` như 1 daemon, tự khởi động lại khi crash và khi VPS reboot.
4. Thêm biến môi trường cho bridge (file `.env` riêng trong thư mục đó, KHÔNG dùng chung `.env.local` của Next.js) — ít nhất gồm `BRIDGE_PORT`, `BRIDGE_INTERNAL_SECRET`.

❌ NGOÀI phạm vi:
- KHÔNG sửa nội dung 3 script `run-batch.js`/`warm-and-join.js`/`post-to-group.js` (giữ nguyên logic anti-detection/proxy hiện có) — bridge chỉ gọi chúng như child process, không động vào bên trong.
- KHÔNG sửa workflow n8n (đó là PHẦN 4b, Claude tự làm sau khi bridge này chạy ổn — vì Claude không có quyền n8n MCP để chỉnh giúp AG được, việc này Claude làm trực tiếp).
- KHÔNG sửa `docker-compose.yml` (không cần — bridge chạy trên host, ngoài Docker, container n8n gọi vào qua network gateway).
- KHÔNG cần gỡ Chromium/Playwright đã cài thừa trong 2 image `n8n-custom-n8n`/`n8n-custom-n8n-worker` — an toàn để giữ nguyên, không phải làm gì thêm với nó.

Nếu thấy cần sửa gì khác ngoài danh sách trên, dừng lại hỏi Claude trước, theo mục 10 GEMINI.md.

---

## 1. Yêu cầu kỹ thuật cho `bridge-server.js`

### 1.1. Cổng lắng nghe
- Bind `0.0.0.0:5680` (đọc từ `process.env.BRIDGE_PORT`, mặc định `5680` — cổng này đã kiểm tra chưa bị chiếm trên VPS).
- Vì bind `0.0.0.0`, bridge sẽ lộ ra ngoài Internet nếu VPS không có firewall chặn — **bắt buộc** có xác thực secret ở mục 1.4, và khuyến nghị thêm rule `ufw`/`iptables` chỉ cho phép cổng 5680 từ dải mạng Docker (`172.18.0.0/16`) và `127.0.0.1` — nếu AG có quyền cấu hình firewall thì làm luôn, không thì báo lại Claude/User để xử lý riêng (không bắt buộc phải làm trong spec này nếu tốn nhiều thời gian, nhưng phải ghi rõ trong báo cáo hoàn thành là CHƯA làm bước firewall).

### 1.2. Hai endpoint
- `POST /api/facebook-post-v2`: nhận payload JSON đầy đủ (dispatch list, content, ảnh, v.v. — đúng shape mà `triggerCampaignRun` trong `campaign_actions.js` đang gửi sang n8n, n8n forward nguyên payload này sang bridge). Bridge ghi payload ra 1 file JSON tạm (ví dụ `/tmp/fb-post-<uuid>.json`), spawn `node run-batch.js /tmp/fb-post-<uuid>.json` bằng `child_process.spawn` (không dùng `exec` để tránh giới hạn buffer output), đợi tiến trình kết thúc, đọc `stdout` (script này đã tự in JSON kết quả ra stdout — xem lại mục 11.1 Plan để nhớ hợp đồng này), parse và trả về nguyên JSON đó cho n8n. Xoá file tạm sau khi xong (kể cả khi lỗi, dùng `finally`).
- `POST /api/facebook-warm-join`: y hệt cơ chế trên nhưng spawn `node warm-and-join.js <temp_path>`.
- Timeout nội bộ: set timeout hợp lý (ví dụ 55 phút) cho tiến trình con, phòng trường hợp script bị treo — nếu quá timeout thì `kill()` tiến trình con và trả lỗi rõ ràng thay vì treo request mãi (n8n phía gọi đã có `timeout: 3600000` + `continueOnFail: true` nên vẫn an toàn, nhưng bridge cũng nên tự bảo vệ).

### 1.3. Không cần route thứ 3
Không cần thêm endpoint health-check trong phạm vi spec này (có thể AG tự thêm `GET /health` nếu thấy tiện cho việc debug qua `curl`, không bắt buộc).

### 1.4. Bảo mật — bắt buộc
- Mọi request phải có header `x-internal-secret` khớp `process.env.BRIDGE_INTERNAL_SECRET`, kiểm tra **đầu tiên** trước khi làm gì khác, sai/thiếu → trả `401` kèm `{error: 'Unauthorized'}` — đúng pattern đã dùng ở 6 webhook Next.js.
- **TUYỆT ĐỐI không log payload thô ra console/stdout/file log** — payload này chứa `proxy_url` và có thể cả thông tin 2FA đã giải mã (Next.js gửi cho n8n ở dạng đã decrypt vì cần dùng thật để đăng nhập Facebook). Nếu cần log để debug, chỉ log các trường không nhạy cảm (ví dụ `runId`, số lượng group, không log proxy/account credentials). Đây là mở rộng của Lớp 3 (Log Sanitization) trong mục 11.3 Plan, áp dụng luôn cho bridge chứ không chỉ Next.js.
- Giá trị `BRIDGE_INTERNAL_SECRET` nên đặt khác với `INTERNAL_WEBHOOK_SECRET` của Next.js (2 hệ thống độc lập, không bắt buộc trùng) — AG tự sinh 1 chuỗi ngẫu nhiên đủ dài, lưu vào file `.env` cạnh `bridge-server.js` (thêm `.env` vào `.gitignore` nếu thư mục này có git riêng, hoặc đảm bảo không commit nhầm).

### 1.5. PM2
```
cd "/opt/n8n/facebook auto posting 2.0"
pm2 start bridge-server.js --name fb-bridge
pm2 save
pm2 startup systemd    # copy và chạy đúng lệnh sudo mà pm2 in ra để bật boot-persistence
```
(`pm2` hiện chưa có trên VPS — AG cần `npm install -g pm2` trước.)

---

## 2. Việc Claude sẽ làm sau khi bridge này chạy xong (PHẦN 4b, không phải việc của AG)

Sau khi AG xác nhận bridge chạy được (test bằng `curl` từ chính VPS), Claude sẽ tự sửa 2 workflow n8n (A: FB Group Auto-Post, C: Auto-Warm & Auto-Join) để node HTTP Request gọi đúng `http://172.18.0.1:5680/api/facebook-post-v2` và `http://172.18.0.1:5680/api/facebook-warm-join` kèm header `x-internal-secret` = `BRIDGE_INTERNAL_SECRET`. AG không cần làm phần này.

---

## 3. Yêu cầu test bắt buộc trước khi báo hoàn thành

1. Test 401: gọi cả 2 endpoint thiếu/sai `x-internal-secret` → xác nhận trả đúng 401.
2. Test thật từ chính VPS (không cần qua n8n): `curl -X POST http://localhost:5680/api/facebook-post-v2 -H "x-internal-secret: <secret>" -H "Content-Type: application/json" -d '<payload mẫu với 1 group, dùng dữ liệu test/dummy, KHÔNG dùng nick FB thật theo mục 10.8 GEMINI.md>'` — xác nhận bridge spawn đúng tiến trình con, nhận lại JSON kết quả (dù script trả lỗi vì proxy/account giả cũng được, miễn bridge KHÔNG tự crash và trả JSON có cấu trúc hợp lệ).
3. Test từ TRONG container `n8n-worker` gọi ra bridge: `docker exec n8n-n8n-worker-1 sh -c "curl -s -X POST http://172.18.0.1:5680/api/facebook-post-v2 -H 'x-internal-secret: <secret>' -H 'Content-Type: application/json' -d '{}'"` — xác nhận container thật sự với tới được bridge qua gateway (đây là bước quan trọng nhất, xác nhận đúng địa chỉ mạng).
4. `pm2 list` sau khi reboot thử (`pm2 restart fb-bridge` để giả lập) → xác nhận service tự phục hồi.

## 4. Báo cáo hoàn thành
Bắt buộc mở đầu bằng đúng 1 trong 2 dòng: "⚠️ Sai lệch so với spec: ..." hoặc "✅ Không có sai lệch so với spec" (mục 10.7 GEMINI.md), và nêu rõ đã làm hay chưa làm bước firewall ở mục 1.1.
