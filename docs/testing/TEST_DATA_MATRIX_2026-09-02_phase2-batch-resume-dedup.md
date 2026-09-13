# Ground-Truth Test Data Matrix — Phase 2 (Batch Upload + Resume + 3-Case Dedup)

**Liên quan:** `FIX_SPEC_2026-09-02_n8n_cv-parser-batch-resume-and-dedup-cases.md`
**Vị trí file test:** `docs/testing/test data/phase2-batch-resume-dedup/` (KHÔNG track git, theo quy ước sẵn có của thư mục `test data/`)
**Generator:** `docs/testing/test data/generate_phase2_cvs.py` (cũng không track git — chạy lại bất cứ lúc nào bằng `python3 generate_phase2_cvs.py` từ trong thư mục `test data/`)
**Ngày tạo:** 2026-09-02
**Schema nhắm tới:** `sandbox` (Supabase project `your-project-ref`) — KHÔNG dùng cho `public`.

## ⚠️ Setup mutation cần revert sau khi test xong

Để có đủ 1 candidate bị blacklist trong `sandbox` (không có sẵn — `sandbox` vốn có 0 candidate `blocked=true`), đã chạy 1 UPDATE 1-dòng, có WHERE theo PK, tuân thủ Rule C.9 (GEMINI.md):

```sql
-- Đã áp dụng (2026-09-02):
UPDATE sandbox.candidates SET blocked=true,
  blacklist_note='[TEST DATA - Phase2 batch/resume/dedup testing - set 2026-09-02, revert with: UPDATE sandbox.candidates SET blocked=false, blacklist_note=NULL WHERE id=''00000000-0000-4000-8000-000000000003'';]'
  WHERE id='00000000-0000-4000-8000-000000000003';

-- REVERT sau khi test Phase 2 xong (nhớ chạy):
UPDATE sandbox.candidates SET blocked=false, blacklist_note=NULL
  WHERE id='00000000-0000-4000-8000-000000000003';
```

Candidate này (display 10615, "Test Candidate B") được dùng làm target cho 2 file test: `B1-04` (UPDATE thẳng vào candidate bị blacklist) và `B2-02` (1 trong 2 candidate của case CONFLICT).

## Cách dùng bảng này

Mỗi dòng = 1 file test. Cột "Kết quả kỳ vọng" là hành vi ĐÚNG theo spec Phase 1 + Phase 2 đã viết — dùng để so sánh với kết quả thực tế khi AG chạy workflow đã sửa. Cột "Candidate/contact match" ghi rõ UUID + display_number thật trong `sandbox` để tra cứu nhanh khi debug (tên trong file PDF cố tình không dấu — xem lý do trong docstring của generator).

## Batch 1 — happy path mix (6 file, `batch1_happy_path/`)

