# FIX SPEC — 2026-09-06 — CV Upload In-App Modal: n8n gọi nhầm URL dev, batch/notification KHÔNG BAO GIỜ được tạo

**Mức độ ưu tiên: CAO — tính năng đang hiển thị "thành công" trên UI nhưng thực chất phần theo dõi/tra cứu kết quả KHÔNG hoạt động trên production, người dùng sẽ không thấy CV mình upload đi đâu.**

**Người phát hiện:** Claude, khi QA độc lập lại tính năng CV Upload In-App Modal theo yêu cầu User (không chỉ tin devlog ghi "đã build xong").

---

## Bằng chứng (đã xác minh qua n8n MCP + Supabase MCP, không đoán)

1. Đọc trực tiếp node `Config` (code node) trong workflow n8n **"CV Parser → ATS 3.0 (Supabase) Dedup"** (`fofSZKkdyhlVd9Lc`):
   ```js
   const item = $input.first();
   return [{
     json: {
       ...(item ? item.json : {}),
       baseUrl: 'https://ats-dev.thucnguyen8n.space'
     },
     binary: item ? item.binary : {}
   }];
   ```
   `baseUrl` bị **hardcode cứng** thành domain dev/tunnel local (`ats-dev.thucnguyen8n.space` — chính là domain khai báo trong `next.config.js` mục `allowedDevOrigins`, dùng cho máy dev local, KHÔNG PHẢI domain production). Toàn bộ workflow dùng biến `baseUrl` này để gọi ngược lại về ATS 3.0 cho các bước: tạo batch record (`/api/webhooks/cv-batch`), insert item (`/api/webhooks/cv-batch-item`), tạo/update notification tiến độ (`/api/webhooks/notifications`).

2. Các lệnh gọi HTTP này đều được bọc trong `try/catch` (hoặc node có `continueOnFail: true`) — nên khi gọi tới domain dev không thể truy cập được từ VPS n8n, lỗi bị **nuốt âm thầm**, không làm execution báo lỗi. Kết quả: n8n báo `status: success` cho toàn bộ 94/94 lần chạy gần đây, kể cả 2 lần chạy hôm nay (exec `566`, `573`, ~09:27-09:47 UTC) — nhưng đó là false positive.

3. Kiểm tra trực tiếp Supabase bảng `public.cv_import_batches` (bảng lưu batch để hiển thị "CV Imports Queue"): **0 dòng, trống hoàn toàn, chưa từng có bản ghi nào** — kể cả trước hôm nay. Xác nhận chắc chắn: cơ chế tạo batch/theo dõi tiến độ **chưa từng hoạt động đúng trên production**, không phải lỗi mới phát sinh.

**Hệ quả với người dùng:** khi bấm "Upload & Queue for AI Parsing" trên modal (`CVUploadModal.js`), file thật sự được gửi đi và có thể vẫn được xử lý bởi sub-workflow AI parsing (`Process Single Item` gọi workflow con `WfSingle00000001`, không phụ thuộc `baseUrl` này) — nhưng: (a) không có bản ghi nào xuất hiện trong "CV Imports Queue" trên UI, (b) không có thông báo tiến độ nào hiện trong Notification Center, dù modal đã hứa "Kết quả sẽ xuất hiện trong CV Imports Queue / thông báo trong vài phút". Người dùng sẽ tưởng tính năng bị treo/mất file dù thực ra file có thể đã vào hệ thống.

---

## Cách sửa

Trong n8n workflow **"CV Parser → ATS 3.0 (Supabase) Dedup"** (`fofSZKkdyhlVd9Lc`), sửa node `Config`:

```js
const item = $input.first();
return [{
  json: {
    ...(item ? item.json : {}),
    baseUrl: 'https://crm-ats-web-hazel.vercel.app'
  },
  binary: item ? item.binary : {}
}];
```

Đổi đúng 1 giá trị string từ `https://ats-dev.thucnguyen8n.space` sang `https://crm-ats-web-hazel.vercel.app` — đúng domain production hiện tại, khớp với cách các workflow khác (A, C, D) đang trỏ.

**Lưu ý khi implement:**
- Chỉ sửa đúng giá trị `baseUrl`, không đổi logic nào khác trong node hay workflow.
- Đây là workflow đang `active: true` — AG cần tự publish lại sau khi sửa (Claude không có quyền publish n8n theo quy định đã thống nhất).
- Không cần sửa gì ở phía code app (`CVUploadModal.js`, `cv-upload-proxy/route.js`) — 2 file này đã đúng, chỉ có phần cấu hình bên n8n bị sai.
- Cân nhắc: các bước gọi HTTP tới `baseUrl` hiện đang nuốt lỗi âm thầm (`try/catch`/`continueOnFail`) — đây là thiết kế có chủ đích để 1 bước phụ lỗi không làm chết cả batch, **giữ nguyên**, không cần sửa cơ chế này, chỉ cần sửa đúng URL đích.

---

## Test bắt buộc trước khi báo hoàn thành

1. Từ UI production (`crm-ats-web-hazel.vercel.app`), mở modal Upload CV, chọn 1 file test, bấm Upload.
2. Ngay sau đó: query lại `public.cv_import_batches` — phải xuất hiện đúng 1 bản ghi mới (`status` bắt đầu từ giá trị khởi tạo, `total_files = 1`).
3. Kiểm tra `public.cv_import_batch_items` — phải có đúng 1 dòng tương ứng.
4. Kiểm tra Notification Center trên UI (chuông thông báo) — phải xuất hiện thông báo tiến độ dạng "Đang xử lý batch CV: 0/1" rồi cập nhật thành "Hoàn tất batch CV: 1/1" sau khi xử lý xong.
5. Xác nhận trang "CV Imports Queue" (nếu có UI riêng hiển thị danh sách batch) hiển thị đúng batch vừa tạo.
6. Xác nhận không có regression: candidate vẫn được parse/tạo đúng như trước (tính năng lõi AI parsing không phụ thuộc `baseUrl` này nên không nên bị ảnh hưởng, nhưng vẫn cần xác nhận lại 1 lượt).

**Báo cáo lại:** ghi vào `docs/DEVELOPMENT_LOG.md` như thường lệ, kèm số `id` batch thật vừa tạo được để tiện QA đối chiếu.
