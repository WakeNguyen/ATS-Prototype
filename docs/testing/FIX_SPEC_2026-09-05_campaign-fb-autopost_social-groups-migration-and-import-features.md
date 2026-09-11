---
title: FIX_SPEC 2026-09-05 — Hoàn tất migrate Social Groups (Google Sheet) + tính năng Bulk Import CSV/XLSX + Filter theo số lượng thành viên
role: Claude = Architect/QA (viết spec này) → AG = Implementer (thực thi toàn bộ bên dưới)
---

## 0. Bối cảnh — ĐỌC TRƯỚC KHI LÀM

User cung cấp 1 Google Sheet mới ("social group url", tab **FB Group**, 1028 dòng dữ liệu group Facebook thật đã được lọc/gán tag bằng AI + xác minh thủ công — cột `AI Verify` / `AI Tag` chỉ dùng nội bộ lúc gắn tag, KHÔNG migrate 2 cột này; cột `Group Type` mới là tag chính thức). Tab phụ **GroupType** trong sheet chỉ dùng làm dropdown validation trong Google Sheet, không phải dữ liệu thật — đã bỏ qua.

User yêu cầu: (1) thêm property lưu số lượng thành viên group, hiển thị trên UI; (2) migrate toàn bộ dataset mới này lên cả 2 schema `sandbox` và `public`; (3) riêng `public` phải **xoá bỏ hẳn database group cũ** và dùng dataset mới này làm nguồn duy nhất từ nay; (4) thêm tính năng upload hàng loạt group bằng file Excel/CSV có check trùng URL; (5) thêm filter theo số lượng thành viên (lớn hơn/nhỏ hơn/trong khoảng).

**Claude (Architect) đã tự thực hiện phần schema + data migration trực tiếp qua Supabase MCP** (đúng tiền lệ PHẦN 1 của dự án — DDL/data migration do Claude làm trực tiếp, không qua AG) và đã dừng lại đúng lúc để bàn giao phần còn lại + toàn bộ phần code application cho AG, theo đúng phân vai Architect/QA vs Implementer ([[claude-role-boundary]]). Cụ thể đã xong:

- ✅ Thêm cột `member_count integer` vào `social_group_urls` (cả `sandbox` và `public`).
- ✅ Đăng ký 12 tag mới vào `social_group_tags` (cả 2 schema): `Mechanical`, `Mechatronics`, `Industrial Automation`, `Industrial`, `IT`, `Dev`, `QA`, `BA`, `PM`, `Network IT`, `Infrastructure IT`, `Devops`.
  - ⚠️ **Lưu ý tên tag đã đổi:** sheet gốc có 2 tag `Network (IT)` và `Infrastructure (IT)` chứa dấu ngoặc `()`, nhưng constraint `social_group_tags_name_charset_check` (từ PHẦN 5.8) chỉ cho phép `^[A-Za-z0-9 _-]+$`. User đã xác nhận đồng ý đổi tên bỏ ngoặc → `Network IT` và `Infrastructure IT`. Toàn bộ group nào có tag này trong data đã dùng đúng tên mới.
- ✅ Đã XOÁ toàn bộ dữ liệu cũ trên **cả 2 schema** theo đúng yêu cầu User (User xác nhận rõ: xoá hẳn, không cần giữ lại):
  - Toàn bộ `campaigns` cũ (22 dòng ở `public`, 8 dòng ở `sandbox` — đều là campaign test/demo gắn với nhóm category cũ như Cosmetic/Marketing/Nontech/Nurse/Video Editor, không có `campaign_runs` thật nào từng chạy).
  - Cascade theo đó: `campaign_social_groups`, `campaign_fb_accounts`, `campaign_runs` liên quan cũng bị xoá theo (FK `ON DELETE CASCADE`).
  - Toàn bộ `social_group_urls` cũ (455 dòng ở `public`, 141 dòng ở `sandbox`).
- 🟡 Đã insert dở dang dữ liệu mới từ sheet (1028 dòng) — **PHẦN 1 bên dưới là việc AG cần làm để hoàn tất nốt phần này**, Claude dừng lại giữa chừng đúng lúc phát hiện đang làm thay việc của Implementer.

**Kết quả:** ngay lúc bàn giao spec này, `public.social_group_urls` có 1000/1028 dòng, `sandbox.social_group_urls` có 800/1028 dòng, và `campaigns` ở cả 2 schema đang **trống hoàn toàn** (đây là chủ đích, không phải lỗi — User sẽ tạo lại campaign mới nhắm vào nhóm ngành IT/Cơ khí/Cơ điện tử sau).

---

## PHẦN 1 — Hoàn tất migrate dữ liệu (BẮT BUỘC LÀM TRƯỚC, không phụ thuộc PHẦN 2/3)

