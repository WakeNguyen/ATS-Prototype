# FIX SPEC — PHẦN R.3: Candidates Hub — Panel Danh Sách + Lưới Prefix/Full Name (Lộ Trình Responsive Tablet)

**Từ:** Claude (Architect/QA)
**Gửi:** Antigravity (Implementer)
**Ngày:** 2026-09-05
**Bối cảnh:** Theo `docs/architecture/PLAN_2026-09-03_tablet-responsive-rollout.md`, PHẦN R.1 (safety net `overflow-x-auto`) và PHẦN R.2 (NavbarTabs co gọn) đã PASS QA 100%. Đây là PHẦN R.3: `src/app/candidates/page.js` (Candidates Hub — trang dùng nhiều nhất) hiện dùng bố cục 2 cột cố định "5:7 DUAL PANE LAYOUT" — panel trái (Personal Info + Contact Points) cố định `w-[42%]`, panel phải (Applications Pipeline & CV Viewer) chiếm phần còn lại qua `flex-1`. Ở khổ tablet 768px, 42% ≈ 322px (trừ padding/gap còn ít hơn) là quá chật để đọc form/bảng — đây là PHẦN có rủi ro Trung bình-Cao theo audit gốc.

**Khác biệt so với R.1/R.2:** PHẦN này đổi HƯỚNG flex (row → column) ở khổ hẹp, không chỉ thêm 1 class CSS đơn lẻ như R.1/R.2 — rủi ro kỹ thuật cao hơn, cần AG đọc kỹ mục 2 (lý do từng thay đổi) trước khi code, và Claude sẽ QA kỹ hơn tương ứng (xem mục 3).

---

## 0. Phạm vi (CHỈ sửa đúng phần này)

✅ Trong phạm vi — CHỈ 4 vị trí sau trong `src/app/candidates/page.js`:

1. Container bố cục chính "MAIN WORKSPACE CONTAINER" (dòng ~876).
2. Panel trái "LEFT PANE: PERSONAL INFO & CONTACTS HUB" (dòng ~880) — chỉ đổi bề rộng.
3. Grid Prefix + Full Name (dòng ~911) — bên trong Card "Personal Information Form".
4. Panel phải "RIGHT PANE: APPLICATIONS PIPELINE & CV VIEWER" (dòng ~1224) — chỉ thêm min-height an toàn cho chế độ xếp chồng.

❌ NGOÀI phạm vi:
- KHÔNG đổi 2 khối `grid grid-cols-2` khác trong cùng file (dòng ~344 — trong modal "Assign to Job Order"; dòng ~945 — DOB & Source Channel): không thuộc audit gốc của Plan, 2 cột đã đủ rộng ở mọi khổ tablet mục tiêu, giữ nguyên 100%.
- KHÔNG đổi nội dung/logic bên trong 2 card (Personal Information Form, Contact Points Hub) hay bên trong panel phải (Applications Pipeline, Embedded CV Viewer) — chỉ đổi wrapper/breakpoint như mô tả ở mục 1.
- KHÔNG đổi `SearchableCandidateSwitcher`, header trên cùng (dòng ~776-870), hay bất kỳ component con nào khác.
- KHÔNG đổi breakpoint `md:`/`lg:` mặc định của Tailwind, không thêm breakpoint tuỳ biến mới — dùng đúng `lg:` (≥1024px) làm điểm quay lại đúng bố cục desktop, giống quy ước đã dùng ở PHẦN R.2 (`hidden lg:inline`).
- Nếu đọc code thực tế thấy khác với mô tả dưới đây (do file đã đổi từ lúc viết spec), tìm đúng đoạn bằng ngữ cảnh (comment header `{/* ... */}` ngay phía trên mỗi vị trí vẫn còn nguyên), KHÔNG đoán bừa — nếu không chắc, dừng lại hỏi Claude theo mục 10 GEMINI.md.

---

## 1. Thay đổi cụ thể

### 1.1. Container chính — đổi hướng flex thành cột ở tablet, hàng ngang từ `lg:` trở lên

**Trước (dòng ~876):**
```jsx
      <div className="flex-1 flex overflow-hidden p-4 gap-4">
```

