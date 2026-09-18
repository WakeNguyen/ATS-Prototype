const fs = require('fs');

const blueprintLog = `
### v3.0-RC4 (31/08/2026)
* 🚨 **Critical Rule & Security**: Khởi tạo quy tắc "Sinh Tử" (Anti-Bulk-Delete) vào file GEMINI.md ngăn chặn AI tự ý xóa dữ liệu hàng loạt.
* 💾 **Database Restoration**: Phục hồi thành công 1,688 dummy records cho Sandbox Schema.
* 🤖 **HITL & N8N Integration**: 
  * Xây dựng API Webhook \`POST /api/webhooks/cv-import\` nhận CV từ N8N (VPS).
  * Xây dựng bảng \`pending_cv_imports\` lưu trữ các CV bị trùng lặp (Duplicate Detection).
  * Phát triển \`PendingCVClientWrapper\` (Notification Bell) hiển thị danh sách CV chờ duyệt.
* 💅 **UI/UX Modernization**: 
  * Tích hợp thư viện \`shadcn/ui\` (Radix UI) và chuyển đổi các native HTML elements sang giao diện cao cấp.
  * Thiết kế lại hoàn toàn ImportQueueCard theo tiêu chuẩn **Compact & High-Density**, xử lý mượt mà hàng loạt CV.
  * Thay thế bộ icon thương hiệu (Facebook, Linkedin, Github) bằng \`BrandIcons.js\` SVG gốc.
* 🛡️ **Data Validation**: Cấu hình Zod Schema (Server Action) tự động xử lý khử dấu Tiếng Việt (Vietnamese Tones Removal) trước khi lưu tên ứng viên vào Database.
* 🧪 **QA & Testing**: Sinh tự động 40 CV PDF giả lập (bao gồm dạng văn bản và dạng ảnh scan có nhiễu) phục vụ cho quá trình test OCR của N8N VPS.
`;

const devLog = `
- **[2026-08-31 23:20] [FEATURE]** Hoàn thành tích hợp luồng HITL cho N8N CV Import. Nâng cấp UI bằng shadcn/ui. Cấu hình tự động lưu tên ứng viên không dấu. Sinh 40 test CVs. (Agent cập nhật)
`;

// Update Blueprint in both places
const bpPaths = [
  'g:/My Drive/AI project/My Porfolio/blue print/ATS_3.0_UI_Modernization_Blueprint.md',
  'g:/My Drive/AI project/ATS/ats-web/docs/architecture/ATS_3.0_UI_Modernization_Blueprint.md'
];

bpPaths.forEach(p => {
  if (fs.existsSync(p)) {
    let content = fs.readFileSync(p, 'utf8');
    content = content.replace('## 7. Nhật Ký Cập Nhật (Changelog)', '## 7. Nhật Ký Cập Nhật (Changelog)\n' + blueprintLog);
    fs.writeFileSync(p, content);
    console.log('Updated ' + p);
  }
});

// Update Development Log
const devLogPath = 'g:/My Drive/AI project/ATS/ats-web/docs/DEVELOPMENT_LOG.md';
if (fs.existsSync(devLogPath)) {
  let content = fs.readFileSync(devLogPath, 'utf8');
  content = content + devLog;
  fs.writeFileSync(devLogPath, content);
  console.log('Updated DEVELOPMENT_LOG.md');
}
