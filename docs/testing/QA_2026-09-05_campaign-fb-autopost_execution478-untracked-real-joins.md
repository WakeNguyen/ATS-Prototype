# QA REPORT — Phát Hiện Nghiêm Trọng: n8n Execution 478 Đã Join Thật 4 Nhóm FB Nhưng KHÔNG Được Ghi Vào DB + Lỗ Hổng Thiết Kế "Has RunId" Bỏ Qua Toàn Bộ Lock

**Từ:** Claude (Architect/QA)
**Ngày:** 2026-09-05
**Phát hiện trong lúc:** QA xác nhận fix `8684486` (đối chiếu `docs/testing/QA_2026-09-05_campaign-fb-autopost_warmjoin-cron-lock-and-secret-hotfix-review.md`) — khi tra lịch sử execution của Workflow C để xác nhận execution `479` (Schedule Trigger) dừng sạch, phát hiện thêm execution `478` (Webhook) ngay trước đó có kết quả bất thường.
**Nguồn dữ liệu:** `mcp__n8n__get_workflow_execution` (execution `478`, `includeData: true`, workflow `L8QdckqW7FDwanRq`), `mcp__n8n__get_workflow_details` (full), Supabase `sandbox` (read-only), đọc trực tiếp `src/app/api/webhooks/warm-join-data/route.js` — không sửa code/DB/n8n nào.

---

## Kết quả: 🚨 NGHIÊM TRỌNG — 4 nhóm Facebook đã được join THẬT bởi 2 tài khoản thật, nhưng DB hoàn toàn không biết, do lỗi callback + lỗ hổng thiết kế cho phép bỏ qua toàn bộ cơ chế lock vừa được vá ở `8684486`

## 1. Diễn biến execution `478`

- Trigger: `Webhook: Manual Trigger` (POST tới `warm-join-trigger`), thời điểm `2026-09-05T15:09:06.985Z` → `15:14:11.211Z` UTC (≈ 22:09–22:14 giờ VN), **status: error**.
- Body gửi vào webhook: `{"runId": "mock-test-prevent-run"}` — một chuỗi giả/placeholder, không phải UUID thật, không kèm `campaignId` hay `accountIds`.
- Vì `runId` không rỗng, node `Check Has RunId` rẽ thẳng sang `Fetch Warm Data from ATS 3.0`, **bỏ qua hoàn toàn** nhánh `Register Warm Join Run` → `_acquireWarmJoinRunLock` → `Check Lock Acquired` (toàn bộ cơ chế lock vừa được xây ở hotfix `4fbea27`/`8684486`).
- `Fetch Warm Data from ATS 3.0` gọi `GET /api/webhooks/warm-join-data` — route này (đọc trực tiếp code) **không hề nhận hay kiểm tra `runId`**, chỉ xác thực bằng secret cố định rồi trả về TOÀN BỘ tài khoản `status='Active'` và TOÀN BỘ nhóm `join_status != 'Joined'`. Không có khái niệm "run hợp lệ" ở tầng này.
- `Smart Group Allocator & Dispatcher` gán 2 nhóm/tài khoản cho cả `acc_02` và `acc_01` (4 lượt join tổng cộng) và dispatch sang VPS Bridge.
- `Call VPS Bridge: facebook-warm-join` chạy thật **301.7 giây**, Playwright thực thi trên VPS, trả về `success: true` với log thật: `acc_02` (fbAccountId `01a071c3-eb55-a4e0-8a64-e28098a8dbd5`) nuôi nick + gửi request join 2 nhóm; `acc_01` (fbAccountId `01a07096-5b5d-a5e9-a2c6-e50a356a7210`) nuôi nick (like post, scroll, xem thông báo) + gửi request join 2 nhóm khác. Cả 4 request join đều `"Join request submitted successfully"`.
- `Process Bridge Warm Results` build đúng `items` (2 "Warmed" + 4 "Joined") — chi tiết 4 nhóm đã join thật:

| Tài khoản | fbAccountId | socialGroupId | Tên nhóm | URL |
|---|---|---|---|---|
| `acc_02` (Nick Chính) | `01a071c3-eb55-a4e0-8a64-e28098a8dbd5` | `01a07018-9aab-99ee-bdf3-eff0510ccbd9` | TUYỂN DỤNG - VIỆC LÀM CƠ KHÍ BÌNH DƯƠNG | facebook.com/groups/tuyendung.vieclamcokhibinhduong/ |
| `acc_02` (Nick Chính) | `01a071c3-eb55-a4e0-8a64-e28098a8dbd5` | `01a07018-9aab-caac-9b7a-dfa0df3c0cd0` | Việc làm Cơ khí chính xác TP. HCM | facebook.com/groups/1545801293911020/ |
| `acc_01` (Nick Phụ Nguyen Thuy) | `01a07096-5b5d-a5e9-a2c6-e50a356a7210` | `01a07018-9aab-ec2e-940a-1c2b232fa5cf` | Việc làm cơ khí và dầu khí Miền Nam | facebook.com/groups/1269792077972281/ |
| `acc_01` (Nick Phụ Nguyen Thuy) | `01a07096-5b5d-a5e9-a2c6-e50a356a7210` | `01a07018-9aab-4220-813e-9e2de2168df7` | Tuyển Dụng Thợ Hàn _Thợ Cơ Khí _ Hỗ Trợ Tìm Kiếm Việc Làm | facebook.com/groups/1626191271203643/ |

- Bước cuối `POST warm-join-run-callback` **thất bại HTTP 500**: `"invalid input syntax for type uuid: \"mock-test-prevent-run\""` — vì route callback dùng thẳng `runId` từ body để tra/update dòng `warm_join_runs` mà không kiểm tra định dạng UUID trước.

## 2. Hậu quả — đã kiểm chứng lại DB `sandbox` ngay lúc viết report này, vẫn còn nguyên

Vì route callback lỗi 500 ngay khi chạm bước dùng `runId` làm UUID, **toàn bộ phần còn lại của quá trình ghi nhận cũng không chạy** (không phải chỉ riêng cập nhật `warm_join_runs`):

- `social_group_urls.join_status` của cả 4 nhóm trên: vẫn là `'Not Joined'` trong `sandbox` (không có trong `public`, hệ thống này chỉ vận hành ở `sandbox`).
- `sandbox.fb_account_groups`: vẫn chỉ có đúng 2 dòng cũ (từ backfill `SNAP-83`, thuộc `acc_01`) — không có dòng nào cho 4 lượt join mới này.
- `fb_accounts.last_warmed_at`: `acc_01` = `2026-09-05 14:34:29Z` (là dấu vết của lượt warm TRƯỚC, không phải execution 478); `acc_02` = `null` — xác nhận cả 2 tài khoản đều chưa được ghi nhận đã warm ở execution 478.
- Không có dòng `warm_join_runs`/`warm_join_run_items` nào tương ứng.

**Rủi ro cụ thể:** đây tái hiện và làm nặng hơn đúng lỗ hổng "dedup tracking gap" đã cảnh báo ở QA report gốc của hệ thống này — một lượt warm/join tương lai (kể cả cron 08:30 mai) có thể nhắm lại đúng 4 nhóm này (vì DB tưởng chưa join), khiến 2 tài khoản gửi request join trùng vào các nhóm đã join, tăng rủi ro bị Facebook đánh dấu spam/checkpoint.

## 3. Nguyên nhân — 2 lớp, cần xử lý cả hai

### 3a. [Bug, dễ vá] Callback route không validate định dạng `runId` trước khi query
`warm-join-run-callback/route.js` dùng thẳng `runId` (kiểu string tuỳ ý từ n8n) vào câu lệnh SQL thao tác cột `uuid`. Khi giá trị không phải UUID hợp lệ, Postgres ném lỗi cú pháp ngay từ câu query đầu tiên, kéo theo toàn bộ request 500 — kể cả phần cập nhật `social_group_urls`/`fb_account_groups`/`last_warmed_at` vốn dùng `fbAccountId`/`socialGroupId` (đều là UUID hợp lệ thật, không phụ thuộc `runId`) cũng bị mất theo vì nằm chung 1 request/transaction bị lỗi giữa chừng.

### 3b. [Lỗ hổng thiết kế, quan trọng hơn] Nhánh "Có `runId`" của n8n bỏ qua hoàn toàn cơ chế Register+Lock vừa xây ở hotfix
Thiết kế hiện tại giả định: nếu request có sẵn `runId`, nghĩa là ATS backend (qua `triggerWarmJoinRun()`) đã tự gọi `_acquireWarmJoinRunLock()` và tạo `warm_join_runs` hợp lệ TRƯỚC khi gọi webhook n8n — nên nhánh này không cần lock lại. Giả định này **không được n8n hay endpoint `GET /api/webhooks/warm-join-data` xác minh lại** — endpoint đó chỉ check secret, hoàn toàn bỏ qua `runId`, và trả về dữ liệu y hệt nhau (toàn bộ tài khoản Active + toàn bộ nhóm chưa join) bất kể `runId` có tồn tại thật trong `warm_join_runs` hay không, có hợp lệ hay không, hay có phải chuỗi test ngẫu nhiên hay không. Hệ quả: **bất kỳ ai gọi tay webhook `warm-join-trigger` (dù đã có header-auth `Je1dHcRXyZhrXODl` từ `8684486`) kèm một `runId` bất kỳ đều kích hoạt được 1 lượt nuôi nick + auto-join thật trên TẤT CẢ tài khoản Active, không qua bất kỳ advisory lock hay kiểm tra "đã có run đang chạy" / "có Warming Campaign active" nào** — đúng như những gì đã xảy ra ở execution `478`. Test "Webhook Header Auth" mà `SNAP-20260905-84` (AG) báo cáo PASS chỉ xác nhận secret đúng/sai, không phát hiện ra tác dụng phụ thật này của thân bài test.

