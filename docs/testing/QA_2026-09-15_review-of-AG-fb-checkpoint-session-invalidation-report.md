**Từ:** Claude (Architect/QA)

# QA_2026-09-15 — Thẩm định độc lập báo cáo RCA của AG (`fb-account-checkpoint-and-session-invalidation-investigation-report.md`)

## Phương pháp

Không tin báo cáo suông — đọc trực tiếp từng file mã nguồn AG trích dẫn (`scripts/*.js`) và query trực tiếp DB (`public`) để đối chiếu từng claim trước khi chấp nhận.

## Kết quả thẩm định từng RCA

### ✅ RCA #1 (thiếu lưu cookie xoay vòng trong `post-to-group.js`) — XÁC NHẬN ĐÚNG, bằng chứng chắc chắn

Đọc toàn bộ `scripts/post-to-group.js` (700 dòng): xác nhận `context.storageState({ path: SESSION_PATH })` **KHÔNG hề được gọi ở bất kỳ đâu** để lưu lại cookie sau khi dùng — chỉ dùng 1 lần lúc tạo context (dòng 259-260) để NẠP session cũ, `finally` block (dòng 679-682) chỉ `browser.close()`, không lưu gì trước đó.

Đối chiếu 2 file AG nói CÓ làm đúng:
- `scripts/sync-group-memberships.js` dòng 181: `await context.storageState({ path: sessionPath });` — CÓ, đúng dòng AG trích.
- `scripts/warm-and-join.js` dòng 557: `await context.storageState({ path: sessionPath });` — CÓ, đúng dòng AG trích.

→ Claim chính xác 100%, kể cả số dòng trích dẫn. Đây là bug thật, rủi ro thật (Facebook có thể coi việc gửi cookie cũ lặp lại là dấu hiệu bất thường).

### ✅ RCA #2 (dùng chung 1 cổng proxy 4G) — XÁC NHẬN ĐÚNG

Đối chiếu screenshot bảng FB Accounts PO đã gửi trước đó: cả `acc_01` và `acc_02` cùng hiện `http://***:***@ip.mproxy.vn:12167` — trùng host:port.

Đối chiếu thêm `scripts/run-batch.js` dòng 42-67 (`resetProxyIp`): có logic chờ đúng **10 giây** (`setTimeout(() => resolve(true), 10000)`, dòng 54) sau khi gọi API reset IP, và CHỈ trigger reset khi đổi account giữa batch (dòng 119: `lastUsedAccountId !== accountId`) — khớp chính xác với claim AG nêu, kể cả con số 10s.

### ⚠️ RCA #3 (1 account gánh 15 nhóm/lượt) — HỢP LÝ nhưng KHÔNG kiểm chứng được trực tiếp

Dữ liệu thật khớp bối cảnh (run `#9437`: 15 nhóm dồn cho 1 mình acc_02, do acc_01 đã Checkpoint từ sáng). Tuy nhiên không có cách nào kiểm chứng trực tiếp ngưỡng phát hiện nội bộ của Facebook — chấp nhận đây là suy luận hợp lý, không phải bằng chứng chắc chắn như RCA #1/#2.

### ❌ RCA #4 (nhóm Buy & Sell / khóa composer với người chưa join) — SAI CƠ CHẾ, nhưng phát hiện được nguyên nhân thật thay thế

Query trực tiếp 7 nhóm bị lỗi `"Could not find text editor in post dialog"` trong run `#9437`:
- **`group_type` của cả 7 nhóm:** `Mechanical`/`Mechatronics`/`Industrial Automation` — **KHÔNG có nhóm nào gắn tag Buy & Sell/Marketplace** như AG khẳng định. Claim này không có căn cứ trong dữ liệu thật.
- **NHƯNG:** cả 7/7 nhóm đều có `join_status = 'Not Joined'` — tương quan 100%. Đối chiếu thêm: campaign WINPRO có `allow_post_without_join = true`.
- Đọc lại `post-to-group.js` dòng 388-411: khi phát hiện chưa là member VÀ `allowPostWithoutJoin = true`, code **cố tình bỏ qua** cảnh báo và vẫn cố tìm composer để đăng — nhưng UI Facebook cho tài khoản CHƯA join 1 nhóm nhiều khả năng không hiển thị khung soạn bài chuẩn (`[role="dialog"]` có header "Tạo bài viết") như code đang tìm.

**Kết luận đúng hơn:** nguyên nhân thật của nhóm lỗi này là **tính năng `allow_post_without_join` không hoạt động ổn định** với nhóm chưa join — không liên quan gì đến loại nhóm Buy & Sell. Khuyến nghị P2 của AG ("Warming & Auto-Join trước") vẫn là hướng xử lý đúng, chỉ là lý do AG đưa ra sai.

### ⚠️ Mục 5 (Hướng dẫn `node save-session.js ...`) — KHÔNG XÁC MINH ĐƯỢC

Đã tìm toàn bộ `scripts/` (glob `**/*.js` và `**/save-session.js`) — **KHÔNG tồn tại file `save-session.js`** ở bất kỳ đâu trong repo Git này (chỉ có `bridge-server.js`, `post-to-group.js`, `run-batch.js`, `sync-group-memberships.js`, `warm-and-join.js`). Có thể đây là script chỉ tồn tại trên VPS (không commit git, hợp lý vì cần chạy có màn hình để tự tay đăng nhập/nhập OTP) — nhưng tôi KHÔNG có cách xác minh điều này từ worktree hiện tại. PO cần tự kiểm tra file này có thật trên VPS tại đúng đường dẫn trước khi làm theo, tránh mất công vì lệnh không chạy được.

---

## Kế hoạch khắc phục (đã điều chỉnh theo kết quả thẩm định)

| # | Việc | Loại | Ai làm |
|---|---|---|---|
| 1 | Thêm `await context.storageState({ path: SESSION_PATH })` trong `finally`/trước khi đóng browser ở `post-to-group.js` (có null-check `context`) | Code fix (P0, đã verify bug thật) | Claude viết spec → AG code → Claude QA |
| 2 | Tăng thời gian chờ reset IP từ 10s → 15s trong `run-batch.js` | Code fix (P1, rủi ro thấp) | Claude viết spec → AG code → Claude QA |
| 3 | Mua thêm 1 cổng 4G riêng cho acc_01 (tách khỏi acc_02) | Quyết định hạ tầng/chi phí | PO tự quyết |
| 4 | Giảm `max_posts_per_run` các campaign đang dùng 15 xuống 4-5 | Đổi field có sẵn trong Edit Modal | PO tự làm qua UI |
| 5 | Chạy Warming & Auto-Join cho các nhóm `Not Joined` trước khi Post Job (đúng hướng, sai lý do AG đưa ra) | Thao tác UI có sẵn | PO tự làm qua UI |
| 6 | `node save-session.js ...` để lấy lại session | KHÔNG XÁC MINH ĐƯỢC — PO tự kiểm tra file có tồn tại trên VPS trước | PO tự kiểm tra |
