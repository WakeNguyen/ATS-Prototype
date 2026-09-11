# Thẩm định độc lập FIX 1–4 (UI-14, UI-15, định dạng ngày/giờ, DateInputField) — 2026-09-01

**Phương pháp:** Đối chiếu `git show ef85998 -- <file>` với từng đoạn diff AG dán trong phần phản biện, đọc trực tiếp code hiện tại trên đĩa, tự gọi lại `/api/qa-test` + `/api/db-test` (2 lần) + `/api/biz-test`, và trực tiếp thao tác tay trên `localhost:3000` cho cả 2 trường hợp UI-14 và UI-15 cùng component DateInputField mới.

## 0. Về phần "phản biện" của AG (mốc thời gian 575c25b0/7f8854d/6bc0400)

Không có gì để tranh luận thêm — nhận định "chưa hoàn thành" của tôi là ở round kiểm tra TRƯỚC `7f8854d`; tôi đã tự xác nhận và ghi nhận `7f8854d` hoàn thành đúng ở round kiểm tiếp theo (`qa-reverify-2026-09-01-round3.md`, mục kết luận: "Cả 3 fix... đã được Antigravity thực hiện đúng và đầy đủ"). Đây không phải bất đồng đang mở, khỏi cần xử lý gì thêm.

## 1. Kết quả test hồi quy sau commit `ef85998`

- `/api/qa-test`: 5/5 PASS (DB-06/07, DB-11/12, DB-20, BIZ-13, SMOKE) — không hồi quy.
- `/api/db-test` (gọi 2 lần liên tiếp): 19/20 PASS cả 2 lần, chỉ `DB-09 FAIL` — đây là lỗi assertion CŨ trong file test tự động (không phải bug thật, đã đính chính ở round 3: `+84912345678` là định dạng ĐÚNG theo yêu cầu của bạn). `DB-10` (JSONB lost-update fix từ đợt trước) PASS ổn định cả 2 lần.
- `/api/biz-test`: 22/22 PASS.

→ **Không có hồi quy nào từ commit `ef85998`.**

## 2. Bằng chứng "raw evidence" của AG — có 1 chỗ không khớp thực tế

Đối chiếu từng file AG dán với `git show ef85998`:

| File | Khớp với diff AG dán? |
| --- | --- |
| `src/app/actions.js` | ✅ Khớp 100% |
| `src/lib/utils.js` | ✅ Khớp 100%, đúng từng ký tự với code trong fix spec |
| `src/app/candidates/page.js`, `jobs/page.js`, `page.js` | ✅ Khớp 100% |
| `src/components/DateInputField.js` | ✅ Khớp 100% |
| **`package.json`** | ❌ **KHÔNG khớp.** AG dán diff cho thấy `next: "14.2.7"`, `lucide-react: "^0.435.0"`, `date-fns: "^4.1.0"`, và **không hề có `react-day-picker`**. Thực tế trên đĩa (và trong chính commit `ef85998`): `next: "16.3.0"`, `lucide-react: "^1.38.0"`, `date-fns: "^4.4.0"`, có thêm `react-day-picker: "^10.0.1"`. |

Đây rõ ràng là AG dán nhầm output cũ/khác (có thể từ 1 lần chạy `git diff` trước đó, hoặc nhầm buffer) — không phải cố ý sai lệch, và không ảnh hưởng gì vì bản thật trên đĩa đúng. Chỉ nêu ra để bạn biết: **nên luôn tự thẩm định độc lập, đừng chỉ tin văn bản AG dán**, kể cả khi phần lớn khớp đúng.

(`npm run build` tôi tự chạy thử qua kênh của tôi bị lỗi mạng DNS cục bộ (`EAI_AGAIN registry.npmjs.org`) — không phải bằng chứng phản bác AG, chỉ là môi trường build của tôi không có sẵn mạng cho bước đó. Tôi chuyển sang test trực tiếp trên trình duyệt để xác nhận thay vì dựa vào build log.)

## 3. Test sống UI-14 — đã sửa 1 nửa, còn sót 1 chỗ khiến thông báo mới không bao giờ chạy

Đã thêm đúng như spec: `handleAddJob` (`jobs/page.js` dòng ~933) giờ có `alert("Vui lòng nhập tên Job Order trước khi tạo.")` khi tên trống. Server-side `createJobForClient` cũng đã chặn đúng.

**NHƯNG:** nút "Add Job" (`jobs/page.js` dòng ~2505) có `disabled={... || !newJobTitle.trim()}` — nút bị **disable ngay khi ô tên trống**. Tôi test cả bấm nút lẫn nhấn Enter trong ô nhập (để trống) → không có `alert()` nào chạy (xác nhận qua console: không thấy dòng "Page dialog suppressed" — dấu hiệu alert không hề được gọi), vì nút disable nên `handleAddJob` không bao giờ được kích hoạt qua đường này. Nói cách khác: đoạn code `alert(...)` mới thêm là **dead code**, chỉ có thể chạy nếu ai đó gọi hàm `handleAddJob` bằng cách khác (ví dụ qua devtools).

→ Cần sửa thêm 1 dòng: bỏ điều kiện `!newJobTitle.trim()` khỏi `disabled` của nút (chỉ giữ `isCreatingClient || addingJob`), để nút luôn bấm được và alert thật sự hiển thị khi tên trống.

## 4. Test sống UI-15 — ĐÃ SỬA ĐÚNG, hoạt động tốt

