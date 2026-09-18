# QA REPORT — Hotfix: Cron Advisory Lock, Hardcoded Secrets & n8n Workflow C Update

**Từ:** Claude (Architect/QA)
**Ngày:** 2026-09-05
**Đối chiếu với:** `docs/testing/FIX_SPEC_2026-09-05_campaign-fb-autopost_warmjoin-cron-lock-and-secret-hotfix.md`
**Commit AG:** `4fbea27` — DEVLOG ghi nhận tại `SNAP-20260905-81`
**Phương pháp:** đọc trực tiếp `_acquireWarmJoinRunLock`/`warm-join-cron-register/route.js`/`triggerWarmJoinRun` trong `campaign_actions.js`, đọc definition đầy đủ mới nhất của n8n Workflow C qua MCP, tra lịch sử execution thật (bao gồm execution `476` mà AG dùng để test), query read-only DB. Không sửa code/DDL/n8n nào.

---

## Kết quả: ⚠️ PASS CÓ ĐIỀU KIỆN — Kiến trúc lock dùng chung đúng và đã verify được, nhưng có 1 bug crash cụ thể **sẽ xảy ra ở lượt cron kế tiếp** nếu không xử lý trước

## 1. [Bug — Cao, cấp bách] Cron sẽ crash với lỗi NOT NULL constraint nếu không có Warming Campaign nào đang active — và đây CHÍNH XÁC là trạng thái DB hiện tại

Đọc trực tiếp `_acquireWarmJoinRunLock()` (dòng ~1404-1591 `campaign_actions.js`): khi gọi từ nhánh cron (`campaignId = null`), hàm tìm 1 Warming Campaign đang active để gán (`SELECT ... WHERE campaign_type='Warming' AND is_active=true ORDER BY created_time ASC LIMIT 1`). **Nếu không tìm thấy campaign nào** (biến `campaign`/`resolvedCampaignId` giữ nguyên `null`), code **không dừng lại** — nó vẫn tiếp tục resolve account pool (fallback về toàn bộ Active accounts, hợp lý), rồi chạy thẳng tới:

```js
INSERT INTO warm_join_runs (campaign_id, status, trigger_source, ...)
VALUES (${resolvedCampaignId || null}, 'Running', ${triggerSource}, ...)
```

Nhưng `warm_join_runs.campaign_id` là `NOT NULL` (đã thêm ở FIX_SPEC `campaign_type` trước đó, FK tới `campaigns(id)`). INSERT này sẽ **ném lỗi ràng buộc DB**, lỗi văng lên tới route `warm-join-cron-register/route.js`, bị catch và trả về **HTTP 500**. Node `Register Warm Join Run` trong n8n Workflow C **không có `onError: continueRegularOutput`**, nên gặp response lỗi sẽ làm **cả execution thất bại** (`status: error`) — quay lại đúng triệu chứng ban đầu ("cron hay lỗi"), chỉ khác nguyên nhân gốc.

**Đối chiếu dữ liệu thật ngay lúc QA này**: query read-only xác nhận bảng `campaigns` hiện đang **0 dòng ở cả `public` và `sandbox`** (đã bị dọn sạch sau lượt E2E test ở `SNAP-20260905-79`). Nghĩa là **không có Warming Campaign nào đang active** — điều kiện lỗi ở trên đang đúng 100% với thực tế hiện tại. Lượt cron kế tiếp (08:30 sáng mai theo lịch `30 8,12,20 * * *`) **nhiều khả năng sẽ lỗi** trừ khi User tạo và active 1 Warming Campaign trước giờ đó.

Đối chiếu thêm: bài test race-condition mà AG dùng để verify (`execution 476`, `status: success`, 1.3s, khớp với mô tả "dừng sạch khi có run active") **không thể phát hiện ra bug này**, vì nhánh "already_running" được kiểm tra và trả về SỚM HƠN bước resolve campaign trong `_acquireWarmJoinRunLock` — tức test đó chỉ đi qua nhánh known-good, chưa từng test kịch bản "không có Warming Campaign nào cả" (rất có thể vì lúc AG test, campaign test từ PHẦN 5 E2E trước đó vẫn còn tồn tại trong DB, chưa bị dọn).

**Khuyến nghị vá**: thêm 1 guard sớm trong `_acquireWarmJoinRunLock` — nếu nhánh cron (`campaignId` truyền vào là `null`) mà không tìm được Warming Campaign active nào, trả về sớm `{ success: false, error: 'no_active_warming_campaign' }` (cùng pattern với `already_running`) thay vì tiếp tục chạy tới bước INSERT. Phía n8n, `Check Lock Acquired` đã có sẵn cơ chế dừng sạch khi `success: false` — chỉ cần đảm bảo lỗi này cũng đi qua đúng đường đó thay vì bị ném thành exception.

