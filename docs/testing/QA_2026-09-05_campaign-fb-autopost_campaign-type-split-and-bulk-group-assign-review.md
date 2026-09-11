# QA REPORT — FIX_SPEC: Campaign Type Split, Warming Detail Panel & Bulk Social Group Assign

**Từ:** Claude (Architect/QA)
**Ngày:** 2026-09-05
**Đối chiếu với:** `docs/testing/FIX_SPEC_2026-09-05_campaign-fb-autopost_campaign-type-split-and-bulk-group-assign.md`
**Commit AG:** `920f4fb` (code) — DEVLOG ghi nhận tại `SNAP-20260905-79`
**Phương pháp:** đọc trực tiếp `git diff 29b574c 920f4fb` cho toàn bộ file thay đổi, đọc definition thật của n8n Workflow C qua MCP, tra lịch sử execution thật, và query read-only DB (`sandbox`) để đối chiếu số liệu thực tế sau lượt chạy E2E thật. Không sửa code/DDL/n8n nào.

---

## Kết quả: ⚠️ PASS CÓ ĐIỀU KIỆN — Kiến trúc cốt lõi đúng, nhưng có 2 bug cụ thể cần vá + 1 việc quan trọng vẫn còn treo từ vòng trước

## 1. [Bug — Cao] Sai tên field trong `AssignGroupsToCampaignsModal.js` — hiển thị tên Campaign trống, search theo tên không hoạt động, đếm nhóm luôn = 0

`getCampaigns()` trả về field `campaign_name` và `target_groups_count` (xác nhận trực tiếp trong `SELECT` của `campaign_actions.js`). Modal mới `AssignGroupsToCampaignsModal.js` lại dùng sai tên field ở **cả 2 chỗ**:

- Dòng 81: lọc search dùng `c.name?.toLowerCase()...` — nhưng object không có field `name`, chỉ có `campaign_name`. Do cú pháp optional chaining, biểu thức không crash mà âm thầm trả về `undefined`, khiến **search theo tên Campaign hoàn toàn không hoạt động** (chỉ còn lọc được theo `channel`).
- Dòng 299: hiển thị `{c.name}` trong danh sách — sẽ hiện **trống/rỗng** cho mọi dòng campaign trong modal này.
- Dòng ~316: `{c.target_group_count || 0}` — sai tên số nhiều/số ít (đúng phải là `target_groups_count`) — cột "Current Groups" sẽ luôn hiện `0` dù campaign đã có nhóm.

Đối chiếu: Master Table chính ở `campaigns/page.js` (dòng 1156, 1199) đã xử lý đúng bằng fallback `c.campaign_name || c.name` và `c.target_groups_count ?? c.target_group_count ?? ...` — tức là pattern phòng thủ này ĐÃ tồn tại sẵn trong codebase nhưng không được áp dụng khi viết modal mới. Đây là bug cụ thể, dễ tái hiện 100% (mở modal "Add to Campaign..." bất kỳ lúc nào sẽ thấy ngay danh sách campaign không có tên).

## 2. [Bug — Trung bình] `fb_account_groups` không được ghi nhận sau lượt chạy E2E thật, dù `social_group_urls.join_status` đã cập nhật đúng

Đối chiếu dữ liệu thật sau lượt chạy execution `473` (webhook, `status: success`, thật sự nuôi + xin vào nhóm cho `acc_01`):

- `fb_accounts.last_warmed_at` của `acc_01` = `2026-09-05 14:34:29` — khớp đúng thời điểm execution 473 (14:29-14:32) → xác nhận run có thật, không phải giả lập.
- `social_group_urls` có đúng **2 dòng** `join_status = 'Joined'` → xác nhận việc xin vào nhóm thật sự thành công và được ghi nhận đúng phía bảng này.
- Nhưng bảng **`fb_account_groups` (sandbox) hiện đang 0 dòng** — tức bước "upsert `fb_account_groups` khi Joined" (yêu cầu ở PHẦN 5 mục 5 của FIX_SPEC) **không được ghi nhận**, dù `social_group_urls` cùng luồng callback đã ghi đúng.

