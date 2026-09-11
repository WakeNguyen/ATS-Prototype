# Fix Spec — 2026-09-01: UI-14 & UI-15 + Chuẩn hoá định dạng ngày/giờ toàn hệ thống

**Từ:** Claude (Architect/QA)
**Gửi:** Antigravity (Implementer)
**Quy trình:** Sau khi sửa xong, dán lại `git diff` đầy đủ của các file đã sửa + `npm run build` output (để xác nhận không lỗi build) + kết quả gọi lại `/api/qa-test`, `/api/db-test`, `/api/biz-test`. Không tự kết luận "hoàn thành" — chỉ đưa bằng chứng thô, tôi sẽ tự xác nhận độc lập trước khi coi là xong.

Spec này gồm 4 phần độc lập, có thể làm tuần tự: FIX 1 (UI-14), FIX 2 (UI-15), FIX 3 (chuẩn hoá hiển thị timestamp), FIX 4 (component chọn ngày dùng chung). Nếu hết thời gian, ưu tiên làm FIX 1 → FIX 2 → FIX 4 → FIX 3 (FIX 4 nên làm trước FIX 3 một phần vì cả hai đều đụng vào cùng khu vực code Planning Date, tránh sửa 2 lần).

---

## FIX 1 [P1] — Tạo Job với tên trống không có thông báo (UI-14)

**Vấn đề xác nhận:** Tại `/jobs`, để trống ô "New Job Title..." rồi nhấn Enter → không tạo Job (đúng), nhưng cũng không có bất kỳ thông báo nào cho biết vì sao — trải nghiệm không rõ ràng. Đồng thời, server action `createJobForClient` không tự chặn nếu bị gọi trực tiếp với `job_title: ""` (bypass UI).

**Vị trí:**
- `src/app/jobs/page.js`, hàm `handleAddJob` (dòng ~929-935): hiện có `if (!newJobTitle.trim() || !clientForm.id) return;` — chỉ return im lặng.
- `src/app/actions.js`, hàm `createJobForClient` (dòng ~1827-1849): `const { job_title = 'New Job Order', ... } = jobData;` — default chỉ áp dụng khi `job_title` là `undefined`, KHÔNG áp dụng khi là chuỗi rỗng `""`.

**Cách sửa:**
1. Trong `handleAddJob`, thay đoạn `if (!newJobTitle.trim() || !clientForm.id) return;` bằng kiểm tra tách riêng, có thông báo rõ ràng khi thiếu title (dùng `notify(...)` hoặc `alert(...)` — dùng đúng cơ chế thông báo (toast) hiện đang có sẵn trong file này, không tự thêm cơ chế mới):
   ```js
   if (!newJobTitle.trim()) {
     notify("Vui lòng nhập tên Job Order trước khi tạo."); // hoặc alert() nếu file này chưa có notify() cho trường hợp lỗi — kiểm tra pattern hiện có trong file rồi dùng cho nhất quán
     return;
   }
   if (!clientForm.id) return;
   ```
2. Trong `createJobForClient` (`src/app/actions.js`), thêm validate ngay đầu hàm, TRƯỚC khi destructure default:
   ```js
   export async function createJobForClient(clientId, jobData = {}) {
     if (!clientId) return { success: false, error: "Missing Client ID" };
     if (!jobData.job_title || !jobData.job_title.trim()) {
       return { success: false, error: "Job title is required" };
     }
     try {
       const { 
         job_title, 
         location = 'Ho Chi Minh', 
         ...
   ```
   (bỏ default `= 'New Job Order'` cho `job_title` vì giờ đã validate bắt buộc phải có).
3. **Verify:** Thử lại UI: để trống tên → phải thấy thông báo. Thử gọi thẳng `createJobForClient(clientId, { job_title: "" })` (qua console hoặc script test) → phải trả `{ success: false, error: "Job title is required" }`, không insert được row rỗng vào DB.

---

## FIX 2 [P2 — nhưng ưu tiên vì gây sai dữ liệu âm thầm] — Phone Number không validate (UI-15)