File đính kèm: **`DATA_2026-09-05_social-groups-remaining-insert.sql`** (gửi kèm cùng spec này).

Việc cần làm:
1. Chạy đúng nguyên văn file SQL này **1 lần duy nhất** qua Supabase MCP (`execute_sql`, project `your-project-ref`) hoặc `psql` — file này CHỈ chứa đúng phần dữ liệu còn thiếu (28 dòng cho `public`, 228 dòng cho `sandbox`), **KHÔNG chạy lại toàn bộ 1028 dòng** vì `social_group_urls` không có unique constraint trên `url` → chạy trùng sẽ tạo dữ liệu duplicate.
2. Chạy đúng 2 query verify ở cuối file: cả `public` và `sandbox` phải trả về **đúng 1028** dòng trong `social_group_urls`, và **0** dòng nào NULL `member_count` hoặc rỗng `group_type`.
3. Cập nhật `docs/DEVELOPMENT_LOG.md` — nhớ áp dụng đúng cả 2 phần (bảng tổng hợp đầu file + chi tiết, xem [[devlog-summary-table-rule]]) — ghi rõ: nguồn dữ liệu (Google Sheet "social group url"), số dòng cuối cùng (1028 mỗi schema), việc campaigns cũ đã bị xoá sạch (để tránh nhầm lẫn "mất dữ liệu" sau này khi ai đó thấy bảng Campaigns trống).

## PHẦN 2 — Property "Số lượng thành viên" trên UI (member_count)

Cột `member_count` (integer) đã có sẵn trong DB. Cần:
1. `src/app/campaign_actions.js`: thêm `member_count` vào SELECT của `getSocialGroupsLibrary` và `getSocialGroups`; thêm `member_count` (optional, integer, cho phép null) vào tham số của `createSocialGroup` và `updateSocialGroupDetails`.
2. `src/app/components/SocialGroupCreateModal.js`: thêm input số cho "Số lượng thành viên" (định dạng có dấu phẩy ngăn cách nghìn khi hiển thị, lưu về DB là số nguyên thuần — tham khảo cách Members trong sheet gốc dùng dấu chấm ngăn cách nghìn kiểu Việt Nam để tránh nhầm khi User nhập tay).
3. `src/app/campaigns/page.js`: thêm cột "Thành viên" vào bảng Social Group URLs Library (sub-tab thứ 3), format số có dấu phân cách nghìn (vd: `1,900,000`), cho sửa inline giống cách sửa tên/URL hiện tại.
4. Không bắt buộc hiển thị `member_count` trong 2 modal picker (`CampaignEditModal.js`/`FbAccountEditModal.js`) trừ khi AG thấy hợp lý thêm cột phụ nhỏ — không phải yêu cầu bắt buộc của PHẦN này.

## PHẦN 3 — Filter theo số lượng thành viên trong Social Group URLs Library

Vị trí: thanh toolbar filter của sub-tab "Social Group URLs" (`campaigns/page.js`), cạnh ô Search và Multi-Tag Filter hiện có.

1. UI: 2 ô input số "Từ" (min) và "Đến" (max), để trống = không giới hạn. Có thể dùng 1 dropdown "Điều kiện" (Lớn hơn / Nhỏ hơn / Trong khoảng) + 1-2 ô input tương ứng — AG tự chọn UX đơn giản nhất, ưu tiên tái dùng pattern input/filter đã có trong file thay vì tạo mới (xem [[ui-design-principle-mvc]]: function-first, không màu mè, tái dùng component có sẵn).
2. Backend: mở rộng `getSocialGroupsLibrary(...)` trong `campaign_actions.js` nhận thêm tham số `minMembers`/`maxMembers` (optional), thêm điều kiện `AND member_count >= $x` / `AND member_count <= $y` vào WHERE clause hiện có (giữ nguyên toàn bộ filter khác: search, tag, show inactive).
3. Debounce giống pattern search hiện tại (300ms) để tránh gọi server liên tục khi gõ số.
4. Test: verify lọc đúng biên (`=` min/max phải được tính, không chỉ `>`/`<` thuần), verify kết hợp đồng thời với Search + Tag Filter cho ra đúng giao (AND) của tất cả điều kiện.

## PHẦN 4 — Bulk Import Social Groups từ file Excel/CSV + check trùng URL

Đây là tính năng UI mới thay thế việc phải insert tay/qua SQL mỗi khi có danh sách group mới (như lần này) — vị trí: sub-tab "Social Group URLs" trong `campaigns/page.js`, thêm nút "Import từ file" cạnh nút "+ Thêm Group" hiện có.

