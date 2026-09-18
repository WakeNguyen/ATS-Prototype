# QA REPORT — Xác Nhận Vá Bug SNAP-83 (Bulk Assign Modal, Callback Upsert, Dead Code) + Xác Nhận Guard Cron

**Từ:** Claude (Architect/QA)
**Ngày:** 2026-09-05
**Đối chiếu với:** `docs/testing/QA_2026-09-05_campaign-fb-autopost_campaign-type-split-and-bulk-group-assign-review.md` và `docs/testing/QA_2026-09-05_campaign-fb-autopost_warmjoin-cron-lock-and-secret-hotfix-review.md`
**Commit AG:** `69f23a3` — DEVLOG ghi tại `SNAP-20260905-83`

---

## Kết quả: ✅ PASS — cả 3 việc trong SNAP-83 đúng, và phát hiện thêm 1 tin tốt: guard cron cấp bách (Mục 1, `SNAP-20260905-82`) **đã được vá trong CHÍNH commit này**, dù DEVLOG không nhắc tới

## 1. Bug field-name trong `AssignGroupsToCampaignsModal.js` — ĐÃ VÁ ĐÚNG

Đối chiếu diff `920f4fb..69f23a3`: `c.name` → `c.campaign_name || c.name`, `c.target_group_count` → `c.target_groups_count ?? c.target_group_count ?? 0`, thêm cả tìm theo `job_title`. Khớp chính xác khuyến nghị.

## 2. `fb_account_groups` — dữ liệu đã được khôi phục đúng, code đã thêm fallback field phòng thủ

Query lại DB xác nhận `sandbox.fb_account_groups` hiện có đúng 2 dòng, khớp 1-1 với 2 nhóm `social_group_urls.join_status = 'Joined'` của `acc_01` — đúng như DEVLOG mô tả ("đồng bộ lại 2 bản ghi"). Route callback cũng được thêm trích xuất field phòng thủ (`fbAccountId || fb_account_id || accountId`, tương tự cho `socialGroupId`). Lưu ý nhỏ: dữ liệu thật gửi từ node n8n `Process Bridge Warm Results` vốn đã dùng đúng camelCase (`fbAccountId`/`socialGroupId`) nên khả năng cao nguyên nhân gốc đúng như AG nêu là do **1 script dọn dẹp test trước đó xoá nhầm** bản ghi thật (không phải lỗi field-name) — phần thêm alias là phòng thủ hợp lý, không sai, chỉ không chắc là nguyên nhân gốc thật sự. Không ảnh hưởng kết quả: dữ liệu đã đúng, không cần làm gì thêm.

## 3. Dọn dẹp code chết — ĐÃ XONG SẠCH

Xác nhận `fbAccountsTab`, `warmJoinRuns`, `loadingWarmJoinRuns`, `loadWarmJoinHistory`, import `getWarmJoinRuns` đã bị xoá hoàn toàn khỏi `campaigns/page.js`. Bonus: polling sau khi warm xong giờ gọi `loadCampaignDetailData(selectedCampaignId)` thay vì hàm cũ — hợp lý hơn, đúng data model mới.

## 4. [Tin tốt, chưa được ghi nhận trong DEVLOG] Guard `no_active_warming_campaign` từ `SNAP-20260905-82` ĐÃ được vá trong CHÍNH commit `69f23a3`

Đọc trực tiếp `_acquireWarmJoinRunLock()` (dòng ~1463-1474): khi nhánh cron không tìm thấy Warming Campaign active nào, code giờ `return` sớm với `result = { success: false, error: 'no_active_warming_campaign', message: '...' }` — **trước khi** chạm tới bước resolve account/INSERT. Đối chiếu tiếp: route `warm-join-cron-register/route.js` đã có sẵn nhánh `else` generic trả về HTTP 200 cho bất kỳ lỗi nào không phải `already_running` — nên lỗi mới này cũng đi qua đúng đường trả về sạch (không phải HTTP 500). Phía n8n, node `Check Lock Acquired` chỉ kiểm tra `$json.success === true`, nên tự động xử lý đúng cho cả 2 lý do thất bại (`already_running` và `no_active_warming_campaign`) mà không cần sửa gì thêm ở n8n.

**Kết luận: bug cấp bách nhất (`SNAP-20260905-82`) đã được xử lý xong, không cần làm thêm gì.** Đề xuất duy nhất: bổ sung 1 dòng vào `SNAP-20260905-83` trong DEVLOG ghi nhận việc này (hiện đang bị bỏ sót trong tóm tắt), để lịch sử phản ánh đúng đầy đủ những gì đã sửa.

## Kết luận chung

Không còn việc gì cần vá thêm từ 2 vòng QA trước. Có thể yên tâm để Schedule Trigger tiếp tục chạy qua lượt 08:30 sáng mai.