**Vấn đề xác nhận:** Thêm Contact Point Type = "Phone", Value = `abc-not-a-phone` → hệ thống lưu thành `"+84"` (không có số thật nào) — không cảnh báo, không từ chối. Dữ liệu sai trông như hợp lệ, khó phát hiện khi rà soát sau này.

**Vị trí:** `src/app/actions.js`, hàm `normalizeContactValue(type, rawValue)` (dòng ~786-812), nhánh xử lý phone (dòng ~794-801):
```js
if (t.includes("phone") || t.includes("tel") || t.includes("mobile") || t.includes("call")) {
    let digits = val.replace(/[^\d+]/g, "");
    if (digits.startsWith("0")) {
      digits = "+84" + digits.slice(1);
    } else if (!digits.startsWith("+")) {
      digits = "+84" + digits;
    }
    return digits;
  }
```

**Cách sửa:** Sau khi tính `digits`, kiểm tra số lượng CHỮ SỐ THẬT (không tính dấu `+`) phải đủ tối thiểu (Việt Nam: số điện thoại có 9-10 chữ số sau mã vùng `+84`, để an toàn dùng ngưỡng tối thiểu 8 chữ số sau `+84`, tối đa 11 — tránh chặn nhầm số hợp lệ nhưng vẫn chặn được rác rõ ràng như `"abc-not-a-phone"` cho ra 0 chữ số):
```js
if (t.includes("phone") || t.includes("tel") || t.includes("mobile") || t.includes("call")) {
    let digits = val.replace(/[^\d+]/g, "");
    if (digits.startsWith("0")) {
      digits = "+84" + digits.slice(1);
    } else if (!digits.startsWith("+")) {
      digits = "+84" + digits;
    }
    const digitCount = digits.replace(/\D/g, "").length; // đếm chữ số thật, bỏ dấu +
    if (digitCount < 8 || digitCount > 12) {
      return ""; // coi như invalid — hàm gọi nó (addContactPoint, updateContactPoint) đã có sẵn check `if (!normalized) return { success: false, error: "Contact value is invalid" }`
    }
    return digits;
  }
```
Vì `addContactPoint` (dòng ~591) và `updateContactPoint` đã có sẵn `if (!normalized) return { success: false, error: "Contact value is invalid" };` ngay sau khi gọi `normalizeContactValue`, nên chỉ cần hàm trả về `""` là tự động bị chặn đúng luồng có sẵn, không cần sửa thêm gì ở 2 hàm đó.

**Verify:** 
1. Thử lại UI: Type=Phone, Value=`abc-not-a-phone` → phải bị từ chối với lỗi "Contact value is invalid", KHÔNG được lưu.
2. Thử số hợp lệ thật (ví dụ `0912345678`, hoặc `+84912345678`, hoặc có định dạng còn dấu cách/gạch ngang như `091-234-5678`) → vẫn phải chấp nhận và chuẩn hoá đúng như trước (không được gây hồi quy).
3. Gọi lại `/api/db-test`, `/api/qa-test` → tất cả kịch bản liên quan phone/dedup vẫn phải PASS như cũ.

---

## FIX 3 — Chuẩn hoá hiển thị NGÀY GIỜ (timestamp) toàn hệ thống

**Yêu cầu từ Product Owner:** Hiện tại các nơi hiển thị timestamp (ví dụ dòng Action Note "8/31/2026, 21:52:55") đang dùng định dạng Mỹ `M/D/YYYY` — dễ gây nhầm lẫn (ví dụ `8/31` bị hiểu nhầm là ngày 8 tháng 31 nếu đọc theo kiểu dd/mm). Cần đổi thống nhất toàn hệ thống thành: **`D - Mon - YYYY HH:mm:ss`** (ví dụ: `31 - Aug - 2026 21:52:55`) — ngày dùng số, tháng dùng chữ viết tắt tiếng Anh 3 ký tự (Jan, Feb, Mar... để không nhầm lẫn ngôn ngữ), năm 4 số, giờ giữ nguyên định dạng 24h có giây (`HH:mm:ss`) như hiện tại — **không đổi phần giờ/phút/giây**, chỉ đổi phần ngày/tháng/năm và cách nối giữa ngày và giờ (bỏ dấu phẩy, dùng khoảng trắng).

