**Từ:** Claude (Architect/QA)

# QA Verification — "Save to Google Contacts" chập chờn (được lúc không) — 2026-09-13 tối

## Bối cảnh

User chạy workflow n8n "A2: Save Contacts → Google Sync (ATS 3.0)" (`O659fZyN2uGaaLyL`) nhiều lần
tối 2026-09-13 (~21:00-22:10 VN), có lúc thành công có lúc không. Trong lúc Claude hết quota, User
hỏi Antigravity chẩn đoán độc lập. AG kết luận: `src/app/actions.js` dòng ~2318-2323, hàm
`syncCandidatesToGoogleContacts()`, gọi `fetch()` sang webhook n8n KHÔNG có `await`, khiến Vercel
Serverless Function có thể đóng băng/ngắt container ngay khi `return` chạy xong, làm request `fetch`
đang gửi dở bị rớt ngẫu nhiên. User yêu cầu Claude kiểm tra độc lập bằng bằng chứng trực tiếp trước
khi chấp nhận kết luận này, đối chiếu n8n VPS ↔ hoạt động Vercel trong khung 21:30-22:10 VN.

## Phương pháp kiểm tra (3 nguồn độc lập, không dựa vào lời AG báo cáo)

1. Đọc trực tiếp code hiện tại trên `master`/production (`src/app/actions.js`).
2. Tra `n8n` execution history của đúng workflow `O659fZyN2uGaaLyL` trong khung giờ liên quan
   (`search_workflow_executions`).
3. Tra bảng `public.notifications` (Supabase, `execute_sql` — chỉ SELECT) để lấy đúng thời điểm mỗi
   lần dispatch (`type='google_contacts_sync', action='dispatched'`) và các callback thực tế
   (`action='created'/'updated'/'conflict'`) ghi lại từ n8n.
4. Tra Vercel Runtime Errors (`get_runtime_errors`) trên đúng project production
   (`prj_Mejr6KeWjqbzqh5jaCEbnXI4QZyr`, deployment `dpl_GxrScdLSZtjQfmzed4HGJ14ET5ug`, xác nhận đây
   đúng là bản đang live qua `get_deployment` → `state: READY`).
5. Tra cấu hình node Webhook thật của workflow (`get_workflow_details`) để xác nhận claim "n8n phản
   hồi ngay lập tức" của AG.

## Bằng chứng thu thập được

### 1. Code — xác nhận đúng như AG mô tả

`src/app/actions.js:2318-2323`:
```js
if (process.env.N8N_GOOGLE_CONTACTS_SYNC_WEBHOOK_URL) {
  fetch(process.env.N8N_GOOGLE_CONTACTS_SYNC_WEBHOOK_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-internal-secret': process.env.INTERNAL_WEBHOOK_SECRET || '' },
    body: JSON.stringify({ candidates: payloadCandidates, environment: process.env.DB_SCHEMA || 'public' })
  }).catch(err => console.error('[syncCandidatesToGoogleContacts] Warning: Failed to notify n8n webhook:', err.message));
} else { ... }
return { success: true, count: payloadCandidates.length };
```
Xác nhận: `fetch()` KHÔNG có `await`, hàm `return` ngay dòng kế tiếp — đúng 100% như AG trích dẫn.

### 2. Đối chiếu timeline: dispatch (Supabase) vs execution thật (n8n) — 21:17-22:03 VN

| # | Giờ dispatch (VN) | Loại | n8n execution tương ứng? |
|---|---|---|---|
| 1 | 21:17:23 | 1 candidate (Pham Nguyen Minh Duc) | ❌ Không có |
| 2 | 21:17:29 | 1 candidate (Nguyen Le Chuong) | ❌ Không có |
| 3 | 21:17:31 | 1 candidate (Danh Le) | ❌ Không có |
| 4 | 21:17:42 | Bulk 80 (batch A) | ❌ Không có |
| 5 | 21:32:45 | 1 candidate (Pham Nguyen Minh Duc, lần 2) | ❌ Không có |
| 6 | 21:33:41 | 1 candidate (Pham Nguyen Minh Duc, lần 3) | ❌ Không có |
| 7 | 21:33:44 | 1 candidate (Nguyen Le Chuong, lần 2) | ❌ Không có |
| 8 | 21:44:32 | 1 candidate (Nguyen Le Chuong, lần 3) | ✅ Execution `#7555` (14:45:00→14:45:10 UTC), callback "Created" lúc 21:45:10 |
| 9 | 21:47:37 | Bulk 80 (batch A, lặp lại) | ✅ Execution `#7559` (14:48:15→14:55:53 UTC), 80 callback Created/Updated liên tục từ 21:48:24→21:55:53 — khớp chính xác |
| 10 | **22:02:43** | Bulk 80 (batch B, **khác** batch A) | ❌ Không có execution nào từ 21:55 VN tới ít nhất 00:00 VN (đã quét `search_workflow_executions` tới `17:00:00Z`) |

