# FIX_SPEC (KHẨN CẤP) — 2026-09-07 — Root cause đăng trùng nhóm FB qua 2 lượt chạy (Execution #956 → #961): bug $input.first() CHƯA fix + bridge-server SIGKILL làm mất toàn bộ kết quả thật khi batch quá lớn

**Mức độ ưu tiên: KHẨN CẤP — có rủi ro thật là tài khoản Facebook đã đăng trùng bài vào cùng 1 nhóm 2 lần trong vòng ~17 phút, có thể bị nhóm/Facebook đánh dấu spam.**
**Người phát hiện:** User, nghi ngờ qua quan sát 2 lượt chạy campaign Accenture hôm nay. Đã điều tra xác nhận qua n8n execution log thật (không suy đoán).

## Bối cảnh — 2 lượt chạy liên tiếp của cùng 1 campaign

- **Execution #956** (Workflow A `9W588GooZeZhiSKm`), 07/09 15:37–15:50 GMT+7, dispatch 6 nhóm. Đã có báo cáo RCA riêng sáng nay (`QA_2026-09-07_campaign-fb-autopost_execution956-investigation-report.md`): do node `Process Bridge Results` dùng `$input.first()` thay vì `$input.all()`, 1 nhóm ("AE THỢ CƠ KHÍ HÀ NỘI") đã đăng bài THẬT THÀNH CÔNG nhưng bị ghi đè thành "Failed" trong `campaign_run_items`. FIX_SPEC cho lỗi này đã viết sáng nay nhưng **QA vừa xác nhận lại qua API n8n: NODE VẪN CHƯA ĐƯỢC SỬA** (code hiện tại của `Process Bridge Results` vẫn y nguyên `const bridgeOutput = $input.first().json;`).
- **Execution #961** (cùng Workflow A), 07/09 15:54–16:49 GMT+7 (chạy chỉ 17 phút sau #956), dispatch **cùng campaign này với batch lớn hơn nhiều** (danh sách `dispatch` gồm hàng trăm nhóm, trong đó **"AE THỢ CƠ KHÍ HÀ NỘI" xuất hiện lại ở vị trí #5** — TRÙNG với nhóm vừa đăng thành công 17 phút trước).

## Root cause #2 (MỚI phát hiện) — `bridge-server.js` SIGKILL xoá sạch kết quả thật khi batch chạy quá 55 phút

Đọc trực tiếp log thật của execution #961, node `Call VPS Bridge: facebook-post-v2` nhận về lỗi:
```
AxiosError: Request failed with status code 504
body: { "success": false, "error": "Execution timed out after 3300s", "stdout": "", "stderr": "...[Job 14]...[Job 20]..." }
```
Đối chiếu code `scripts/bridge-server.js` (dòng 42, 106-122):
```js
const PROCESS_TIMEOUT_MS = parseInt(process.env.BRIDGE_TIMEOUT_MS || '3300000', 10); // 55 minutes
...
const timeoutHandle = setTimeout(() => {
  ...
  console.error(`[${runLabel}] Process timed out after ${PROCESS_TIMEOUT_MS / 1000}s. Terminating...`);
  try { child.kill('SIGKILL'); } catch (e) {}
  ...
  resolve({ statusCode: 504, data: { success: false, error: ..., stdout: stdoutData.slice(-2000), stderr: stderrData.slice(-2000) } });
}, PROCESS_TIMEOUT_MS);
```

