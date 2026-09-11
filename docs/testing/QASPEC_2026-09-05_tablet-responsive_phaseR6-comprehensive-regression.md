# QA SPEC — PHẦN R.6: QA Tổng Thể Lộ Trình Responsive Tablet (R.1–R.5 Cộng Dồn)

**Từ:** Claude (Architect/QA)
**Gửi:** Antigravity (Implementer) — thực thi test qua Chrome DevTools MCP trên dev server thật, báo cáo lại số liệu cụ thể cho Claude review
**Ngày:** 2026-09-05
**Bối cảnh:** R.1 (safety net overflow-x-auto), R.2 (NavbarTabs co gọn), R.3 (Candidates Hub), R.4 (Jobs & Clients Workbench) đã QA PASS 100% từng PHẦN riêng lẻ. R.5 (Search) đã audit, không cần sửa code. PHẦN R.6 là bước cuối: verify **CỘNG DỒN** cả 5 PHẦN cùng lúc trên cùng 1 phiên trình duyệt — mục tiêu là bắt các lỗi tương tác CHÉO giữa nhiều PHẦN mà QA từng PHẦN riêng lẻ có thể bỏ sót (ví dụ: NavbarTabs co gọn ở R.2 có ảnh hưởng gì đến chiều cao khả dụng của workspace container ở R.3/R.4 không; chuyển tab giữa các trang ở cùng 1 độ rộng có giữ đúng trạng thái responsive không).

**Đây KHÔNG phải FIX_SPEC** — không có thay đổi code nào trong PHẦN này (trừ khi phát hiện lỗi mới, xem mục 3). Đây là 1 QA SPEC: AG chạy đúng test matrix bên dưới bằng Chrome DevTools MCP trên dev server thật (`npm run dev`), ghi số liệu cụ thể, rồi báo cáo lại để Claude review — đúng quy trình đã áp dụng nhất quán từ R.1-R.4.

---

## 1. Test Matrix — 5 trang × 4 mốc độ rộng

| Trang | Route | Cần test ở |
| --- | --- | --- |
| Action Menu | `/` | 768px, 834px, 1024px, 1440px |
| Candidates Hub | `/candidates` | 768px, 834px, 1024px, 1440px |
| Jobs & Clients Workbench | `/jobs` | 768px, 834px, 1024px, 1440px |
| Campaigns | `/campaigns` | 768px, 834px, 1024px, 1440px |
| Search | `/search` | 768px, 834px, 1024px, 1440px |

Với MỖI ô trong bảng trên (20 tổ hợp), ghi lại:
1. Ảnh chụp màn hình.
2. `document.documentElement.scrollWidth` vs `clientWidth` của toàn trang (xác nhận KHÔNG có cuộn ngang cấp trang ngoài ý muốn ở bất kỳ độ rộng nào — mỗi bảng dữ liệu có thể tự cuộn ngang bên trong nó, nhưng bản thân trang/`<body>` không được tràn ngang).
3. `read_console_messages(onlyErrors=true)` — phải sạch ở mọi tổ hợp.

## 2. Kịch bản test tương tác CHÉO (không chỉ chụp ảnh tĩnh)

1. **Ở khổ 768px:** vào `/candidates`, chuyển đổi qua lại vài ứng viên khác nhau (dùng `SearchableCandidateSwitcher`) — xác nhận panel trái/phải vẫn xếp chồng dọc đúng, không bị "kẹt" ở trạng thái lưng chừng.
2. **Ở khổ 768px:** vào `/jobs`, bấm nút "Expand Pipeline / Split View" để ẩn/hiện cột trái — xác nhận hoạt động đúng CẢ khi đã xếp chồng dọc (không chỉ test ở desktop như QA R.4 đã làm).
3. **Đổi độ rộng cửa sổ NGAY TRONG LÚC đang ở 1 trang** (768px → 1024px → 1440px → về lại 768px) trên `/candidates` VÀ `/jobs` — xác nhận layout chuyển đổi mượt qua lại đúng ngưỡng `lg:` mỗi lần đổi, không bị "kẹt" ở trạng thái cũ (React không re-render sai do cache/state cũ).
4. **Điều hướng qua lại giữa các trang ở CÙNG 1 độ rộng 768px** (Action Menu → Candidates → Jobs & Clients → Campaigns → Search → quay lại Action Menu) — xác nhận NavbarTabs (đã co gọn icon-only từ R.2) hoạt động đúng xuyên suốt, không có trang nào "quên" trạng thái responsive khi quay lại (Next.js client-side navigation đôi khi giữ lại state cũ không mong muốn).
5. **Đối chiếu ảnh chụp desktop 1440px của CẢ 5 trang với baseline TRƯỚC KHI có lộ trình R.1-R.5** (nếu còn giữ ảnh chụp cũ từ lúc audit ban đầu 2026-09-03; nếu không còn, đối chiếu bằng cách đọc lại mô tả bố cục gốc trong `docs/architecture/PLAN_2026-09-03_tablet-responsive-rollout.md` mục 1 — bảng audit hiện trạng) — xác nhận KHÔNG có sai khác nào tích luỹ qua nhiều PHẦN.

## 3. Nếu phát hiện lỗi mới trong lúc chạy R.6

**KHÔNG tự sửa.** Dừng lại, báo cáo đầy đủ cho Claude: trang nào, độ rộng nào, kịch bản nào, ảnh chụp/console log liên quan. Claude sẽ đánh giá và viết FIX_SPEC riêng nếu cần (đúng quy trình Architect/QA, xem `claude-role-boundary.md`).

## 4. Yêu cầu báo cáo lại cho Claude

Khi hoàn tất, gửi lại 1 báo cáo gồm:
- Bảng kết quả 20 tổ hợp (mục 1) — PASS/FAIL kèm số liệu `scrollWidth`/`clientWidth` cụ thể, không chỉ ghi "PASS" suông.
- Kết quả 5 kịch bản tương tác chéo (mục 2) — mô tả cụ thể quan sát được, không chỉ "hoạt động đúng".
- Danh sách lỗi mới phát hiện (nếu có, theo mục 3) — để riêng, không tự sửa.
- `npm run build` PASS.

Claude sẽ review báo cáo này và đối chiếu độc lập (đọc lại code, hoặc tự verify qua Browser pane nếu dev server còn chạy được lúc đó) trước khi ký PASS cuối cùng cho toàn bộ lộ trình R.1-R.6.