**Bước 1 — Tạo hàm dùng chung** trong `src/lib/utils.js` (thêm vào cuối file, giữ nguyên hàm `cn()` đã có):
```js
const MONTH_ABBR_EN = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

// Trả về "31 - Aug - 2026" — chỉ phần ngày, không có giờ
export function formatDateVN(dateInput) {
  if (!dateInput) return "";
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return "";
  return `${d.getDate()} - ${MONTH_ABBR_EN[d.getMonth()]} - ${d.getFullYear()}`;
}

// Trả về "31 - Aug - 2026 21:52:55" — ngày + giờ 24h có giây
export function formatDateTimeVN(dateInput) {
  if (!dateInput) return "";
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return "";
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  const ss = String(d.getSeconds()).padStart(2, "0");
  return `${formatDateVN(d)} ${hh}:${mm}:${ss}`;
}
```
⚠️ Lưu ý: đây là hàm HIỂN THỊ (presentation) — KHÔNG được dùng để thay đổi cách lưu dữ liệu vào DB. Cột `date`/`timestamp` trong DB và giá trị `value` truyền cho `<input type="date">` (xem FIX 4) vẫn phải giữ nguyên định dạng ISO `yyyy-mm-dd` như hiện tại — chỉ phần HIỂN THỊ CHO NGƯỜI DÙNG XEM mới đổi.

**Bước 2 — Thay thế tất cả các nơi đang tự format timestamp** bằng 2 hàm trên (import `{ formatDateVN, formatDateTimeVN }` từ `@/lib/utils` hoặc đường dẫn tương đối đúng theo cách file đó đang import từ `lib/utils`):

| File | Dòng (khoảng) | Code cũ | Thay bằng |
| --- | --- | --- | --- |
| `src/app/page.js` | ~1258 | `{log.action_date ? new Date(log.action_date).toLocaleString("en-US", { hour12: false }) : "N/A"}` | `{log.action_date ? formatDateTimeVN(log.action_date) : "N/A"}` |
| `src/app/candidates/page.js` | ~1315 | `{log.action_date ? new Date(log.action_date).toLocaleDateString() : ""}` | `{log.action_date ? formatDateVN(log.action_date) : ""}` |
| `src/app/candidates/page.js` | ~697 | `new Date(c.added_at).toLocaleDateString()` | `formatDateVN(c.added_at)` |
| `src/app/jobs/page.js` | ~1001 | `new Date(res.data.action_date).toLocaleString("en-US", { dateStyle: "short", timeStyle: "short" })` | `formatDateTimeVN(res.data.action_date)` |
| `src/app/jobs/page.js` | ~1043 | `new Date(editData.action_date).toLocaleString("en-US", { dateStyle: "short", timeStyle: "short" })` | `formatDateTimeVN(editData.action_date)` |

**Verify:** Mở lại Action Menu, Candidates 360° View, Jobs Workbench — tất cả các chỗ hiển thị timestamp phải cùng 1 kiểu `D - Mon - YYYY HH:mm:ss` (hoặc `D - Mon - YYYY` cho chỗ chỉ hiển thị ngày), không còn kiểu `M/D/YYYY` nào sót lại. Chạy `grep -rn "toLocaleDateString\|toLocaleString" src/app/` phải KHÔNG còn kết quả nào liên quan đến hiển thị ngày cho người dùng (trừ khi phát hiện thêm chỗ khác ngoài danh sách trên — nếu có, báo lại cho tôi trước khi tự ý sửa thêm, theo đúng quy trình mục 10 GEMINI.md).

---

## FIX 4 — Component chọn ngày (Date Picker) dùng chung cho Planning Date & Date of Birth

**Bối cảnh:** Hiện tại có 3 nơi dùng `<input type="date">` gốc của trình duyệt, KHÔNG dùng chung component nào:
- `src/app/page.js` dòng ~894-903 (Planning Date, Action Menu — ô nhỏ trong bảng)
- `src/app/candidates/page.js` dòng ~892-897 (Date of Birth — ô trong form hồ sơ)
- `src/app/jobs/page.js` dòng ~2833-2839 (Planning Date, Jobs Workbench)

