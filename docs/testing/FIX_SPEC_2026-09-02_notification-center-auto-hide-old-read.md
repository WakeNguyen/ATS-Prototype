# Fix Spec — Notification Center: tự ẩn notification cũ đã đọc (>48h) khỏi danh sách hiển thị — 2026-09-02

**Từ:** Claude (Architect/QA)
**Cho:** AG (Implementer)
**Mức độ ưu tiên:** Thấp — cải tiến UX theo góp ý user, không phải bug, không chặn phase nào khác.
**Phạm vi:** CHỈ `src/app/notification_actions.js` (hàm `getNotifications`). Không đụng schema DB, không xoá dữ liệu, không cần cron job mới.

## Bối cảnh

User góp ý: Notification Center hiện liệt kê tới 29 notification (xem ảnh chụp thực tế đính kèm trong chat) dù panel báo "0 pending review · 0 unread alerts" — tức toàn bộ đã được đọc từ lâu (có cái "1h ago", có cái đã hoàn tất từ các batch test CV Parser). Danh sách bị rối vì không có cơ chế nào tự dọn bớt các thông báo cũ, đã xử lý xong.

Đã kiểm tra code hiện tại (`src/app/notification_actions.js`):
```js
export async function getNotifications(limit = 30) {
  try {
    const rows = await sql`SELECT * FROM notifications ORDER BY created_at DESC LIMIT ${limit}`;
    return rows;
  } catch (err) { ... }
}
```
Hàm này chỉ lấy 30 dòng mới nhất theo `created_at`, KHÔNG lọc theo `is_read` hay tuổi của notification — nên notification cũ đã đọc vẫn chiếm chỗ trong danh sách cho tới khi bị đẩy ra khỏi top 30 bởi notification mới hơn.

**Quyết định đã chốt với user (không cần hỏi lại):** CHỈ ẩn khỏi danh sách hiển thị bằng cách sửa query — KHÔNG xoá gì khỏi bảng `notifications` trong DB. Lý do: đơn giản nhất, không cần cron job/pg_cron mới, không rủi ro mất dữ liệu, vẫn giữ nguyên toàn bộ lịch sử trong DB để tra cứu/audit sau này nếu cần (vd đối chiếu QA như đã làm nhiều lần ở spec CV Parser).

Quy tắc ẩn: 1 notification chỉ bị ẩn khỏi danh sách khi ĐỒNG THỜI thoả cả 2 điều kiện — (a) `is_read = true`, VÀ (b) `created_at` cũ hơn 48 giờ. Notification CHƯA đọc (`is_read = false`) LUÔN hiển thị bất kể cũ tới đâu — tránh trường hợp user bỏ sót 1 việc cần chú ý chỉ vì nó bị "dọn" mất.

## Việc cần làm

### 1. Sửa `getNotifications` trong `src/app/notification_actions.js`

```js
const NOTIFICATION_VISIBLE_HOURS = 48; // notification đã đọc & cũ hơn ngưỡng này sẽ không còn hiện trong danh sách (vẫn còn nguyên trong DB)

export async function getNotifications(limit = 30) {
  try {
    const rows = await sql`
      SELECT * FROM notifications
      WHERE is_read = false
         OR created_at > NOW() - make_interval(hours => ${NOTIFICATION_VISIBLE_HOURS})
      ORDER BY created_at DESC
      LIMIT ${limit}
    `;
    return rows;
  } catch (err) {
    console.error("Failed to fetch notifications:", err);
    return [];
  }
}
```

Đặt hằng số `NOTIFICATION_VISIBLE_HOURS` ngay đầu file (dưới các dòng `import`), để dễ chỉnh ngưỡng sau này nếu user muốn đổi (vd 24h hoặc 72h) mà không phải sửa sâu trong query.

### 2. KHÔNG đổi các hàm khác

- `getUnreadNotificationCount()`: giữ nguyên — đã đúng, chỉ đếm `is_read = false`, không liên quan tuổi notification.
- `markNotificationRead`/`markAllNotificationsRead`: giữ nguyên.
- `route.js` (webhook nhận/insert/update notification): giữ nguyên — không đổi cách tạo/cập nhật notification, chỉ đổi cách HIỂN THỊ.

### 3. Không cần migration DB, không cần cron job

Đây chỉ là thay đổi điều kiện `WHERE` khi SELECT hiển thị — bảng `notifications` không đổi cấu trúc, dữ liệu cũ không bị xoá hay archive. Áp dụng tự động cho cả `sandbox` lẫn `public` vì cùng 1 đoạn code, không phân biệt schema.

## Test trước khi báo hoàn thành

1. Lấy 1 notification hiện có, đã `is_read = true` — cập nhật thủ công `created_at` của nó lùi về quá 48h trước (`UPDATE notifications SET created_at = NOW() - interval '3 days' WHERE id = '...'` — CHỈ làm trên `sandbox`) → reload trang → xác nhận notification đó KHÔNG còn xuất hiện trong danh sách hiển thị, nhưng vẫn còn nguyên trong bảng `notifications` (SELECT trực tiếp vẫn thấy).
2. Lấy 1 notification khác, để `is_read = false` và cũng chỉnh `created_at` lùi về quá 48h trước → xác nhận notification này VẪN hiển thị bình thường (vì chưa đọc, không bị ẩn dù cũ).
3. Xác nhận notification mới tạo trong vòng 48h (dù đã đọc hay chưa) vẫn hiển thị bình thường như hiện tại — không có thay đổi hành vi cho dữ liệu mới.
4. Xác nhận `unreadNotificationsCount`/badge số ở icon chuông không đổi cách tính, không bị ảnh hưởng bởi thay đổi này.
5. Trả lại `created_at` các dòng test về giá trị gốc (hoặc xoá dòng test nếu là dữ liệu tự tạo riêng cho test này) trước khi báo hoàn thành — không để sai lệch dữ liệu test còn sót trong `sandbox`.
6. Cập nhật `DEVELOPMENT_LOG.md` (cả bảng tổng hợp lẫn phần chi tiết, như quy tắc đã nhắc nhiều lần trước đây).