| File | Kịch bản | Contact dùng để match | Candidate/contact match trong `sandbox` | Kết quả kỳ vọng |
|---|---|---|---|---|
| B1-01_NEW_clean.pdf | NEW, sạch, không trùng ai | email/phone/linkedin toàn bộ mới (`phase2.new01@...`) | Không match | `match_status='NEW'` → tạo candidate mới ngay (201), không vào `pending_cv_imports` |
| B1-02_UPDATE-clean_dang-hai-trang.pdf | UPDATE, email trùng nhưng viết hoa/thường lộn xộn, thêm SĐT mới | email `Candidate.11068@Fake-Email.com` | `00000000-0000-4000-8000-000000000001` (display 11068, "Test Candidate F") | `match_status='UPDATE'` (202) — email phải match dù khác case (so sánh `LOWER(TRIM())`); SĐT `0900000309` là contact mới, phải xuất hiện trong danh sách "contact mới" của UI merge |
| B1-03_UPDATE-fielddiff_pham-kim-uyen.pdf | UPDATE, SĐT định dạng lộn xộn, mang theo dob+address mới (DB đang NULL) | phone `090 000 0302` | `00000000-0000-4000-8000-000000000002` (display 10720, "Test Candidate A") | `match_status='UPDATE'` — SĐT phải normalize đúng `+84900000302` để match; UI field-diff (Part H.2) phải hiện 2 dòng khác biệt (dob, address) vì DB đang NULL |
| B1-04_UPDATE-blacklist_trinh-quoc-ngoc.pdf | UPDATE nhắm vào candidate ĐÃ BỊ BLACKLIST | email `candidate.10615@fake-email.com` | `00000000-0000-4000-8000-000000000003` (display 10615, "Test Candidate B", **blocked=true** — xem mutation ở trên) | `match_status='UPDATE'` — UI (Part H.2) BẮT BUỘC hiện banner đỏ cảnh báo blacklist + nội dung `blacklist_note`, trước khi cho phép merge |
| B1-05_UPDATE-inpipeline_ly-hong-tuan.pdf | UPDATE nhắm vào candidate đang có activity `In progress` | phone `+84900000303` | `00000000-0000-4000-8000-000000000004` (display 10749, "Test Candidate C") | `match_status='UPDATE'` — UI phải hiện banner vàng "đang trong quy trình tuyển dụng" (Part H.2, dựa trên query `activity.status='In progress'` mới thêm ở Part G.3) |
| B1-06_CONFLICT-clean.pdf | CONFLICT, 2 candidate khác nhau, cả 2 đều sạch | email `candidate.11508@...` + phone `+84900000304` | email → `00000000-0000-4000-8000-000000000005` (display 11508, "Test Candidate D"); phone → `00000000-0000-4000-8000-000000000006` (display 10908, "Test Candidate E") | `match_status='CONFLICT'` — `matched_details.candidates` (Part G.3) phải chứa ĐỦ 2 candidate; UI (Part I.1) hiện cả 2 để chọn, không có banner blacklist/in-pipeline nào (baseline sạch) |

## Batch 2 — resume simulation + edge cases (6 file, `batch2_resume_and_edge/`)

| File | Kịch bản | Contact dùng để match | Candidate/contact match | Kết quả kỳ vọng |
|---|---|---|---|---|
| B2-01_NEW_clean-scanned.pdf | NEW, file SCAN (ảnh, cần OCR) | email/phone mới | Không match | Phải qua được OCR subworkflow (`0BLBJWwP80nn9eN3`) rồi mới match NEW — test này xác nhận Phần A của Phase 1 (fix OCR reference) hoạt động đúng |
| B2-02_CONFLICT-with-blacklist.pdf | CONFLICT, 1 trong 2 candidate bị blacklist | email `candidate.10615@...` + phone `+84900000305` | email → `5e06d076...` (display 10615, **blocked=true**); phone → `00000000-0000-4000-8000-000000000007` (display 11117, "Test Candidate G", sạch) | `match_status='CONFLICT'` — UI Part I.1 phải hiện banner blacklist NGAY TRÊN candidate 10615 trong danh sách chọn, candidate 11117 thì không có banner nào |
| B2-03_DUPLICATE-IN-BATCH_pair-a.pdf | Cặp trùng lặp NGAY TRONG 1 batch — file A | email `phase2.duppair@fake-test.local`, phone `+84900000199` | Không match lúc bắt đầu batch | Nếu xử lý theo đúng thứ tự (A trước B): `match_status='NEW'`, tạo candidate mới |
| B2-04_DUPLICATE-IN-BATCH_pair-b.pdf | Cặp trùng lặp NGAY TRONG 1 batch — file B (cùng contact với A) | email/phone giống hệt A | Candidate vừa được tạo bởi B2-03 (nếu batch xử lý tuần tự và item A đã commit trước khi item B bắt đầu query dedup) | **ĐÂY LÀ TEST QUAN TRỌNG NHẤT của cơ chế resume/batch**: kỳ vọng B2-04 trả về `match_status='UPDATE'` (không phải NEW lần 2). Nếu ra 2 candidate NEW riêng biệt → bug race-condition giữa các item trong cùng batch, cần thêm lock hoặc xử lý tuần tự nghiêm ngặt (không parallel) trong Loop Over Items |
| B2-05_CORRUPT-invalid-pdf-structure.pdf | File .pdf nhưng KHÔNG PHẢI PDF thật (garbage bytes) | — | — | Node OCR/Extract phải fail có kiểm soát (try/catch ở Part F.3) → item này phải được đánh dấu `status='failed'` trong `cv_import_batch_items` kèm `error_message`, KHÔNG được làm crash cả batch — các item khác trong batch vẫn phải chạy tiếp |
| B2-06_INVALID-zero-contact-points.pdf | PDF hợp lệ, có tên, nhưng KHÔNG có bất kỳ contact nào (email/phone/linkedin) | — | — | `candidateCreationSchema` (Zod) yêu cầu `contactPoints` tối thiểu 1 phần tử → webhook phải trả lỗi validation có kiểm soát; item phải được đánh dấu `status='failed'` trong `cv_import_batch_items`, không crash batch |

