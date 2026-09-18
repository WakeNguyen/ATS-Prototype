**Từ:** Claude (Architect/QA)

# FIX_SPEC_2026-09-13 — Dùng `after()` (next/server) cho webhook dispatch trong `syncCandidatesToGoogleContacts`

## Bối cảnh

Đã QA độc lập và xác nhận đúng chẩn đoán của Antigravity — xem đầy đủ bằng chứng (đối chiếu Supabase
`notifications` ↔ n8n execution history ↔ Vercel Runtime Errors, 3 nguồn độc lập) tại
`docs/testing/QA_Verification_2026-09-13_google-contacts-sync-missing-await.md`. Tóm tắt root cause:

`src/app/actions.js`, hàm `syncCandidatesToGoogleContacts()`, gọi `fetch()` sang webhook n8n
(`N8N_GOOGLE_CONTACTS_SYNC_WEBHOOK_URL`) KHÔNG có `await`, rồi `return` ngay dòng kế tiếp. Trên Vercel
Serverless Function, container có thể bị đóng băng/ngắt ngay khi hàm `return` — khiến request
`fetch()` đang gửi dở bị rớt trước khi tới n8n. Đêm 2026-09-13, đối chiếu thực tế: 8/10 lần dispatch
KHÔNG tới được n8n (80% thất bại).

**Sửa lại hướng fix (so với bản nháp đầu — quan trọng):** Theo đúng mục "This is NOT the Next.js you
know" ở `AGENTS.md`, đã đọc `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/
after.md` trước khi chốt spec (bản Next.js 16.3.0 dùng trong repo). Next.js có sẵn API `after()` từ
`next/server`, viết ra CHÍNH XÁC cho trường hợp này: *"schedule work to be executed after a response
is finished... for tasks and other side effects that should not block the response, such as logging
and analytics."* Trên Vercel, `after()` được triển khai qua `waitUntil()` — cơ chế kéo dài vòng đời
serverless invocation cho tới khi promise truyền vào hoàn tất, thay vì để container đóng băng/ngắt
ngay khi response đã trả. Đây là fix ĐÚNG GỐC RỄ (đảm bảo container sống đủ lâu để `fetch` hoàn tất)
mà KHÔNG cần chặn response trả về User như phương án `await fetch(...)` trực tiếp trong action (bản
nháp ban đầu) — dùng `after()` giữ nguyên tốc độ phản hồi cho User, đúng tinh thần "fire-and-forget"
mà thiết kế gốc (webhook n8n respond immediately) đã nhắm tới, chỉ khác là lần này thực sự đảm bảo
gửi tới nơi.

Webhook n8n ("A2: Save Contacts → Google Sync (ATS 3.0)", node "Save Contact Webhook") đã xác nhận
cấu hình **Response Mode: respond immediately** ("Workflow got started") — n8n ACK gần như tức thì,
KHÔNG đợi xử lý xong toàn bộ candidate. Trong khối `after()`, request tới n8n vẫn hoàn tất rất nhanh
(quan sát các lần thành công tối nay: ACK <1 giây) — chỉ khác lần này chạy sau khi response đã gửi
cho User, không làm chậm UI, nhưng vẫn được Vercel giữ container sống tới khi xong.

## Phạm vi thay đổi (CHỈ 1 file)

`src/app/actions.js` — hàm `syncCandidatesToGoogleContacts()` đã có. Không đụng file nào khác.

## Chi tiết triển khai

### A. Thêm import (đầu file, khoảng dòng 1-6, cạnh các import hiện có)

Thêm 1 dòng import mới, ngay dưới `import { revalidatePath } from 'next/cache';`:
```js
import { after } from 'next/server';
```
Không đổi gì khác trong khối import.

### B. Code CŨ (khoảng dòng 2318-2326, xác nhận số dòng thật trước khi sửa vì có thể lệch nhẹ):

```js
    if (process.env.N8N_GOOGLE_CONTACTS_SYNC_WEBHOOK_URL) {
      fetch(process.env.N8N_GOOGLE_CONTACTS_SYNC_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-internal-secret': process.env.INTERNAL_WEBHOOK_SECRET || '' },
        body: JSON.stringify({ candidates: payloadCandidates, environment: process.env.DB_SCHEMA || 'public' })
      }).catch(err => console.error('[syncCandidatesToGoogleContacts] Warning: Failed to notify n8n webhook:', err.message));
    } else {
      console.warn('[syncCandidatesToGoogleContacts] N8N_GOOGLE_CONTACTS_SYNC_WEBHOOK_URL not configured — skipping dispatch.');
    }