Mức độ rủi ro thực tế: do node `Smart Group Allocator` lọc `eligibleGroups` dựa trên `join_status !== 'Joined'` (đọc từ `social_group_urls`, đã đúng), nên 2 nhóm này vẫn sẽ được loại khỏi các lượt chạy sau — rủi ro trực tiếp (cố join lại) hiện KHÔNG xảy ra. Tuy vậy, đây vẫn là sai lệch so với spec: `fb_account_groups` là nguồn dữ liệu dùng để loại trừ theo **cặp (account, group)** cụ thể (khác với `join_status` chỉ loại trừ theo group nói chung) — quan trọng khi nhiều account khác nhau có thể nhắm cùng 1 nhóm. Cần AG kiểm tra lại đoạn code upsert trong `warm-join-run-callback/route.js` (có thể lỗi phát sinh khi PHẦN 5 sửa node `Process Bridge Warm Results` để vá lỗi parse JSON string — cấu trúc `items[]` gửi lên có thể đã đổi field mà route callback chưa cập nhật theo).

## 3. [Dọn dẹp — Thấp] Code chết còn sót lại: sub-tab lịch sử Warm & Join cũ trong tab "FB Accounts"

Spec (PHẦN 3.2) yêu cầu xoá bỏ hoàn toàn sub-tab "Warm & Join Execution History" khỏi tab FB Accounts. Thực tế: nút bấm chuyển sang sub-tab đó đã bị xoá đúng (`setFbAccountsTab` không còn được gọi ở đâu khác ngoài khai báo `useState`, nên `fbAccountsTab` mãi mãi là `"accounts"` — **không có bug sống, người dùng không thể vào được view cũ**). Tuy nhiên state `fbAccountsTab`, hàm `loadWarmJoinHistory()` và nhánh `if (fbAccountsTab === "warm_join_history")` vẫn còn trong code, và bên trong nó gọi `getWarmJoinRuns(30)` — sai với chữ ký hàm mới `getWarmJoinRuns(campaignId = null, limit = 20)` (số `30` sẽ bị hiểu nhầm là `campaignId`, gây lỗi kiểu dữ liệu uuid nếu đoạn code này từng được kích hoạt lại). Không ảnh hưởng người dùng hiện tại, nhưng nên dọn để tránh nợ kỹ thuật/lỗi tái phát sau này.

## 4. [Nhắc lại — Quan trọng] Hotfix concurrency + hardcoded secret từ vòng QA trước VẪN CHƯA xong

Kiểm tra lại trực tiếp qua n8n MCP: node "Schedule Trigger" của Workflow C hiện `"disabled": true` — tức chỉ có **PHẦN 1 (tắt tạm cron)** của `FIX_SPEC_2026-09-05_campaign-fb-autopost_warmjoin-cron-lock-and-secret-hotfix.md` được thực hiện. Node "Validate Internal Secret" vẫn giữ nguyên y hệt logic bypass cron cũ, và cả 3 secret (`x-internal-secret` x2, VPS bridge secret) vẫn hardcode plaintext y hệt trước — PHẦN 2-4 của hotfix đó chưa được làm. Vì Schedule Trigger đang tắt nên rủi ro concurrency hiện KHÔNG xảy ra, nhưng **không được bật lại cron cho tới khi PHẦN 2-4 hoàn tất** — cần nhắc lại rõ với AG để không bị quên khi tiếp tục các việc khác.

## 5. Việc đã xác nhận ĐÚNG