**Chuỗi nguyên nhân đầy đủ:**
1. Campaign này có `max_posts_per_run = 50`. Log thật cho thấy mỗi job tốn ~1.5–2.5 phút (bao gồm "safety cooldown" theo tài khoản + "Anti-Spam Delay" ~90-105s sau mỗi job). Với 50 job/run, tổng thời gian cần **~75–125 phút** — VƯỢT XA ngưỡng timeout cứng 55 phút (`PROCESS_TIMEOUT_MS`) của `bridge-server.js`.
2. Khi chạm 55 phút, `bridge-server.js` **SIGKILL** tiến trình Playwright con NGAY LẬP TỨC — bất kể đang xử lý dở job nào. Script con (`run-batch.js`, chạy trên VPS, không nằm trong repo này) chỉ ghi mảng JSON kết quả đầy đủ ra `stdout` **SAU KHI xử lý xong TOÀN BỘ batch** — bị kill giữa chừng nghĩa là **`stdout` trống rỗng** (`"stdout":""` — xác nhận đúng trong log thật), tức là **TOÀN BỘ kết quả thật của các job ĐÃ CHẠY XONG trước khi bị kill (ít nhất 20 job, có real success/fail) bị MẤT SẠCH, không được lưu vào DB ATS 3.0 dưới bất kỳ hình thức nào.**
3. n8n nhận về lỗi 504 rỗng → node `Process Bridge Results` rơi vào nhánh `isBridgeLevelFailure` → gán `status: 'Failed'` đồng loạt cho TẤT CẢ nhóm trong `dispatch` (kể cả các nhóm đã thực sự được xử lý — có thể đã đăng thành công thật — trước khi bị kill).
4. Vì không có bất kỳ dòng `campaign_run_items` nào ghi `status = 'Sent'` cho các nhóm đó, cơ chế chống trùng 24h (`_getEligibilityState`, `campaign_actions.js` dòng ~600-610, chỉ lọc theo `status = 'Sent' AND posted_at > now() - interval '24 hours'`) **KHÔNG THỂ biết** các nhóm này vừa được xử lý — nên lượt chạy tiếp theo (hoặc chính batch bị kill, nếu retry) sẽ **dispatch lại y hệt các nhóm đó**, dẫn tới khả năng đăng trùng bài thật trên Facebook.