## 2. [Còn sót, mức thấp] 1 trong 4 chỗ hardcode secret vẫn còn — DEVLOG ghi "100%" chưa chính xác

3 node HTTP Request (`Fetch Warm Data from ATS 3.0`, `Call VPS Bridge`, `POST warm-join-run-callback`) đã chuyển đúng sang dùng Credential `httpHeaderAuth` (`Je1dHcRXyZhrXODl` và `wQ16G6l04h4gP5wF`) — xác nhận qua `get_workflow_details`, không còn thấy giá trị literal ở 3 node này. Tuy nhiên node code `Validate Internal Secret` (dùng để validate header của **webhook đến**, không phải request đi) vẫn giữ nguyên dòng `const expected = 'ats3_internal_webhook_secret_2026_token!';` — hardcode y hệt trước. `SNAP-20260905-81` ghi "thay thế 100% literal secrets bằng credential" — chưa chính xác, còn đúng 1/4 chỗ. Mức độ rủi ro thấp hơn 3 chỗ kia (chỉ đọc được nếu ai đó có quyền xem workflow definition, không phải secret gửi ra ngoài), nhưng nên vá cho triệt để: cách sạch nhất là chuyển node `Webhook: Manual Trigger` sang dùng cơ chế `Header Auth` có sẵn của chính n8n (`authentication: headerAuth` + Credential), thay vì tự check trong code — khi đó có thể xoá hẳn đoạn check thủ công này.

## 3. Việc đã xác nhận ĐÚNG

- **Kiến trúc lock dùng chung thật sự dùng chung**: đọc trực tiếp code xác nhận `triggerWarmJoinRun()` (đường UI) và route `warm-join-cron-register` (đường cron) đều gọi chung đúng 1 hàm `_acquireWarmJoinRunLock()` — không phải 2 đoạn logic viết riêng trông giống nhau. Đây là điểm mấu chốt nhất của hotfix và đã làm đúng.
- **Cơ chế dừng sạch khi đang có run active hoạt động đúng**: `execution 476` (manual, `status: success`, 1.3s, không có bước gọi VPS Bridge) khớp đúng với hành vi mong đợi khi `Check Lock Acquired` nhận `success: false` do `already_running`.
- **Cấu trúc workflow mới** (`Check Has RunId` → rẽ nhánh `Register Warm Join Run` → `Check Lock Acquired` → `Prepare Cron Context` → hợp nhất tại `Fetch Warm Data`) đúng theo thiết kế trong FIX_SPEC — nhánh webhook (đã có `runId` từ app) đi thẳng, không đăng ký lại lần 2, đúng như yêu cầu tránh double-registration.
- **3/4 secret** đã chuyển sang Credential đúng cách (Mục 2 nêu phần còn thiếu).
- **Đính chính DEVLOG cho `SNAP-20260905-76`** đã được thêm đúng, đúng vị trí, nội dung khớp với những gì Claude đề xuất.
- Schedule Trigger đã bật lại (`disabled: false`) — hợp lý về mặt trình tự (đã test race-condition trước khi bật), nhưng do Mục 1, việc bật lại này hiện đang mang rủi ro crash thật ở lượt chạy kế tiếp.

## Khuyến nghị hành động

1. **Ưu tiên cao nhất, nên làm trước giờ cron kế tiếp (08:30)**: vá Mục 1 — thêm guard `no_active_warming_campaign` trong `_acquireWarmJoinRunLock`. Đây là lỗi chắc chắn sẽ xảy ra với dữ liệu hiện tại, không phải giả định.
2. Phương án tạm thời song song (không thay thế Mục 1): User có thể tạo 1 Warming Campaign và bật `is_active = true` trước 08:30 để tránh crash trong lúc chờ vá — nhưng đây chỉ là né tránh, không phải fix, vì crash sẽ tái diễn bất cứ khi nào không có Warming Campaign active nào (ví dụ user tắt hết campaign).
3. Vá Mục 2 khi tiện — chuyển webhook trigger sang Header Auth credential có sẵn của n8n.
4. Sửa nhẹ câu chữ trong `SNAP-20260905-81` (từ "100%" thành "3/4", hoặc mô tả rõ node còn lại) — không khẩn, chỉ để log chính xác.

## Kết luận

Phần cốt lõi của hotfix (dùng chung 1 cơ chế lock cho cả 2 đường trigger) đã làm đúng và có bằng chứng test thật, không còn là "trông giống nhau" như rủi ro ban đầu. Nhưng bài test race-condition của AG bỏ sót đúng 1 nhánh — trường hợp không có Warming Campaign active — và đó lại là trạng thái DB thật ngay lúc này, nên cần vá Mục 1 trước khi tin tưởng để cron chạy tự động qua đêm.
