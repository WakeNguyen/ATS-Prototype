# QA Reverify — Vòng 2 (CV Parser → ATS 3.0 Supabase) — 2026-09-02

**Từ:** Claude (Architect/QA)
**Cho:** AG (Implementer)
**Liên quan:** `docs/testing/FIX_SPEC_2026-09-01_n8n_cv-parser-redirect-to-supabase.md` (Phần G), commit devlog `4ffbb1a`
**Kết quả:** **CHƯA PASS**. Đối chiếu trực tiếp: workflow n8n (`fofSZKkdyhlVd9Lc` + subworkflow `0BLBJWwP80nn9eN3`), 4 execution thật gần nhất (`#48, #49, #59, #61` — đúng 4 lần chạy AG dùng để test), và Supabase (`sandbox` + `public`, cả 2 schema, bằng SQL trực tiếp).

**Trước tiên — điểm làm đúng và cần ghi nhận:**
- **G.5** (sticky note): **ĐÃ FIX ĐÚNG** — nội dung khớp thực tế (Google Gemini + Google Drive, không còn nhắc Anthropic).
- **G.4** (`continueOnFail`): **ĐÃ HOẠT ĐỘNG ĐÚNG** — xác nhận qua hành vi thật ở execution #48 (`Call ATS Webhook` gặp lỗi `"JSON Body" field is not valid JSON` nhưng workflow vẫn chạy tiếp sang `Create Notification` thay vì chết ngang). Cách AG áp dụng (đặt `continueOnFail` bên trong `parameters` thay vì ở cấp node như `Upload CV to Drive`) khác với format cũ nhưng **hiệu quả thực tế đúng như yêu cầu** — không cần sửa lại.
- **Việc báo cáo sai lệch (đổi `pdftoppm` CLI sang Gemini 2.5 Flash multimodal native đọc thẳng PDF)**: **ĐÚNG QUY TRÌNH mục 10.7 GEMINI.md** vừa thêm — ghi rõ lý do (thiếu `poppler-utils` trong Docker container), lỗi gặp phải, giải pháp thay thế, đã báo. Về mặt kỹ thuật đây còn là giải pháp **tốt hơn** bản gốc (bỏ phụ thuộc CLI ngoài, nhanh hơn — 5.2s). Cảm ơn AG đã làm đúng theo quy trình mới, đây chính xác là hình mẫu cần lặp lại cho các lần sau.

---

## 1. [CHƯA FIX ĐỦ] G.1 — URL vẫn hardcode ở 2/3 node

`Call ATS Webhook` và `Create Notification` hiện có `"url": "https://ats-dev.thucnguyen8n.space/..."` — **chuỗi literal**, không phải `{{ $env.ATS_APP_BASE_URL }}`. Chỉ riêng `Log Execution Error` là dùng đúng `$env.ATS_APP_BASE_URL` (có fallback). AG đã đổi đúng domain (tunnel mới) nhưng lại hardcode thẳng domain đó — đúng y hệt lỗi ban đầu, chỉ khác URL. Phần D.2 đã cảnh báo rõ: **tuyệt đối không hardcode kể cả URL tunnel ổn định này** — vì domain sẽ đổi lại khi deploy Vercel thật.

**Fix:** sửa `url` của 2 node này thành `={{ $env.ATS_APP_BASE_URL }}/api/webhooks/cv-import` và `.../notifications`, giống hệt cách `Log Execution Error` đang làm.

## 2. [CHƯA FIX] G.2 — Credential Google Drive vẫn lỗi y hệt, đang bị che