**Kết luận:** Nhóm "AE THỢ CƠ KHÍ HÀ NỘI" (vị trí #5 trong batch #961, tức là được xử lý sớm — trong vòng ~10-15 phút đầu, TRƯỚC mốc 55 phút bị kill) **RẤT CÓ KHẢ NĂNG đã được VPS xử lý xong và đăng trùng bài thật lần 2** trước khi tiến trình bị SIGKILL ở phút 55 — nhưng vì log stderr n8n nhận được chỉ giữ lại 2000 ký tự cuối (`stderrData.slice(-2000)`, tức chỉ thấy job #14-20), **KHÔNG có bằng chứng trực tiếp job #5 thành công hay thất bại trong lần chạy này** — cần AG kiểm tra thêm bằng 1 trong 2 cách ở mục Verify bên dưới.

## Việc cần AG làm (theo thứ tự ưu tiên)

### 1. (Ưu tiên cao nhất — đã trễ từ sáng nay) Áp dụng bản vá `$input.all()` cho node `Process Bridge Results`, Workflow A (`9W588GooZeZhiSKm`)
Code đầy đủ đã có sẵn trong `docs/testing/QA_2026-09-07_campaign-fb-autopost_execution956-investigation-report.md` mục 4.1 — copy-paste trực tiếp, không cần viết lại. Đây là điều kiện tiên quyết để các lượt chạy BÌNH THƯỜNG (không bị timeout) báo đúng kết quả từng nhóm, tránh lặp lại chính xác lỗi của execution #956.

### 2. Sửa `scripts/bridge-server.js` để KHÔNG mất kết quả thật khi bị timeout/kill
**Vấn đề gốc:** `run-batch.js` (script con, chạy trên VPS) chỉ in kết quả JSON ra `stdout` một lần duy nhất ở CUỐI batch. Cần AG mở file `run-batch.js` trên VPS (không có trong repo `ats-web` này) và đổi sang ghi kết quả **tăng dần theo từng job** (ví dụ: ghi từng dòng JSON — JSON Lines — ra 1 file tạm `/tmp/<runId>-results.ndjson` ngay sau khi mỗi job xử lý xong, thay vì gom hết vào 1 mảng rồi in 1 lần ở cuối).

Sau đó, trong `scripts/bridge-server.js`, tại đúng nhánh timeout (dòng ~106-122): TRƯỚC khi resolve lỗi 504, đọc file `.ndjson` tạm đó (nếu có) và trả kèm mảng `partialResults` trong response, để n8n có thể ghi nhận ĐÚNG các nhóm đã thực sự xử lý xong (Sent/Failed thật) thay vì đánh đồng `Failed` cho tất cả.

**Nếu việc sửa `run-batch.js` để ghi kết quả tăng dần mất nhiều thời gian, làm TRƯỚC bước giảm rủi ro đơn giản hơn ở mục 3 — đây là fix triệt để nhưng có thể làm sau.**

### 3. (Fix nhanh, giảm rủi ro ngay) Giảm `max_posts_per_run` hoặc tăng timeout để batch LUÔN chạy xong trong thời gian cho phép
Chọn 1 trong 2 (ưu tiên phương án A vì không phải sửa hạ tầng VPS):
- **A. Giảm `max_posts_per_run` của các campaign lớn** (ví dụ campaign Accenture 437 nhóm) xuống mức để `max_posts_per_run × ~2.5 phút/job < 50 phút` (có biên an toàn trước ngưỡng 55 phút) — ví dụ đặt `max_posts_per_run = 18-20` thay vì 50. Cần nhiều lượt chạy hơn để phủ hết 437 nhóm, nhưng mỗi lượt sẽ LUÔN hoàn tất trong timeout, không bao giờ bị SIGKILL giữa chừng.
- **B. Tăng `BRIDGE_TIMEOUT_MS`** trên VPS (biến môi trường, hiện mặc định 3300000 = 55 phút) lên mức đủ cho 50 job (ví dụ 130 phút = 7800000) — rủi ro: n8n HTTP node timeout hiện đặt `3600000` (60 phút, xem node `Call VPS Bridge: facebook-post-v2`) cũng cần tăng theo cho khớp, nếu không n8n sẽ tự timeout ở phía nó trước khi VPS kịp trả lời.

**Khuyến nghị: làm phương án A trước (đổi 1 giá trị số trong DB/UI, không cần deploy lại VPS), có thể làm ngay trong hôm nay.**

### 4. Hardening cơ chế chống trùng 24h — thêm lớp bảo vệ khi lượt chạy trước kết thúc bất thường (bridge-level failure/timeout)
Hiện `_getEligibilityState` (`campaign_actions.js` dòng ~552-650) chỉ loại nhóm đã `status='Sent'` trong 24h. Đề xuất bổ sung: khi 1 lượt chạy (`campaign_runs`) kết thúc với TOÀN BỘ item cùng bị `Failed` với cùng 1 `errorMessage` chứa `"timed out"` hoặc `"Gateway"` (dấu hiệu bridge-level failure như #961) — tự động gắn cờ run đó là `needs_manual_review = true` và **chặn nút "Run" của chính campaign đó trên UI** cho tới khi User xác nhận đã kiểm tra thủ công (không tự động cho phép trigger lại ngay, tránh lặp lại vòng lặp trùng như hôm nay).

## Yêu cầu verify (bắt buộc trước khi báo hoàn thành)

1. **Xác minh có đăng trùng thật hay không** (làm trước tiên, không phụ thuộc code fix): AG kiểm tra trực tiếp trên VPS xem có log đầy đủ hơn của execution #961 không (bridge-server.js console log qua `pm2 logs` hoặc tương tự, KHÔNG bị cắt 2000 ký tự như log n8n nhận được) để xác nhận job #5 ("AE THỢ CƠ KHÍ HÀ NỘI") thành công hay thất bại lần 2. Nếu xác nhận đăng trùng thật — báo ngay cho User để cân nhắc xoá bớt 1 bài trùng trên Facebook (thao tác thủ công, không phải việc của AG).
2. Sau khi sửa mục 1: chạy lại 1 campaign nhỏ (như execution #956, ~6 nhóm) mô phỏng lại đúng tình huống 1 nhóm "not a member" + 1 nhóm thành công → xác nhận `Process Bridge Results` trả đúng per-group status, KHÔNG còn đồng loạt Failed.
3. Sau khi sửa mục 3 (giảm `max_posts_per_run` hoặc tăng timeout): chạy thử 1 lượt với batch đúng bằng ngưỡng mới, đo thời gian thực tế, xác nhận hoàn tất TRƯỚC khi chạm timeout (có biên an toàn ít nhất 10-15%).
4. Xác nhận `npm run build` PASS 100% nếu có đổi code Next.js (mục 4).
