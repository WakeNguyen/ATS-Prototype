# FIX SPEC — PHẦN 4b Hardening: Chuyển Secret Sang Credential + Sửa Hostname Callback Trước Khi Kích Hoạt Workflow A

**Từ:** Claude (Architect/QA)
**Ngày:** 2026-09-06
**Phạm vi:** CHỈ n8n Workflow **"A: FB Group Auto-Post (Campaign)"** (`9W588GooZeZhiSKm`). KHÔNG đụng code application (`src/`), KHÔNG đụng DB. Workflow vẫn giữ nguyên `active: false` sau khi AG làm xong — Claude sẽ QA rồi mới quyết định kích hoạt.

## 1. Bối cảnh

Workflow A đã được xây xong từ 2026-09-02 (`SNAP-20260902-57`), chưa từng kích hoạt, chưa từng chạy thử end-to-end lần nào. User đã xác nhận tiến hành PHẦN 4b (kích hoạt), nhưng trước khi bật, Claude đọc lại toàn bộ định nghĩa workflow qua n8n MCP và phát hiện 2 vấn đề đúng loại rủi ro vừa gây sự cố thật ở Workflow C (`L8QdckqW7FDwanRq`, tối 2026-09-05) — cả 2 đã được Workflow C xử lý xong, giờ cần áp dụng đúng pattern tương tự cho Workflow A.

## 2. Vấn đề #1 — Hostname callback sai/lỗi thời

Workflow A hiện đang gọi 2 endpoint sau về app ATS 3.0:
- Node `POST campaign-run-callback`: `https://ats-dev.thucnguyen8n.space/api/webhooks/campaign-run-callback`
- Node `POST campaign-run-progress`: `https://ats-dev.thucnguyen8n.space/api/webhooks/campaign-run-progress`

Hostname `ats-dev.thucnguyen8n.space` được set từ lúc build (02/09), chưa từng verify, và đúng là loại hostname từng gây lỗi 404 thật ở Workflow C (execution `442`/`444` gọi nhầm hostname khác tunnel thật đang cấu hình).

Đọc trực tiếp Workflow C **hiện tại** (đã verify hoạt động thật qua execution `479` thành công, không lỗi) xác nhận toàn bộ 3 endpoint gọi về ATS 3.0 của Workflow C đều dùng đúng 1 hostname: **`https://ats-local.thucnguyen8n.space`** (`warm-join-data`, `warm-join-run-callback`, `warm-join-cron-register`).

**Yêu cầu:** Đổi URL ở cả 2 node của Workflow A sang đúng hostname `ats-local.thucnguyen8n.space`:
- `POST campaign-run-callback` → `https://ats-local.thucnguyen8n.space/api/webhooks/campaign-run-callback`
- `POST campaign-run-progress` → `https://ats-local.thucnguyen8n.space/api/webhooks/campaign-run-progress`

Nếu AG xác nhận `ats-local.thucnguyen8n.space` KHÔNG phải hostname đúng/hiện hành (ví dụ tunnel đã đổi domain sau thời điểm QA Workflow C), dùng đúng hostname hiện hành thật — không copy máy móc nếu có bằng chứng khác đi kèm. Vui lòng nêu rõ trong báo cáo hostname nào đã dùng và vì sao.

## 3. Vấn đề #2 — Secret hardcode plaintext (4 chỗ)

Đọc trực tiếp `get_workflow_details` xác nhận 4 chỗ secret dạng chuỗi literal trong tham số/code node, dù n8n instance đã có sẵn 2 Credential kiểu `httpHeaderAuth` đang dùng cho Workflow C:
- `Je1dHcRXyZhrXODl` — "ATS 3.0 Internal Webhook Secret" (giá trị `x-internal-secret` dùng cho webhook nhận vào TỪ ATS 3.0 và các call gọi VỀ ATS 3.0)
- `wQ16G6l04h4gP5wF` — "ATS 3.0 VPS Bridge Secret" (giá trị `x-internal-secret` dùng khi gọi VPS Bridge)

4 chỗ cần vá trong Workflow A, theo ĐÚNG pattern đã áp dụng cho Workflow C (xem node tương ứng bên Workflow C để đối chiếu cấu hình chính xác):