Thử lại y hệt kịch bản cũ: Candidate #11687, thêm Contact Point Type=Phone, Value=`abc-not-a-phone` → hệ thống từ chối ngay với toast rõ ràng: **"Failed to add contact point: Contact value is invalid"**. Contact Points Hub vẫn giữ nguyên (3), không có số `"+84"` giả nào được lưu. ✅ Đúng như spec yêu cầu, có UX tốt hơn cả spec đề xuất (toast rõ ràng thay vì chỉ chặn âm thầm).

## 5. Test sống Fix 3 (định dạng timestamp) — ĐÚNG

Timestamp trên Action Note hiển thị đúng "31 - Aug - 2026 21:52:55" như yêu cầu.

## 6. Test sống Fix 4 (DateInputField) — component chạy được, nhưng có 1 lỗi kỹ thuật thật + 1 điểm lệch spec

### 6a. Lỗi thật đã xác định chính xác nguyên nhân: hydration error do dùng sai API

Mở trang Candidates hoặc Jobs đều thấy badge đỏ "3 Issues" của Next.js dev overlay. Console xác nhận:

```
In HTML, <button> cannot be a descendant of <button>. This will cause a hydration error.
React does not recognize the `asChild` prop on a DOM element...
```

**Nguyên nhân chính xác:** `src/components/DateInputField.js` dùng `<PopoverTrigger asChild><button>...</button></PopoverTrigger>` — đây là cú pháp của **Radix UI**. Nhưng `src/components/ui/popover.jsx` của dự án bọc **Base UI** (`@base-ui/react/popover`), và `PopoverTrigger` của Base UI **không hỗ trợ prop `asChild`** — nó luôn tự render ra 1 thẻ `<button>` mặc định (xác nhận qua `node_modules/@base-ui/react/popover/trigger/PopoverTrigger.d.ts`), bất kể có truyền `asChild` hay không. Kết quả: `<button>` do PopoverTrigger tự tạo lồng thêm `<button>` viết tay bên trong → sai cấu trúc HTML, gây lỗi hydration.

File `src/components/ui/sheet.jsx` có sẵn trong dự án (component `Sheet`, cũng dùng Base UI) làm ĐÚNG — nó không dùng `asChild` mà dùng prop `render` của Base UI. Đây là mẫu đúng cần theo.

**Về mức độ ảnh hưởng thực tế:** component vẫn dùng được — tôi bấm mở lịch, chọn ngày, đều hoạt động bình thường (React tự phục hồi sau lỗi hydration ở phía client). Không mất chức năng, nhưng: (1) làm bẩn console/dev overlay liên tục, gây khó chịu khi debug sau này, (2) về nguyên tắc là HTML không hợp lệ, có thể gây hành vi khó lường trên 1 số trình duyệt/trợ năng (screen reader), nên vẫn nên sửa dứt điểm chứ không để "chạy được nên thôi".

### 6b. Định dạng hiển thị trong picker lệch yêu cầu ban đầu của bạn

Bạn yêu cầu rõ: Planning Date và Date of Birth (2 trường NHẬP LIỆU, có date picker) hiển thị dạng số **`dd-mm-yyyy`**, khác với timestamp chỉ-đọc dùng dạng chữ `dd - MMM - yyyy`. Tôi test chọn ngày 15/09/2026 → picker hiển thị **"15 - Sep - 2026"** (dạng chữ, giống hệt Fix 3 dùng cho timestamp), không phải "15-09-2026" như bạn yêu cầu cho trường nhập liệu.

Đây không phải lỗi kỹ thuật — component chạy đúng, chỉ là AG chọn nhầm định dạng hiển thị cho ô picker (lấy nhầm format của Fix 3 áp vào Fix 4). Cần xác nhận lại với bạn: bạn có muốn đổi đúng lại thành số `dd-mm-yyyy` (ví dụ "15-09-2026") cho 2 ô picker này không, hay giữ dạng chữ "15 - Sep - 2026" cho đồng bộ nhìn với timestamp cũng được (dễ đọc hơn, ít nhầm ngày/tháng hơn số thuần)? Tôi cần bạn chốt trước khi giao fix tiếp, vì đây là lựa chọn về trải nghiệm chứ không phải lỗi rõ ràng đúng/sai.

## Tổng kết

| Hạng mục | Trạng thái |
| --- | --- |
| Hồi quy sau `ef85998` | ✅ Không có |
| Fix 1 (UI-14) — alert khi tên trống | ⚠️ Code đúng nhưng **không chạy được** do nút bị disable — cần sửa 1 dòng |
| Fix 1 (UI-14) — chặn server-side | ✅ Đúng |
| Fix 2 (UI-15) — chặn phone rác | ✅ Đúng, verified live |
| Fix 3 — định dạng timestamp | ✅ Đúng, verified live |
| Fix 4 — DateInputField hoạt động | ✅ Chạy được (chọn ngày lưu đúng) |
| Fix 4 — lỗi hydration `asChild` | 🔴 **Lỗi thật, cần sửa** — nguyên nhân đã xác định chính xác |
| Fix 4 — định dạng hiển thị trong picker | ⚠️ Lệch yêu cầu gốc (chữ thay vì số) — cần bạn chốt hướng trước khi giao fix |
| Bằng chứng package.json AG dán | ❌ Không khớp thực tế (nhưng file thật trên đĩa đúng, không ảnh hưởng) |
