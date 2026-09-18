**Từ:** Claude (Architect/QA)

# QA Verification — Environment-Separation Giai đoạn 1 (Google Contacts Sync)

**Ngày:** 2026-09-13
**Kết quả:** ✅ PASS — verify bằng bằng chứng trực tiếp (code diff, SQL trên Supabase, không dựa vào
báo cáo của Antigravity).
**Spec gốc:** `spec.md` (dispatch qua bridge, round 1/10, `EXIT=0`).

## Phạm vi đã verify

1. `src/app/actions.js` — đọc trực tiếp dòng 2378-2386: `body` gửi n8n đã có thêm
   `environment: process.env.DB_SCHEMA || 'public'`, không có thay đổi nào khác trong hàm.
2. `src/app/api/webhooks/notifications/route.js` — đọc trực tiếp toàn bộ file: đã thêm
   `targetSchema = body.environment === 'sandbox' ? 'sandbox' : 'public'`, dùng
   `${sql(targetSchema)}.notifications` cho cả UPDATE và INSERT, đúng cú pháp dynamic identifier
   của thư viện `postgres` (đối chiếu `node_modules/postgres/README.md`).
3. n8n workflow `O659fZyN2uGaaLyL` — gọi `get_workflow_details` trực tiếp (không tin báo cáo text),
   xác nhận cả 3 node `Build Create Payload`/`Build Update Payload`/`Build Conflict Message` đều có
   thêm đúng 1 dòng lấy `environment` từ `Save Contact Webhook` và field `environment` trong
   `notificationPayload`. Không có node/kết nối nào khác bị đổi. Workflow đã publish version mới
   `5bb2fa7c-0a69-4cf0-b1a0-dce7b708238c`, `active: true`.

## Live test (end-to-end route logic — dùng dữ liệu test tự tạo, đã tự dọn dẹp)

- Gọi trực tiếp `POST http://localhost:3000/api/webhooks/notifications` với
  `{"type":"qa_test_env_flag","title":"QA-TEST-ENV-FLAG (sandbox)","environment":"sandbox",...}`.
- Kết quả: `{"id":"01a09a06-2d38-0e21-8acb-50fd9ce91b2a"}`.
- Query trực tiếp Supabase: bản ghi CHỈ tồn tại ở `sandbox.notifications`, KHÔNG có ở
  `public.notifications` — đúng hành vi mong muốn.
- Đã `DELETE` đúng 1 dòng test này bằng `id` ngay sau khi verify xong (theo mục 10.8 GEMINI.md).

**Ghi chú về nhánh `public`:** không test trực tiếp nhánh `environment: 'public'` qua dev server
local vì kết nối local dùng `ag_dev_role` (không có quyền ghi `public`, đúng theo thiết kế cách ly ở
CLAUDE.md mục 3) — cố tình gọi sẽ bị chặn bởi quyền DB, không phải bug. Logic 2 nhánh hoàn toàn đối
xứng (chỉ khác tên schema truyền vào `sql()`), nên nhánh `sandbox` PASS là đủ cơ sở tin nhánh
`public` cũng đúng; sẽ được xác nhận thêm 1 lần nữa khi test thật trên production sau khi merge.

## Kết luận

Giai đoạn 1 hoàn thành đúng spec, không có sai lệch, không đụng phạm vi ngoài yêu cầu. Sẵn sàng cho
Giai đoạn 2 (Workflow A, Workflow C nhánh Webhook, CV Parser `Config` node).
