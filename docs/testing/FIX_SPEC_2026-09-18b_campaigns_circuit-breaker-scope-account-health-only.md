**Từ:** Claude (Architect/QA)

# FIX_SPEC_2026-09-18b — Circuit Breaker chỉ trip khi lỗi thật sự phản ánh TÀI KHOẢN có vấn đề

## Bối cảnh & quyết định đã chốt với PO

PO nêu: circuit breaker (gỡ account khỏi campaign sau khi Failed đủ ngưỡng) hiện đang áp dụng cho MỌI loại lỗi — nhưng chỉ nên áp dụng cho lỗi liên quan tới **phiên đăng nhập Facebook hết hạn**. Sau khi Claude phân tích trực tiếp 6 nhóm lỗi thật đã ghi nhận trong hệ thống (xem báo cáo trước đó cùng ngày), đã thống nhất mở rộng thêm 1 trường hợp PO có thể chưa để ý: **Facebook Checkpoint** — status này đã tồn tại sẵn trong hệ thống, là dấu hiệu account có vấn đề còn rõ ràng hơn cả session hết hạn, nhưng hiện tại **hoàn toàn không kích hoạt circuit breaker**.

**Quyết định cuối cùng**: Circuit breaker chỉ trip cho 2 loại sự kiện — (1) `status/action = 'Checkpoint'`, (2) `status/action = 'Failed'` VÀ `error_message` cho thấy rõ là lỗi session (hết hạn/cần đăng nhập lại/không tìm thấy file session). **KHÔNG trip** cho: lỗi UI selector (Could not find text editor/composer), lỗi network/timeout (socket hang up, page.goto timeout), lỗi "chưa là thành viên group" — các lỗi này không phản ánh account có vấn đề, mà là bug code/mạng/dữ liệu targeting.

## Đã xác nhận qua đọc trực tiếp code (KHÔNG suy diễn)

- `_maybeTripCircuitBreaker(sqlTx, campaignId, fbAccountId, failedCount, triggerType)` (`src/app/campaign_actions.js:661`): trip khi `failedCount >= 3`, xoá dòng khỏi `campaign_fb_accounts`, ghi `campaign_account_circuit_breaker_log`. **Không cần sửa hàm này** — vấn đề nằm ở 2 nơi GỌI nó, tự tính sai `failedCount` (đếm mọi `status = 'Failed'` bất kể lý do).
- `src/app/api/webhooks/campaign-run-progress/route.js:59-81`: khối `if (status === 'Failed' && fbAccountId)` (dòng 61-72) đếm TẤT CẢ `status = 'Failed'` rồi gọi breaker — không lọc theo `error_message`. Khối `if (status === 'Checkpoint' && fbAccountId)` (dòng 75-81) CHỈ update `fb_accounts.status`, **không gọi breaker** — đây là lỗ hổng cần vá theo quyết định trên.
- `src/app/api/webhooks/warm-join-run-progress/route.js`: cùng pattern — khối Checkpoint (dòng 52-58) không gọi breaker; khối breaker (dòng 140-152) đếm mọi `action = 'Failed'` (account-level `accountAction` HOẶC group-level `groupItems[].action`) không lọc lý do.
- **Không có bảng lỗi nào là ENUM cứng** — `campaign_run_items.status` và `warm_join_run_items.action` đều kiểu `text` thường (đã verify qua `information_schema.columns`), nên **KHÔNG cần migration DB** cho thay đổi này — chỉ là logic tầng application.
- Chuỗi lỗi session thật sự đã ghi nhận trong hệ thống (đọc trực tiếp `public.campaign_run_items`/`warm_join_run_items`):
  - `"Facebook session expired or login required for account [acc_01]."` / `[acc_02]` (Warming, 21 lần)
  - `"fb-session.json not found for account \"...\". Please run \"node save-session.js ...\" first."` (Job Posting, 2 lần)

## Phạm vi — CHỈ 3 file, KHÔNG migration DB

1. `src/app/campaign_actions.js` — thêm 1 hàm helper mới, export.
2. `src/app/api/webhooks/campaign-run-progress/route.js` — sửa điều kiện trip.
3. `src/app/api/webhooks/warm-join-run-progress/route.js` — sửa điều kiện trip.

**Không đụng** `_maybeTripCircuitBreaker` (giữ nguyên), không đụng ngưỡng `>= 3` (giữ nguyên, kể cả cho Checkpoint — xem "Lưu ý thiết kế" bên dưới), không đụng bảng `campaign_account_circuit_breaker_log` hay dữ liệu breaker log cũ đã có từ trước (đây là thay đổi hành vi CHO CÁC LẦN CHẠY TIẾP THEO, không "hoàn tác" các lần trip cũ theo logic cũ — PO không yêu cầu việc đó).

## Lưu ý thiết kế (đã cân nhắc, giữ nguyên ngưỡng — không tự ý đổi)

