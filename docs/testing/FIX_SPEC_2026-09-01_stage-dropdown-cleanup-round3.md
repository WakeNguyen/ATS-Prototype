# Fix Spec — 2026-09-01 (round 3): dọn nốt các dropdown Stage hard-code còn sót lại

**Từ:** Claude (Architect/QA)
**Gửi:** Antigravity (Implementer)

**Bối cảnh:** Sau khi round 1-2 của `FIX_SPEC_2026-09-01_stage-result-reason-refactor.md` được xác nhận hoàn thành 6/6, PO (Thức) chụp ảnh UI thực tế cho thấy dropdown "STAGE / ACTION TYPE" trên trang Action Menu (`/`) **vẫn còn** `Rejected`, `Failed Interview` trong nhóm "Offer & Closing" — tức là spec round 1-2 CHƯA dọn hết. Tôi (Claude) đã rà lại toàn bộ repo bằng grep và xác nhận đây là lỗi thật, do chính spec ban đầu của tôi chỉ chỉ rõ vị trí cần sửa trong `src/app/jobs/page.js`, quên chỉ rõ 2 vị trí tương tự trong `src/app/page.js`, và bỏ sót hẳn 1 dropdown thứ 3 trong `src/app/jobs/page.js` (form "Edit Log" — khác với form "Add Log" đã sửa ở round 1). Lỗi này là của spec, không phải AG làm sai — round 1-2 AG làm đúng 100% những gì spec yêu cầu.

**Tôi đã grep toàn bộ `src/` để liệt kê ĐẦY ĐỦ mọi nơi còn sót — dưới đây là danh sách chốt, không còn chỗ nào khác** (đã kiểm tra: `src/app/candidates/page.js` ĐÃ đúng từ trước, dùng thẳng `CANDIDATE_STAGES_LIST.map(...)` không hard-code, KHÔNG cần sửa):

## Việc 1 — `src/app/page.js`, dòng ~1095-1119 (form "Add New Log", optgroup "Sourcing & Applications" / "Assessment & Interview" / "Offer & Closing")

Hiện tại (nguyên văn):
```jsx
<optgroup label="Sourcing & Applications">
  <option value="Received CV">Received CV</option>
  <option value="Talent Mapping">Talent Mapping</option>
  <option value="Contact">Contact / Reach Out</option>
  <option value="Waiting for CV">Waiting for CV</option>
</optgroup>
<optgroup label="Assessment & Interview">
  <option value="Send CV To AH/Client">Send CV to Client</option>
  <option value="Sending Test">Sending Test</option>
  <option value="Submit Test">Submit Test</option>
  <option value="1st Interview">1st Interview</option>
  <option value="2nd Interview">2nd Interview</option>
  <option value="Additional Interview">Additional Interview</option>
  <option value="Final Interview">Final Interview</option>
  <option value="Feedback">Feedback</option>
  <option value="Chasing Feedback">Chasing Feedback</option>
</optgroup>
<optgroup label="Offer & Closing">
  <option value="Offer">Offer</option>
  <option value="Onboard">Onboard</option>
  <option value="Rejected">Rejected</option>
  <option value="Failed Interview">Failed Interview</option>
  <option value="Reject Offer">Reject Offer</option>
  <option value="Withdraw Interview Process">Withdraw Process</option>
</optgroup>
```

Thay bằng render động từ `CANDIDATE_STAGES_LIST` (đã đúng 15 giá trị, đúng thứ tự 3 nhóm 4+9+2 kể từ round 1), y hệt pattern đã áp dụng đúng ở `src/app/jobs/page.js` dòng ~2962-2970:
```jsx
<optgroup label="Sourcing & Applications">
  {CANDIDATE_STAGES_LIST.slice(0, 4).map(stage => <option key={stage} value={stage}>{stage}</option>)}
</optgroup>
<optgroup label="Assessment & Interview">
  {CANDIDATE_STAGES_LIST.slice(4, 13).map(stage => <option key={stage} value={stage}>{stage}</option>)}
</optgroup>
<optgroup label="Offer & Closing">
  {CANDIDATE_STAGES_LIST.slice(13).map(stage => <option key={stage} value={stage}>{stage}</option>)}
</optgroup>
```
Import `CANDIDATE_STAGES_LIST` từ `src/constants/enums.js` ở đầu file nếu `page.js` chưa import (kiểm tra lại — round 1 đã import `APPLICATION_RESULTS_LIST, FAILURE_REASONS_LIST` từ file này rồi, chỉ cần thêm `CANDIDATE_STAGES_LIST` vào cùng dòng import).