```

### C. Code MỚI (thay thế nguyên khối trên):

```js
    if (process.env.N8N_GOOGLE_CONTACTS_SYNC_WEBHOOK_URL) {
      const webhookUrl = process.env.N8N_GOOGLE_CONTACTS_SYNC_WEBHOOK_URL;
      const webhookSecret = process.env.INTERNAL_WEBHOOK_SECRET || '';
      const webhookEnvironment = process.env.DB_SCHEMA || 'public';
      after(async () => {
        try {
          await fetch(webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-internal-secret': webhookSecret },
            body: JSON.stringify({ candidates: payloadCandidates, environment: webhookEnvironment }),
            signal: AbortSignal.timeout(8000)
          });
        } catch (err) {
          console.error('[syncCandidatesToGoogleContacts] Warning: Failed to notify n8n webhook:', err.message);
        }
      });
    } else {
      console.warn('[syncCandidatesToGoogleContacts] N8N_GOOGLE_CONTACTS_SYNC_WEBHOOK_URL not configured — skipping dispatch.');
    }
```

**Giải thích:**
1. Đọc `process.env.*` ra biến local TRƯỚC khi vào `after()` — theo đúng khuyến cáo trong tài liệu
   `after.md` (mục "With request APIs": đọc dữ liệu request-time TRƯỚC, truyền vào callback qua
   closure, không gọi trực tiếp bên trong `after`). `process.env` không phải request-time API nên về
   kỹ thuật gọi thẳng bên trong cũng được, nhưng tách biến ra ngoài cho rõ ràng, nhất quán với pattern
   khuyến nghị.
2. `after(async () => { ... })` — Next.js/Vercel đảm bảo (qua `waitUntil`) function invocation KHÔNG
   bị đóng băng cho tới khi promise bên trong hoàn tất, dù response đã trả về User từ trước đó. Đây
   là fix trực tiếp cho đúng root cause đã QA (container bị đóng băng/ngắt trước khi `fetch` xong).
3. Giữ nguyên `try...catch` bên trong callback — lỗi webhook (kể cả timeout) chỉ log, không throw ra
   ngoài (không có gì bên ngoài để bắt nữa vì `after` chạy sau khi response đã xong).
4. Giữ `signal: AbortSignal.timeout(8000)` — lớp an toàn bổ sung: dù `after()` không chặn response
   User, vẫn nên giới hạn thời gian chạy nền để tránh giữ tài nguyên serverless vô thời hạn nếu VPS
   n8n treo hẳn. 8 giây đủ rộng so với ACK bình thường (n8n cấu hình respond immediately, quan sát
   thực tế các lần thành công tối nay ACK trong <1 giây).
5. Hành vi return của hàm KHÔNG đổi: `return { success: true, count: payloadCandidates.length }`
   vẫn chạy ngay sau khối `if/else` như cũ — giờ chạy nhanh hơn nữa vì không cần chờ `fetch` (khác
   với phương án `await fetch` trực tiếp mà bản nháp đầu đề xuất, vốn sẽ làm chậm phản hồi cho User).

## Việc KHÔNG được làm

- Không đổi logic INSERT vào bảng `notifications` phía trên khối này (giữ nguyên).
- Không đổi giá trị `environment`, `candidates` trong body payload.
- Không đổi hành vi return của hàm — vẫn `return { success: true, count: payloadCandidates.length }`
  sau khối `if/else`, chạy ngay lập tức như code cũ (không chờ `fetch`). Khác biệt duy nhất là `fetch`
  giờ chạy bên trong `after()` nên Vercel đảm bảo nó sẽ thực sự hoàn tất (dù thành công hay lỗi) trước
  khi container bị dọn, thay vì có thể bị cắt ngang giữa chừng như code cũ.
- Không đụng file nào khác ngoài `src/app/actions.js`.
- Không tự ý đổi giá trị timeout khác 8000ms nếu không có lý do kỹ thuật rõ ràng — nếu thấy cần đổi,
  DỪNG LẠI và báo lại lý do thay vì tự quyết định (áp dụng mục 10 GEMINI.md).

## Verify bắt buộc

1. `node --check src/app/actions.js` → PASS.
2. `git diff --stat` → chỉ `src/app/actions.js` (+ `docs/DEVELOPMENT_LOG.md` nếu cập nhật log) thay
   đổi.
3. `npm run build` → PASS.
4. Test thật qua UI (không phải script gọi thẳng Server Action — đúng mục 10.8 GEMINI.md): bấm "Save
   to Google Contacts" cho 1 candidate đơn lẻ, xác nhận notification "Google Contact Created/Updated"
   xuất hiện trong Notification Center trong vòng vài giây (không cần bấm lại nhiều lần như trước).
   Nếu tiện, lặp lại 2-3 lần để tăng độ tin cậy so với tỷ lệ thất bại 80% đã ghi nhận trước khi fix.
5. Cập nhật `docs/DEVELOPMENT_LOG.md` 1 mục mới theo template mục 10.3, ghi rõ tham chiếu tới
   `docs/testing/QA_Verification_2026-09-13_google-contacts-sync-missing-await.md` (root cause) và
   file spec này.

Báo cáo kèm `git status`, `git diff --stat`, `npm run build` output, và mô tả ngắn kết quả test UI
thật (bao nhiêu lần bấm, bao nhiêu lần thành công).

**Nhắc lại theo mục 10.9 GEMINI.md:** sau khi code xong, KHÔNG tự `git commit`/`git push` — chỉ báo
lại cho Claude để QA + commit/push/verify deploy READY.