**Về đề xuất "tích hợp shadcn/ui toàn hệ thống ngay từ bây giờ" của Antigravity:** Đã ghi nhận, nhưng CHƯA phê duyệt làm như 1 việc riêng, quy mô lớn (snapshot + scaffold hàng loạt component gốc). Lý do: chưa cần thiết — chỉ nên mở rộng thêm component gốc khi có nhu cầu thực tế cụ thể, như Fix 4 này (cần `Calendar` + `Popover`). Việc "snapshot backup" cũng không cần làm riêng — Git hiện đã là nguồn dữ liệu duy nhất (single source of truth), mọi thay đổi đều commit được, không cần thêm cơ chế backup nào khác. **Antigravity: KHÔNG tự ý sinh thêm component gốc nào khác ngoài `calendar` và `popover` nêu ở Bước 1 dưới đây** — nếu thấy cần thêm component khác cho việc gì đó, dừng lại và báo cáo trước, đúng theo quy trình mục 10 GEMINI.md.

**Vấn đề:** `<input type="date">` gốc của trình duyệt hiển thị định dạng ngày (dd/mm/yyyy hay mm/dd/yyyy) tuỳ theo ngôn ngữ hệ điều hành/trình duyệt của TỪNG máy người dùng — **web app không có cách nào ép định dạng hiển thị của nó**, đây chính là lý do bạn thấy hiển thị sai lệch ("dd----yyyy" thiếu phần mm) trên máy của bạn. Vì vậy không thể chỉ "sửa CSS" — cần thay hẳn bằng 1 component tự vẽ (không dùng input gốc) để kiểm soát được định dạng.

**Quyết định kiến trúc (đã tư vấn với Product Owner):** Gộp thành 1 component dùng chung duy nhất, vì:
1. Input gốc không kiểm soát được định dạng — bắt buộc phải tự làm, và nếu tự làm thì nên làm 1 lần dùng chung, tránh 3 chỗ code trùng lặp (đã thấy dấu hiệu lệch nhau: cách truyền `value` ở `jobs/page.js` khác 2 chỗ còn lại, dùng `.toISOString().substring(0,10)`).
2. Yêu cầu định dạng `dd-mm-yyyy` áp dụng đồng loạt cho mọi trường ngày (Planning Date, Date of Birth, và bất kỳ trường ngày nào thêm sau này) — có sẵn 1 component dùng chung thì lần sau chỉ cần import, không phải làm lại.

**Cập nhật quan trọng (theo chỉ đạo của Product Owner: ưu tiên tận dụng cái đã có sẵn, không tự chế lại từ đầu):** Dự án đã cài sẵn `shadcn/ui` (xem `components.json`, style `base-nova`, dùng `@base-ui/react` làm primitive, KHÔNG dùng Radix) và đã có 3 component gốc do Antigravity sinh trước đó: `src/components/ui/button.jsx`, `select.jsx`, `sheet.jsx`. Đây chính xác là hệ thống nên dùng cho việc này — không cài thư viện date-picker rời rạc, không tự vẽ lịch từ đầu.

**Cách làm:**

Bước 1 — Sinh thêm 2 component gốc còn thiếu bằng đúng CLI của shadcn (để đồng bộ 100% style với Button/Select/Sheet đã có, không lệch theme):
```
npx shadcn@latest add calendar popover
```
Lệnh này tự sinh `src/components/ui/calendar.jsx` và `src/components/ui/popover.jsx` đúng style "base-nova" hiện có, và tự thêm các dependency cần thiết vào `package.json` (component `Calendar` chuẩn của shadcn dùng `react-day-picker` + `date-fns` bên dưới — CLI tự lo phần cài đặt này, không cần `npm install` tay).

⚠️ Nếu lệnh CLI lỗi hoặc không chạy được (ví dụ do môi trường không có mạng ra ngoài) — **DỪNG LẠI, báo cáo lỗi cụ thể cho tôi**, không tự ý chuyển sang cài `react-day-picker`/`date-fns` tay rồi tự viết component từ đầu thay thế, vì như vậy sẽ lệch style với Button/Select/Sheet đã có.