**Sau:**
```jsx
      <div className="flex-1 flex flex-col lg:flex-row overflow-y-auto lg:overflow-hidden p-4 gap-4">
```

Giải thích: dưới `lg:` (< 1024px), 2 panel xếp CHỒNG DỌC (`flex-col`) thay vì cạnh nhau, và container tự cho phép cuộn dọc (`overflow-y-auto`) vì tổng chiều cao 2 panel xếp chồng nhiều khả năng vượt quá chiều cao khả dụng — đúng tinh thần "safety net" đã dùng ở R.1. Từ `lg:` trở lên (≥1024px, bao trùm khổ desktop chính ≥1280px), quay lại ĐÚNG NGUYÊN VĂN hành vi cũ: `flex-row` + `overflow-hidden` — không đổi gì ở desktop.

### 1.2. Panel trái — full-width ở tablet, giữ 42% từ `lg:` trở lên

**Trước (dòng ~880):**
```jsx
        <div className="w-[42%] flex flex-col gap-4 overflow-y-auto custom-scrollbar pr-1">
```

**Sau:**
```jsx
        <div className="w-full lg:w-[42%] flex flex-col gap-4 overflow-y-auto custom-scrollbar pr-1">
```

Giải thích: dưới `lg:`, panel trái chiếm full-width của container (vì đã xếp chồng dọc ở mục 1.1) thay vì bị ép 42%. Từ `lg:` trở lên, quay lại đúng `w-[42%]` như cũ.

### 1.3. Grid Prefix + Full Name — 2 cột ở tablet, 4 cột từ `lg:` trở lên

**Trước (dòng ~911, bên trong Card "Personal Information Form"):**
```jsx
            <div className="grid grid-cols-4 gap-2.5">
```

**Sau:**
```jsx
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
```

Giải thích: 2 ô con bên trong là `<div className="col-span-1">` (Prefix) và `<div className="col-span-3">` (Full Name). Ở lưới 2 cột, `col-span-3` sẽ tự động bị trình duyệt giới hạn lại còn tối đa 2 cột — kết quả là Prefix chiếm nửa trái hàng 1, Full Name tự động xuống hàng 2 chiếm trọn full-width (không cần đổi `col-span-1`/`col-span-3` trong code, hành vi grid tự xử lý đúng). Từ `lg:` trở lên, quay lại đúng 4 cột với tỉ lệ 1:3 trên cùng 1 hàng như cũ.

### 1.4. Panel phải — thêm min-height an toàn cho chế độ xếp chồng

**Trước (dòng ~1224):**
```jsx
        <div className="flex-1 flex flex-col bg-slate-900/90 border border-slate-800 rounded-2xl shadow-xl overflow-hidden min-w-0">
```

**Sau:**
```jsx
        <div className="flex-1 flex flex-col bg-slate-900/90 border border-slate-800 rounded-2xl shadow-xl overflow-hidden min-w-0 min-h-[560px] lg:min-h-0">
```

Giải thích: khi xếp chồng dọc (dưới `lg:`), panel phải (chứa tab Applications Pipeline / Embedded CV Viewer) không còn được "stretch" theo chiều cao hàng ngang như trước — nếu không có min-height, panel này có thể bị co lại quá thấp tuỳ theo chiều cao nội dung panel trái, gây khó dùng. `min-h-[560px]` đảm bảo panel phải luôn có đủ không gian hợp lý để xem bảng Applications hoặc CV Viewer trên tablet dọc (768×1024). Từ `lg:` trở lên, `min-h-0` là giá trị mặc định ban đầu (không có min-height) — quay lại đúng hành vi cũ, không đổi gì ở desktop.

**Lưu ý cho AG:** `560px` là giá trị đề xuất ban đầu dựa trên ước tính, không phải con số bắt buộc cứng — nếu khi test trực quan ở 768×1024 thấy panel phải vẫn bị cảm giác chật (ví dụ CV Viewer/bảng Applications bị bó hẹp bất thường), được phép điều chỉnh tăng/giảm trong khoảng ±100px, miễn là: (a) không đổi gì ở `lg:` trở lên, (b) ghi rõ giá trị cuối cùng và lý do điều chỉnh trong báo cáo khi giao lại cho Claude QA.

