# Fix Spec — 2026-09-01 (round 5): sửa 2 điểm còn sót từ FIX 1 & FIX 4

**Từ:** Claude (Architect/QA)
**Gửi:** Antigravity (Implementer)
**Bối cảnh:** Đã thẩm định độc lập commit `ef85998` (xem `docs/testing/QA_Reverify_2026-09-01_FIX1-4_round4.md`). Không có hồi quy, đa số đúng — chỉ còn 2 điểm cần sửa dứt điểm bên dưới. **Quyết định đã chốt với PO:** định dạng hiển thị trong DateInputField picker ("15 - Sep - 2026") giữ nguyên như hiện tại, KHÔNG cần đổi thành số "dd-mm-yyyy" — không cần động vào phần này.

**Quy trình báo cáo:** như cũ — dán `git diff` đầy đủ + kết quả JSON thô `/api/qa-test`, `/api/db-test`, `/api/biz-test` sau khi sửa. Không tự kết luận "hoàn thành".

---

## FIX A [P2] — Nút "Add Job" bị disable khiến alert cảnh báo tên trống không bao giờ chạy (UI-14)

**Vấn đề xác nhận (live test):** `handleAddJob` trong `src/app/jobs/page.js` đã có `alert("Vui lòng nhập tên Job Order trước khi tạo.")` khi `newJobTitle` rỗng — đúng theo spec trước. NHƯNG nút submit "Add Job" (cùng file, ~dòng 2505) có:
```jsx
disabled={isCreatingClient || addingJob || !newJobTitle.trim()}
```
Vì nút bị disable ngay khi ô tên trống, người dùng không thể bấm được nút trong tình huống này, và nhấn Enter trong ô input cũng không kích hoạt submit của form khi nút submit đang disabled. Kết quả: `handleAddJob` không bao giờ chạy được với tên rỗng qua đường UI bình thường → đoạn `alert(...)` mới thêm là dead code, không ai thấy được cảnh báo.

**Cách sửa:** Bỏ điều kiện `!newJobTitle.trim()` khỏi `disabled`, chỉ giữ 2 điều kiện còn lại:
```jsx
disabled={isCreatingClient || addingJob}
```
Giữ nguyên toàn bộ phần còn lại của `handleAddJob` (đoạn `if (!newJobTitle.trim()) { alert(...); return; }` ở đầu hàm là đúng, không cần đổi).

**Verify:** Để trống ô "New Job Title...", bấm nút "Add Job" (giờ phải bấm được) → phải thấy alert "Vui lòng nhập tên Job Order trước khi tạo.", Job Orders không tăng số lượng.

---

## FIX B [P1] — Lỗi hydration: `<button>` lồng `<button>` trong DateInputField (dùng nhầm API của Radix UI thay vì Base UI)

**Vấn đề xác nhận (live test, console Next.js dev overlay "3 Issues"):**
```
In HTML, <button> cannot be a descendant of <button>. This will cause a hydration error.
React does not recognize the `asChild` prop on a DOM element...
```

**Nguyên nhân chính xác:** `src/components/DateInputField.js` hiện dùng:
```jsx
<PopoverTrigger asChild>
  <button type="button" className={...} onClick={...}>
    ...
  </button>
</PopoverTrigger>
```
Đây là cú pháp **Radix UI** (`asChild` = "đừng tự render thẻ của mày, dùng thẻ con tao đưa"). Nhưng dự án này dùng **Base UI** (`@base-ui/react`), xác nhận qua `src/components/ui/popover.jsx`:
```jsx
import { Popover as PopoverPrimitive } from "@base-ui/react/popover"
function PopoverTrigger({ ...props }) {
  return <PopoverPrimitive.Trigger data-slot="popover-trigger" {...props} />;
}
```
`PopoverPrimitive.Trigger` của Base UI **không hỗ trợ prop `asChild`** — nó LUÔN tự render ra 1 thẻ `<button>` mặc định, bất kể `asChild` có được truyền hay không (xác nhận qua `node_modules/@base-ui/react/popover/trigger/PopoverTrigger.d.ts`). Base UI dùng cơ chế khác để tuỳ biến thẻ render ra: prop `render`.

Kết quả hiện tại: `PopoverTrigger` tự tạo 1 `<button>`, bên trong lại có thêm `<button>` viết tay của `DateInputField.js` → 2 `<button>` lồng nhau → sai cấu trúc HTML → lỗi hydration.

**Mẫu ĐÚNG đã có sẵn trong dự án:** `src/components/ui/sheet.jsx` (component `Sheet`, cũng bọc Base UI) dùng đúng prop `render` thay vì `asChild`. Mở file này ra xem cách `SheetTrigger` hoặc các chỗ khác trong file dùng `render={...}` để tham khảo cú pháp chính xác của phiên bản Base UI đang cài trong dự án.

**Cách sửa — chọn 1 trong 2 hướng sau (hướng 1 đơn giản hơn, ưu tiên):**

**Hướng 1 (khuyến nghị — đơn giản, ít thay đổi nhất):** Bỏ hẳn `asChild` và thẻ `<button>` con viết tay, để `PopoverTrigger` tự render thẻ `<button>` của chính nó, chỉ truyền `className`/`onClick` cần thiết và nội dung (children) trực tiếp vào `PopoverTrigger`:
```jsx
<PopoverTrigger
  type="button"
  className={cn("flex items-center justify-between text-left transition-colors w-full px-1.5 p...", className)}
>
  {dateObj ? format(dateObj, "dd - MMM - yyyy") : <span>...</span>}
  ...
</PopoverTrigger>
```
(Giữ nguyên toàn bộ nội dung/icon bên trong, chỉ chuyển từ "bọc button riêng" sang "để PopoverTrigger tự làm button", không đổi bất kỳ style/behavior nào khác.)

**Hướng 2 (nếu Hướng 1 va phải giới hạn kỹ thuật nào đó, ví dụ cần ref phức tạp):** Dùng đúng prop `render` của Base UI như `sheet.jsx` đang làm, ví dụ dạng:
```jsx
<PopoverTrigger
  render={
    <button type="button" className={...} onClick={...}>
      {dateObj ? format(dateObj, "dd - MMM - yyyy") : <span>...</span>}
      ...
    </button>
  }
/>
```
(Cú pháp chính xác của prop `render` — object JSX hay render-function — lấy đúng theo cách `sheet.jsx` đang dùng trong dự án, vì đây đã được xác nhận hoạt động đúng.)

**Verify:**
1. Mở `/candidates` và `/jobs` trên trình duyệt, xác nhận KHÔNG còn badge đỏ "Issues" của Next.js dev overlay liên quan tới `DateInputField`/`popover`.
2. Console không còn cảnh báo "cannot be a descendant of", "does not recognize the `asChild` prop".
3. Bấm mở date picker (Planning Date, Date of Birth) → lịch vẫn mở đúng, chọn ngày vẫn lưu đúng như trước (không đổi behavior, chỉ đổi cách render DOM).

---

## Yêu cầu báo cáo

Sau khi sửa xong CẢ 2 fix, dán lại NGUYÊN VĂN:
1. `git diff` đầy đủ của các file đã sửa (`src/app/jobs/page.js`, `src/components/DateInputField.js`).
2. Kết quả JSON thô khi gọi `/api/qa-test`, `/api/db-test`, `/api/biz-test` sau khi sửa.
3. Xác nhận đã kiểm tra console trình duyệt không còn lỗi hydration liên quan tới `DateInputField`.

Không viết "hoàn thành" hay kết luận nào — chỉ đưa bằng chứng thô, tôi sẽ tự xác nhận độc lập.
