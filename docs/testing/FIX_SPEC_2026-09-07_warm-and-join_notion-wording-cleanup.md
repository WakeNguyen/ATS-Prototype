# FIX_SPEC — 2026-09-07 — Xoá text lỗi thời nhắc tới "Notion" trong scripts/warm-and-join.js (chỉ sửa chữ, không đổi logic)

**Mức độ ưu tiên:** Thấp — lỗi hiển thị chữ (cosmetic), KHÔNG ảnh hưởng vận hành. Có thể gộp chung phiên tối nay hoặc làm bất kỳ lúc nào.
**Người phát hiện:** User, khi thấy status "Needs Answer" trên UI Social Group URLs hiển thị message nhắc "cấu hình câu trả lời trên Notion" — trong khi ATS 3.0 được xây dựng chính là để cắt phụ thuộc Notion.
**Đã điều tra xác nhận:** Đây CHỈ là text sót lại từ kiến trúc cũ (khi hệ thống còn dùng Notion/Telegram để báo cáo/nhận cấu hình). Về mặt chức năng, trường trả lời tuỳ chỉnh (`custom_join_answer`) đã nằm hẳn trong Supabase và đã có UI riêng trong ATS 3.0 (tab **Social Group URLs**, component `JoinStatusBadge` — bấm vào badge để nhập/sửa câu trả lời trực tiếp). Không có bất kỳ lệnh gọi API Notion nào trong luồng này — chỉ là chữ trong log/message chưa được cập nhật theo kiến trúc mới.

## Việc cần sửa

File `scripts/warm-and-join.js`, 3 chỗ:

1. **Dòng ~104** (log console, không hiển thị cho user, chỉ trong log VPS):
   - Từ: `` `  -> Using Custom Join Answer from Notion: "${customAnswer.substring(0, 50)}..."` ``
   - Thành: `` `  -> Using Custom Join Answer (ATS 3.0): "${customAnswer.substring(0, 50)}..."` ``

2. **Dòng ~216** (`result.details` — message này HIỂN THỊ TRỰC TIẾP cho user trên UI, cột Details/Result trong Run History và badge "Needs Answer"):
   - Từ: `'Nhóm có câu hỏi bảo mật đặc biệt (mã bí mật/quy tắc riêng). Cần người dùng cấu hình câu trả lời trên Notion.'`
   - Thành: `'Nhóm có câu hỏi bảo mật đặc biệt (mã bí mật/quy tắc riêng). Cần người dùng cấu hình câu trả lời trong tab Social Group URLs (ATS 3.0).'`

3. **Dòng ~311** (comment code, không hiển thị runtime nhưng gây hiểu lầm khi đọc code):
   - Từ: `// Capture screenshot of question modal for User review on Notion/Telegram`
   - Thành: `// Capture screenshot of question modal for User review (ATS 3.0 Notification Center)`

4. **Dòng ~323** (log console alert, không hiển thị cho user):
   - Từ: `'[Survey Handler Alert] Strict/Custom question detected and NO Custom Answer was found on Notion!'`
   - Thành: `'[Survey Handler Alert] Strict/Custom question detected and NO Custom Answer was found in ATS 3.0 (custom_join_answer)!'`

**KHÔNG đổi bất kỳ logic nào khác** — không đổi tên biến `customAnswer`, không đổi cách đọc dữ liệu (`g.customAnswer` từ dispatch payload vẫn giữ nguyên), không đổi DB, không đổi n8n workflow. Đây thuần tuý là cập nhật string literal + comment cho khớp với kiến trúc thật hiện tại.

## Yêu cầu verify

1. `node --check scripts/warm-and-join.js` — cú pháp hợp lệ 100%.
2. Grep lại file xác nhận không còn chữ "Notion" hoặc "Telegram" nào sót trong `scripts/warm-and-join.js`.
3. `npm run build` PASS 100% (không liên quan Next.js nhưng vẫn chạy theo quy trình chuẩn để chắc chắn không phá vỡ gì khác).
4. Không cần test E2E lại luồng join nhóm thật — vì không đổi logic, chỉ đổi chữ hiển thị.