---

## 2. Vì sao cách này an toàn (đọc trước khi code)

- Tất cả 4 thay đổi đều theo đúng mẫu mobile-first + `lg:` override đã dùng ở R.2: giá trị KHÔNG có prefix áp dụng cho mọi độ rộng (bao gồm cả tablet 768-1024px mục tiêu), giá trị có prefix `lg:` chỉ áp dụng từ 1024px trở lên — đây chính là ngưỡng "quay lại y hệt desktop" đã được xác nhận đúng ở R.2.
- Ở ≥1024px (bao trùm toàn bộ khổ desktop chính ≥1280px đang dùng), cả 4 vị trí đều có class `lg:` phục hồi ĐÚNG NGUYÊN VĂN giá trị cũ (`flex-row`, `overflow-hidden`, `w-[42%]`, `grid-cols-4`, `min-h-0` = mặc định) — về lý thuyết CSS phải render pixel-identical với trước khi sửa. Đây là điểm QA sẽ verify kỹ nhất (xem mục 3).
- Không đụng bất kỳ logic JS/state nào, không đổi component con, không đổi thứ tự phần tử trong DOM (panel trái vẫn đứng trước panel phải trong code — khi xếp dọc sẽ tự nhiên hiện Personal Info phía trên, Applications/CV Viewer phía dưới, đúng thứ tự ưu tiên đọc thông tin).

---

## 3. Yêu cầu QA/test trước khi báo PASS

1. **Test trực quan ở 3 mốc tablet: 768px, 834px, 1024px** (DevTools responsive mode hoặc `resize_window`):
   - 2 panel xếp CHỒNG DỌC, panel trái (Personal Info + Contact Points) full-width, nằm TRÊN; panel phải (Applications & Pipeline / CV Viewer) full-width, nằm DƯỚI.
   - Prefix hiện nửa trái hàng đầu, Full Name tự xuống hàng dưới chiếm full-width (không bị cắt/tràn).
   - Cuộn dọc được để xem hết cả 2 panel (không có nội dung nào bị kẹt/mất do `overflow-hidden`).
   - Panel phải có chiều cao đủ dùng (không bị bó hẹp bất thường) — nếu cần chỉnh `min-h`, áp dụng theo lưu ý ở mục 1.4.
2. **Test đúng ngưỡng chuyển `lg:` (1024px):** xác nhận dưới 1024px là bố cục xếp chồng, từ 1024px trở lên chuyển hẳn sang 2 cột cạnh nhau như cũ.
3. **Đối chiếu KHÔNG có regression ở độ rộng desktop bình thường (≥1280px) — bắt buộc so sánh trước/sau:**
   - Chụp màn hình (hoặc đo qua `find`/`read_page`) panel trái đúng 42% bề rộng, panel phải đúng phần còn lại, layout 2 cột cạnh nhau y hệt trước khi sửa.
   - Grid Prefix/Full Name vẫn đúng tỉ lệ 1:3 trên cùng 1 hàng.
   - Container vẫn `overflow-hidden` (không phát sinh thanh cuộn dọc thừa ở container cha nếu nội dung vừa đủ như trước).
4. Console sạch (`read_console_messages(onlyErrors=true)`), không có warning hydration mismatch.
5. `npm run build` PASS, không lỗi lint.
6. Cập nhật `docs/DEVELOPMENT_LOG.md`: **BẮT BUỘC cập nhật CẢ 2 phần** — bảng tổng hợp đầu file VÀ chi tiết snapshot phía dưới (theo đúng quy tắc đã nhắc lại sau đợt lệch 1-2/9).

Nếu có bất kỳ điểm nào không rõ, hoặc code thực tế khác với mô tả trong spec này, dừng lại hỏi Claude trước khi tự quyết, theo mục 10 GEMINI.md. Sau khi PHẦN R.3 PASS QA, bước tiếp theo trong lộ trình là PHẦN R.4 (Jobs & Clients).
