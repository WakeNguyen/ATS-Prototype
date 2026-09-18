**Từ:** Claude (Architect/QA)

# QA Verification — 4 mục trong list "Những lỗi cần cải thiện": #1, #2, #3, #9

**Ngày:** 2026-09-13
**Kết quả:** ✅ PASS toàn bộ 4 mục — verify bằng đọc trực tiếp code sau khi Antigravity triển khai,
và 1 lần chạy thử thật hàm `normalizeContactValue` (không qua báo cáo suông).

## 1. Campaign Details bị chật (`src/app/campaigns/page.js`)

Đọc trực tiếp xác nhận cả 3 thay đổi đúng spec:
- `overflow-hidden` → `overflow-x-hidden` trên Master Campaigns Table (dòng 1152).
- `max-h-16 overflow-y-auto` thêm vào container badge "Linked Job" (dòng 1238).
- `min-h-0` → `min-h-[360px]` trên Detail Expandable Panel (dòng 1348).

## 2. Timeline không tự chuyển khi đổi status dòng khác (`src/app/page.js`)

Đọc trực tiếp xác nhận nhánh `field === "status"` trong `handleInlineUpdate` (dòng 468-476) đã đổi
đúng: luôn gọi `selectRow({ application_id: applicationId })` sau khi cập nhật thành công, bất kể
dòng đó có đang được chọn hay không; vẫn giữ đúng logic lọc dòng khỏi bảng khi status mới khác
filter đang áp dụng.

## 3. Planning Date thiếu default Today() (`src/app/actions.js`)

Đọc trực tiếp xác nhận `createCandidateWithApplication()` (dòng 2107-2109) đã thêm cột
`planning_date` với giá trị `CURRENT_DATE` vào câu INSERT.

## 9. Trùng contact point khi append CV (dedup không chuẩn hoá)

**Sai lệch kỹ thuật đã ghi nhận đúng quy trình mục 10.7:** spec gốc yêu cầu export
`normalizeContactValue` trực tiếp từ `src/app/actions.js`, nhưng file đó có `"use server"` nên mọi
export bắt buộc phải là hàm async — build báo lỗi thật (`Server Actions must be async functions`).
Antigravity đã tự xử lý đúng: dời hàm sang `src/lib/utils.js` (nơi đã có sẵn helper dùng chung khác
như `stripAccents`, `formatDateVN`), giữ NGUYÊN 100% logic bên trong hàm.

- Đọc trực tiếp `src/lib/utils.js`: logic hàm khớp byte-for-byte với bản gốc.
- Đọc trực tiếp `hitl_actions.js` (dòng 184-201): nhánh dedup MERGE đã dùng
  `normalizeContactValue` cho cả 2 phía + lowercase `type` khi so khớp key.
- Đọc trực tiếp `cv-import/route.js` (dòng 24-49): đã thêm `phoneFormatVariants()` sinh biến thể
  `0xxx`/`+84xxx`/`84xxx`, đưa vào `checkValues` cho câu `= ANY(...)` hiện có (không đổi SQL).
- **Live test trực tiếp hàm** (không qua DB):
  ```
  normalizeContactValue('Phone', '0901234567')   -> '+84901234567'
  normalizeContactValue('phone', '+84901234567') -> '+84901234567'
  equal? true
  ```
  Xác nhận đúng: 2 định dạng số điện thoại khác nhau giờ được coi là TRÙNG, giải quyết đúng lỗi gốc
  ("trùng contact point khi append CV mới" do khác định dạng số điện thoại).

## Kết luận

Cả 4 mục PASS, có bằng chứng trực tiếp (code + live function test). Không phát sinh thay đổi ngoài
phạm vi spec.