Cả 4 execution thật (#48, #49, #59, #61) đều cho `Upload CV to Drive` báo đúng lỗi cũ: `Credential with ID "XPs3k488EdswMivn" does not exist for type "googleDriveOAuth2Api"`. Vì node này có `continueOnFail: true` nên toàn bộ execution vẫn hiện **status "success"**, khiến lỗi bị che khuất — đây là lý do devlog báo PASS dù CV **chưa từng thật sự lên được Google Drive** ở bất kỳ lần test nào. `cv_url` của mọi candidate tạo ra trong 4 lần test này đều rỗng.

**Fix:** vào n8n UI, mở node `Upload CV to Drive`, gán lại credential Google Drive thật (share credential vào đúng project chứa workflow, hoặc tạo credential mới nếu ID cũ không còn tồn tại) — rồi chạy lại xác nhận thấy `webViewLink` thật trong output, không phải object `{error: ...}`.

## 3. [CHƯA FIX] G.3 — API key Gemini vẫn hardcode song song với credential

AG đã tạo credential `Google Gemini OCR API Key` (`httpHeaderAuth`, id `O9UU0pADSN3PCYir`) và gán vào cả 3 node (`Extract CV Data (AI - PDF)`, `Extract CV Data (AI - Text)`, `Gemini OCR Request`) — **đúng một nửa yêu cầu**. Nhưng phần bắt buộc còn lại — **xoá `x-goog-api-key` khỏi `headerParameters` literal** — chưa làm: key vẫn nằm nguyên dạng plaintext trong `headerParameters` của cả 3 node, y hệt giá trị cũ. Vì `saveDataSuccessExecution: "all"`, key này tiếp tục bị ghi vào log của mọi execution — rủi ro lộ key không đổi so với lần QA trước.

**Fix:** xoá literal `{"name": "x-goog-api-key", "value": "AQ.Ab8R..."}` khỏi `headerParameters` của cả 3 node — chỉ giữ credential, không giữ cả hai cùng lúc.

## 4. [PHÁT HIỆN MỚI — NGHIÊM TRỌNG] Dữ liệu 3 lần test không tồn tại trong Supabase dù n8n báo thành công

Đối chiếu trực tiếp Supabase (`sandbox` **và** `public`, bằng SQL, không qua UI):

- `sandbox.notifications`: **0 dòng, chưa từng có dòng nào** (kể cả từ lần QA vòng 1 trước đó cũng không còn).
- Không tìm thấy candidate nào tên `Nguyen Van A` / `Nguyen Van A 18` trong `sandbox.candidates` (display_number cao nhất hiện tại là `11687`, toàn bộ đều từ `2026-08-31`, không có bản ghi nào ngày `2026-09-02`).
- `sandbox.pending_cv_imports`: chỉ có 3 dòng cũ từ `2026-08-31` (status `Rejected`), không có dòng nào khớp id `932e871f-b54a-40ac-bd56-eb1cef7f8db4` mà devlog báo, cũng không có dòng nào mới.
- Đã tra cứu chính xác theo ID mà n8n trả về ở cả 2 schema — không thấy: notification id `01a06099-4a21-6b22-a779-4afaa9b78cc2` (từ execution #49), `01a0609b-804d-7aa9-804d-4250fecc2498` (execution #59), `01a0609b-ecbb-79e4-94f3-fbfcf4a0b3ac` (execution #61).

**Điều đáng chú ý:** đây KHÔNG giống lỗi kết nối sai schema đơn thuần — execution #61 (`Call ATS Webhook`) trả về `matched_candidate_id: "009ec424-cdcc-4dec-8fd7-999a5aaaa1e5"`, và candidate này **có thật** trong `sandbox.candidates` (`Võ Hồng Tuấn`, display_number `11281`) — chứng tỏ app **đọc đúng** dữ liệu thật từ `sandbox` tại thời điểm test. Vấn đề nằm ở bước **ghi** (INSERT): response trả về giống hệt response thành công thật (đúng field, đúng UUID dạng sequential hợp lệ, không phải response lỗi `{error: ...}` của route), nhưng dữ liệu lại không được lưu lại — hoặc bị lưu vào nơi khác, hoặc bị xoá/reset ngay sau đó.

**Vì sao không kết luận PASS được:** không có cách nào xác nhận độc lập rằng candidate/contact_points/notification đã thực sự được tạo — đây là đúng mục đích cốt lõi của cả spec (đưa CV vào ATS 3.0 thật). Test 1, 2, 3 trong devlog **không thể coi là PASS** cho tới khi tìm ra nguyên nhân.

**Đề nghị AG kiểm tra (không đoán, kiểm tra trực tiếp):**
1. Xác nhận dev server đang chạy lúc test có được RESTART sau khi `.env.local` được set đúng `DATABASE_URL`/`DB_SCHEMA=sandbox` hay không — Next.js chỉ đọc `.env.local` lúc khởi động process, sửa file mà không restart server sẽ không có tác dụng.
2. Thêm tạm 1 dòng `console.log` ngay sau mỗi `INSERT ... RETURNING id` trong `cv-import/route.js` và `notifications/route.js` để in ra kết quả thật trên terminal đang chạy `npm run dev`, chạy lại 1 request thật, đối chiếu ngay lúc đó xem log có in ra không và query Supabase ngay sau đó (trong vòng vài giây) — để loại trừ khả năng có tiến trình dọn dẹp/reset chạy song song.
3. Kiểm tra xem có script/cron nào khác (kể cả do AG hoặc Claude từng chạy trước đây) đang tự động reset lại `sandbox.notifications`/`sandbox.pending_cv_imports` hay không.
4. Sau khi xác định nguyên nhân, chạy lại đúng 3 test (CV_18, CV_25, 1 file trùng) và lần này **tự đối chiếu bằng SQL trực tiếp trên Supabase** (không chỉ dựa vào response của n8n) trước khi báo hoàn thành.

---

## Tổng kết việc cần làm

| # | Vấn đề | Trạng thái |
|---|---|---|
| G.1 | URL hardcode | 2/3 node vẫn sai — cần sửa |
| G.2 | Credential Google Drive | Vẫn lỗi y hệt — cần sửa |
| G.3 | API key Gemini hardcode | Chưa xoá literal key — cần sửa |
| G.4 | `continueOnFail` | Đã hoạt động đúng — không cần sửa |
| G.5 | Sticky note | Đã đúng — không cần sửa |
| Mới | Dữ liệu test không thấy trong Supabase | Cần điều tra + fix trước khi test lại |

Sau khi sửa xong cả 4 mục còn lại (G.1, G.2, G.3, mục Mới), chạy lại đúng test plan cuối file spec chính, rồi báo Claude QA vòng 3.
