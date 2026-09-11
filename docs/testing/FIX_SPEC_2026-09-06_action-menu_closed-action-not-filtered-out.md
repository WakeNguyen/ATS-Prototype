# FIX SPEC — 2026-09-06 — Action Menu: đóng action không tự lọc khỏi view "In Progress"

**Mức độ ưu tiên: Thấp — không khẩn, không liên quan bảo mật, không block dùng ngày mai.**

**Người phát hiện:** User, khi dùng thật Action Menu (`src/app/page.js`, trang `/`).

**Hiện tượng:** Action Menu mặc định lọc `statusFilter = "In progress"` (dòng 312). Khi người dùng đổi 1 action từ "In Progress" sang "Closed" (dropdown STATUS ở mỗi dòng, dòng ~872-883), dòng đó vẫn còn hiển thị trong danh sách đang xem — không tự biến mất khỏi view dù filter hiện tại là "In Progress".

**Nguyên nhân (đã đọc code, xác nhận, không đoán):**
- Dropdown STATUS gọi `handleInlineUpdate(app.application_id, "status", e.target.value)` (dòng 874).
- `handleInlineUpdate` (định nghĩa dòng ~446-470) làm **optimistic update local state**: `setApplications(prev => prev.map(a => a.application_id === applicationId ? {...a, [field]: value} : a))` — chỉ ĐỔI giá trị `status` của đúng dòng đó trong mảng `applications` đang có sẵn trên client, KHÔNG xoá dòng đó khỏi mảng và KHÔNG refetch lại từ server.
- Vì `applications` ban đầu được fetch có lọc theo `statusFilter` ở server (dòng 377 `status: statusFilter` trong tham số gọi fetch, effect phụ thuộc `statusFilter` ở dòng 408), nên khi lọc là "In Progress", chỉ những action "In Progress" mới được tải về — nhưng sau khi đổi status ngay trên client, hàm không kiểm tra lại xem giá trị mới có còn khớp filter đang chọn hay không, nên dòng đó bị "kẹt lại" trong danh sách cho tới khi user tự đổi filter qua lại hoặc load lại trang.

**Cách sửa đề xuất — sửa trong `handleInlineUpdate` (`src/app/page.js`, khoảng dòng 446-470):**

Sau khi `updateApplicationAction` trả về `success`, nếu field vừa đổi là `status` VÀ filter hiện tại không phải "ALL" VÀ giá trị mới khác với `statusFilter` đang chọn → xoá hẳn dòng đó khỏi mảng `applications` local (thay vì chỉ update tại chỗ), để nó biến mất khỏi view ngay lập tức, đúng như filter đang chọn.

Code hiện tại (rút gọn, giữ nguyên phần đầu không đổi):
```js
async function handleInlineUpdate(applicationId, field, value) {
  setSavingField(`${applicationId}-${field}`);
  const prevApps = applications;

  setApplications(prev => prev.map(a => {
    if (a.application_id === applicationId) {
      return { ...a, [field]: value };
    }
    return a;
  }));

  const updatePayload = { [field]: value };
  const res = await updateApplicationAction(applicationId, updatePayload);

  if (res.success) {
    notify(`Đã cập nhật ${field}`);
  } else {
    notify("Lỗi: " + res.error);
    setApplications(prevApps);
  }
  setSavingField(null);
}
```

Sửa thành (chỉ thêm 1 khối `if` sau dòng `notify(...)` khi thành công, không đổi gì khác):
```js
async function handleInlineUpdate(applicationId, field, value) {
  setSavingField(`${applicationId}-${field}`);
  const prevApps = applications;

  setApplications(prev => prev.map(a => {
    if (a.application_id === applicationId) {
      return { ...a, [field]: value };
    }
    return a;
  }));

  const updatePayload = { [field]: value };
  const res = await updateApplicationAction(applicationId, updatePayload);

  if (res.success) {
    notify(`Đã cập nhật ${field}`);
    // Nếu vừa đổi STATUS và giá trị mới không còn khớp filter đang chọn
    // (và filter không phải "ALL") → xoá dòng khỏi view ngay, không chờ refetch.
    if (field === "status" && statusFilter !== "ALL" && value !== statusFilter) {
      setApplications(prev => prev.filter(a => a.application_id !== applicationId));
    }
  } else {
    notify("Lỗi: " + res.error);
    setApplications(prevApps);
  }
  setSavingField(null);
}
```

**Lưu ý khi implement:**
- Chỉ thêm đúng khối `if` trên, không đổi logic optimistic update ban đầu hay logic rollback khi lỗi (giữ nguyên để không phá vỡ hành vi các field khác như `is_passive`, `planning_date`...).
- Nếu dòng đang bị xoá đó đang được chọn xem chi tiết (`selectedApp`), kiểm tra xem UI panel chi tiết bên phải có bị lỗi (hiển thị record không còn trong danh sách) không — nếu có, tự xử lý thêm (ví dụ: đóng panel chi tiết hoặc giữ nguyên, tuỳ hành vi hiện tại của app khi 1 dòng bị xoá khỏi `applications` mà vẫn đang `selectedApp`).

**Test bắt buộc trước khi báo hoàn thành:**
- Filter đang "In Progress" → đổi 1 action sang "Closed" → dòng đó biến mất khỏi danh sách ngay lập tức, không cần đổi filter qua lại hay reload trang.
- Filter đang "Closed" → đổi 1 action từ "Closed" sang "In Progress" → dòng đó cũng biến mất khỏi view (đúng hành vi tương tự chiều ngược lại).
- Filter đang "ALL" → đổi status bất kỳ → dòng đó vẫn hiển thị bình thường (chỉ đổi badge status, không biến mất) — vì "ALL" không nên lọc gì cả.
- Các field khác (`is_passive`, `planning_date`, ghi chú...) vẫn hoạt động như cũ, không bị ảnh hưởng bởi thay đổi này.
- `npm run build` PASS.

**Báo cáo lại:** ghi vào `docs/DEVELOPMENT_LOG.md` như thường lệ, xác nhận đã test đủ 4 mục trên.
