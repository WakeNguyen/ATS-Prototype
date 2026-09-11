# QA REPORT — PHẦN R.3: Candidates Hub — Bố Cục Xếp Chồng Dọc & Lưới Prefix/Full Name (Lộ Trình Responsive Tablet)

**Từ:** Claude (Architect/QA)
**Ngày:** 2026-09-05
**Đối chiếu với:** `FIX_SPEC_2026-09-05_tablet-responsive_phaseR3-candidates-hub-layout.md`
**Commit AG:** `dea21b4` (code) + `730215e` (devlog)

---

## Kết quả: ✅ PASS 100%

## 1. Đối chiếu diff với spec

`git show dea21b4 -- src/app/candidates/page.js`: 3/4 vị trí khớp **đúng nguyên văn** với spec:
- Container chính (dòng 876): `flex-col lg:flex-row overflow-y-auto lg:overflow-hidden` — đúng.
- Grid Prefix/Full Name (dòng 911): `grid-cols-2 lg:grid-cols-4` — đúng.
- Panel phải (dòng 1224): thêm đúng `min-h-[560px] lg:min-h-0` — đúng.

Vị trí thứ 4 (Panel trái, dòng 880) có **1 điểm ngoài văn bản spec gốc**: AG thêm `shrink-0 lg:shrink` (spec gốc chỉ yêu cầu `w-full lg:w-[42%]`). Theo devlog (`SNAP-20260905-71`), đây là fix phát sinh khi AG tự test và phát hiện bug thật: `min-h-[560px]` của Panel phải (mục 1.4 spec) khiến flexbox co ép Panel trái xuống còn 143px cuộn nội bộ thay vì hiện đủ nội dung — AG đã dừng lại trao đổi với User và được duyệt "Option B" trước khi code, đúng quy trình khi phát hiện vấn đề ngoài phạm vi spec (không tự ý âm thầm mở rộng).

## 2. Xác minh độc lập bằng mô phỏng CSS cô lập (Playwright, sandbox riêng của Claude — không phụ thuộc dev server của User)

Do dev server (`localhost:3000`) không chạy tại thời điểm QA nên không verify trực tiếp qua Browser pane trên máy User được. Thay vào đó, Claude tự dựng lại đúng cơ chế CSS liên quan (không phải chỉ đọc code suông) bằng Playwright trong sandbox riêng để verify 2 điểm rủi ro kỹ thuật nhất:

**a) Grid `grid-cols-2` + `col-span-1`/`col-span-3` có tạo cột ẩn (implicit column) làm vỡ layout không?**
Dựng lại đúng CSS Tailwind sinh ra (`grid-template-columns: repeat(2,...)`, `grid-column: span 1`/`span 3`) trong khung rộng 320px (giả lập panel trái ở 768px). Kết quả đo `boundingBox` thật: Prefix rộng 150px (nửa trái, hàng 1), Full Name rộng 320px (full-width, tự động xuống hàng 2) — **khớp đúng mô tả trong spec, không phát sinh cột ẩn/tràn layout.**

**b) `shrink-0 lg:shrink` trên Panel trái có thực sự cần thiết và giải quyết đúng bug AG báo cáo không?**
Dựng lại đúng cấu trúc container cha bị giới hạn chiều cao (500px) + Panel trái (nội dung mô phỏng 700px) + Panel phải (`min-h-[560px]`, `overflow:hidden`) ở cả 2 phiên bản:
- **KHÔNG có `shrink-0`:** Panel trái bị flexbox co ép xuống **0px** (case cực đoan hơn cả 143px AG báo, do khác chiều cao nội dung mô phỏng — nhưng cùng bản chất bug).
- **CÓ `shrink-0`:** Panel trái giữ đúng **700px** (full nội dung), Panel phải giữ đúng **560px** (min-height), tổng vượt quá 500px của container cha → tự động cuộn dọc qua `overflow-y-auto` của container cha — đúng hành vi mong muốn.

Kết luận: bug AG phát hiện là **có thật** (verify độc lập bằng cơ chế, không chỉ tin lời báo cáo), và fix `shrink-0 lg:shrink` giải quyết đúng gốc rễ.

## 3. Không có regression ở độ rộng desktop (≥1280px)

Cả 4 vị trí đều dùng `lg:` để phục hồi ĐÚNG NGUYÊN VĂN giá trị cũ (`flex-row`, `overflow-hidden`, `w-[42%]`, `grid-cols-4`). Riêng 2 điểm cần lưu ý kỹ hơn (không chỉ nhìn tên class):
- `lg:shrink` = `flex-shrink: 1`, trùng với giá trị khởi tạo mặc định của flex item — Panel trái trước đây không có class shrink nào nên vốn đã là `flex-shrink: 1`. Không đổi gì.
- `lg:min-h-0` trên Panel phải: Panel phải vốn đã có `overflow-hidden` **từ trước khi có PHẦN R.3** (không đổi bởi PHẦN này) — theo spec CSS Flexbox, "automatic minimum size" của 1 flex item có `overflow` khác `visible` vốn đã là `0`, tức `min-h-0` tường minh cho ra kết quả tính toán y hệt trạng thái mặc định trước đây. Không đổi gì.

Kết hợp với kết quả AG tự đo qua Chrome DevTools MCP tại 1440px (42%:58% pixel-perfect, tỉ lệ Prefix/Name 1:3, console sạch) — đủ cơ sở kết luận không có regression.

## 4. `npm run build`

AG báo cáo PASS 21/21 routes. Claude không tự chạy lại được (giới hạn môi trường bridge đã ghi nhận nhiều lần) — không chặn PASS vì đã verify độc lập cơ chế CSS cốt lõi ở mục 2.

## 5. DEVELOPMENT_LOG.md

Đã cập nhật đúng cả 2 phần: bảng tổng hợp (`SNAP-20260905-71`) và chi tiết snapshot (`[2026-09-05 12:40] Candidates Hub...`) — khớp nội dung, đúng quy tắc.

## Kết luận

PHẦN R.3 đạt yêu cầu spec. 3/4 vị trí khớp nguyên văn, 1 vị trí có bổ sung ngoài văn bản gốc nhưng đã qua đúng quy trình (AG dừng lại hỏi, User duyệt trước khi code) và đã được Claude verify độc lập là fix đúng, cần thiết, không phải mở rộng phạm vi tuỳ tiện. Không phát hiện lỗi logic hay rủi ro regression ở desktop. Khuyến nghị: khi User có dịp chạy `npm run dev`, nên tranh thủ verify trực quan 1 lần qua Browser pane thật để đối chiếu chéo với kết quả mô phỏng này (không bắt buộc vì rủi ro kỹ thuật đã được verify độc lập ở mục 2). Sẵn sàng chuyển sang PHẦN R.4 (Jobs & Clients).
