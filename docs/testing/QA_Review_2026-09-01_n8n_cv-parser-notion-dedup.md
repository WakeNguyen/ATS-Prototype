# Thẩm định độc lập — n8n Workflow "CV Parser → Notion ATS Dedup" — 2026-09-01

**Từ:** Claude (Architect/QA)
**Yêu cầu gốc:** "AG đã báo tôi là đã tích hợp xong nhưng tôi chưa thật sự yên tâm... Hãy review lại và kiểm thử workflow này" (kèm folder test data có CV scan để kiểm tra OCR).
**Phương pháp:** Đọc toàn bộ 31 node của workflow chính qua n8n MCP (`get_workflow_details`), đối chiếu với 4 workflow OCR ứng viên tìm được, đọc lại toàn bộ hạ tầng CV-import sẵn có trong `ats-web` (`/api/webhooks/cv-import`, `hitl_actions.js`, `PendingCVClientWrapper.js`), đọc script sinh dữ liệu test (`generate_cvs.py`) để hiểu rõ 40 file CV test (10 file trùng lặp cố ý, 20 file scan).

## Kết luận: CHƯA ĐẠT — phát hiện 2 lỗi nghiêm trọng, cần bạn quyết định hướng đi trước khi tôi sửa & test thật

Claim "đã tích hợp xong" của AG **không chính xác** theo nghĩa: cái được nối dây thực sự không nói chuyện với ứng dụng ATS 3.0 (Supabase) mà bạn đã dùng cả ngày hôm nay — và nhánh OCR (thứ bạn đặc biệt muốn kiểm tra) đang tham chiếu tới một workflow **không tồn tại**.

---

### Lỗi #1 (nghiêm trọng nhất): Workflow ghi vào Notion cũ (CRM-ATS V2), KHÔNG ghi vào ứng dụng Supabase hiện tại

Sticky note ngay trong workflow tự ghi rõ:
> "**Databases (from CRM-ATS V2):** Candidates: `a1f6d984-...` / Contact Points: `6d8b17c5-...`"

Toàn bộ luồng ghi dữ liệu (`Create Candidate`, `Update Candidate`, `Create/Add Contact Points`) đều là node HTTP Request gọi thẳng `api.notion.com`, dùng credential Notion cá nhân — **không hề gọi** đến ứng dụng ATS 3.0.

Điều đáng nói: ứng dụng ATS 3.0 đã có sẵn TOÀN BỘ hạ tầng dành riêng cho đúng việc này, xây từ trước, chỉ là chưa từng được n8n gọi tới:
- `POST /api/webhooks/cv-import` — validate bằng Zod, dedup theo `contact_points` (case-insensitive), tự tạo ứng viên mới nếu 0 trùng, hoặc đẩy vào hàng đợi `pending_cv_imports` nếu có khả năng trùng.
- `hitl_actions.js` (`getPendingCVImports`, `resolvePendingCVImport`) — server actions xử lý hàng đợi.
- `PendingCVClientWrapper.js` — UI icon chuông + panel trượt "CV Imports Queue" (Merge/Reject/Dismiss), đã nhúng sẵn trong `layout.js` toàn app.

Nói cách khác: **đây chính là lý do bạn thấy chưa có nút "Trigger CV Parser" trong Add New Candidate** — không phải vì thiếu nút, mà vì hiện tại không có đường dữ liệu nào từ n8n chảy về app để cái nút đó gọi tới. Route webhook đã sẵn sàng nhận, nhưng chưa ai gọi nó.

---

### Lỗi #2: Nhánh OCR tham chiếu tới 1 subworkflow KHÔNG TỒN TẠI

Node `Run OCR Subworkflow` gọi `workflowId: "p97QV9Luyn2YFszA"` — kiểm tra qua `get_workflow_details` trả về: **"Workflow not found or you don't have permission to access it."**

Vì node này có `continueOnFail: true`, hậu quả thực tế khi chạy: **MỌI file CV dạng scan** (is_scanned=true, đúng nhóm 20/40 file test data của bạn) sẽ luôn đi vào nhánh lỗi ngay lập tức → gửi Telegram cảnh báo giả "Subworkflow OCR gặp sự cố" → rồi fallback gửi thẳng ảnh PDF gốc cho Claude Haiku đọc trực tiếp (không qua OCR). Tức là bước Gemini OCR chuyên dụng mà bạn muốn kiểm tra **hiện không bao giờ chạy được**, dù workflow có active hay không.