- **DB**: schema `campaign_type` + `warm_join_runs.campaign_id` hoạt động đúng, `campaigns`/`warm_join_runs`/`warm_join_run_items`/`campaign_social_groups`/`campaign_fb_accounts` hiện đều sạch (0 dòng) ở sandbox sau dọn dẹp — không có rác dữ liệu test còn sót (ngoại trừ vấn đề Mục 2).
- **Backend `campaign_actions.js`**: `createCampaign`/`updateCampaign` validate đúng giá trị `campaign_type`, khoá immutable đúng theo yêu cầu (kiểm tra tồn tại run ở CẢ `campaign_runs` lẫn `warm_join_runs` trước khi cho đổi type); `getCampaigns` filter theo `campaign_type` đúng; `triggerCampaignRun` có guard chặn campaign không phải Job Posting; `triggerWarmJoinRun(campaignId, params)` resolve đúng account pool từ `campaign_fb_accounts` (fallback về Active accounts khi pool rỗng) và resolve đúng target groups từ `campaign_social_groups`, gửi đúng `campaignId` + `targetGroups` sang webhook n8n; `bulkAssignSocialGroupsToCampaigns` dùng `unnest` + `ON CONFLICT DO NOTHING` đúng, đếm `insertedCount`/`alreadyLinkedCount` chính xác qua `RETURNING`, có batch 500 cặp/lần hợp lý.
- **UI**: field "Loại Campaign" đúng là field đầu tiên trong modal, bị khoá (`disabled`) kèm chú thích rõ ràng khi campaign đã có run; nút "Run Warm & Join" + Run History đúng chỉ xuất hiện trong Detail Panel của campaign `campaign_type === 'Warming'`, không còn ở tab FB Accounts (đã đổi tên đúng thành "FB Accounts"); Master Table có cột Type badge + filter dropdown.
- **n8n Workflow C**: node `Smart Group Allocator & Dispatcher` đã đúng theo spec — dùng `triggerContext.targetGroups` làm nguồn DUY NHẤT khi có (Warming Campaign từ ATS UI), fallback về `warmData.targetGroups` (đường cron/legacy) khi không có — đọc trực tiếp source code node xác nhận đúng.
- **Bằng chứng E2E thật mạnh hơn vòng trước**: execution `473` (`status: success`) là lượt chạy thật, có bằng chứng cụ thể trong DB (`last_warmed_at` cập nhật, `join_status` 2 nhóm chuyển `Joined`) — khác hẳn tuyên bố PASS không có bằng chứng ở `SNAP-20260905-76` trước đây. Đáng ghi nhận là lần này AG đã thực sự sửa đúng vấn đề #2 của QA trước.

## Khuyến nghị hành động

1. Vá Mục 1 (field name trong `AssignGroupsToCampaignsModal.js`) — sửa nhanh, rủi ro thấp, nên làm ngay vì đây là tính năng người dùng sẽ dùng thường xuyên.
2. Điều tra + vá Mục 2 (`fb_account_groups` upsert) — cần AG đọc lại `warm-join-run-callback/route.js` đối chiếu với cấu trúc `items[]` mới nhất mà node `Process Bridge Warm Results` gửi lên sau khi sửa PHẦN 5.
3. Dọn Mục 3 (xoá hẳn code chết `fbAccountsTab`/`loadWarmJoinHistory`) khi tiện — không khẩn cấp.
4. Hoàn tất Mục 4 (PHẦN 2-4 của hotfix cron/secret) TRƯỚC khi bật lại Schedule Trigger — đây vẫn là việc quan trọng nhất còn treo, không liên quan gì tới campaign_type nhưng có rủi ro vận hành thật nếu bị quên.
5. Sau khi vá Mục 1-2, nên test lại đúng luồng: chọn vài Social Group, bấm "Add to Campaign...", xác nhận tên + số nhóm hiện đúng, gán thử, xác nhận `insertedCount` tăng đúng và không tăng khi gán lặp lại (idempotent).

## Kết luận

Phần lớn công sức PHẦN 1-5 của FIX_SPEC `campaign_type` được làm đúng và chắc chắn hơn hẳn vòng trước (đặc biệt là có bằng chứng E2E thật thay vì tuyên bố suông). Hai bug tìm được đều nhỏ, khoanh vùng rõ, không phải lỗi kiến trúc. Việc cần chú ý nhất vẫn là Mục 4 — dễ bị quên vì không nằm trong phạm vi commit `920f4fb`, nhưng là điều kiện tiên quyết trước khi cho hệ thống Warming chạy tự động trở lại.