1. **Node `Webhook: Campaign Trigger`** (hiện tại: không có `authentication`, việc validate secret làm thủ công ở node kế tiếp bằng code):
   - Thêm `authentication: "headerAuth"` + `credentials: { httpHeaderAuth: { id: "Je1dHcRXyZhrXODl", name: "ATS 3.0 Internal Webhook Secret" } }` vào node này — giống hệt cấu hình node `Webhook: Manual Trigger` bên Workflow C.
   - Sau khi có native header auth, node `Validate Internal Secret` (Code node) phía sau trở thành thừa 100% — nó CHỈ làm mỗi việc validate secret rồi `return $input.all()` không đổi gì (khác với Workflow C, nơi node cùng tên còn build thêm `triggerContext` nên phải giữ lại). Ở Workflow A: **xoá hẳn node `Validate Internal Secret`**, nối thẳng `Webhook: Campaign Trigger` → `Build FB Post Bridge Payload`.

2. **Node `Call VPS Bridge: facebook-post-v2`** (hiện tại: `sendHeaders: true` + `headerParameters` chứa secret literal):
   - Bỏ `sendHeaders`/`headerParameters`, thay bằng `authentication: "genericCredentialType"` + `genericAuthType: "httpHeaderAuth"` + `credentials: { httpHeaderAuth: { id: "wQ16G6l04h4gP5wF", name: "ATS 3.0 VPS Bridge Secret" } }` — giống hệt node `Call VPS Bridge: facebook-warm-join` bên Workflow C.

3. **Node `POST campaign-run-callback`**: cùng cách vá như mục 2, nhưng dùng credential `Je1dHcRXyZhrXODl` (giống node `POST warm-join-run-callback` bên Workflow C).

4. **Node `POST campaign-run-progress`**: cùng cách vá như mục 3, dùng credential `Je1dHcRXyZhrXODl`.

## 4. Không cần làm

- KHÔNG cần đổi URL VPS Bridge nội bộ `http://172.18.0.1:5680/api/facebook-post-v2` — đây là IP nội bộ VPS, cùng dạng với `/api/facebook-warm-join` bên Workflow C đang hoạt động đúng. Nếu tiện, AG có thể xác nhận route `/api/facebook-post-v2` đã tồn tại thật trên `bridge-server.js` (đọc code, không cần gọi thử thật) — không bắt buộc.
- KHÔNG cần chạy test E2E thật (post lên nhóm Facebook thật) ở bước này — User đã chủ động chọn chỉ vá 2 điểm trên rồi kích hoạt, chưa yêu cầu test E2E đầy đủ cho Workflow A. KHÔNG tự ý mở rộng phạm vi.
- KHÔNG bật `active: true` cho workflow này — giữ nguyên `inactive` sau khi sửa xong. Việc kích hoạt do Claude làm sau khi QA xong (đây là ngoại lệ đã có tiền lệ ghi nhận, không phải việc AG cần làm).
- KHÔNG đụng gì tới nội dung sticky note trong workflow trừ khi cần cập nhật câu "Secrets are inlined directly..." cho đúng thực tế mới (nên sửa lại đoạn đó cho khớp, vì sau khi vá sẽ không còn đúng nữa).

## 5. Yêu cầu báo cáo (để Claude QA)

Sau khi sửa xong, báo lại: (a) hostname cuối cùng đã dùng cho 2 node callback + căn cứ; (b) xác nhận cả 4 chỗ secret đã chuyển sang Credential, không còn plaintext (có thể tự quét JSON toàn bộ node như đã làm ở Workflow C); (c) xác nhận `Validate Internal Secret` đã bị xoá và kết nối `Webhook: Campaign Trigger → Build FB Post Bridge Payload` nối thẳng đúng; (d) `versionId`/commit reference của n8n (không có Git cho n8n, nên ghi rõ `updatedAt`/`versionId` mới sau khi `update_workflow`); (e) cập nhật `docs/DEVELOPMENT_LOG.md` theo đúng rule 2 phần (bảng tổng hợp + chi tiết).

## 6. Không chặn gì khác

Workflow B (Import Social Group qua n8n) và các mảng khác không liên quan tới spec này.
