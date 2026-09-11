# FIX SPEC — PHẦN R.4: Jobs & Clients Workbench — Bố Cục 2 Cột (Lộ Trình Responsive Tablet)

**Từ:** Claude (Architect/QA)
**Gửi:** Antigravity (Implementer)
**Ngày:** 2026-09-05
**Bối cảnh:** Theo `docs/architecture/PLAN_2026-09-03_tablet-responsive-rollout.md`, sau khi R.1, R.2, R.3 đã PASS QA 100%, đây là PHẦN R.4: `src/app/jobs/page.js` ("Jobs & Clients Workbench", file lớn nhất dự án — hiện 3010 dòng). Khu vực rủi ro cao nhất là **"MAIN WORKBENCH BODY"** (dòng ~2093): bố cục 2 cột — cột trái "Job Orders" cố định `w-[45%] min-w-[460px] max-w-[50%]`, cột phải "Applications & Pipeline" chiếm phần còn lại qua `flex-1`. Đây là **cùng dạng kiến trúc "dual pane" như Candidates Hub đã sửa ở PHẦN R.3** (container flex-row cố định, mỗi cột `h-full` để tràn hết chiều cao) — nên áp dụng đúng mẫu đã kiểm chứng ở R.3, có điều chỉnh cho phù hợp cấu trúc `h-full`/`min-h-0` đặc thù của file này (khác Candidates Hub, cả 2 cột ở đây đều dùng `h-full` để chiếm trọn chiều cao, không phải cột nào cũng có nội dung "form" ngắn).

**Đã audit thêm:** khu vực toolbar phía trên (TIER 1: Master Client Toolbar, dòng ~1075) **đã có sẵn `flex-wrap`** — tự động xuống hàng khi hẹp, không cần sửa ở PHẦN này. Bảng "Job Orders" bên trong cột trái (dòng ~2113, 6 cột: checkbox/ID/Job Title/Location/Working Mode/Status) đã có `overflow-x-auto` từ PHẦN R.1. Ước tính tổng bề rộng tối thiểu hợp lý của bảng này (~550-650px) **nhỏ hơn bề rộng full-width của cột trái khi xếp chồng dọc** (≥768px màn hình, trừ padding vẫn còn >700px) — nghĩa là việc xếp chồng dọc ở PHẦN này nhiều khả năng **tự loại bỏ luôn nhu cầu cuộn ngang** của bảng Job Orders trên tablet, không cần ẩn bớt cột như đã cân nhắc trong Plan gốc mục 2 (PHẦN R.4). Việc ẩn cột (nếu QA vẫn thấy cần) để dành đánh giá lại sau khi R.4 này PASS.

---

## 0. Phạm vi (CHỈ sửa đúng phần này)

✅ Trong phạm vi — CHỈ 3 vị trí sau trong `src/app/jobs/page.js`, đều nằm trong khối "MAIN WORKBENCH BODY":

1. Container chính của 2 cột (dòng ~2093).
2. Cột trái "LEFT COLUMN: JOB ORDERS & JOB NOTES" (dòng ~2098).
3. Cột phải "RIGHT COLUMN: APPLICATIONS & PIPELINE ACCORDION" (dòng ~2598).

❌ NGOÀI phạm vi:
- KHÔNG đụng TIER 1 Toolbar (dòng ~1075 trở lên) — đã có `flex-wrap` sẵn, an toàn.
- KHÔNG ẩn/thêm `hidden md:table-cell` cho bất kỳ cột nào trong bảng Job Orders — theo audit ở trên, nhiều khả năng không cần thiết sau khi xếp chồng dọc; nếu QA PHẦN này vẫn phát hiện bảng bị chật, báo lại Claude để đánh giá riêng, không tự ý thêm.
- KHÔNG đổi logic nút "Expand Pipeline / Split View" (`isAppsMaximized`, dòng ~422, ~2098, ~2648) — giữ nguyên hành vi toggle ẩn/hiện cột trái ở MỌI độ rộng màn hình, đây vẫn là 1 lối thoát thủ công hữu ích trên tablet.
- KHÔNG đổi nội dung/logic bên trong bảng Job Orders hay panel Applications & Pipeline — chỉ đổi wrapper/breakpoint như mô tả ở mục 1.
- KHÔNG đổi breakpoint mặc định — tiếp tục dùng `lg:` (≥1024px) làm điểm quay lại đúng bố cục desktop, đúng quy ước đã dùng xuyên suốt R.2/R.3.
- Nếu đọc code thực tế thấy khác với mô tả dưới đây, tìm đúng đoạn bằng ngữ cảnh (comment header `{/* ... */}` ngay phía trên mỗi vị trí), KHÔNG đoán bừa — nếu không chắc, dừng lại hỏi Claude theo mục 10 GEMINI.md.

---

## 1. Thay đổi cụ thể

### 1.1. Container chính — xếp chồng dọc ở tablet, hàng ngang từ `lg:` trở lên

**Trước (dòng ~2093):**
```jsx
      <div className="flex-1 flex gap-3 p-3 min-h-0 overflow-hidden w-full">
```