## Batch 3 — scale + OCR mix (8 file, `batch3_scale_and_ocr/`)

| File | Kịch bản | Contact dùng để match | Candidate/contact match | Kết quả kỳ vọng |
|---|---|---|---|---|
| B3-01..04_NEW_text-N.pdf (4 file) | NEW hàng loạt, text-based | email/phone riêng biệt từng file (`phase2.scale.textN@...`) | Không match | 4× `match_status='NEW'` — dùng để test khối lượng + đếm tiến độ (progress notification phải đếm đúng 8/8, không lệch số) |
| B3-05_NEW_scanned-1.pdf, B3-06_NEW_scanned-2.pdf | NEW, scan | email/phone riêng | Không match | 2× `match_status='NEW'`, qua OCR — cùng batch với text-based để test mix loại file trong 1 lần chạy |
| B3-07_UPDATE-repeat_dang-hai-trang-scanned.pdf | Repeat match candidate của B1-02, nhưng khác batch + khác loại contact (phone thay vì email) + file SCAN | phone `+84900000306` | `6c672ca7...` (display 11068, "Test Candidate F") — SĐT này PHẢI đã tồn tại trong DB (do B1-02 hoặc dữ liệu gốc thêm vào) tại thời điểm chạy Batch 3 | `match_status='UPDATE'` — xác nhận dedup nhất quán xuyên suốt các batch khác nhau (không chỉ trong 1 execution), và qua được OCR |
| B3-08_UPDATE-repeat_ly-hong-tuan-text.pdf | Repeat match candidate của B1-05, khác loại contact (email thay vì phone) | email `candidate.10749@fake-email.com` | `f9b299bc...` (display 10749, "Test Candidate C") | `match_status='UPDATE'` — cùng mục đích cross-batch consistency như trên, nhưng bằng email |

**Lưu ý thứ tự chạy:** B3-07 và B3-08 giả định B1-02/B1-05 đã được xử lý TRƯỚC ĐÓ (ở Batch 1) và đã thêm contact mới vào candidate thật. Nếu test 3 batch không theo đúng thứ tự 1→2→3, 2 file này có thể không match như kỳ vọng — chạy tuần tự Batch 1 rồi Batch 2 rồi Batch 3.

## Test riêng cho cơ chế RESUME (không phải file cụ thể, mà là thao tác thủ công)

Theo test plan #2 trong FIX_SPEC Phase 2: dùng lại toàn bộ Batch 3 (8 file) làm batch test resume — chủ động dừng workflow (deactivate hoặc kill execution) sau khi khoảng 3-4/8 item đã có `status != 'queued'` trong `cv_import_batch_items`, đợi >10 phút để "CV Parser - Resume Stuck Batches" (Part F.5) kích hoạt, rồi xác nhận: (a) chỉ các item còn `queued`/`processing` được xử lý lại, (b) các item đã `done` KHÔNG bị xử lý lại (không tạo trùng candidate), (c) thông báo tiến độ tiếp tục đúng số đếm cộng dồn.

## Giới hạn đã biết của bộ test data này (không cố giả lập)

- Không test hyperlink annotation thật của LinkedIn "Save to PDF" (loại link ẩn trong PDF thật, không phải text thường) — nếu node Extract dựa vào text thuần thì mọi giá trị `linkedin` trong bộ test này đều là text hiển thị, không phải annotation link thật.
- File scan dùng noise ngẫu nhiên + xoay nhẹ (0.4°) để mô phỏng "ảnh scan", không phải ảnh chụp thật từ máy scan — đủ để buộc OCR subworkflow phải chạy (không detect được text layer), nhưng không đại diện cho mọi loại nhiễu ảnh thực tế (mờ, gập giấy, chữ viết tay...).
- Không có file PDF nhiều trang — mọi kịch bản đều là CV 1 trang.