Checkpoint là tín hiệu account có vấn đề khá nghiêm trọng — về lý thuyết có thể lập luận nên trip ngay từ lần đầu tiên thay vì chờ đủ 3. Quyết định trong spec này: **VẪN giữ ngưỡng `>= 3` thống nhất cho cả 2 loại sự kiện** (đếm gộp Checkpoint + Failed-do-session), để thay đổi ở mức tối thiểu, dễ kiểm chứng, và nhất quán với cơ chế hiện có. Nếu sau khi test PO thấy ngưỡng này chưa hợp lý (ví dụ muốn Checkpoint trip ngay lần 1), đây sẽ là 1 quyết định RIÊNG cần PO xác nhận thêm, không tự ý làm trong spec này.

## Chi tiết triển khai

### A. `src/app/campaign_actions.js` — thêm hàm helper mới

Đặt ngay TRƯỚC `_maybeTripCircuitBreaker` (dòng ~655), export để 2 webhook route import dùng:

```js
/**
 * Nhận diện lỗi 'Failed' có thật sự phản ánh TÀI KHOẢN có vấn đề (cần con người đăng
 * nhập lại) hay không — dùng để lọc sự kiện tính vào ngưỡng trip circuit breaker.
 * KHÔNG tính lỗi UI selector/network/timeout/"chưa join group" (không phải lỗi account,
 * xem FIX_SPEC_2026-09-18b). Khớp CHÍNH XÁC với điều kiện ILIKE dùng trong 2 webhook
 * route (campaign-run-progress, warm-join-run-progress) — sửa ở đây thì PHẢI sửa đồng
 * bộ cả 2 nơi đó.
 */
export function isAccountHealthFailure(errorMessage) {
  if (!errorMessage) return false;
  const msg = String(errorMessage).toLowerCase();
  return (
    msg.includes('session expired') ||
    msg.includes('login required') ||
    msg.includes('fb-session.json not found')
  );
}
```

### B. `src/app/api/webhooks/campaign-run-progress/route.js`

Import thêm ở đầu file (dòng 3, cạnh `_maybeTripCircuitBreaker`):
```js
import { _maybeTripCircuitBreaker, isAccountHealthFailure } from '../../../campaign_actions.js';
```

Thay khối dòng 59-72 (giữ NGUYÊN khối "2. If Checkpoint..." ngay sau, dòng 74-81, không đổi):

```js
      // 1b. Circuit breaker: CHỈ tính các sự kiện phản ánh TÀI KHOẢN thật sự có vấn đề
      // (Facebook Checkpoint, hoặc Failed do session hết hạn/cần đăng nhập lại) — KHÔNG
      // tính lỗi UI selector/network/timeout/"chưa join group" (xem FIX_SPEC_2026-09-18b).
      // Đếm lại tổng số sự kiện thuộc 2 loại trên của account này TRONG campaign này,
      // trip (gỡ thật khỏi campaign_fb_accounts + log) nếu >= 3.
      const isAccountHealthEvent = status === 'Checkpoint' || (status === 'Failed' && isAccountHealthFailure(errorMessage));
      if (isAccountHealthEvent && fbAccountId) {
        const [{ campaign_id: breakerCampaignId }] = await sqlTx`
          SELECT campaign_id FROM campaign_runs WHERE id = ${runId}
        `;
        const [{ cnt: failedCount }] = await sqlTx`
          SELECT COUNT(*)::int AS cnt
          FROM campaign_run_items
          WHERE run_id IN (SELECT id FROM campaign_runs WHERE campaign_id = ${breakerCampaignId})
            AND fb_account_id = ${fbAccountId}
            AND (
              status = 'Checkpoint'
              OR (status = 'Failed' AND (
                error_message ILIKE '%session expired%'
                OR error_message ILIKE '%login required%'
                OR error_message ILIKE '%fb-session.json not found%'
              ))
            )
        `;
        await _maybeTripCircuitBreaker(sqlTx, breakerCampaignId, fbAccountId, failedCount, 'job_posting');
      }
```

### C. `src/app/api/webhooks/warm-join-run-progress/route.js`

Import thêm ở đầu file (dòng 3):
```js
import { _maybeTripCircuitBreaker, isAccountHealthFailure } from '../../../campaign_actions.js';
```

Thay khối dòng 140-152 (`hasFailedThisCall` + breaker call) — GIỮ NGUYÊN khối Checkpoint account-status ở dòng 52-58 phía trên, không đổi:

```js
      // Circuit breaker: CHỈ tính các sự kiện phản ánh TÀI KHOẢN thật sự có vấn đề
      // (Checkpoint, hoặc Failed do session hết hạn) ở CẢ account-level (accountAction)
      // lẫn group-level (groupItems[].action) trong lượt gọi này — KHÔNG tính lỗi khác
      // (xem FIX_SPEC_2026-09-18b). Đếm lại tổng số sự kiện thuộc 2 loại trên của account
      // này TRONG campaign này, trip nếu >= 3.
      const isAccountHealthEventThisCall =
        accountAction === 'Checkpoint' ||
        (accountAction === 'Failed' && isAccountHealthFailure(accountErrorMessage)) ||
        groupItems.some(g => g.action === 'Checkpoint' || (g.action === 'Failed' && isAccountHealthFailure(g.errorMessage)));

      if (isAccountHealthEventThisCall && fbAccountId && run?.campaign_id) {
        const [{ cnt: failedCount }] = await sqlTx`
          SELECT COUNT(*)::int AS cnt
          FROM warm_join_run_items
          WHERE run_id IN (SELECT id FROM warm_join_runs WHERE campaign_id = ${run.campaign_id})
            AND fb_account_id = ${fbAccountId}
            AND (
              action = 'Checkpoint'
              OR (action = 'Failed' AND (
                error_message ILIKE '%session expired%'
                OR error_message ILIKE '%login required%'
                OR error_message ILIKE '%fb-session.json not found%'
              ))
            )
        `;
        await _maybeTripCircuitBreaker(sqlTx, run.campaign_id, fbAccountId, failedCount, 'warming');
      }
```

Giữ nguyên vị trí khối này (sau khi `run` được fetch ở dòng 131-138, đúng như hiện tại).

## Việc KHÔNG được làm

- Không sửa `_maybeTripCircuitBreaker`, không đổi ngưỡng `>= 3`.
- Không migration DB — không cần, cột đã là `text` tự do.
- Không đụng dữ liệu `campaign_account_circuit_breaker_log` cũ đã có.
- Không thêm status/action mới ngoài dùng lại `'Checkpoint'` đã có sẵn.

## Verify bắt buộc trước khi báo hoàn thành

1. `node --check src/app/campaign_actions.js src/app/api/webhooks/campaign-run-progress/route.js src/app/api/webhooks/warm-join-run-progress/route.js` → PASS.
2. **Test HTTP E2E trên môi trường `development`** (KHÔNG production — dùng `sandbox` schema qua `body.environment: 'sandbox'`, tự tạo campaign/run/account test cô lập theo mục 10.8 GEMINI.md, dọn sạch sau khi test xong). Viết script test (kiểu `test_circuit_breaker_http.mjs` đã có tiền lệ ở `SNAP-182`) gọi trực tiếp `POST /api/webhooks/campaign-run-progress` và `POST /api/webhooks/warm-join-run-progress` trên URL deploy `development` (không phải `localhost`, để test đúng code đã deploy), kiểm tra đủ các kịch bản:
   - **Kịch bản A (không được trip)**: gửi 3-5 lần `status: 'Failed', errorMessage: 'Could not find text editor in post dialog.'` cho cùng 1 account test → xác nhận account **VẪN CÒN** trong `campaign_fb_accounts` sau đó (không bị gỡ), `campaign_account_circuit_breaker_log` không có dòng mới.
   - **Kịch bản B (phải trip)**: gửi 3 lần `status: 'Failed', errorMessage: 'Facebook session expired or login required for account [acc_test].'` cho 1 account test khác → xác nhận đến lần thứ 3 account **BỊ GỠ** khỏi `campaign_fb_accounts`, có dòng mới trong `campaign_account_circuit_breaker_log`.
   - **Kịch bản C (Checkpoint phải trip)**: gửi 3 lần `status: 'Checkpoint'` cho 1 account test thứ 3 → xác nhận trip đúng sau lần thứ 3.
   - **Kịch bản D (trộn lẫn, xác nhận đếm đúng)**: 1 account test thứ 4 nhận 2 lần lỗi UI-selector (không tính) + 2 lần Checkpoint (có tính) → xác nhận CHƯA trip (mới đếm 2/3 hợp lệ), gửi thêm 1 lần Checkpoint nữa → trip đúng lần thứ 3.
   - Lặp lại tương tự tối thiểu 1 kịch bản (chọn 1 trong 4 ở trên) cho Warming (`warm-join-run-progress`) để xác nhận cả 2 route đều hoạt động đúng.
   - Dọn sạch toàn bộ dữ liệu test (campaign/run/account/breaker log) sau khi xong.
3. `npm run build` → PASS 100% routes.

## Tài liệu

Thêm 1 mục mới vào `docs/DEVELOPMENT_LOG.md` theo template mục 10.3 — liệt kê rõ 3 file đã sửa và kết quả từng kịch bản test A/B/C/D.

Báo cáo hoàn thành kèm `git status`, `git diff --stat`, `npm run build`, kết quả từng kịch bản test (PASS/FAIL rõ ràng), xác nhận đã dọn dữ liệu test. Nếu có sai lệch so với spec, ghi theo mục 10.7 GEMINI.md.
