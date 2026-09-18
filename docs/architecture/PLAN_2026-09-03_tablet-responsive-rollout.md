# PLAN — Tablet Responsive Rollout (~768–1024px), Desktop Vẫn Là Chính

**Viết bởi:** Claude (Architect/QA)
**Ngày:** 2026-09-03
**Bối cảnh:** Sau khi sửa lỗi layout trống diện tích ở tab Campaigns (PHẦN 5.6), User đặt câu hỏi lớn hơn: toàn bộ ATS 3.0 có chạy tốt trên các màn hình/thiết bị khác không? Claude đã audit tĩnh toàn bộ codebase và xác nhận: **app hiện tại được code theo kiểu desktop-only, cố định theo viewport (`h-screen`/`overflow-hidden` toàn cục), gần như không có responsive design thật sự** (chỉ 7/33 file dùng bất kỳ class `sm:`/`md:`/`lg:` nào, và chỉ ở phạm vi rất nhỏ bên trong modal).

User đã xác nhận phạm vi mong muốn: **cần dùng được cả trên tablet (~768–1024px, ví dụ iPad)**, desktop vẫn là thiết bị chính, **KHÔNG cần hỗ trợ điện thoại thật (~375–428px)** trong đợt này.

**Chiến lược breakpoint:** dùng đúng breakpoint mặc định của Tailwind v4 đang dùng sẵn trong dự án — `md:` (≥768px), `lg:` (≥1024px) — không tạo breakpoint tuỳ biến mới trừ khi phát sinh nhu cầu thật. Mọi thay đổi PHẢI giữ nguyên 100% hành vi/hình ảnh ở độ rộng desktop hiện tại (≥1280px) — đây là yêu cầu bắt buộc xuyên suốt tất cả các PHẦN bên dưới, không được đánh đổi.

---

## 1. Kết quả audit hiện trạng (bằng chứng cụ thể từ code)

| Khu vực | Vấn đề cụ thể | Mức rủi ro ở tablet |
| --- | --- | --- |
| `src/app/layout.js` (khung ngoài cùng) | `<html>`/`<body>` ép cứng `h-screen max-h-screen overflow-hidden` — không có scroll cấp trang, mọi phần phải tự quản lý scroll riêng | Trung bình — bản thân pattern này không sai, nhưng khiến bất kỳ phần nào quên bọc `overflow-y-auto`/`overflow-x-auto` sẽ mất nội dung thay vì cuộn được |
| `src/app/NavbarTabs.js` (thanh menu trên cùng) | Hàng ngang cố định: logo + 5 tab (icon + chữ) + bên phải là chuông thông báo + text "Supabase Singapore Live", KHÔNG có cơ chế thu gọn (không hamburger, không `flex-wrap`) | Cao — ở ~768–1024px nhiều khả năng bị tràn/đè lên nhau, đây là phần NGƯỜI DÙNG THẤY ĐẦU TIÊN mỗi trang |
| Bảng dữ liệu (`<table>`) thiếu `overflow-x-auto`: `src/app/page.js` (Action Menu), `src/app/jobs/page.js`, `src/app/search/page.js`, `components/CampaignDispatchPreviewModal.js`, `components/PendingCVClientWrapper.js` | 0/5 file này có bọc cuộn ngang cho bảng | Cao — cột bị ép cứng px (ví dụ `jobs/page.js` có cột `min-w-[460px]` riêng lẻ) sẽ bị cắt mất hoặc tràn layout thay vì cuộn ngang được |
| `src/app/candidates/page.js` (Candidates Hub, trang dùng nhiều nhất) | Panel danh sách bên trái cố định `w-[42%]`, panel chi tiết có lưới `grid-cols-4` không đổi theo màn hình | Trung bình-Cao — ở khổ tablet dọc (768px), 42% ≈ 320px cho panel trái là quá chật để đọc bảng ứng viên |
| `src/app/jobs/page.js` (2937 dòng, file lớn nhất) | Nhiều cột bảng ép cứng pixel (280px, 240px, 200px, 150px, 130px...) cộng dồn, không có fallback nào | Cao — bảng Jobs/Clients/Applications nhiều khả năng là nơi vỡ layout nặng nhất |
| `src/app/campaigns/page.js` | Đã có sẵn 1 phần nền tảng tốt hơn các trang khác: 3/3 bảng đã bọc `overflow-x-auto`, đã dùng 1 số `sm:`/`md:` cho form/filter | Thấp hơn các trang khác — vẫn cần rà lại thanh Filter Bar và NavbarTabs dùng chung |
| `src/app/search/page.js` | Có `<table>` không bọc cuộn ngang, gần như chưa có class responsive nào | Cao |

**Không có ghi chú nào trong `GEMINI.md`/plan docs cũ nói rõ "desktop-only"** — đây là khoảng trống chưa từng được quyết định có chủ đích, không phải phạm vi đã chốt từ trước.

---

