const fs = require('fs');

const bpPaths = [
  'g:/My Drive/AI project/My Porfolio/blue print/ATS_3.0_UI_Modernization_Blueprint.md',
  'g:/My Drive/AI project/ATS/ats-web/docs/architecture/ATS_3.0_UI_Modernization_Blueprint.md'
];

bpPaths.forEach(p => {
  if (fs.existsSync(p)) {
    let content = fs.readFileSync(p, 'utf8');
    
    const oldRow = '| **Phase 6: AI CV Parser & Matching** | Tích hợp n8n webhook / Gemini API để tự động trích xuất thông tin CV và gợi ý độ phù hợp với Job. | ⏳ Dự kiến | 0% |';
    const newRow = '| **Phase 6: External N8N Workflows & HITL** | Tích hợp Webhook N8N VPS OCR CV, xử lý chống trùng lặp dữ liệu đa nguồn qua giao diện chờ duyệt (Human-in-the-loop Notification Queue), và API phân tích CV. | 🟡 Đang thực hiện | 60% |';
    
    // We just replace using a regex that ignores encoding corruption
    content = content.replace(/\| \*\*Phase 6: AI CV Parser & Matching\*\* \|.*\| \d+% \|/g, newRow);
    
    fs.writeFileSync(p, content);
    console.log('Updated roadmap in ' + p);
  }
});