**Tin tốt:** tôi tìm và đọc kỹ 1 workflow tên **"PDF Scan OCR - Gemini API"** (`0BLBJWwP80nn9eN3`, cập nhật 31/8) — cấu trúc khớp gần như chắc chắn là đúng subworkflow bị đứt liên kết:
- Nhận input qua `Execute Workflow Trigger` (đúng loại node mà "Run OCR Subworkflow" gọi tới).
- Chuyển PDF → ảnh bằng `pdftoppm` (200 DPI), gửi từng trang cho Gemini 2.5 Flash OCR, gộp kết quả.
- Trả về đúng field `fullText` — khớp 100% với những gì node `Extract CV Data (Claude - Text)` đang đọc (`$json.fullText`) và node `If OCR Success` đang kiểm tra (`!$json.error`).
- Tên workflow khớp chính xác với subworkflow "PDF Scan OCR - Gemini API" đã được thiết kế từ trước trong `docs/architecture/legacy-notion-schema.md`.

→ Nhiều khả năng đây đúng là subworkflow AG (hoặc bản thiết kế gốc) đã tạo, nhưng liên kết trong node "Run OCR Subworkflow" chưa từng được trỏ đúng ID này — cần sửa 1 dòng `workflowId`.

**Lưu ý bảo mật phát hiện thêm:** node "Gemini OCR Request" trong subworkflow này đang hardcode API key Gemini thẳng vào URL (`?key=AQ.Ab8R...`) thay vì dùng credential lưu trữ của n8n — nên chuyển sang credential để tránh lộ key khi export/chia sẻ workflow.

---

### Vì sao tôi CHƯA tự chạy thử thật (kể cả với 2 file CV_18/CV_25 đã chuẩn bị sẵn)

1. Chạy workflow chính thật sẽ: ghi bản ghi thật vào Notion, upload file thật lên Google Drive, và gửi tin nhắn Telegram thật tới chat của bạn — đây là hành động có tác dụng phụ ngoài đời thật, tôi cần bạn xác nhận rõ ràng trước khi tự ý thực hiện.
2. Ngay cả khi được phép chạy, nhánh OCR vẫn sẽ lỗi ngay lập tức (Lỗi #2 ở trên) nên không kiểm tra được đúng thứ bạn muốn (khả năng OCR thật).
3. Quan trọng hơn: nếu đích đúng của dữ liệu là Supabase (không phải Notion legacy — xem Lỗi #1), thì chạy thật lúc này sẽ tạo dữ liệu rác vào hệ thống Notion cũ, không giúp ích gì cho ATS 3.0 — nên tôi muốn xác nhận hướng đi với bạn trước khi tốn thao tác chạy thật.

---

## Cần bạn quyết định trước khi tôi viết fix spec cho AG

**Hướng A — (đề xuất) Đổi đích ghi dữ liệu sang Supabase/ATS 3.0:** Sửa workflow n8n để, sau khi Claude trích xuất JSON từ CV, gọi thẳng `POST /api/webhooks/cv-import` thay vì gọi Notion trực tiếp. Toàn bộ dedup/HITL/queue UI đã có sẵn, không cần xây thêm gì ở phía app — chỉ cần n8n gọi đúng endpoint với đúng schema (`candidateCreationSchema`). Nút "Trigger CV Parser" trong Add New Candidate khi đó sẽ trigger form n8n (hoặc gọi webhook n8n), rồi kết quả tự động xuất hiện trong hàng đợi "CV Imports Queue" đã có sẵn trên UI.

**Hướng B — Giữ nguyên đích Notion (CRM-ATS V2)**, nếu hệ thống Notion cũ vẫn đang được dùng song song với ATS 3.0 vì lý do khác tôi chưa biết. Trường hợp này chỉ cần vá Lỗi #2 (OCR) + lỗi bảo mật API key, nhưng sẽ để lại 2 nguồn dữ liệu ứng viên tách biệt (Notion cũ và Supabase mới), và nút "Trigger CV Parser" sẽ không có ý nghĩa nhiều với ATS 3.0 vì dữ liệu không chảy vào đó.

Cá nhân tôi nghiêng hẳn về **Hướng A** — nó tận dụng đúng hạ tầng đã xây sẵn cả ngày hôm nay và tránh 2-nguồn-sự-thật. Nhưng đây là quyết định kiến trúc/nghiệp vụ, tôi muốn xác nhận từ bạn trước khi viết fix spec chính thức cho AG.

Sau khi có quyết định, tôi sẽ: (1) viết fix spec sửa workflow theo đúng hướng chọn + vá lỗi OCR reference + bỏ hardcode API key, (2) viết fix spec thêm nút "Trigger CV Parser" vào Add New Candidate, (3) xin phép bạn rõ ràng trước khi chạy test thật có tác dụng phụ (ghi Notion/Supabase, gửi Telegram) bằng chính 40 file CV test (bao gồm các file scan) để kiểm tra thật khả năng OCR + dedup.