## 2. Đề xuất thứ tự triển khai (ưu tiên rủi ro thấp/giá trị cao trước)

Mỗi PHẦN dưới đây sẽ có 1 FIX_SPEC riêng do Claude viết và giao AG, theo đúng quy trình mục 10 GEMINI.md. Thứ tự đề xuất:

### PHẦN R.1 — Safety net toàn cục: bọc `overflow-x-auto` cho MỌI bảng còn thiếu ✅ ĐÃ QA PASS (2026-09-03)
Bọc `<div className="overflow-x-auto">` quanh các bảng đang thiếu. Rủi ro cực thấp — không đổi bố cục ở desktop (bảng vẫn hiển thị y hệt khi đủ chỗ), chỉ thêm khả năng cuộn ngang khi màn hình hẹp hơn nội dung bảng. Đã triển khai đúng 3 file thực sự thiếu (2 file trong audit ban đầu hoá ra đã có `overflow-auto` sẵn). QA PASS 100%, đã verify trực tiếp qua trình duyệt thật.

### PHẦN R.2 — NavbarTabs co gọn ở tablet ✅ ĐÃ QA PASS (2026-09-03)
Thêm breakpoint để: ẩn bớt chữ label của tab (chỉ giữ icon, có `title` tooltip) và rút gọn text "Supabase Singapore Live" thành chấm tròn trạng thái dưới `lg:` (< 1024px), đảm bảo không tràn/đè lên chuông thông báo. QA PASS 100%, verify trực tiếp qua Browser pane ở 768px và 1440px.

### PHẦN R.3 — Candidates Hub: panel danh sách + lưới Prefix/Full Name ✅ ĐÃ QA PASS (2026-09-05)
Đổi container chính sang xếp chồng dọc (`flex-col lg:flex-row`) dưới `lg:`, panel trái `w-[42%]` → `w-full lg:w-[42%] shrink-0 lg:shrink`, grid Prefix/Full Name `grid-cols-4` → `grid-cols-2 lg:grid-cols-4`, thêm `min-h-[560px] lg:min-h-0` an toàn cho panel phải khi xếp chồng. `shrink-0 lg:shrink` là bổ sung phát sinh khi AG tự test phát hiện bug co ép panel trái, đã trao đổi User duyệt trước khi code, Claude verify độc lập bằng Playwright xác nhận fix đúng. QA PASS 100%, commit `dea21b4`. Xem `docs/testing/FIX_SPEC_2026-09-05_tablet-responsive_phaseR3-candidates-hub-layout.md` + `docs/testing/QA_2026-09-05_tablet-responsive_phaseR3-candidates-hub-layout.md`.

### PHẦN R.4 — Jobs & Clients Workbench ✅ ĐÃ QA PASS (2026-09-05)
Container 2 cột `w-[45%] min-w-[460px] max-w-[50%]` / `flex-1` (cùng kiến trúc dual-pane như Candidates Hub R.3) đổi sang xếp chồng dọc dưới `lg:`, cả 2 cột dùng `h-auto lg:h-full` + `min-h-[420px] lg:min-h-0` (không cần `shrink-0` như R.3 vì bản chất bug khác — đã kiểm chứng bằng Playwright TRƯỚC khi ban hành spec). Diff AG giao nộp khớp 100% nguyên văn spec, không có sai lệch. Test thật xác nhận bảng Job Orders (727px) vừa khít container (729px) khi xếp chồng — đúng dự đoán, KHÔNG cần ẩn cột nào. QA PASS 100%, commit `a3cc521`. Xem `docs/testing/FIX_SPEC_2026-09-05_tablet-responsive_phaseR4-jobsclients-workbench-layout.md` + `docs/testing/QA_2026-09-05_tablet-responsive_phaseR4-jobsclients-workbench-layout.md`.

### PHẦN R.5 — Search page ✅ ĐÃ AUDIT, KHÔNG CẦN SỬA CODE (2026-09-05)
Audit trước khi viết FIX_SPEC (khác cách làm ở R.3/R.4) phát hiện trang này đã tablet-safe từ trước: bảng đã có `overflow-auto` sẵn (1 trong 2 file R.1 xác nhận không cần sửa), toolbar đã có `flex-wrap` sẵn (Claude verify bằng Playwright tại 768px: tự xuống 2 hàng gọn gàng, không tràn/cắt chữ). Không có kiến trúc dual-pane cố định nào cần đổi hướng flex như R.3/R.4. Xem `docs/testing/AUDIT_2026-09-05_tablet-responsive_phaseR5-search-page.md`.

### PHẦN R.6 — QA tổng thể bằng Playwright ở nhiều độ rộng
Test lại toàn bộ 5 trang chính ở 3 mốc: 768px, 834px (iPad Air/Pro dọc), 1024px — đối chiếu ảnh chụp desktop 1440px trước/sau để xác nhận **không có regression nào** ở độ rộng lớn.

---

