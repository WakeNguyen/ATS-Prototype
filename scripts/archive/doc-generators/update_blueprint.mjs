import fs from 'fs';

const files = [
  'g:/My Drive/AI project/My Porfolio/blue print/ATS_3.0_UI_Modernization_Blueprint.md',
  'g:/My Drive/AI project/ATS/ats-web/docs/architecture/ATS_3.0_UI_Modernization_Blueprint.md'
];

for (const file of files) {
  if (fs.existsSync(file)) {
    let content = fs.readFileSync(file, 'utf8');
    const changelogEntry = `\n### v3.0-RC78 (31/08/2026)\n* ✨ **Hoàn thành Đồng bộ & Chuẩn hóa Dữ liệu (Notion to Supabase Phase 2)**:\n  * Thực hiện thành công việc Migrate toàn bộ dữ liệu (Jobs, Campaigns, Interviews) và cơ chế Master-Detail cho Applications.\n  * Auto-heal 100% định dạng Email & Số điện thoại (Chuẩn E.164).\n  * Gộp (Merge) an toàn 32 Profile trùng lặp từ Notion cũ, xóa sạch dữ liệu mồ côi (Orphans) và đảm bảo Data Integrity 100%.\n`;
    content = content.replace('## 7. Nhật Ký Cập Nhật (Changelog)', '## 7. Nhật Ký Cập Nhật (Changelog)\n' + changelogEntry);
    fs.writeFileSync(file, content, 'utf8');
    console.log(`Updated Blueprint: ${file}`);
  }
}