**Kết quả: 2/10 lần dispatch tối nay thực sự chạm tới n8n (20%)** — kể cả đúng lượt bấm 22:02:43
User hỏi cụ thể. Đây khớp với hiện tượng "được lúc không" User mô tả, và giải thích vì sao User phải
bấm lại nhiều lần (Pham Nguyen Minh Duc bấm 3 lần, Nguyen Le Chuong bấm 3 lần mới ăn 1 lần).

### 3. Vercel Runtime Error — bằng chứng trực tiếp lượt 22:02:43

`get_runtime_errors` (7 ngày gần nhất, deployment `dpl_GxrScdLSZtjQfmzed4HGJ14ET5ug` = production
đang live):
```
[syncCandidatesToGoogleContacts] Warning: Failed to notify n8n webhook: fetch failed
count=1, route=/search.rsc, first=last=2026-09-13T15:03:45.000Z (= 22:03:45 VN)
```
Đây CHÍNH LÀ log từ khối `.catch()` trong code — nghĩa là promise `fetch()` của lượt dispatch
22:02:43 vẫn còn "sống" và tự thất bại ("fetch failed") khoảng **62 giây SAU KHI** request HTTP gốc
của User đã nhận response `{success:true}` và kết thúc từ lâu. Đây là bằng chứng trực tiếp cho đúng
cơ chế Vercel Serverless Function "đóng băng container sau khi response được trả" mà AG mô tả — nếu
không có hiện tượng đóng băng/tách rời vòng đời, `fetch()` phải hoàn tất (thành công hoặc lỗi) trong
vòng đời của cùng 1 request, không thể trôi tự do và tự lỗi hơn 1 phút sau đó trên 1 route request
khác (`/search.rsc`). Đây cũng là lý do tại sao chỉ 1 trong 8 lượt dispatch thất bại tối nay để lại
log lỗi: đa số các lượt còn lại rất có thể bị cắt ngay lập tức trước khi kịp phát log gì (container
đóng băng gần như tức thời), còn lượt 22:02:43 may mắn (hoặc do trạng thái container lúc đó) sống đủ
lâu để tự bung lỗi network thật ra ngoài.

### 4. Xác nhận cấu hình webhook n8n — claim "phản hồi ngay lập tức" của AG là đúng

`get_workflow_details('O659fZyN2uGaaLyL')` → node "Save Contact Webhook":
> Response Mode: Webhook is configured to respond immediately with the message "Workflow got started."

Xác nhận: n8n ACK ngay khi nhận request (không đợi xử lý xong), nên `await fetch(...)` chỉ cần chờ
round-trip TCP + ACK — đúng như AG ước tính "~30-50ms", không phải chờ toàn bộ thời gian xử lý 80
candidate (~7 phút như execution `#7559` cho thấy).

## Kết luận

**Chẩn đoán của Antigravity là ĐÚNG, đã xác minh độc lập bằng 3 nguồn dữ liệu (Supabase, n8n, Vercel)
không phụ thuộc vào báo cáo của AG.** Root cause: thiếu `await` trước `fetch()` dispatch webhook
trong `syncCandidatesToGoogleContacts()` (`src/app/actions.js:2319`), kết hợp hành vi đóng
băng/terminate container của Vercel Serverless Function ngay sau khi hàm `return`, khiến phần lớn
(8/10 lần tối nay, 80%) request webhook bị rớt trước khi tới được n8n.

**Đề xuất kiến trúc bổ sung (User cân nhắc khi giao spec cho AG):** Giải pháp `await fetch(...)` của
AG là đúng hướng, nhưng cần thêm 1 lớp an toàn: `AbortSignal.timeout(...)` (ví dụ 5-8 giây) bọc quanh
`await fetch`, để nếu VPS n8n treo/không phản hồi, request `syncCandidatesToGoogleContacts` từ User
không bị treo chờ vô thời hạn (ảnh hưởng UX nút "Save to Google Contacts", đặc biệt bulk nhiều
candidate) — vẫn giữ nguyên `try...catch` để không làm fail toàn bộ action nếu webhook lỗi/timeout.

## Việc tiếp theo

Chưa có FIX_SPEC chính thức nào được viết — đây chỉ là báo cáo QA/chẩn đoán độc lập. Nếu User đồng ý
hướng xử lý, Claude sẽ soạn FIX_SPEC chi tiết (kèm đoạn `await` + `AbortSignal.timeout`) giao AG thực
thi theo đúng quy trình mục 10 GEMINI.md.
