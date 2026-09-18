# QA REPORT — Search Popover Clipping Fix & PHẦN R.6 (QA Tổng Thể, Ký PASS Cuối Cho Toàn Bộ Lộ Trình Responsive Tablet)

**Từ:** Claude (Architect/QA)
**Ngày:** 2026-09-05
**Đối chiếu với:** `FIX_SPEC_2026-09-05_search-page_contact-popover-clipping-fix.md` + `QASPEC_2026-09-05_tablet-responsive_phaseR6-comprehensive-regression.md`
**Commit AG:** `2eb2975` (code fix) + `9e9c26e` (devlog VIỆC 1 & 2)

---

## Kết quả: ✅ PASS 100% CHO CẢ 2 VIỆC — LỘ TRÌNH RESPONSIVE TABLET R.1–R.6 HOÀN TẤT

## PHẦN A — Fix Popover Bị Cắt (Search Page)

### A.1. Đối chiếu diff với spec

`git show 2eb2975 -- src/app/search/page.js`: **khớp đúng nguyên văn từng ký tự** với cả 3 vị trí trong spec (import, popover phone, popover email). Không có sai lệch, không đụng gì ngoài phạm vi.

### A.2. Xác minh độc lập gốc rễ cơ chế fix — đọc thẳng mã nguồn thư viện, không chỉ tin báo cáo runtime

Claude tự đọc trực tiếp source code `node_modules/@base-ui/react` (không phải suy luận hay chỉ tin AG báo cáo):
- `node_modules/@base-ui/react/utils/FloatingPortalLite.mjs`: xác nhận dùng `ReactDOM.createPortal(children, portalNode)` thật.
- `node_modules/@base-ui/react/floating-ui-react/components/FloatingPortal.mjs` dòng 55: `resolvedContainer = containerProp ?? parentPortalNode ?? document.body` — vì cách dùng trong spec KHÔNG truyền `container` prop tuỳ chỉnh, popover chắc chắn portal thẳng ra `document.body`, **hoàn toàn thoát khỏi container `overflow-auto`** đang gây lỗi cắt.

Kết luận: cơ chế fix đúng về bản chất kỹ thuật, không phải chỉ "trông có vẻ đúng" — đã verify tận gốc thư viện.

### A.3. Đối chiếu báo cáo runtime của AG (Chrome DevTools MCP)

Devlog (`SNAP-20260905-74`) ghi nhận AG đã test đúng kịch bản khắc nghiệt nhất nêu trong spec mục 3.1 (dòng gần mép dưới bảng): `distToBottom: 0.17px` (gần như sát đáy tuyệt đối), kết quả `insideOverflowContainer: false` (khớp chính xác kết luận đọc source ở mục A.2), popover tự động lật lên trên (`data-side="top"`) — đúng hành vi collision-avoidance của thư viện đã nêu trong spec. Nút Copy hoạt động, đóng bằng `pointerdown` ngoài popover và bằng toggle lại badge đều đúng.

### A.4. Hành vi mới (đã báo trước trong spec mục 2)

Đóng khi bấm ra ngoài — đã xác nhận hoạt động, đúng như dự kiến, không phải lỗi.

---

## PHẦN B — R.6: QA Tổng Thể Cộng Dồn R.1–R.5

### B.1. Test Matrix 20 tổ hợp (5 trang × 4 độ rộng)

AG báo cáo đầy đủ số liệu cụ thể cho từng ô (không ghi "PASS" suông, đúng yêu cầu mục 4 của QA SPEC): cả 20/20 tổ hợp đạt `scrollWidth == clientWidth` (không có cuộn ngang cấp trang ngoài ý muốn), console sạch ở mọi tổ hợp.

### B.2. 5 kịch bản tương tác chéo

Cả 5 kịch bản đều có số liệu cụ thể đối chiếu đúng với những gì đã ghi nhận riêng lẻ ở QA R.3/R.4 trước đó (không mâu thuẫn):
- Candidates 768px: panel trái/phải đều 721px — nhất quán với thiết kế `w-full` khi xếp chồng.
- Jobs 768px, Expand Pipeline: width 729px, height 420px — **khớp chính xác con số đã ghi nhận ở QA R.4** (bảng Job Orders 727px trong container 729px) — một phép đối chiếu chéo tốt, không phải số liệu bịa.
- Resize động qua lại đúng ngưỡng `lg:` 1024px, không kẹt state.
- Điều hướng 5 trang liên tục ở 768px, NavbarTabs icon-only hoạt động xuyên suốt.
- Desktop 1440px: zero regression.

Không phát hiện bug mới nào trong suốt R.6.

### B.3. `npm run build`

AG báo cáo PASS 21/21 routes (32.3s). Claude không tự chạy lại được (giới hạn môi trường bridge).

### B.4. DEVELOPMENT_LOG.md

Cả 2 phần đã cập nhật đúng (bảng tổng hợp `SNAP-20260905-74` + chi tiết snapshot), gộp chung cả VIỆC 1 và VIỆC 2 rõ ràng, mạch lạc.

---

## Kết luận chung

Cả bug popover và PHẦN R.6 đều đạt PASS 100%. Đặc biệt với việc fix popover, Claude đã verify tận gốc bằng cách đọc trực tiếp source code thư viện `@base-ui/react` thay vì chỉ tin kết quả runtime của AG — 2 nguồn (đọc code thư viện + test runtime thật) cho kết quả nhất quán tuyệt đối.

**Với PHẦN R.6 hoàn tất, TOÀN BỘ lộ trình Responsive Tablet (R.1 → R.6) theo `PLAN_2026-09-03_tablet-responsive-rollout.md` chính thức HOÀN TẤT.** ATS 3.0 hiện dùng được trên khổ tablet (~768–1024px) cho cả 5 trang chính, không có regression nào ở desktop (≥1280px). Việc còn lại ngoài phạm vi lộ trình này: giai đoạn "Zero-Scroll" (chỉ bắt đầu khi User chủ động yêu cầu) và việc dọn git tồn đọng đã ghi nhận trong `campaign-fb-autopost-status.md`.
