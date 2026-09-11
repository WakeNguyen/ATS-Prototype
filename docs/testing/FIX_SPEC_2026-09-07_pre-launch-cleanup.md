# FIX SPEC — 2026-09-07 — Dọn dẹp trước khi dùng thật: xoá candidate test lọt vào production + quyết định folder Drive CV Parser

**Mức độ ưu tiên: Thấp/Trung bình — không chặn việc dùng ngay hôm nay, nhưng nên xử lý sớm trong vài ngày tới.**
**Người phát hiện:** User, khi duyệt trang Candidates thấy 1 record rõ ràng là dữ liệu test.
**Tham chiếu:** `docs/testing/QA_2026-09-07_final-production-readiness-review.md` (PHẦN 2).

---

## Task A — Xoá candidate test lọt vào production (#3416 "Hoang Minh Phase2 New01")

**Đã điều tra kỹ, xác nhận an toàn để xoá:**

- `id`: `01a077cf-9b7d-a1ed-afb9-b38344ea4cd1`, `display_number`: `3416`
- `full_name`: `"Hoang Minh Phase2 New01"` — **root cause đã xác nhận qua Supabase**: KHÔNG phải rác cutover cũ, mà là candidate tạo mới lúc 06/09 17:41 UTC bởi chính lượt AG tự test E2E fix "CV Upload domain" (SNAP-20260907-122) — upload file `QA_Test_CV_Verification.pdf` (batch `520d21fb-563f-48cf-8fec-abefc4ebece6`) thẳng vào webhook production thật, không dọn lại sau khi verify xong.
- Contact points: email `phase2.new01@fake-test.local`, phone `+84900000101`, LinkedIn `linkedin.com/in/phase2-new-01` — cả 3 đều là giá trị test rõ ràng.

**Kiểm tra phụ thuộc (đã chạy trực tiếp trên Supabase, KHÔNG suy đoán):**
| Bảng | Số dòng liên quan |
| --- | --- |
| `activity` | 0 |
| `onboarding_history` | 0 |
| `reach_sourcing` | 0 |
| `cv_import_batch_items` | 1 (chính batch test tạo ra candidate này) |
| `contact_points` | 3 (của chính candidate này) |

→ Không có application/pipeline, interview, hay hoạt động thật nào gắn với candidate này (khớp với UI: "Applications & Pipeline (0)"). An toàn để xoá theo đúng thứ tự FK.

**Việc cần làm:**
1. Xoá theo đúng thứ tự (con trước, cha sau) để không vướng FK constraint:
   ```sql
   DELETE FROM public.contact_points WHERE candidate_id = '01a077cf-9b7d-a1ed-afb9-b38344ea4cd1';
   DELETE FROM public.cv_import_batch_items WHERE candidate_id = '01a077cf-9b7d-a1ed-afb9-b38344ea4cd1';
   DELETE FROM public.candidates WHERE id = '01a077cf-9b7d-a1ed-afb9-b38344ea4cd1';
   ```
2. Xác nhận lại: candidate #3416 không còn hiển thị trên UI production (`/candidates`), và query lại Supabase (`SELECT * FROM public.candidates WHERE id = '01a077cf-9b7d-a1ed-afb9-b38344ea4cd1'` phải trả về rỗng).
3. Ghi vào `docs/DEVELOPMENT_LOG.md` (cả bảng tổng hợp lẫn phần chi tiết, theo đúng quy tắc) — nêu rõ đã xoá candidate test nào, lý do, và đã verify 0 phụ thuộc.

---

## Task B — Quyết định + xử lý folder Google Drive cho CV Parser (node "Upload CV to Drive")

**Hiện trạng đã xác nhận qua `get_workflow_details` (n8n workflow `fofSZKkdyhlVd9Lc`):** node `Upload CV to Drive` vẫn trỏ `folderId = 1sXNrOHRswKzy_hyXZE2wi2nEfg2WFS_d` ("Temp Candidate Folder (for testing)"). Đây không phải lỗi chức năng (candidate vẫn tạo đúng trong Supabase) — chỉ ảnh hưởng nơi lưu file CV gốc trên Google Drive.

**User đã quyết định (07/09/2026): dùng folder "Candidate" làm đích thật.**

- Folder Drive thật: **`Candidate`**, `folderId = 1uhxDOoXgosNE4ZGvidW7qyf2Xr6UmzMw` (https://drive.google.com/drive/folders/1uhxDOoXgosNE4ZGvidW7qyf2Xr6UmzMw) — đã xác nhận qua Google Drive API là folder nằm cùng cấp với "Temp Candidate Folder (for testing)" (cùng parent `1MFVGHFZvzPwIbQcE8WWmSlJ5zf0HGiXg`), tồn tại từ 12/04/2026, sửa lần cuối 13/08/2026 — không phải folder "Parsing CV" (đó là nơi lưu CV cũ từ thời hệ thống Notion, không dùng cho hệ thống mới).

**Việc cần AG làm:**
1. Mở workflow n8n **"CV Parser → ATS 3.0 (Supabase) Dedup"** (`fofSZKkdyhlVd9Lc`), node **"Upload CV to Drive"**.
2. Đổi tham số `folderId` từ `1sXNrOHRswKzy_hyXZE2wi2nEfg2WFS_d` ("Temp Candidate Folder (for testing)") sang `1uhxDOoXgosNE4ZGvidW7qyf2Xr6UmzMw` ("Candidate").
3. Publish lại workflow (draft → active version mới).

**Test bắt buộc:**
- Upload 1 CV thật qua modal trong app → xác nhận file Drive nằm đúng trong folder **Candidate** thật (không phải Temp) → xác nhận candidate được tạo đúng trong Supabase như bình thường → **dọn ngay file test đó khỏi Drive + Supabase sau khi verify xong** (rút kinh nghiệm từ chính việc candidate #3416 ở Task A — test trên webhook production thật thì phải tự dọn ngay, không để sót).

---

## Ghi chú thêm (không thuộc spec giao AG, chỉ để User cân nhắc)
`.env.local` trên máy dev local của User hiện đang set `DB_SCHEMA=public` (trỏ thẳng vào schema sản xuất thật). Nếu dự định tiếp tục code/test cục bộ (`npm run dev`) sau khi đã dùng thật, nên đổi lại về `DB_SCHEMA=sandbox` để tránh thao tác dev vô tình ghi đè dữ liệu thật, chỉ đổi về `public` khi cần verify trực tiếp trên production.
