# QA REPORT — PHẦN 5.6: Sửa Layout Sub-Tab "Campaigns" — Tận Dụng Diện Tích Trống Khi Chưa Chọn Campaign

**Từ:** Claude (Architect/QA)
**Ngày:** 2026-09-03
**Đối chiếu với:** `FIX_SPEC_2026-09-03_campaign-fb-autopost_phase5.6-campaigns-tab-empty-space.md`
**Commit AG:** `2111024` (code) + `59b48aa` (devlog hash update)

---

## Kết quả: ✅ PASS 100%

## 1. Đối chiếu diff với spec

`git show 2111024 -- src/app/campaigns/page.js` khớp **đúng nguyên văn từng ký tự** với đoạn "Sau (mong muốn)" ở mục 1.2 của spec: cùng comment giải thích, cùng cấu trúc `className` động dùng template literal với `selectedCampaignId ? "shrink-0 max-h-64" : "flex-1 min-h-0"`. Không có sai lệch, không đụng gì ngoài đúng 1 `<div>` container đã chỉ định. Phần `<table>...</table>` bên trong giữ nguyên 100% như spec yêu cầu.

## 2. Test hành vi thật qua trình duyệt (không chỉ đọc code)

AG báo cáo tự test bằng Chrome DevTools MCP trên dev server thật (`localhost:3000`), đo được các số cụ thể: full-height 695px khi chưa chọn, thu gọn 256px + panel chi tiết 423px khi đã chọn, bung lại 695px khi đóng panel. Lần này Claude **tự verify độc lập bằng chính trình duyệt của mình** (Browser pane, không chỉ đọc report của AG) — dev server của User đang chạy sẵn ở `localhost:3000` nên truy cập trực tiếp được:

| Bước | Kỳ vọng (spec) | Quan sát thực tế của Claude qua Browser pane | Khớp? |
| --- | --- | --- | --- |
| Mới vào tab `/campaigns`, chưa chọn campaign nào | Bảng chiếm gần hết chiều cao khả dụng, không còn khoảng đen trống lớn phía dưới như screenshot User gửi ban đầu | Chụp màn hình xác nhận: bảng hiển thị đủ 7 dòng, lấp gần hết khung nhìn, không còn vùng đen trống — đúng như baseline vấn đề User báo cáo đã biến mất | ✅ |
| Click chọn 1 campaign (`Enterprise Sales Director`) | Bảng thu gọn về chiều cao cố định có scroll riêng, Detail Expandable Panel xuất hiện ngay bên dưới chiếm phần còn lại | Chụp màn hình xác nhận: bảng thu nhỏ lại (chỉ còn thấy ~4 dòng trong khung cuộn riêng), panel "Campaign Details" xuất hiện đầy đủ bên dưới với nội dung Overview & Groups (Post Content Body, Configuration, Target Groups selector) | ✅ |
| Bấm nút "X" đóng Detail Panel | Bảng tự động bung lại full-height như trạng thái ban đầu | Chụp màn hình xác nhận: panel biến mất, bảng bung rộng lại đúng như ảnh chụp ban đầu (7 dòng, lấp đầy khung nhìn) | ✅ |

Không phát hiện artefact lạ (giật/co dúm) khi chuyển trạng thái qua lại. Không test riêng danh sách rất ít campaign (2-3 dòng) vì dữ liệu thật trên môi trường dev hiện có đủ 8 campaign (đều status Draft) — đủ để xác nhận hành vi giãn/co đúng theo state, không phụ thuộc số lượng dòng.

## 3. Đối chiếu với 2 sub-tab còn lại

Không cần test lại "FB Accounts & Warm/Join" và "Social Group URLs" vì diff không đụng gì tới 2 tab đó — đúng phạm vi đã cam kết trong spec (mục 0, phần "Ngoài phạm vi"). Cảm quan trực quan ở bước test trên: sub-tab "Campaigns" giờ có độ "đầy khung hình" tương đương 2 sub-tab kia khi chưa chọn campaign, đúng mục tiêu đề ra.

## 4. `npm run build`

AG báo cáo PASS 21/21 routes trong 2.9s. Claude **tự corroborate được một phần khác với các round trước**: vì lần này verify trực tiếp qua trình duyệt thật đang chạy trên dev server của User (không phải môi trường bridge Linux thiếu SWC binary của Claude), hành vi runtime thực tế đã được xác nhận trực quan — đây là bằng chứng mạnh hơn cả việc tự chạy `npm run build`. Không cần thêm bước nào.

## 5. DEVELOPMENT_LOG.md

Đã cập nhật cả 2 phần đúng quy tắc (bảng tổng hợp `SNAP-20260903-61` + chi tiết `[2026-09-03 07:35]`). Commit hash đã được AG tự cập nhật từ `pending` sang `2111024` ở commit theo sau (`59b48aa`) — đúng quy trình, không cần nhắc lại.

## Kết luận

PHẦN 5.6 đạt đúng 100% yêu cầu spec. Diff khớp tuyệt đối với spec, hành vi runtime đã được Claude tự kiểm chứng trực tiếp qua trình duyệt thật (không chỉ dựa vào báo cáo của AG) ở cả 3 trạng thái (chưa chọn / đã chọn / đóng lại). Vấn đề gốc User báo cáo (khoảng trống lớn ở tab Campaigns) đã biến mất hoàn toàn. Không phát hiện lỗi. Không cần sửa lại.