## 4. Đề xuất khắc phục — 2 phần độc lập

**Phần A — Vá dữ liệu (backfill, khớp chính xác execution `478`):**
- `UPDATE sandbox.social_group_urls SET join_status='Joined', last_posted_account_id=<fbAccountId tương ứng> WHERE id IN (4 UUID nhóm ở bảng trên)`.
- `INSERT INTO sandbox.fb_account_groups (fb_account_id, social_group_id, joined_at) VALUES (...)` cho đúng 4 cặp ở bảng trên (dùng `ON CONFLICT DO NOTHING` như code hiện có).
- Cập nhật `sandbox.fb_accounts.last_warmed_at` cho cả `acc_01` và `acc_02` (mốc thời gian execution: `2026-09-05T15:14:11Z` hoặc thời điểm VPS Bridge hoàn tất).
- (Tuỳ chọn, không bắt buộc) tạo 1 dòng `warm_join_runs`/`warm_join_run_items` mang tính lịch sử cho execution `478` để dashboard warm-join history không có khoảng trống — không bắt buộc vì không ảnh hưởng logic dedup, chỉ ảnh hưởng tính đầy đủ của lịch sử hiển thị.

**Phần B — Vá code (ngăn tái diễn):**
1. `warm-join-run-callback/route.js`: validate `runId` đúng định dạng UUID trước khi dùng trong bất kỳ câu query nào liên quan `warm_join_runs`; tách rời phần cập nhật `social_group_urls`/`fb_account_groups`/`last_warmed_at` (dựa trên `fbAccountId`/`socialGroupId` — luôn là UUID hợp lệ) ra khỏi phần cập nhật `warm_join_runs` (dựa trên `runId`), để nếu `runId` không hợp lệ thì vẫn ghi nhận được kết quả join thật, chỉ riêng bản ghi `warm_join_runs` là không cập nhật được (và trả lỗi rõ ràng thay vì 500 lẫn lộn).
2. Cân nhắc thiết kế: nhánh "Có `runId`" trong n8n (`Check Has RunId` → `Fetch Warm Data`) nên xác minh `runId` tồn tại thật trong `warm_join_runs` (ví dụ gọi 1 route "verify-run" nhẹ, hoặc để `GET /api/webhooks/warm-join-data` nhận thêm `runId` qua query string và 404 nếu không tìm thấy run tương ứng) trước khi cho phép dispatch sang VPS Bridge — để việc gọi tay webhook với `runId` giả không còn khả năng kích hoạt hành động thật trên tài khoản Facebook thật.
3. Quy trình vận hành: không test thủ công webhook `warm-join-trigger` bằng `runId` giả khi hệ thống đang trỏ vào tài khoản Facebook thật — nếu cần test nhánh "Has RunId", nên dùng `campaignId`/`accountIds` rỗng kèm 1 cờ dry-run riêng (hiện chưa có), hoặc tạm trỏ `GET /api/webhooks/warm-join-data` sang dữ liệu test trong lúc kiểm thử.

## Kết luận

Không có gì cần chặn gấp trước cron 08:30 sáng mai riêng cho phát hiện này (guard `no_active_warming_campaign` ở `8684486` vẫn bảo vệ đúng nhánh KHÔNG có `runId`, tức nhánh cron thật). Nhưng nên xử lý Phần A (backfill) sớm để tránh cron/lượt warm kế tiếp join trùng 4 nhóm này, và Phần B (validate UUID + không test tay webhook bằng runId giả trên dữ liệu thật) nên làm trước khi AG tiếp tục test thủ công workflow này.

**Verify:** đọc trực tiếp toàn bộ dữ liệu execution `478` (bao gồm log Playwright thật) qua n8n MCP, đọc `get_workflow_details` (full) để xác nhận cấu trúc rẽ nhánh `Check Has RunId`, đọc trực tiếp `warm-join-data/route.js`, query read-only Supabase `sandbox` để xác nhận DB hiện vẫn chưa ghi nhận 4 lượt join này — không chạy code/DDL/DML nào.
