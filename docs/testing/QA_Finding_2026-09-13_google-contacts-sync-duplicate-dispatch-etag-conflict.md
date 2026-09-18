**Từ:** Claude (Architect/QA)

# QA Finding — 2 lần bấm "Save to Google Contacts" trùng nhau gây lỗi Google API `etag` conflict

## Bối cảnh

Ngay sau khi fix `after()` cho `syncCandidatesToGoogleContacts()` được deploy production (xem
`docs/testing/FIX_SPEC_2026-09-13_google-contacts-sync-await-webhook-fetch.md` và
`QA_Verification_2026-09-13_google-contacts-sync-missing-await.md`), User test lại bằng nút "Save to
Google Contacts" (bulk 80 candidate) và báo: bấm chạy, thấy 2 lần dispatch nhưng 1 lần bị lỗi. Claude
đã kiểm tra trực tiếp trên n8n VPS (không suy đoán) theo yêu cầu của User.

## Bằng chứng (từ n8n VPS, workflow "A2: Save Contacts → Google Sync (ATS 3.0)", id `O659fZyN2uGaaLyL`)

Supabase `public.notifications` cho thấy **2 lần dispatch cùng 1 batch 80 candidate**, cách nhau chỉ
~4.6 giây:
- `23:30:14.230` VN — "Đang đồng bộ 80 candidate tới Google Contacts"
- `23:30:18.906` VN — "Đang đồng bộ 80 candidate tới Google Contacts" (cùng danh sách 80 ID hệt nhau)

n8n ghi nhận đúng 2 execution tương ứng:
- **`#7639`** (bắt đầu 16:30:14.828Z = 23:30:14 VN): chạy bình thường, xử lý tuần tự đủ 80 candidate
  (chính là chuỗi notification "Google Contact Updated: ..." nối tiếp nhau từ 23:30:21 → 23:31:39+
  quan sát được).
- **`#7640`** (bắt đầu 16:30:19.459Z = 23:30:19 VN, ~4.6s sau `#7639`): **status "error"**, dừng sau
  ~4 giây, lỗi ngay ở candidate đầu tiên nó chạm tới trong batch (Truc Le, ATS ID #3420), tại node
  "Update Google Contact":
  ```
  400 FAILED_PRECONDITION — "Request person.etag is different than the current person.etag.
  Clear local cache and get the latest person."
  ```

## Phân tích root cause

Đây **KHÔNG PHẢI regression của fix `after()`** — ngược lại là hệ quả trực tiếp của việc fix đó hoạt
động đúng. Trước khi fix, do `fetch()` không có `await`, khả năng cao 1 trong 2 request dispatch sẽ bị
Vercel cắt ngang trước khi tới n8n (đúng hiện tượng "được lúc không" đã QA trước đó). Sau khi fix,
**cả 2 lần dispatch đều tới n8n thành công (100% delivery)** — nhưng vì cả 2 request đều mang đúng
CÙNG 1 danh sách 80 candidate, khi cả 2 execution cùng cố `PATCH` (update) đúng 1 Google Contact gần
như đồng thời, Google People API dùng cơ chế `etag` (optimistic concurrency control) để chặn ghi đè
xung đột — execution chạy sau (`#7640`) bị Google từ chối vì giá trị `etag` nó đọc được đã lỗi thời
ngay khi execution kia (`#7639`) vừa ghi xong đúng bản ghi đó trước nó vài giây.

**Hậu quả thực tế: KHÔNG mất dữ liệu, không có candidate nào bị đồng bộ sai/thiếu.** `#7639` chạy độc
lập, xử lý đầy đủ cả 80 candidate không phụ thuộc `#7640`. `#7640` chỉ dừng giữa chừng ở candidate đầu
tiên nó chạm tới rồi toàn bộ execution bị huỷ (hành vi mặc định của n8n khi 1 node lỗi) — không xử lý
tiếp candidate nào khác trong batch của nó, nhưng những candidate đó vẫn được `#7639` xử lý đúng.

**Nguyên nhân gốc của việc dispatch trùng 2 lần:** nhiều khả năng nút "Save to Google Contacts" trên
UI chưa bị disable / chưa hiện rõ trạng thái "đang xử lý" ngay sau lần bấm đầu — nên User (hoặc thao
tác double-click) bấm lại lần 2 trước khi kịp thấy phản hồi, đặc biệt dễ xảy ra với bulk 80 người vì
độ trễ từ lúc bấm tới lúc thấy notification xuất hiện không phải tức thời.

## Kết luận & khuyến nghị

- Fix `after()` đang hoạt động đúng thiết kế — không cần rollback hay sửa gì thêm ở phần dispatch.
- Vấn đề còn lại (nếu muốn xử lý) là **UX**: ngăn double-submit ở nút "Save to Google Contacts" (ví
  dụ disable nút + hiện loading state ngay khi bấm, hoặc debounce phía client) để tránh lãng phí 1
  lượt gọi n8n dư thừa và dòng lỗi gây hoang mang trong log. Đây là cải tiến KHÔNG khẩn cấp (không gây
  mất dữ liệu thật), tuỳ User quyết định có muốn giao spec cho AG xử lý hay không — **chưa có quyết
  định nào được đưa ra, chưa giao việc này cho AG**.
- Khi gặp lại hiện tượng "n8n báo lỗi liên quan Google Contacts", luôn kiểm tra trước tiên: có đúng 2+
  execution trùng thời điểm (~vài giây) cùng thao tác lên cùng 1 candidate không — đây là dấu hiệu
  double-submit, khác hẳn với dấu hiệu "dispatch không tới n8n" (0 execution nào sinh ra) đã QA ở
  root cause trước đó. 2 lớp lỗi này dễ bị nhầm lẫn nếu chỉ nhìn tiêu đề "lỗi" mà không đối chiếu số
  lượng execution/thời điểm thật trên n8n.