## 3. Ngoài phạm vi (đợt này)

- Hỗ trợ điện thoại thật (~375–428px) — User đã xác nhận KHÔNG cần trong đợt này.
- Redesign lại UI/UX tổng thể — đây là công việc thích ứng bố cục hiện có với nhiều độ rộng, không phải thiết kế lại giao diện.

---

## 4. Giai đoạn tương lai (đã lên kế hoạch, CHƯA triển khai) — "Zero-Scroll"

**Bối cảnh phát sinh:** Trong lúc test PHẦN R.1, User quan sát qua Browser pane rằng bảng "Action Menu" (`src/app/page.js`) vẫn cần cuộn ngang để xem hết cột, và đặt câu hỏi liệu sau khi hoàn tất lộ trình responsive (R.1–R.6) thì có còn cần cuộn ngang ở bất kỳ đâu không ("Zero-Scroll").

**Bằng chứng cụ thể — vì sao R.1–R.6 KHÔNG thể đạt Zero-Scroll hoàn toàn:** Bảng Action Menu có 11 cột, mỗi cột đều ép cứng `min-w-[Npx]` (110, 80, 110, 90, 180, 220, 160, 80, 120, 120px, cộng thêm 1 cột checkbox 32px) — tổng cộng **≈1278px bề rộng tối thiểu**, đã vượt quá toàn bộ khổ tablet mục tiêu (1024px) ngay cả khi ẩn hết padding/border. Các bảng dữ liệu dày đặc tương tự khác (Jobs & Clients pipeline, Candidates) nhiều khả năng cũng rơi vào tình trạng tương tự. Việc thêm `overflow-x-auto` (PHẦN R.1) hay ẩn/hiện cột theo breakpoint (PHẦN R.4) chỉ **giảm** nhu cầu cuộn ngang, KHÔNG thể loại bỏ hoàn toàn cho các bảng dày dữ liệu này mà không đổi cách trình bày dữ liệu.

**Quyết định của User (đã xác nhận qua câu hỏi lựa chọn):** Ưu tiên hoàn tất lộ trình "giảm cuộn ngang" hiện tại (R.1–R.6, tập trung vào các core feature) trước. "Zero-Scroll" là một giai đoạn **riêng, sau này**, không nằm trong phạm vi cam kết của lộ trình R.1–R.6 đang triển khai.

**Hướng tiếp cận dự kiến cho giai đoạn Zero-Scroll (chỉ là định hướng ban đầu, CHƯA phải spec — sẽ cần audit + thiết kế lại chi tiết khi đến lúc triển khai):**
- Với các bảng dữ liệu dày cột (Action Menu, Jobs & Clients, có thể cả Candidates): cân nhắc chuyển sang bố cục dạng thẻ (card layout) ở khổ hẹp thay vì bảng ngang truyền thống, hoặc áp dụng mô hình "cột ưu tiên + cột mở rộng khi cần" (frozen/priority columns — chỉ hiện vài cột quan trọng nhất, các cột còn lại xem qua nút "chi tiết"/mở rộng dòng).
- Đây là công việc thiết kế lại cách trình bày dữ liệu (data presentation redesign), không phải chỉ thêm class CSS như R.1–R.6 — quy mô lớn hơn nhiều, cần Claude viết PLAN/audit riêng khi được ưu tiên.
- Điều kiện để bắt đầu: sau khi các core feature (bao gồm cả R.1–R.6) đã ổn định và User xác nhận muốn ưu tiên giai đoạn này.

**Trạng thái:** Đã ghi nhận vào roadmap theo yêu cầu của User. CHƯA có FIX_SPEC nào được viết, CHƯA triển khai gì.

---

## 5. Bước tiếp theo

**LỘ TRÌNH R.1–R.6 ĐÃ HOÀN TẤT (2026-09-05).** PHẦN R.6 (QA tổng thể cộng dồn cả 5 trang × 4 độ rộng + 5 kịch bản tương tác chéo) đã QA PASS 100% qua Chrome DevTools MCP, không phát hiện regression nào. Bug phụ phát hiện khi audit R.5 (2 popover phone/email trong bảng Search bị cắt bởi container overflow-auto, KHÔNG thuộc đánh số R.x) cũng đã fix và QA PASS — thay bằng component `Popover` có sẵn (base-ui + Portal), Claude verify tận gốc bằng cách đọc source code thư viện xác nhận cơ chế portal ra `document.body`. Xem `docs/testing/QA_2026-09-05_search-popover-fix_and_phaseR6-final-signoff.md` (báo cáo ký PASS cuối cùng). ATS 3.0 hiện dùng được trên tablet (~768-1024px) cho cả 5 trang chính, desktop ≥1280px không có regression. Giai đoạn "Zero-Scroll" (mục 4) là công việc riêng, chỉ bắt đầu khi User chủ động yêu cầu — KHÔNG còn việc gì mở trong phạm vi lộ trình này.
