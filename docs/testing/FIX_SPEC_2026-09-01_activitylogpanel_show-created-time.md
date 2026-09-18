# Fix Spec — Việc nhỏ: hiển thị giờ:phút:giây tạo record trong ActivityLogPanel — 2026-09-01

**Từ:** Claude (Architect/QA)
**Cho:** AG (Implementer)
**Mức độ ưu tiên:** Thấp — cải tiến nhỏ theo góp ý user, không phải bug, không chặn phase nào khác.
**Phạm vi:** CHỈ `src/components/ActivityLogPanel.js` + thêm 1 helper mới trong `src/lib/utils.js`. Không đụng `page.js`/`candidates/page.js`/`jobs/page.js`.

## Bối cảnh

User góp ý: hiện tại mỗi dòng log trong `ActivityLogPanel` chỉ hiển thị NGÀY (`action_date`, format "1 - Sep - 2026" qua `formatDateVN`). User muốn thấy thêm **giờ:phút:giây** — cụ thể là thời điểm record được **tạo** (`created_time`, cột đã có sẵn trong bảng `activity_log`, đã được `getActivityLogs()` SELECT ra rồi nên không cần đổi backend/query).

**Lưu ý quan trọng để không nhầm lẫn:** `action_date` và `created_time` là 2 khái niệm khác nhau:
- `action_date`: ngày/giờ user tự chọn cho hoạt động đó (VD ngày phỏng vấn) — user có thể sửa qua Edit Log.
- `created_time`: dấu thời gian hệ thống tự set khi record được tạo trong DB — không đổi được, dùng để audit.

User yêu cầu hiển thị `created_time` (giờ record được TẠO), không phải giờ của `action_date`. Cần hiển thị rõ ràng để không gây hiểu nhầm 2 giá trị này là một.

## Việc cần làm

### 1. Thêm helper mới vào `src/lib/utils.js` (ngay dưới `formatDateTimeVN`)

```js
// Trả về "21:52:55" — chỉ giờ:phút:giây theo giờ địa phương trình duyệt, dùng cho created_time
export function formatTimeVN(dateInput) {
  if (!dateInput) return "";
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return "";
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  const ss = String(d.getSeconds()).padStart(2, "0");
  return `${hh}:${mm}:${ss}`;
}
```

### 2. Trong `ActivityLogPanel.js`

Thêm `formatTimeVN` vào import từ `src/lib/utils` (dòng ~5, cạnh `formatDateVN` hiện có).

Tại vị trí hiển thị ngày hiện tại (dòng ~268):
```js
<span className="text-slate-400 font-mono whitespace-nowrap">{log.action_date ? formatDateVN(log.action_date) : ""}</span>
```

Thêm ngay bên dưới (hoặc bên cạnh, xem gợi ý UI bên dưới) 1 dòng nhỏ hiển thị giờ tạo, có nhãn rõ ràng để không nhầm với `action_date`:
```jsx
{log.created_time && (
  <span
    className="text-slate-600 font-mono whitespace-nowrap text-[10px]"
    title={`Tạo lúc: ${formatDateVN(log.created_time)} ${formatTimeVN(log.created_time)}`}
  >
    tạo lúc {formatTimeVN(log.created_time)}
  </span>
)}
```

**Gợi ý layout:** vì mỗi card log hiện đang khá hẹp (flex hàng ngang giữa action_type/badge bên trái và date+icon bên phải), nên đặt dòng "tạo lúc HH:mm:ss" xuống 1 hàng phụ nhỏ NGAY DƯỚI hàng ngày/icon hiện tại (căn phải, cỡ chữ nhỏ hơn, màu nhạt hơn `text-slate-600` thay vì `text-slate-400` để không cạnh tranh thị giác với ngày chính) — không chèn cùng hàng với ngày để tránh vỡ layout ở màn hình hẹp. AG tự quyết định chi tiết className cho khớp style hiện có, miễn giữ đúng 2 nguyên tắc: (a) nhỏ hơn/nhạt hơn ngày chính, (b) có `title` tooltip ghi rõ "Tạo lúc" để user hiểu đây là giờ tạo record, không phải giờ hoạt động.

### 3. Không đổi form Edit/Add

`created_time` là trường chỉ đọc (audit), KHÔNG thêm vào form Edit Log, KHÔNG cho sửa.

## Test trước khi báo hoàn thành

1. Mở 1 ứng viên có sẵn nhiều log ở các thời điểm khác nhau → xác nhận mỗi log hiển thị thêm giờ:phút:giây, giá trị khớp với cột `created_time` thật trong Supabase (đối chiếu trực tiếp).
2. Thêm 1 log mới → xác nhận giờ hiển thị đúng = thời điểm vừa tạo (so khớp với giờ hệ thống lúc bấm Save, sai số cho phép vài giây).
3. Edit 1 log (sửa Result/Note) → xác nhận `created_time`/giờ hiển thị của log đó **không đổi** sau khi Save (vì `created_time` là lúc tạo, không phải lúc sửa).
4. Kiểm tra không vỡ layout ở cả Candidates, Jobs *(nếu đã dùng chung component — hiện tại `jobs/page.js` CHƯA migrate nên có thể bỏ qua bước này)*, và Action Menu (`page.js`) — cả 3 nơi đều dùng chung `ActivityLogPanel` (trừ Jobs).
5. Cập nhật `DEVELOPMENT_LOG.md`.