### 4.1 Luồng người dùng
1. Bấm "Import từ file" → mở modal mới (`SocialGroupBulkImportModal.js`), cho chọn file `.xlsx`/`.csv`.
2. Client-side đọc file (dùng thư viện `xlsx`/`papaparse` — kiểm tra `package.json` xem đã có sẵn chưa trước khi thêm dependency mới), map cột theo tên header linh hoạt (chấp nhận biến thể tên cột thường gặp: `URL`/`Url`/`Link`; `Name`/`Tên`; `Members`/`Member Count`/`Số lượng thành viên`; `Group Type`/`Tag`/`Tags`) — nếu không tự map được, cho User chọn cột thủ công qua dropdown (đơn giản, không cần AI).
3. Gửi danh sách đã parse lên 1 Server Action mới `bulkImportSocialGroups(rows)` để xử lý phía server (không tin tưởng dữ liệu validate phía client).
4. Server trả về báo cáo: số dòng sẽ thêm mới, số dòng bị **skip vì trùng URL** (so với DB hiện có, so sánh sau khi chuẩn hoá: trim khoảng trắng, bỏ dấu `/` cuối URL, không phân biệt hoa/thường phần domain), số dòng trùng URL **ngay trong chính file upload**, số dòng lỗi định dạng (thiếu URL/tên, `member_count` không phải số).
5. Hiển thị báo cáo dạng bảng preview cho User xem trước khi bấm "Xác nhận Import" — chỉ insert sau khi User bấm xác nhận (không tự động insert ngay khi đọc xong file).
6. Sau khi insert, tag mới xuất hiện trong file (nếu có) tự động đăng ký vào `social_group_tags` theo đúng cơ chế `ON CONFLICT ((lower(name))) DO NOTHING` đã có sẵn — **nhưng phải validate charset trước** (`^[A-Za-z0-9 _-]+$`, dùng lại `isValidTagName` đã có từ PHẦN 5.8): tag nào không hợp lệ → liệt kê rõ trong báo cáo lỗi, KHÔNG tự động sửa/bỏ ký tự, để User tự sửa file gốc rồi upload lại.

### 4.2 Backend
- Server Action mới trong `campaign_actions.js`: `bulkImportSocialGroups(rows: {url, name, group_type: string[], member_count?: number}[])`.
- Dedup URL: query 1 lần toàn bộ `url` hiện có trong `social_group_urls` (schema đang active — dùng đúng `DB_SCHEMA` hiện tại của app, KHÔNG hard-code `public`), so sánh chuẩn hoá như mục 4.1.4, trả về danh sách URL trùng thay vì insert đè.
- Insert theo batch (dùng `pg-format`/multi-row VALUES hoặc vòng lặp trong 1 transaction) — tham khảo cách Claude đã cấu trúc SQL insert trong `DATA_2026-09-05_social-groups-remaining-insert.sql` làm ví dụ format dữ liệu (mảng tag dùng `ARRAY[...]::text[]`).
- Giới hạn hợp lý số dòng 1 lần import (đề xuất 5000 dòng/lần, đủ dư cho quy mô hiện tại ~1000-2000 dòng) để tránh timeout — nếu file lớn hơn, báo lỗi rõ ràng yêu cầu chia nhỏ.

### 4.3 Test bắt buộc trước khi báo PASS
- Import file có 100% URL mới → insert đủ, không sót không trùng.
- Import file có 1 số URL đã tồn tại trong DB → các dòng đó bị skip đúng, báo cáo đúng số lượng, các dòng còn lại vẫn insert bình thường.
- Import file có 2 dòng trùng URL với nhau ngay trong file → chỉ giữ 1, báo cáo rõ.
- Import file có tag chứa ký tự không hợp lệ (dấu ngoặc, dấu, ký tự đặc biệt) → bị chặn đúng, báo lỗi rõ dòng nào/tag nào, không insert dòng đó.
- Import file có cột `Members` định dạng có dấu chấm ngăn cách nghìn kiểu Việt Nam (vd `1.900`) lẫn định dạng số thuần (vd `1900`) → parse đúng cả 2 kiểu (đây đúng là định dạng gặp thật trong sheet gốc User cung cấp).
- `npm run build` PASS toàn bộ routes.

---

## Ghi chú chung
- Toàn bộ PHẦN 2/3/4 là code application (`src/`) → đúng quy trình 2-agent, AG code + tự QA, Claude review sau khi AG báo cáo xong (xem [[claude-role-boundary]]).
- PHẦN 1 là dữ liệu/SQL thuần, AG chỉ cần chạy đúng file đính kèm, không cần viết thêm code.
- Không có PHẦN nào trong spec này đụng chạm tới nhánh code khác đang chạy song song (Responsive Tablet R.3-R.6) — an toàn làm độc lập.
