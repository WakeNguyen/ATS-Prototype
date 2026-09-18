# FIX SPEC — Campaign Edit Modal: Start/End Date Thiếu Date Picker (Dùng Sai Component So Với Chuẩn Chung)

**Từ:** Claude (Architect/QA)
**Ngày:** 2026-09-05
**Nguồn:** User báo trực tiếp qua ảnh chụp màn hình Campaign Edit Modal

---

## 1. Bug

Trong `src/app/components/CampaignEditModal.js` (dòng 429-457), 2 field **Start Date** và **End Date** đang dùng thẳng `<input type="date">` của trình duyệt — không có calendar dropdown, hiển thị định dạng mặc định của trình duyệt (`dd-----yyyy` khi rỗng) thay vì định dạng chuẩn `dd - MMM - yyyy` (ví dụ `05-Sep-2026`) mà các field ngày khác trong hệ thống đang dùng.

Toàn bộ hệ thống đã có sẵn 1 component dùng chung cho việc này: `src/components/DateInputField.js` — dùng `Popover` + `Calendar` (shadcn), có icon lịch, nút xoá (X), hiển thị `dd - MMM - yyyy`. Ví dụ đang dùng đúng: field **Date of Birth** trong `src/app/candidates/page.js` (dòng ~950, import ở dòng 7):

```jsx
import DateInputField from "src/components/DateInputField";
...
<DateInputField
  value={formData.dob}
  onChange={newVal => setFormData({ ...formData, dob: newVal })}
  className="w-full px-3 py-1.5 text-xs bg-slate-950 border border-slate-700 rounded-xl text-slate-200 focus:outline-none focus:border-emerald-500"
/>
```

`CampaignEditModal.js` không import/dùng component này cho Start Date/End Date — đây là chỗ thiếu sót, không phải chủ đích thiết kế khác.

## 2. Vị trí cần sửa

**File:** `src/app/components/CampaignEditModal.js`

**Đoạn hiện tại (dòng ~429-457):**
```jsx
{/* Start Date & End Date */}
<div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
  <div className="space-y-1">
    <label className="text-[11px] font-semibold text-slate-300 flex items-center gap-1">
      <Calendar size={12} />
      <span>Start Date</span>
    </label>
    <input
      type="date"
      value={startDate}
      onChange={(e) => setStartDate(e.target.value)}
      className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 focus:outline-none focus:border-emerald-500 text-xs"
    />
  </div>

  <div className="space-y-1">
    <label className="text-[11px] font-semibold text-slate-300 flex items-center gap-1">
      <Calendar size={12} />
      <span>End Date</span>
    </label>
    <input
      type="date"
      value={endDate}
      onChange={(e) => setEndDate(e.target.value)}
      className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 focus:outline-none focus:border-emerald-500 text-xs"
    />
  </div>
</div>
```

**Đề xuất sửa thành:**
```jsx
{/* Start Date & End Date */}
<div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
  <div className="space-y-1">
    <label className="text-[11px] font-semibold text-slate-300 flex items-center gap-1">
      <Calendar size={12} />
      <span>Start Date</span>
    </label>
    <DateInputField
      value={startDate}
      onChange={(newVal) => setStartDate(newVal)}
      placeholder="Select start date..."
      className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 focus:outline-none focus:border-emerald-500 text-xs"
    />
  </div>

  <div className="space-y-1">
    <label className="text-[11px] font-semibold text-slate-300 flex items-center gap-1">
      <Calendar size={12} />
      <span>End Date</span>
    </label>
    <DateInputField
      value={endDate}
      onChange={(newVal) => setEndDate(newVal)}
      placeholder="Select end date..."
      className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 focus:outline-none focus:border-emerald-500 text-xs"
    />
  </div>
</div>
```

Cần thêm import ở đầu file (chưa có):
```js
import DateInputField from "src/components/DateInputField";
```

**Tương thích dữ liệu — đã kiểm tra, không cần đổi gì thêm:**
- `startDate`/`endDate` state hiện là string `"yyyy-mm-dd"` (đọc từ `toDateString(c.start_date)` khi edit, dòng 147-148, hoặc `new Date().toISOString().substring(0,10)` khi tạo mới, dòng 170). `DateInputField.onChange` cũng trả về đúng string `"yyyy-mm-dd"` (xem code component) — **tương thích 100%, không cần đổi logic submit** (dòng 236-237: `startDate ? new Date(startDate).toISOString() : null`).
- Đây là thay thế 1-1, không đổi state, không đổi API, không đổi DB — an toàn, rủi ro thấp.

## 3. [Phát hiện thêm, cùng loại] `NewCandidateModal.js` — Date of Birth cũng đang dùng `<input type="date">` thay vì `DateInputField`

Khi rà lại toàn bộ codebase để tìm các chỗ dùng `type="date"` còn sót, phát hiện thêm 1 chỗ tương tự:

**File:** `src/components/NewCandidateModal.js` (dòng ~620-627, field "Date of Birth" trong form tạo Candidate mới):
```jsx
<label className="block text-[10px] font-bold text-slate-400 mb-1">Date of Birth</label>
<input
  type="date"
  value={formData.dob}
  onChange={(e) => handleFormChange("dob", e.target.value)}
  className="w-full h-8 px-2 bg-slate-950 border border-slate-700 rounded text-slate-100 focus:ring-1 focus:ring-emerald-500 text-[11px]"
/>
```

Đây là form **tạo mới** Candidate — khác component với form **sửa** Candidate trong `src/app/candidates/page.js` (nơi đã dùng đúng `DateInputField`). Cùng field "Date of Birth" nhưng 2 nơi tạo/sửa lại dùng 2 loại input khác nhau — nên đồng bộ hoá luôn cho nhất quán trải nghiệm, cùng cách sửa như trên (thay `<input type="date">` bằng `<DateInputField value={formData.dob} onChange={(newVal) => handleFormChange("dob", newVal)} className="..." />`, thêm import `DateInputField` nếu file chưa có).

Đây chỉ là ghi nhận thêm (không phải yêu cầu gốc của User) — có thể làm cùng đợt cho tiện, hoặc để riêng nếu muốn giới hạn phạm vi thay đổi.

## 4. Phạm vi & rủi ro

- Thay đổi thuần UI, không đổi state/API/DB, không có tác dụng phụ khác.
- Không tìm thấy chỗ nào khác còn dùng `<input type="date">` trong `src/app` và `src/components` ngoài 2 vị trí trên (đã grep toàn bộ).
- Đề xuất AG chạy `npm run build` sau khi sửa để đảm bảo không lỗi import, và test nhanh mở modal Edit Campaign / New Candidate để xác nhận date picker hiện đúng.
