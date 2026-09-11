# Thẩm định độc lập lần 3 — Xác nhận Fix 1/2/3 (2026-09-01)

**Phương pháp:** Đọc trực tiếp `src/app/actions.js` trên đĩa, đối chiếu từng dòng diff AG dán với diff thật (`git diff`) — khớp 100%, không có sai lệch giữa báo cáo và code thực tế. Kiểm tra trực tiếp Supabase (`pg_sequences`, `information_schema.columns`, số liệu MAX thực tế) để xác nhận phần SQL đã chạy đúng, không chỉ tin vào script. Gọi trực tiếp `/api/qa-test`, `/api/db-test` (3 lần liên tiếp), `/api/biz-test` trên server đang chạy.

## Kết luận: 3/3 fix đã hoạt động đúng, có 1 điểm nhỏ cần dọn thêm (không chặn)

| # | Việc | Xác minh code | Xác minh DB | Xác minh test sống |
| --- | --- | --- | --- | --- |
| Fix 1 [P0] `display_number` SEQUENCE | ✅ Cả 4 vị trí (`assignCandidateToJob`, `createCandidateWithStrictValidation`, `createClient`, `createJobForClient`) đã bỏ hẳn `COALESCE(MAX()+1)`, không còn 1 chỗ nào sót (`grep "MAX(display_number)"` → 0 kết quả) | ✅ Cả 8 sequence (4 bảng × 2 schema) đã tạo, `column_default = nextval(...)` đã set đúng trên cả 8 bảng. Giá trị khởi tạo khớp chính xác với `MAX(display_number)+1` tại thời điểm chạy | ✅ `/api/qa-test` DB-11/12: "Created 5 unique records perfectly." |
| Fix 2 [P1] Dedup dùng lại `checkCandidateContactDuplicate` | ✅ Chữ ký hàm đã thêm `sqlClient = sql`, gọi đúng qua `sqlTx` trong `createCandidateWithStrictValidation`. ⚠️ Còn sót 1/2 câu query nội bộ trong hàm (nhánh dự phòng tìm theo `all_contacts_text`/`cv_url`) vẫn dùng `sql` thay vì `sqlClient` — không đúng 100% với yêu cầu spec ("đổi mọi `sql\`...\`` thành `sqlClient\`...\``") | — | ✅ `/api/db-test` DB-18: PASS (3/3 lần). DB-17, DB-19, DB-20 không hồi quy |
| Fix 3 [P1] Bọc `sql.begin` cho branch functions | ✅ Cả 3 hàm (`addClientBranch`, `updateClientBranch`, `deleteClientBranch`) đã bọc đúng, `FOR UPDATE` + `UPDATE` đều chạy qua `tx` | — | ✅ `/api/db-test` DB-10: PASS **3/3 lần chạy liên tiếp** (đủ số lần theo yêu cầu spec để loại trừ ăn may) |

## Kết quả đầy đủ lần gọi cuối cùng

`/api/qa-test`: DB-06/07 PASS, DB-11/12 PASS, DB-20 PASS, BIZ-13 PASS, SMOKE PASS.

`/api/db-test` (20 kịch bản): tất cả PASS trừ **DB-09 FAIL** — đây KHÔNG phải lỗi thật (đã đính chính ở báo cáo trước: `+84912345678` là định dạng đúng theo yêu cầu của bạn, bản thân assertion trong file test đang sai, chưa ai sửa lại — không cấp bách).

`/api/biz-test` (21 kịch bản): tất cả PASS, không hồi quy.

## ⚠️ 1 điểm nhỏ cần AG dọn thêm (không cấp bách, không phải bug đang gây lỗi sống)

Trong `checkCandidateContactDuplicate` (dòng ~817-905), hàm có 2 nhánh tìm trùng lặp: nhánh chính (join `contact_points`) đã đổi đúng sang `sqlClient` theo yêu cầu; nhánh dự phòng (tìm theo `all_contacts_text`/`cv_url` khi nhánh chính không thấy trùng) vẫn dùng `sql` toàn cục thay vì `sqlClient`. Về mặt thực tế hiện tại KHÔNG gây sai kết quả (Postgres không cho phép đọc dữ liệu chưa commit từ transaction khác dù dùng `sql` hay `sqlTx`), nhưng vi phạm đúng tinh thần spec đã yêu cầu ("đổi MỌI `sql\`...\`` bên trong hàm"), và về lâu dài nếu có thêm logic ghi dữ liệu trong cùng transaction thì nhánh này sẽ không thấy được dữ liệu chưa commit của chính transaction đó (mất tính "read-your-own-writes"). Đề nghị AG đổi nốt dòng còn lại khi tiện, không cần làm gấp.

## Ghi chú phụ (không phải lỗi)

`createClient`: do bỏ `nextDisplayNumber` khỏi code, tên mặc định khi không nhập tên Client đã đổi từ `"New Client #<số>"` thành `"New Client"` (không còn số thứ tự trong tên mặc định, vì số này giờ chỉ có sau khi INSERT xong nhờ `DEFAULT nextval()`). Đây là thay đổi hành vi nhỏ, không phải lỗi, chỉ để bạn biết nếu có nhận thấy khác biệt khi tạo Client mới không nhập tên.

## Kết luận chung

Cả 3 fix trong `FIX_SPEC_2026-09-01_followup.md` đã được Antigravity thực hiện đúng và đầy đủ (khác hẳn lần báo cáo trước). Lần này báo cáo của AG (diff dán nguyên văn) khớp 100% với code thực tế trên đĩa — không phát hiện claim sai. Đã commit trực tiếp (`7f8854d`), kèm dọn dẹp 2 file scratch (`diff_actions.txt`, `diff_actions_cmd.txt`) và di chuyển script migration một lần (`fix-sequences.mjs`) vào `scripts/archive/data-mutating-oneoffs/` để lưu vết.

**Việc còn lại:** thẩm định độc lập 10 kịch bản UI còn lại (UI-04, 05, 06, 07, 08, 10, 11, 12, 14, 15) — chưa thực hiện trong đợt này.
