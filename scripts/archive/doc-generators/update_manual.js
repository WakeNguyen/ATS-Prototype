const fs = require('fs');
const manualPath = 'g:/My Drive/AI project/ATS/ats-web/docs/USER_MANUAL_DRAFT.md';
const manualLog = `
## 3. Quản Lý CV Trùng Lặp (N8N Import Queue)
- Hệ thống ATS được kết nối tự động với quy trình VPS N8N để đọc và bóc tách CV.
- Nếu CV được gửi tới có chứa số điện thoại hoặc email đã tồn tại trong hệ thống, CV này sẽ bị đưa vào hàng đợi kiểm duyệt (Human-in-the-loop).
- **Cách xử lý:** 
  1. Bấm vào biểu tượng quả chuông (🔔) ở góc trên bên phải màn hình.
  2. Chọn tick vào các thông tin liên hệ mới (nếu có) để nhập thêm vào hồ sơ hiện tại.
  3. Chọn hành động cho file CV: \`Append CV\` (giữ lại file cũ, thêm file mới vào lịch sử), \`Replace CV\` (thay thế hẳn file cũ) hoặc \`Ignore CV\` (bỏ qua file mới).
  4. Bấm **Merge** để hoàn tất hoặc **Reject** để loại bỏ CV này.
- [📷 Vị trí ảnh chụp: Chụp lại màn hình quả chuông thông báo và UI của Drawer lúc mở ra, lưu ý chọn ảnh Drawer có chứa thông tin trùng lặp để minh họa].

*Ghi chú thêm về tên ứng viên:* Toàn bộ tên ứng viên (khi nạp tự động hoặc thủ công) sẽ được hệ thống tự động loại bỏ dấu tiếng Việt (ví dụ: "Đinh Hải Khoa" thành "Dinh Hai Khoa") để đảm bảo tính đồng nhất khi lưu vào Database.
`;
if (fs.existsSync(manualPath)) {
  let content = fs.readFileSync(manualPath, 'utf8');
  content = content + manualLog;
  fs.writeFileSync(manualPath, content);
  console.log('Updated USER_MANUAL_DRAFT.md');
}