## Việc 2 — `src/app/page.js`, dòng ~1202-1226 (form "Edit Log", 3 optgroup y hệt cấu trúc Việc 1)

Nội dung hiện tại giống hệt Việc 1 (đây là bản sao cho form sửa 1 log đã có sẵn thay vì thêm log mới). Áp dụng ĐÚNG cách sửa y hệt Việc 1 (cùng đoạn `CANDIDATE_STAGES_LIST.slice(...)` 3 dòng).

## Việc 3 — `src/app/jobs/page.js`, dòng ~3025-3044 (form "Edit Log" trong Action Notes Timeline — KHÁC với form "Add Log" đã sửa ở round 1 tại dòng ~2962)

Đây là dropdown thứ 3 bị bỏ sót hoàn toàn — vẫn giữ nguyên bản gốc chưa từng sửa (không có optgroup, phẳng, còn cả `"Call"`, `"1st interview"`/`"2nd interview"` chữ thường, `"Reject"` — những giá trị này chưa từng tồn tại trong enum):
```jsx
<option value="Received CV">Received CV</option>
<option value="Talent Mapping">Talent Mapping</option>
<option value="Contact">Contact / Reach Out</option>
<option value="Call">Call</option>
<option value="Send CV To AH/Client">Send CV to Client</option>
<option value="1st interview">1st Interview</option>
<option value="2nd interview">2nd Interview</option>
<option value="Feedback">Feedback</option>
<option value="Offer">Offer</option>
<option value="Onboard">Onboard</option>
<option value="Failed Interview">Failed Interview</option>
<option value="Reject">Reject</option>
```
Thay bằng ĐÚNG cấu trúc 3 optgroup dùng `CANDIDATE_STAGES_LIST` y hệt Việc 1/2 (thêm 3 thẻ `<optgroup>` bao ngoài, dùng đúng 3 label "Sourcing & Applications" / "Assessment & Interview" / "Offer & Closing" cho nhất quán với 3 dropdown còn lại trong toàn bộ app).

## KHÔNG được đụng vào: `normalizeStage()` trong `src/app/page.js` (dòng ~223-249)

Hàm này dùng để hiển thị lại đúng giá trị của các log/action cũ đã lưu trong DB (kể cả log cũ có `action_type = "Rejected"`/`"Failed Interview"`/...). Nếu xoá các giá trị này khỏi mảng `standard` hoặc khỏi các nhánh so khớp mờ (`lower.includes("reject")`...), log cũ sẽ bị normalize sai thành `"Contact"` (nhánh fallback cuối hàm) khi hiển thị lại trong form Edit — làm sai lệch dữ liệu hiển thị của log lịch sử. Chỉ sửa 3 dropdown JSX ở Việc 1-3 (nơi liệt kê lựa chọn CHO NGƯỜI DÙNG CHỌN MỚI), giữ nguyên 100% logic bên trong `normalizeStage()`.

## Yêu cầu báo cáo

1. `git diff` đầy đủ của `src/app/page.js` và `src/app/jobs/page.js`.
2. Xác nhận đã tự `grep -rn "Failed Interview\|Reject Offer\|Withdraw Interview Process\|<option value=\"Rejected\"" src/ --include=*.js` sau khi sửa xong và dán lại kết quả — kết quả phải KHÔNG còn dòng nào nằm trong 1 thẻ `<option>` (chỉ được phép còn xuất hiện bên trong logic của `normalizeStage()` như đã nêu ở trên).
3. Thao tác tay: mở `/` (Action Menu), bấm mở dropdown "STAGE / ACTION TYPE" ở form thêm log mới → xác nhận nhóm "Offer & Closing" chỉ còn đúng 2 lựa chọn `Offer`, `Onboard`. Lặp lại tương tự cho form Edit 1 log đã có, và cho `/jobs` → mở 1 Application → Edit 1 Action Note đã có.
4. `/api/qa-test`, `/api/db-test`, `/api/biz-test` — dán JSON thô, không được có regression.
5. Cập nhật `DEVELOPMENT_LOG.md` theo template mục 10.3 như thường lệ (entry mới, không sửa đè entry cũ).