Bước 2 — Tạo component mới `src/components/DateInputField.js`, **lắp ghép từ 2 component gốc `Popover` + `Calendar` vừa sinh** (không viết lại UI lịch từ đầu, không cài thêm thư viện date-picker nào khác), với hợp đồng (contract) sau:
- Props: `value` (string dạng `"yyyy-mm-dd"` hoặc rỗng `""`/`null` — giữ NGUYÊN định dạng này để tương thích với cách các nơi gọi đang lưu/gửi dữ liệu lên server, KHÔNG đổi sang định dạng khác), `onChange(newValue)` (trả về string `"yyyy-mm-dd"` giống hệt input gốc để không phải sửa logic ở nơi gọi), `className` (để nơi gọi tuỳ chỉnh style cho khớp bối cảnh — ô nhỏ trong bảng vs ô lớn trong form), `placeholder` (mặc định `"dd-mm-yyyy"`).
- Hành vi: 1 ô input dạng text hiển thị giá trị theo format `dd-mm-yyyy` (dùng `date-fns` để parse/format, ví dụ `format(date, "dd-MM-yyyy")`), có icon lịch bên cạnh (dùng icon có sẵn từ `lucide-react`, ví dụ `Calendar`), bấm vào icon hoặc vào ô mở popup lịch (`react-day-picker`) để chọn ngày. Có nút xoá (icon `X`) để clear về rỗng, tương đương hành vi nút "x" của input gốc.
- Style: theo đúng theme tối (dark) hiện có của toàn app (nền `slate-900`/`slate-950`, viền `slate-700`, chữ `slate-100`/`slate-200`, accent màu `emerald-500` khi focus/hover — xem class Tailwind đang dùng ở các input khác trong cùng file để đồng bộ).

Bước 3 — Thay thế cả 3 nơi dùng `<input type="date">` bằng `<DateInputField />`, giữ nguyên logic `value`/`onChange` hiện có của từng nơi (chỉ đổi tag, không đổi hàm xử lý dữ liệu phía sau `onChange`):
- `src/app/page.js` (~894-903): giữ nguyên `value={app.planning_date || ""}` và `onChange={(newVal) => handleInlineUpdate(app.application_id, "planning_date", newVal)}`.
- `src/app/candidates/page.js` (~892-897): giữ nguyên `value={formData.dob}` và `onChange={(newVal) => setFormData({ ...formData, dob: newVal })}`.
- `src/app/jobs/page.js` (~2833-2839): giữ nguyên cách tính `value` hiện tại (`app.raw_planning_date ? new Date(app.raw_planning_date).toISOString().substring(0, 10) : ""`) và `onChange={(newVal) => handleUpdateAppField(app.id, "planning_date", newVal)}`.

**Verify:**
1. Mỗi nơi trong 3 nơi trên: ô hiển thị đúng `dd-mm-yyyy`, click mở được lịch, chọn ngày cập nhật đúng giá trị, nút xoá hoạt động.
2. Lưu Planning Date / Date of Birth qua UI → refresh trang → giá trị vẫn đúng (xác nhận dữ liệu lưu DB không bị sai lệch do đổi component).
3. Chạy lại `/api/qa-test`, `/api/db-test`, `/api/biz-test` → không có hồi quy nào liên quan đến `planning_date`, `dob`.
4. `npm run build` chạy thành công, không lỗi TypeScript/ESLint mới phát sinh.

---

## Yêu cầu báo cáo (bắt buộc)

Sau khi làm xong (toàn bộ hoặc từng phần), dán lại:
1. `git diff` đầy đủ của tất cả file đã sửa + `git status` (để thấy file mới `src/lib/utils.js` đổi và `src/components/DateInputField.js` mới tạo).
2. Output của `npm run build`.
3. Kết quả JSON thô của `/api/qa-test`, `/api/db-test`, `/api/biz-test` sau khi sửa.
4. 1-2 ảnh chụp màn hình (nếu tiện) cho thấy Planning Date / Date of Birth / Action Note timestamp hiển thị đúng định dạng mới.

Không viết "hoàn thành" hay "100% PASS" trong báo cáo — chỉ đưa bằng chứng thô, tôi sẽ tự xác nhận độc lập.