**Sau:**
```jsx
      <div className="flex-1 flex flex-col lg:flex-row gap-3 p-3 min-h-0 overflow-y-auto lg:overflow-hidden w-full">
```

Giải thích: đúng mẫu đã dùng ở R.3 — dưới `lg:` xếp chồng dọc + container tự cuộn dọc; từ `lg:` trở lên quay lại đúng nguyên văn `flex-row` + `overflow-hidden`.

### 1.2. Cột trái "Job Orders" — full-width + tự co theo nội dung ở tablet

**Trước (dòng ~2098):**
```jsx
        <div className={`${isAppsMaximized ? "hidden" : "w-[45%] min-w-[460px] max-w-[50%]"} flex flex-col h-full min-h-0 bg-[#0b1120] border border-slate-800/90 rounded-xl overflow-hidden shadow-inner shrink-0`}>
```

**Sau:**
```jsx
        <div className={`${isAppsMaximized ? "hidden" : "w-full lg:w-[45%] lg:min-w-[460px] max-w-full lg:max-w-[50%]"} flex flex-col h-auto lg:h-full min-h-[420px] lg:min-h-0 bg-[#0b1120] border border-slate-800/90 rounded-xl overflow-hidden shadow-inner lg:shrink-0`}>
```

Giải thích từng phần (đọc kỹ, đây là vị trí có nhiều class đổi nhất trong PHẦN này):
- `w-[45%]` → `w-full lg:w-[45%]`; `min-w-[460px]` → `lg:min-w-[460px]`; `max-w-[50%]` → `max-w-full lg:max-w-[50%]`: dưới `lg:`, cột chiếm full-width (không còn ép 45%/sàn 460px/trần 50% — các ràng buộc này chỉ có ý nghĩa khi 2 cột nằm cạnh nhau). Từ `lg:` trở lên, phục hồi đúng nguyên văn cả 3 giá trị cũ.
- `h-full` → `h-auto lg:h-full`: dưới `lg:`, cột tự co theo chiều cao nội dung thật (KHÔNG ép tràn hết chiều cao container cha) — nếu giữ nguyên `h-full` khi đã xếp chồng dọc, cột này sẽ chiếm trọn 100% chiều cao khả dụng dù nội dung ngắn, đẩy cột phải xuống dưới rất xa (phải cuộn qua 1 khoảng trống lớn mới thấy). Từ `lg:` trở lên, phục hồi đúng `h-full` như cũ.
- `min-h-0` → `min-h-[420px] lg:min-h-0`: **đây là điểm quan trọng nhất, đã được Claude tự kiểm chứng bằng mô phỏng CSS trước khi ban hành spec này** (xem mục 2 bên dưới) — đảm bảo cột trái luôn có sàn chiều cao hợp lý (420px) để xem được vài dòng Job Orders mà không bị co ép quá mức khi cột phải cũng cần không gian, đồng thời khi nội dung ít hơn 420px thì phần dư sẽ trống (chấp nhận được). Từ `lg:` trở lên, phục hồi đúng `min-h-0` như cũ.
- `shrink-0` → `lg:shrink-0`: dưới `lg:`, KHÔNG ép cột này giữ nguyên 100% chiều cao nội dung bất kể — để nó có thể co lại đến đúng sàn `min-h-[420px]` khi cột phải cũng cần không gian (nếu giữ `shrink-0` luôn bật, cột trái sẽ luôn chiếm đúng chiều cao nội dung của nó bất kể dài ngắn, đẩy cột phải xuống rất xa nếu Job Orders dài). Từ `lg:` trở lên, phục hồi đúng `shrink-0` như cũ (ở đó nó có ý nghĩa khác — chống co ép BỀ RỘNG khi 2 cột nằm ngang, không phải chiều cao).

**KHÔNG đổi gì khác trong class này** — `flex flex-col`, `bg-[#0b1120] border border-slate-800/90 rounded-xl overflow-hidden shadow-inner` giữ nguyên y hệt.

### 1.3. Cột phải "Applications & Pipeline" — tự co theo nội dung + sàn chiều cao ở tablet

**Trước (dòng ~2598):**
```jsx
        <div className="flex-1 min-w-0 flex flex-col h-full min-h-0 bg-[#0b1120] border border-slate-800/90 rounded-xl overflow-hidden shadow-inner transition-all duration-200">
```

**Sau:**
```jsx
        <div className="flex-1 min-w-0 flex flex-col h-auto lg:h-full min-h-[420px] lg:min-h-0 bg-[#0b1120] border border-slate-800/90 rounded-xl overflow-hidden shadow-inner transition-all duration-200">
```

Giải thích: cùng logic `h-full`→`h-auto lg:h-full` và `min-h-0`→`min-h-[420px] lg:min-h-0` như cột trái ở mục 1.2. Cột này vốn không có class `shrink`/`shrink-0` nào (mặc định `flex-shrink: 1`), không cần đổi gì thêm ở đây — hành vi mặc định vừa đúng ý (cho phép co lại đến đúng sàn 420px khi cần).

---

## 2. Vì sao cách này an toàn — ĐÃ kiểm chứng bằng mô phỏng CSS trước khi ban hành (không chỉ suy luận lý thuyết)

Trước khi ban hành spec này, Claude đã tự dựng lại đúng cơ chế flexbox liên quan bằng Playwright trong sandbox riêng (rút kinh nghiệm từ bug thật đã gặp ở PHẦN R.3 — `min-height` cố định trên 1 cột có thể vô tình co ép cột kia về gần 0 nếu không xử lý đúng `flex-shrink`):

- **Kịch bản test:** container cha bị giới hạn chiều cao (mô phỏng khung nhìn tablet), 2 cột xếp chồng dọc, cả 2 đều có `min-h-[420px]` + `flex-shrink` mặc định (không dùng `shrink-0` ở tablet — đúng như spec mục 1.2/1.3 chốt).
- **Trường hợp cả 2 cột đều có nội dung dài (vượt sàn 420px nhiều):** cả 2 cột đều dừng đúng ở 420px (sàn `min-height` được tôn trọng tuyệt đối, không bị co ép thêm), phần nội dung dư mỗi cột tự cuộn dọc RIÊNG bên trong nó (nhờ mỗi cột vốn đã có `overflow-y-auto` nội bộ cho bảng/danh sách bên trong — không đổi ở PHẦN này), container cha cuộn dọc thêm nếu tổng 2 cột vẫn vượt khung nhìn.
- **Trường hợp cột trái ngắn (vd Job Orders chỉ 2-3 dòng), cột phải dài:** cột trái tự co về đúng sàn 420px (không tràn hết cỡ, không bị bóp méo), cột phải chiếm phần còn lại.
- Kết luận: sàn `min-h-[420px]` trên CẢ HAI cột (không cần `shrink-0` ở tablet như R.3 phải dùng) là đủ để tránh hoàn toàn kiểu bug co ép về gần 0px đã gặp ở R.3 — vì lần này rủi ro nằm ở 1 cột `h-full` không co được khi đổi hướng flex, khác với R.3 (rủi ro là 1 cột bị co ép bởi `min-height` cố định của cột kia). Đã verify đúng cơ chế trước khi giao việc, không phải đoán.

**Lưu ý cho AG:** `420px` là giá trị đề xuất ban đầu (đủ hiển thị ~6-8 dòng bảng Job Orders có sticky header), không phải số bắt buộc cứng — được phép điều chỉnh ±100px nếu khi test trực quan thấy chật, miễn là: (a) không đổi gì ở `lg:` trở lên, (b) áp dụng CÙNG 1 giá trị cho cả 2 cột (giữ đối xứng), (c) ghi rõ giá trị cuối cùng và lý do trong báo cáo khi giao lại Claude QA.

---

## 3. Yêu cầu QA/test trước khi báo PASS

1. **Test trực quan ở 3 mốc tablet: 768px, 834px, 1024px:**
   - 2 cột xếp chồng dọc, cột trái "Job Orders" full-width nằm TRÊN, cột phải "Applications & Pipeline" full-width nằm DƯỚI.
   - Cả 2 cột có chiều cao hợp lý (không cột nào bị co ép về gần 0 hay bị tràn full màn hình dù nội dung ngắn).
   - Bảng Job Orders trong cột trái: kiểm tra còn cần cuộn ngang không (theo audit ở đầu spec, nhiều khả năng KHÔNG cần nữa — nếu vẫn cần, báo lại Claude thay vì tự ý ẩn cột).
   - Nút "Expand Pipeline / Split View" vẫn hoạt động đúng (ẩn/hiện cột trái) ở tablet.
   - Cuộn dọc được để xem hết cả 2 cột nếu tổng chiều cao vượt khung nhìn.
2. **Test đúng ngưỡng chuyển `lg:` (1024px):** dưới 1024px xếp chồng dọc, từ 1024px trở lên chuyển hẳn sang 2 cột ngang 45%:55% như cũ.
3. **Đối chiếu KHÔNG có regression ở độ rộng desktop bình thường (≥1280px) — bắt buộc so sánh trước/sau:**
   - Cột trái đúng 45% bề rộng (sàn 460px, trần 50%), cột phải chiếm phần còn lại — y hệt trước khi sửa.
   - Nút "Expand Pipeline" vẫn ẩn/hiện đúng cột trái như cũ.
   - Cả 2 cột vẫn tràn hết chiều cao container (`h-full`) như cũ, không có khoảng trống thừa nào xuất hiện.
4. Console sạch, không warning hydration mismatch.
5. `npm run build` PASS, không lỗi lint.
6. Cập nhật `docs/DEVELOPMENT_LOG.md`: **BẮT BUỘC cập nhật CẢ 2 phần** — bảng tổng hợp đầu file VÀ chi tiết snapshot phía dưới.

Nếu có bất kỳ điểm nào không rõ, hoặc code thực tế khác với mô tả trong spec này, dừng lại hỏi Claude trước khi tự quyết, theo mục 10 GEMINI.md. Sau khi PHẦN R.4 PASS QA, bước tiếp theo trong lộ trình là PHẦN R.5 (`search/page.js`).
