# ATS 3.0 Development Log & Rollback History

Tài liệu này ghi chép chi tiết từng mốc phát triển, các thay đổi mã nguồn, thay đổi cơ sở dữ liệu và vị trí lưu bản snapshot sao lưu (backup) để phục vụ việc **Rollback (khôi phục trạng thái cũ)** tức thì khi người dùng yêu cầu.

---

## 📌 Bảng Tổng Hợp Snapshots & Điểm Phục Hồi

| Snapshot ID | Thời Gian | Phiên Bản | Tóm Tắt Thay Đổi | Trạng Thái | Thư Mục Sao Lưu |
| :--- | :--- | :---: | :--- | :--- | :--- |
| **`SNAP-20260830-37`** | 30/08/2026 23:08 | `v3.0-RC74` | 🛡️🐛 **Fix Missing Application ID Error in Candidate 360 Timeline Note & Polymorphic Signature Support**: Khắc phục triệt để lỗi `Failed to add timeline note: Missing Application ID` khi thêm ghi chú phỏng vấn trong Candidate 360: (1) Nâng cấp Server Action `addActivityLog` hỗ trợ chữ ký đa hình (Polymorphic Arguments) linh hoạt nhận cả dạng Object `{ application_id, action_type, note }` lẫn Positional `(applicationId, stage, note)`; (2) Đồng bộ việc truyền tham số trong `handleAddTimelineNote` tại `src/app/candidates/page.js`; (3) Tự động revalidate path `/candidates` và `/` ngay sau khi ghi nhận log mới. | ✅ Stable | `.backups/20260830_v3.0_fix_add_activity_log_polymorphic_args` |
| **`SNAP-20260830-36`** | 30/08/2026 23:05 | `v3.0-RC73` | 🛡️✨ **Fix Action Timeline Auto-Slide Infinite Scroll-Resize Oscillation Loop**: Khắc phục triệt để lỗi Action Timeline giật giật liên tục mở rồi đóng nhanh: (1) Thay thế sự kiện `onScroll` bằng `onWheel` (`Math.abs(e.deltaY) > 5`), triệt tiêu 100% việc trình duyệt tự bắn sự kiện `scroll` do container co giãn chiều cao khi Timeline mở ra; (2) Tích hợp nút **`Hide`** thủ công ngay trên Sub-table Header giúp người dùng chủ động đóng/mở Action Timeline; (3) Timeline luôn đứng yên ổn định khi người dùng không lăn chuột. | ✅ Stable | `.backups/20260830_v3.0_fix_action_timeline_scroll_resize_loop` |
| **`SNAP-20260830-35`** | 30/08/2026 22:35 | `v3.0-RC72` | 🧪🛡️ **50% Isolated Sandbox Dummy Database Ingestion & Zero-Leakage Connection**: (1) Khởi tạo schema `sandbox` và nhân bản trọn vẹn DDL của 14 bảng dữ liệu từ schema `public`; (2) Nạp thành công **11,882 bản ghi dữ liệu giả lập chất lượng cao** (50% khối lượng thật): 95 Clients, 155 Job Orders, 1,688 Candidates, 5,914 Contact Points, 1,600 Applications, 2,218 Activity Logs, 24 Interviews, 18 Onboarding Records, 8 Campaigns, 140 Social URLs; (3) Cập nhật `src/lib/db.js` tự động trỏ `search_path=sandbox,public`, bảo vệ an toàn 100% dữ liệu sản xuất thật và phục vụ hoàn hảo cho việc test và chụp ảnh User Manual. | ✅ Stable | `.backups/20260830_v3.0_isolated_sandbox_dummy_database_50pct` |
| **`SNAP-20260830-34`** | 30/08/2026 22:14 | `v3.0-RC71` | 🏢🖱️ **Mouse Wheel Scroll & Full Keyboard Navigation for Jobs & Clients Dropdown**: Đồng bộ chuẩn trải nghiệm cho `SearchableClientDropdown` trên Master Client Header (`/jobs`): (1) Cố định cứng chiều cao vùng danh sách `height: 260px`, `maxHeight: 260px`, `overflowY: scroll`, `overscrollBehavior: contain` kèm thanh cuộn ngọc bích; (2) Chặn nổi bọt `onWheel` `e.stopPropagation()` giúp lăn chuột mượt mà; (3) Tích hợp trọn bộ phím tắt `ArrowDown`, `ArrowUp`, `PageDown` (+6), `PageUp` (-6), `Enter` và `Escape` kèm `scrollIntoView` tự động. | ✅ Stable | `.backups/20260830_v3.0_jobs_client_dropdown_scroll_and_keyboard_nav` |
| **`SNAP-20260830-33`** | 30/08/2026 22:11 | `v3.0-RC70` | 🛡️⚡ **Fix React setState Side-Effect in Dropdown Keyboard Handler**: Khắc phục triệt để lỗi `Cannot update a component ('Router') while rendering a different component ('SearchableCandidateDropdown')`: Tách biệt hoàn toàn side effect `loadNextBatch()` ra ngoài hàm thuần túy `setActiveIndex`, xử lý biến `next` độc lập trước khi kích hoạt Server Action, triệt tiêu hoàn toàn cảnh báo Next.js Router và xung đột chu trình render. | ✅ Stable | `.backups/20260830_v3.0_fix_setstate_in_render_router_error` |
| **`SNAP-20260830-32`** | 30/08/2026 22:10 | `v3.0-RC69` | 🎯🖱️ **Fix Dropdown Scroll Container Constraints & Full Keyboard Navigation**: Khắc phục triệt để lỗi không cuộn được chuột và phím mũi tên: (1) Cố định cứng chiều cao `height: 350px`, `maxHeight: 350px`, `overflowY: scroll`, `overscrollBehavior: contain` bằng inline style cho container danh sách, ngăn chặn triệt để hiện tượng container bị giãn dài quá khổ off-screen khiến mất thanh cuộn; (2) Chặn nổi bọt sự kiện lăn chuột `e.stopPropagation()` trên `onWheel`; (3) Nâng cấp bộ điều hướng bàn phím (`ArrowUp`, `ArrowDown`, `PageUp`, `PageDown`, `Enter`) tự động cuộn mượt item đang chọn vào tầm nhìn với `scrollIntoView`. | ✅ Stable | `.backups/20260830_v3.0_fix_dropdown_scroll_container_and_keyboard_nav` |
| **`SNAP-20260830-31`** | 30/08/2026 22:06 | `v3.0-RC68` | 📜⚡ **Server-Side Infinite Scroll Pagination for SearchableCandidateDropdown**: Nâng cấp cơ chế cuộn chuột nạp thêm dữ liệu từ server (Server-Side Infinite Scroll): (1) Bổ sung sự kiện `onScroll` lắng nghe khi cuộn gần đáy danh sách để tự động gọi `searchCandidatesServer({ query, limit = 50, offset = results.length })` nạp tiếp +50 ứng viên; (2) Tích hợp nút bấm nạp nhanh `Scroll down or click here to load next 50 candidates (X of Y)` và icon xoay spinner trong lúc nạp; (3) Hỗ trợ phím `↓` tự động kích hoạt nạp trang khi di chuyển xuống gần cuối danh sách. | ✅ Stable | `.backups/20260830_v3.0_serverside_infinite_scroll_pagination` |
| **`SNAP-20260830-30`** | 30/08/2026 22:03 | `v3.0-RC67` | 🛡️🐛 **Fix TypeError CANDIDATE_STAGES.map in AttachCandidateModal**: Khắc phục triệt để lỗi `CANDIDATE_STAGES.map is not a function` khi mở Modal `+ ATTACH CANDIDATE`. Chuyển đổi import từ hằng số Object `CANDIDATE_STAGES` sang mảng chuẩn `CANDIDATE_STAGES_LIST` từ `enums.js`, đảm bảo dropdown Initial Stage hiển thị đầy đủ và mở Modal trơn tru 100%. | ✅ Stable | `.backups/20260830_v3.0_fix_candidate_stages_list_attach_modal` |
| **`SNAP-20260830-29`** | 30/08/2026 22:01 | `v3.0-RC66` | 🛡️⚡ **100% Pure Server-Side PostgreSQL Candidate Search & Zero-Memory Leak Architecture**: Triển khai toàn diện kiến trúc tìm kiếm Server-Side: (1) Xây dựng Server Action `searchCandidatesServer({ query, limit = 50, offset = 0 })` truy vấn trực tiếp PostgreSQL với SQL indexed LIKE/Full-text; (2) Tối ưu hóa `getCandidateProfile` loại bỏ 100% việc dump 3,377 bản ghi về client, cắt giảm dung lượng payload từ 350KB xuống 3KB (giảm 99%); (3) Nâng cấp `SearchableCandidateDropdown` và `SearchableCandidateSwitcher` thành component tìm kiếm Server-Side có bộ đệm Debounce 280ms, bảo vệ tuyệt đối dữ liệu ứng viên không bị lộ trong RAM trình duyệt/DevTools. | ✅ Stable | `.backups/20260830_v3.0_pure_serverside_candidate_search` |
| **`SNAP-20260830-28`** | 30/08/2026 21:57 | `v3.0-RC65` | 🛡️🔒 **Filtering Strategy & Explicit User Approval Protocol Integration**: Thiết lập quy chuẩn bắt buộc về lọc dữ liệu và bảo mật vào Phần C.3 của `GEMINI.md` và Mục 6.6 Blueprint: (1) Đề cao Bảo mật (Security), Toàn vẹn dữ liệu (Data Integrity) và Độ ổn định (Stability) lên hàng đầu, cấm đánh đổi dump dữ liệu về client lấy tốc độ frontend mù quáng; (2) Bắt buộc xin ý kiến và phải có sự đồng ý của User trước khi áp dụng bất kỳ giải pháp lọc Frontend hay Backend; (3) Mặc định chuẩn doanh nghiệp: 100% Backend Server-Side Search/Filter với Debounce và Phân trang SQL (`LIMIT / OFFSET`). | ✅ Stable | `.backups/20260830_v3.0_filtering_strategy_and_user_consent_protocol` |
| **`SNAP-20260830-27`** | 30/08/2026 21:54 | `v3.0-RC64` | 🎯✨ **Action Menu "+ Attach Candidate" Sourcing Workflow & High-Capacity Scrollable Dropdown**: (1) Khắc phục triệt để lỗi thiếu liên kết Client/Job trong `NewCandidateModal.js` do chuẩn hóa `id`/`client_id` và `name`/`client_name` trong `getJobs()` và `getClients()`; (2) Tích hợp nút **`+ ATTACH CANDIDATE`** trên Action Menu (`/`) mở **`AttachCandidateModal`** hỗ trợ quy trình cào CV hàng loạt trước rồi mới gán vào Job sau; (3) Nâng cấp **`SearchableCandidateDropdown`** với cơ chế cuộn chuột mượt mà (Mouse wheel progressive loading) xử lý hơn 2,000+ kết quả không bị cắt ngắn 80 items, thanh cuộn tương phản cao và phím tắt điều hướng `↑`/`↓`/`Enter` cho cả Candidate Header Switcher và Action Menu. | ✅ Stable | `.backups/20260830_v3.0_attach_candidate_and_high_capacity_dropdown` |
| **`SNAP-20260830-26`** | 30/08/2026 21:40 | `v3.0-RC63` | 💡🏛️ **Technical Architect Advisory & Consulting Protocol Integration**: Thiết lập quy chuẩn cố vấn kiến trúc cao cấp cho người dùng (Product Owner / Non-Tech) vào Phần C của `GEMINI.md` và Mục 6.5 Blueprint: (1) Định vị vai trò Lead Technical Architect giải thích thuật ngữ công nghệ phức tạp bằng ngôn ngữ trực quan, gắn liền thực tế tuyển dụng; (2) Bắt buộc áp dụng khung phân tích 5 Trụ cột (Điểm Mạnh - Điểm Yếu, Giá Trị Đạt Được - Cái Giá Đánh Đổi, Khuyến Nghị Của Architect) cho mọi đề xuất kỹ thuật/tính năng. | ✅ Stable | `.backups/20260830_v3.0_technical_architect_advisory_protocol` |
| **`SNAP-20260830-25`** | 30/08/2026 21:38 | `v3.0-RC62` | 👤✨ **Candidate 360° Master Workbench & Auto Latest Candidate Load**: Chuyển đổi toàn diện Menu `Candidates` (`/candidates`) thành **Bàn Làm Việc Hồ Sơ Ứng Viên 360° Chuyên Sâu**: (1) Tự động nạp ngay hồ sơ của **Ứng viên mới nhất** trong DB khi truy cập; (2) **`SearchableCandidateSwitcher`** trên Header hỗ trợ tìm kiếm trực tiếp theo Tên, ID `#`, SĐT, Email, LinkedIn và bộ đếm `Record X of 3,377` kèm nút `◀` / `▶`; (3) Nút **`+ New Candidate`** mở modal chống trùng, tạo xong nhảy ngay sang hồ sơ mới; (4) Fast contact pills (Call, Zalo, Email, Preview CV, `+ Assign to Job`); (5) Bố cục 5:7 Dual Pane: Cột trái (Thông tin cá nhân, Đánh giá, Blacklist, Contact Points Hub), Cột phải (Applications Pipeline + Timeline Accordion + Embedded CV Viewer). | ✅ Stable | `.backups/20260830_v3.0_candidate_360_master_workbench` |
| **`SNAP-20260830-24`** | 30/08/2026 15:39 | `v3.0-RC61` | 📚🏛️ **Comprehensive System Architecture & Backend Documentation Guide**: Nâng cấp toàn diện bộ quy chuẩn kiến trúc hệ thống: (1) **Frontend UI Rules** (Phân tách rõ Presentational/Container/Custom Hooks, cấm `any`, cấm Magic Strings, bắt buộc TSDoc/JSDoc cho Components & Hooks, README mô-đun); (2) **Backend & Database Schema Rules** (UUID/Timestamps/FK/Indexes bắt buộc, Transaction Safety `sql.begin`, Data Validation với parser, JSDoc ghi rõ Roles/Side-effects/Error Codes); (3) Khởi tạo trọn vẹn thư mục `docs/backend/` chứa `schema-map.md` (ERD chi tiết) và `api-contracts.md` (chuẩn response và API contracts). | ✅ Stable | `.backups/20260830_v3.0_system_architecture_and_backend_docs` |
| **`SNAP-20260830-23`** | 30/08/2026 15:38 | `v3.0-RC60` | 📜🏛️ **Official ATS 3.0 Development & Maintenance Rules Enforcement**: Ban hành và thiết lập bộ quy chuẩn phát triển & bảo trì mã nguồn chính thức cho toàn bộ dự án ATS 3.0 vào `GEMINI.md` và Blueprint kỹ thuật: (1) **Code Quality & Architecture** (Clean code, phân tách UI/Logic/Data Access, Type Safety & Null-safety tuyệt đối, Error Handling chặt chẽ); (2) **Code Comments Standard** (Bắt buộc JSDoc/TSDoc cho mọi hàm/API, Comment inline tập trung vào lý do "Why" thay vì cú pháp "What"); (3) **Documentation & Maintainability** (Kiến trúc, luồng dữ liệu và hướng dẫn mở rộng). | ✅ Stable | `.backups/20260830_v3.0_development_maintenance_rules_enforcement` |
| **`SNAP-20260830-22`** | 30/08/2026 15:34 | `v3.0-RC59` | 🛡️🐛 **Fix TypeError localeCompare & Null-Safety Guard in Candidate Modal**: Khắc phục triệt để lỗi `Cannot read properties of undefined (reading 'localeCompare')` khi bấm mở Modal `+ New Candidate`. Bổ sung lớp bảo vệ null-safety toàn diện (`String(a.label || "").localeCompare(String(b.label || ""))`) cho cả 2 mảng `clientOptions` và `filteredJobOptions`, xử lý mượt mà khi metadata Client hoặc Job có trường null/rỗng. | ✅ Stable | `.backups/20260830_v3.0_fix_localecompare_null_safety_candidate_modal` |
| **`SNAP-20260830-21`** | 30/08/2026 15:32 | `v3.0-RC58` | 🎯✨ **Linked Client-First & Searchable Position Filters in New Candidate Modal**: Nâng cấp phân hệ gán Job trong Modal `+ New Candidate`: Tích hợp bộ đôi Searchable Dropdowns tương tự Action Menu: (1) **Dropdown Chọn Client Company** với tìm kiếm thời gian thực, huy hiệu đếm số lượng Open Jobs, và nút `All Clients` / `✕ Clear`; (2) **Dropdown Chọn Vị Trí Tuyển Dụng** tự động lọc danh sách chỉ hiển thị các Job thuộc Client đã chọn, hỗ trợ gõ tìm kiếm vị trí (`Search position (e.g. Java, Nurse)`), hiển thị cờ `✓` xanh lục và tự động reset khi chuyển Client. | ✅ Stable | `.backups/20260830_v3.0_linked_client_job_searchable_dropdowns_candidate_modal` |
| **`SNAP-20260830-20`** | 30/08/2026 15:27 | `v3.0-RC57` | 👤🛡️ **Dedicated Candidate Menu & Strict Anti-Duplicate Intake System**: Tách biệt hoàn toàn Candidate Menu (`/candidates`) thành phân hệ quản lý ứng viên chuyên dụng độc lập với bảng dữ liệu 3,377+ ứng viên. Chuyển Search Menu 3-Tab tổng hợp sang route `/search`. Xây dựng Modal On-Demand **`+ New Candidate`** với cơ chế bảo vệ chống trùng lặp 100%: Bắt buộc tối thiểu 1 contact point, đối soát real-time trên toàn bộ database `contact_points`/`candidates`, cảnh báo chỉ đích danh Ứng viên trùng kèm link mở hồ sơ, tự động lưu cache bản nháp (`localStorage`), chặn tạo tuyệt đối khi còn trùng và hỗ trợ gán thẳng vào Job Order. | ✅ Stable | `.backups/20260830_v3.0_dedicated_candidate_menu_and_strict_anti_duplicate_intake` |
| **`SNAP-20260830-19`** | 30/08/2026 15:14 | `v3.0-RC56` | 🛡️💾 **Client Draft State Machine, Explicit Save & LocalStorage Cache**: Dọn dẹp sạch sẽ 27 dòng dummy clients khỏi database. Thiết lập cơ chế tạo Client an toàn: Khi bấm `+ New Client`, hệ thống chuyển sang chế độ **Draft Mode** (không tạo data vào DB), lưu cache bản nháp tức thì vào `localStorage` chống mất dữ liệu khi chuyển trang. Chỉ khi người dùng bấm nút **`💾 Save Client`** (hoặc Enter) mới ghi vào PostgreSQL. Bổ sung nút **`✕ Cancel`** để hủy nháp. | ✅ Stable | `.backups/20260830_v3.0_client_draft_mode_and_save_cache` |
| **`SNAP-20260830-18`** | 30/08/2026 15:06 | `v3.0-RC55` | 🆕✨ **Fix "+ New Client" Button State Transition & Direct Navigation**: Khắc phục triệt để lỗi bất đồng bộ khi tạo Khách hàng mới: Thay vì gọi hàm `navigateClient(clients.length)` với index chưa kịp cập nhật, hàm `handleCreateNewClient` sẽ tự động nối trực tiếp Client mới tạo vào state `clients`, chuyển ngay `currentClientIndex` đến vị trí mới, reset sạch pipeline và nạp form để người dùng có thể đặt tên, nhập Tax ID và tạo Job Order ngay lập tức. | ✅ Stable | `.backups/20260830_v3.0_fix_create_new_client_navigation` |
| **`SNAP-20260830-17`** | 30/08/2026 15:03 | `v3.0-RC54` | 🔍✨ **Searchable Client Dropdown & Clean Header Navigation**: Xóa bỏ cụm 4 nút điều hướng cũ (`[ ▢ ]`) thừa thãi trên Master Client Header. Thay thế thẻ `<select>` tĩnh bằng component **`SearchableClientDropdown`** trực quan tương tự Action Menu: Hỗ trợ tìm kiếm thời gian thực (theo Tên công ty hoặc Mã số `#`), hiển thị danh sách dạng thẻ thanh lịch kèm cờ `✓` xanh lục cho công ty đang chọn, thống kê số lượng kết quả và tự động focus ô tìm kiếm khi mở. | ✅ Stable | `.backups/20260830_v3.0_searchable_client_dropdown_header` |
| **`SNAP-20260830-16`** | 30/08/2026 14:58 | `v3.0-RC53` | 🏢🧹 **Streamline Location Popover (Registered Addresses & Empty/Remote Support)**: Xóa bỏ hoàn toàn mục Standard/Remote thừa thãi trong Location Selection Popover. Hỗ trợ nút xóa/để trống `⚪ None / Unspecified (e.g. Remote)` cho các vị trí tuyển dụng làm việc từ xa (được cấu hình qua Working Mode). Hiển thị ký hiệu `—` thanh lịch khi Job Order không gán địa chỉ cụ thể. | ✅ Stable | `.backups/20260830_v3.0_streamline_location_popover_registered_only` |
| **`SNAP-20260830-15`** | 30/08/2026 14:54 | `v3.0-RC52` | 🎯✨ **Fix Location Cell 1-Click Trigger & Overflow Clipping**: Gỡ bỏ thuộc tính `truncate` (`overflow: hidden`) gây che khuất Popover trên thẻ `<td>` của bảng Job Orders. Bổ sung sự kiện chặn nổi bọt `e.stopPropagation()` và thiết kế nút chọn địa chỉ với icon Chevron `▾` trực quan, cho phép mở bung Location Selection Popover ngay cả khi nhấp đơn (Single-click) hoặc nhấp đúp (Double-click). | ✅ Stable | `.backups/20260830_v3.0_fix_location_popover_click_and_unclip` |
| **`SNAP-20260830-14`** | 30/08/2026 14:52 | `v3.0-RC51` | 🗺️✨ **Interactive Location Popover Dropdown (Eliminate Native Datalist Pre-filtering Bug)**: Thay thế hoàn toàn thẻ `datalist` của trình duyệt bằng **Interactive Location Selection Popover**. Khi double-click vào cột Location của bất kỳ Job Order nào, popover sẽ mở bung danh sách đầy đủ gồm **Trụ sở chính** (`🏢 Main Headquarters`), **Tất cả các Chi nhánh đã đăng ký** (`📍 Tên chi nhánh: Địa chỉ cụ thể`), **Các tùy chọn chuẩn/Remote** và **Ô nhập địa chỉ tự do**, cho phép chọn 1-click tức thì và không bao giờ bị trình duyệt ẩn đi các chi nhánh khác khi đã có sẵn dữ liệu cũ. | ✅ Stable | `.backups/20260830_v3.0_interactive_location_popover` |
| **`SNAP-20260830-13`** | 30/08/2026 14:48 | `v3.0-RC50` | 🧹✨ **Deduplicate Location Options & Clean Test Branches**: Loại trừ triệt để thẻ Trụ sở chính (HQ) khỏi danh sách duyệt chi nhánh phụ, khắc phục hoàn toàn hiện tượng hiển thị 2 dòng địa chỉ HQ giống hệt nhau trong gợi ý datalist của Job Orders. Dọn dẹp sạch chi nhánh test trong database và chuẩn hóa bộ đếm huy hiệu `additionalBranches` trên Header (chỉ đếm chi nhánh phụ thực tế). | ✅ Stable | `.backups/20260830_v3.0_deduplicate_job_location_datalist` |
| **`SNAP-20260830-12`** | 30/08/2026 14:46 | `v3.0-RC49` | 🏢📍 **Remove Header Location Pill & Use Full Client Address for Job Orders**: Loại bỏ ô chọn Location thừa trên Row 1 của Master Client Header (đã được hợp nhất vào thanh HQ Address & Branches bên dưới). Nâng cấp cột **Location** trong bảng Job Orders để chọn và hiển thị trực tiếp **Địa chỉ đầy đủ** của Trụ sở chính (`HQ Address`) hoặc Chi nhánh (`Branch Address`) từ danh sách gợi ý datalist thay vì chỉ ghi tên ngắn gọn `HQ`. Đảm bảo mỗi Job Order gắn với đúng 1 địa chỉ làm việc cụ thể. | ✅ Stable | `.backups/20260830_v3.0_job_full_address_location` |
| **`SNAP-20260830-11`** | 30/08/2026 14:39 | `v3.0-RC48` | 🏢📍 **Direct Dynamic Branch Address Rows on Header & Address Restoration**: Khôi phục chính xác 100% địa chỉ gốc cho khách hàng All That Beauty Clinic (`53/4 Trần Khánh Dư, Tân Định, TP HCM`). Hiển thị trực tiếp các dòng địa chỉ chi nhánh (Branch Address Rows) ngay dưới thanh HQ Address trên Master Client Header kèm Tên chi nhánh, Badge Tỉnh/thành phố, Số hotline, nút Sao chép `📋` và nút Sửa nhanh `✏️`, giúp người dùng quan sát được toàn bộ địa chỉ của công ty mà không cần mở Drawer. | ✅ Stable | `.backups/20260830_v3.0_direct_branch_address_lines` |
| **`SNAP-20260830-10`** | 30/08/2026 14:33 | `v3.0-RC47` | 🏢✨ **Unified Branches & HQ Architecture**: Hợp nhất hiển thị danh sách Chi nhánh và Trụ sở chính (HQ) thành một danh sách động duy nhất (`branchesList`). Khắc phục hiện tượng hiển thị 2 thẻ HQ trùng lặp. Hỗ trợ đầy đủ chức năng Sửa (`✏️`), Xóa (`🗑️`), và Đổi Trụ sở chính (`Set as HQ`) cho mọi chi nhánh; Tự động đồng bộ `clients.location` & `clients.address` theo Trụ sở chính mới; Chuẩn hóa native JSONB với `sql.json()`. | ✅ Stable | `.backups/20260830_v3.0_fix_branch_hq_unification` |
| **`SNAP-20260830-09`** | 30/08/2026 14:26 | `v3.0-RC46` | 🏢📍 **Multi-Branch Management (`clients.branches jsonb`) & On-Demand UI Linking:** Bổ sung cột `branches jsonb DEFAULT '[]'::jsonb` cho bảng `clients` trong PostgreSQL. Xây dựng phân hệ On-Demand **Client Branches & Offices Drawer** trên bàn làm việc `/jobs` (nút `📍 Branches (N)` cạnh `👥 Contacts`), hỗ trợ quản lý đa chi nhánh/nhà máy/văn phòng đại diện (CRUD, đặt trụ sở chính HQ, copy địa chỉ 1-click). Đồng bộ danh sách chi nhánh vào gợi ý chọn nhanh (datalist) khi chỉnh sửa Location trong bảng Job Orders. | ✅ Stable | `.backups/20260830_v3.0_client_multi_branches_jsonb` |
| **`SNAP-20260830-08`** | 30/08/2026 14:15 | `v3.0-RC45` | 🎯 **Job Row Single-Click Focus & Double-Click Inline Edit:** Tối ưu hóa trải nghiệm bảng Job Orders: Single-click vào bất kỳ vị trí nào trên hàng Job (bao gồm Tên Job, Location, ID) để chọn và nạp ngay pipeline đơn ứng tuyển; Double-click vào Tên Job hoặc Location để bật chế độ chỉnh sửa inline trực tiếp với tính năng tự động lưu khi bấm Enter/rời chuột. | ✅ Stable | `.backups/20260830_v3.0_job_row_single_click_select_double_click_edit` |
| **`SNAP-20260830-07`** | 30/08/2026 14:10 | `v3.0-RC44` | 🔗 **Fix Deep Linking & Double-Click Navigation for Clients and Jobs Database:** Chuẩn hóa luồng điều hướng khi Double-Click từ Search Menu: Double-click vào Client Name mở thẳng phân hệ `/jobs?client_id=...` nạp đúng khách hàng đó; Double-click vào Job Title mở `/jobs?job_id=...` tự động truy vết Client sở hữu, chọn đúng Job Order và nạp toàn bộ danh sách đơn ứng tuyển của Job đó vào bàn làm việc. | ✅ Stable | `.backups/20260830_v3.0_fix_deep_linking_client_job` |
| **`SNAP-20260830-06`** | 30/08/2026 14:01 | `v3.0-RC43` | 👁️ **On-Demand Collapsible JD Link Input & Airy Clean UX:** Chuyển đổi khung nhập link JD (`jd_url`) thành dạng On-Demand có nút bật/tắt (ẩn/hiện `showJdLinkInput`); Khi thu gọn chỉ hiển thị 1 dòng mỏng kèm trạng thái `[Link Attached]` và nút xem nhanh `Preview JD ↗` / `Edit Link`, giải phóng tối đa chiều cao màn hình cho bảng Job Orders và Job Notes. | ✅ Stable | `.backups/20260830_v3.0_ondemand_jd_link_toggle` |
| **`SNAP-20260830-05`** | 30/08/2026 13:58 | `v3.0-RC42` | 🖥️ **Full-Width Bulletproof Flexbox Dual Pane Layout:** Chuyển đổi container chính sang cấu trúc Flexbox hiện đại (`w-[45%]` cho Job Orders + `flex-1 min-w-0` cho Applications & Pipeline / JD Viewer); Triệt tiêu hoàn toàn lỗi Tailwind JIT grid-column bị bóp hẹp còn 8% màn hình, giúp 2 phân hệ luôn luôn dàn trải 100% chiều ngang màn hình side-by-side chuẩn xác. | ✅ Stable | `.backups/20260830_v3.0_job_working_mode_multiselect` |
| **`SNAP-20260830-04`** | 30/08/2026 13:56 | `v3.0-RC41` | 📐 **Fix Side-by-Side Dual Pane Layout (5:7 Split View Lock):** Khắc phục lỗi rớt hàng (vertical stacking) khi thu nhỏ màn hình bằng cách khóa cố định tỷ lệ `col-span-5` (Job Orders) và `col-span-7` (Applications & Pipeline / JD Viewer) trong grid 12 cột, đảm bảo 2 phân hệ luôn luôn nằm song song cạnh nhau trên cùng một hàng ngang mà không bao giờ bị đẩy xuống dưới. | ✅ Stable | `.backups/20260830_v3.0_job_working_mode_multiselect` |
| **`SNAP-20260830-03`** | 30/08/2026 13:54 | `v3.0-RC40` | 🏢⚡🌐 **Working Mode Multi-Select Column for Job Orders & 50-50 Layout Rebalance:** Di trú trường `working_mode` sang kiểu mảng `text[]` trong PostgreSQL; Bổ sung cột **Working Mode** nằm giữa Location và Status trong bảng Job Orders với UI tương tác đa chọn (Multi-Select Popover: `On-site`, `Hybrid`, `Remote`) và hiển thị các badge pill màu sắc trực quan; Tái cân đối tỷ lệ chia màn hình 50:50 (`lg:col-span-6 / 6`) giúp không gian hiển thị của cả 2 bảng hài hòa và chuyên nghiệp. | ✅ Stable | `.backups/20260830_v3.0_job_working_mode_multiselect` |
| **`SNAP-20260830-02`** | 30/08/2026 13:46 | `v3.0-RC39` | 🎯 **Streamline Job Status Lifecycle (Open, On Hold, Closed):** Tinh giản các trạng thái của Job Order chỉ gồm 3 giá trị chuẩn: `Open`, `On Hold`, `Closed` (xóa bỏ `Active` khỏi toàn bộ UI và backend default, chuẩn hóa dữ liệu cũ trong PostgreSQL để tương thích 100% với enum `job_status`). | ✅ Stable | `.backups/20260830_v3.0_job_status_cleanup` |
| **`SNAP-20260830-01`** | 30/08/2026 13:40 | `v3.0-RC38` | 📄 **Embedded JD Document Viewer & JD URL Management for Jobs & Clients Workbench:** Tích hợp trường nhập liệu liên kết JD (`jd_url` - Google Drive / Docs / PDF) vào bảng Job Orders; Nâng cấp cột phải phân hệ `/jobs` với hệ thống 2 Tab chuyển đổi linh hoạt: **Tab 1 `Applications & Pipeline`** và **Tab 2 `Embedded JD Viewer`** (tự động nhúng tài liệu trực tiếp qua iframe thông minh kèm nút `Open Fullscreen`, hỗ trợ form nhập/gắn link nhanh khi chưa có JD). | ✅ Stable | `.backups/20260830_v3.0_job_embedded_jd_viewer` |
| **`SNAP-20260829-23`** | 29/08/2026 22:45 | `v3.0-RC37` | ✏️ **Direct Inline Edit for Contact Points & Multi-Channel Management:** Bổ sung nút sửa trực tiếp `✏️` trên từng pill kênh liên lạc (SĐT/Email/URL/Zalo) của Người phụ trách, cho phép đổi loại kênh và nội dung liên lạc 1-click; Đồng thời giữ nguyên danh sách kênh liên lạc khi đang ở chế độ chỉnh sửa thông tin người (Full Name / Job Title / Department) để không làm gián đoạn trải nghiệm quản lý. | ✅ Stable | `.backups/20260829_v3.0_inline_edit_contact_points` |
| **`SNAP-20260829-22`** | 29/08/2026 22:40 | `v3.0-RC36` | 📇 **PostgreSQL Hybrid Stakeholder Cards & Multi-Channel Contact Points:** Nâng cấp cấu trúc cơ sở dữ liệu: Tạo bảng `client_persons` với cột `contact_points jsonb` chuẩn hóa quan hệ B2B (1 Công ty ➔ N Người liên hệ ➔ N Kênh liên lạc SĐT/Email/Zalo/LinkedIn); Thiết kế giao diện **Thẻ Danh Thiếp Nhân Sự (Stakeholder Business Cards)** chuyên nghiệp, hỗ trợ thêm nhiều kênh liên lạc cho từng người, trực quan và không bị trùng lặp tên người. | ✅ Stable | `.backups/20260829_v3.0_client_persons_jsonb_contacts` |
| **`SNAP-20260829-21`** | 29/08/2026 22:26 | `v3.0-RC35` | 🚀 **Full-Width Expand Pipeline & Single-Active Focus Accordion:** Thêm nút `Expand Pipeline` / `Split View` để mở bung bảng Applications & Pipeline ra toàn màn hình (12 cols) khi cần không gian tối đa; Tối ưu chế độ Single-Active Candidate Accordion (mở 1 ứng viên thì tự động đóng ứng viên trước), tăng chiều cao linh hoạt `max-h-80` cho bảng Action Notes Timeline giúp tận dụng tối đa chiều cao màn hình mà không để thừa khoảng trống. | ✅ Stable | `.backups/20260829_v3.0_expand_pipeline_single_focus` |
| **`SNAP-20260829-20`** | 29/08/2026 22:23 | `v3.0-RC34` | 🧹 **Dynamic Clean On-Demand Fields for Closed Applications:** Tự động ẩn 3 trường `Planning Date`, `Source Channel`, và `Passive Sourcing` khi đơn ứng tuyển ở trạng thái `Closed`, chỉ giữ lại ô chọn Status để giải phóng không gian; khi chuyển lại `In progress` sẽ tự động hiển thị đầy đủ ngay lập tức. Áp dụng đồng bộ trên `/jobs` và `/candidates/[id]`. | ✅ Stable | `.backups/20260829_v3.0_hide_closed_application_fields` |
| **`SNAP-20260829-19`** | 29/08/2026 22:20 | `v3.0-RC33` | 🌐 **100% English UI Standard & On-Demand Airy Clean UX:** Bổ sung Rule 5 bắt buộc 100% tiếng Anh trên toàn bộ UI; Tối ưu triết lý On-Demand Clean UX: Chuyển Client Contacts Hub thành Drawer On-Demand (chỉ bung ra khi bấm nút `Contacts (N)`), mặc định thu gọn các thẻ Timeline, giữ không gian làm việc rộng thoáng 100%. | ✅ Stable | `.backups/20260829_v3.0_english_ui_ondemand_clean_ux` |
| **`SNAP-20260829-18`** | 29/08/2026 22:15 | `v3.0-RC32` | 💼 **Client Contacts Hub & UI Modernization:** Xóa bỏ `work_email` và `notes` khỏi bảng `clients` (DB + UI); Xây dựng **Client Contacts Hub** chuyên nghiệp với đầy đủ CRUD (Add/Edit/Delete/Copy/Direct Action); Không viết tắt `Location`, `Address`, `Client Name`; Tối ưu tỷ lệ 70% viewport cho Job Orders & Applications Pipeline. | ✅ Stable | `.backups/20260829_v3.0_client_contacts_hub_clean_header` |
| **`SNAP-20260829-17`** | 29/08/2026 21:51 | `v3.0-RC31` | 🔒 **Security Hardening:** Thu hồi (REVOKE) toàn bộ quyền `anon` & `authenticated` trên 13 tables (defense-in-depth). Xóa 2 duplicate indexes legacy (`idx_applications_candidate_id`, `idx_applications_job_id`). | ✅ Stable | N/A (DB-only change) |
| **`SNAP-20260829-16`** | 29/08/2026 21:37 | `v3.0-RC30` | 🔒 **Security Fix:** Bật RLS trên 13 tables, di chuyển `pg_trgm` sang schema `extensions`, fix `uuid_generate_v7` search_path. Xóa 13 CRITICAL + 2 WARN từ Supabase Security Advisor. | ✅ Stable | N/A (DB-only change) |
| **`SNAP-20260829-01`** | 29/08/2026 19:44 | `v3.0-RC16` | Thêm Stage `Additional Interview` & `Chasing Feedback`, Chỉnh sửa trực tiếp Action Notes (Inline Edit) & Xóa bỏ sub-bar thừa. | ✅ Stable | `.backups/20260829_v3.0_stages_editlog_cleanui` |
| **`SNAP-20260828-17`** | 28/08/2026 23:30 | `v3.0-RC15` | Tự động chuyển đổi và chuẩn hóa tất cả Stage/Action phi chuẩn (`Call`, `Reaching Out`,...) về `Contact / Reach Out`. | ✅ Stable | `.backups/20260828_v3.0_stage_normalization_contact_reachout` |

---

## 📝 Chi Tiết Từng Snapshot

### Snapshot `SNAP-20260830-37` (30/08/2026 23:08) - Current Version (`v3.0-RC74`)
* **Mục tiêu:** 🛡️🐛 **Fix Missing Application ID Error in Candidate 360 Timeline Note & Polymorphic Signature Support**:
  1. **Khắc phục lỗi `Failed to add timeline note: Missing Application ID`:** Nâng cấp Server Action `addActivityLog` với chữ ký đa hình (Polymorphic Arguments), tự động bóc tách linh hoạt kể cả khi caller truyền vào Object `{ application_id, action_type, note }` hay các tham số vị trí `(applicationId, stage, note)`.
  2. **Đồng bộ hóa component Candidate 360:** Chuẩn hóa hàm `handleAddTimelineNote` trong `src/app/candidates/page.js`, làm mới Timeline logs và tự động cập nhật Stage badge của ứng viên ngay sau khi ghi nhận log thành công.
* **Các file tác động:**
  * `g:\My Drive\AI project\ATS\ats-web\src\app\actions.js`: Nâng cấp hàm `addActivityLog`.
  * `g:\My Drive\AI project\ATS\ats-web\src\app\candidates\page.js`: Đồng bộ hàm `handleAddTimelineNote`.
* **Quy trình Rollback (nếu cần):** Khôi phục từ `.backups/20260830_v3.0_fix_add_activity_log_polymorphic_args`.

---

### Snapshot `SNAP-20260830-36` (30/08/2026 23:05) - Previous Version (`v3.0-RC73`)
* **Mục tiêu:** 🛡️✨ **Fix Action Timeline Auto-Slide Infinite Scroll-Resize Oscillation Loop**:
  1. **Khắc phục lỗi giật giật (Oscillating Resize-Scroll Loop):** Khi bảng Action Timeline mở ra (`h-[260px]`), container bảng Master bên trên bị co chiều cao lại, khiến trình duyệt tự động kích hoạt sự kiện `onScroll`, vô tình gọi lại hàm ẩn Timeline và tạo ra vòng lặp đóng/mở liên tục.
  2. **Chuyển sang lắng nghe `onWheel` có ngưỡng:** Chỉ ẩn Timeline khi người dùng chủ động lăn con trỏ chuột (`Math.abs(e.deltaY) > 5`). Khi Timeline trồi lên lại và container co giãn, không có sự kiện `onWheel` nào được kích hoạt, triệt tiêu 100% hiện tượng giật giật.
  3. **Tích hợp nút `Hide` thủ công:** Bổ sung nút thu gọn nhanh ngay trên Sub-table Header cho phép người dùng chủ động ẩn/hiện Timeline bất kỳ lúc nào.
* **Các file tác động:**
  * `g:\My Drive\AI project\ATS\ats-web\src\app\page.js`: Nâng cấp hàm `handleMasterWheel` và gắn nút Hide thủ công.
* **Quy trình Rollback (nếu cần):** Khôi phục từ `.backups/20260830_v3.0_fix_action_timeline_scroll_resize_loop`.

---

### Snapshot `SNAP-20260830-35` (30/08/2026 22:35) - Previous Version (`v3.0-RC72`)
* **Mục tiêu:** 🧪🛡️ **50% Isolated Sandbox Dummy Database Ingestion & Zero-Leakage Connection**:
  1. **Khởi tạo Schema `sandbox`:** Nhân bản độc lập toàn bộ 14 cấu trúc bảng (DDL), kiểu dữ liệu, khóa chính/khóa ngoại, default values và indexes từ schema `public` sang `sandbox`.
  2. **Nạp 11,882 Bản Ghi Dữ Liệu Giả Lập Chuẩn Chuyên Nghiệp (50% Volume):**
     * **95 Khách Hàng:** Doanh nghiệp mẫu (*VNPAY, MoMo, Tiki, Viettel Digital, FPT Software, Grab, Shopee...*).
     * **155 Vị Trí Tuyển Dụng (Job Orders):** Đa dạng ngành nghề (*Backend, Frontend, DevOps, AI, QA, Product, CFO...*).
     * **1,688 Ứng Viên:** Họ tên, Prefix, DOB, 3% Blacklist mẫu.
     * **5,914 Điểm Liên Lạc:** Phone, Email, LinkedIn, Facebook.
     * **1,600 Hồ Sơ Ứng Tuyển & 2,218 Timeline Logs:** Phân bổ đầy đủ 19 Stages tuyển dụng.
     * **24 Interviews, 18 Onboarding, 8 Campaigns, 140 Social URLs, 165 Campaign Groups, 22 Reach Sourcing.**
  3. **Kết Nối Ứng Dụng Next.js:** Cập nhật `src/lib/db.js` tự động thiết lập `connection: { search_path: 'sandbox,public' }`, bảo vệ an toàn tuyệt đối 100% dữ liệu sản xuất thật trong `public`.
* **Các file tác động:**
  * `g:\My Drive\AI project\ATS\ats-web\src\lib\db.js`
  * `g:\My Drive\AI project\ATS\USER_MANUAL_DRAFT.md`
* **Quy trình Rollback (nếu cần):** Khôi phục từ `.backups/20260830_v3.0_isolated_sandbox_dummy_database_50pct`.

---

### Snapshot `SNAP-20260830-34` (30/08/2026 22:14) - Previous Version (`v3.0-RC71`)
* **Mục tiêu:** 🏢🖱️ **Mouse Wheel Scroll & Full Keyboard Navigation for Jobs & Clients Dropdown**:
  1. **Đồng bộ cơ chế cuộn chuột và phím tắt cho `SearchableClientDropdown`:** Cố định cứng chiều cao `height: '260px'`, `maxHeight: '260px'`, `overflowY: 'scroll'`, `overscrollBehavior: 'contain'`.
  2. **Chặn Xung Đột Sự Kiện Cuộn Chuột:** Bổ sung `onWheel={(e) => e.stopPropagation()}` giúp con lăn chuột cuộn mượt mà không bị Modal/Layout cha nuốt sự kiện.
  3. **Bộ Phím Tắt Điều Hướng Hoàn Hảo:** Hỗ trợ `ArrowDown`, `ArrowUp`, `PageDown` (+6), `PageUp` (-6), `Enter` (chọn client) và `Escape` (đóng dropdown), tự động gọi `scrollIntoView` cho client đang chọn.
* **Các file tác động:**
  * `g:\My Drive\AI project\ATS\ats-web\src\app\jobs\page.js`: Nâng cấp component `SearchableClientDropdown`.
* **Quy trình Rollback (nếu cần):** Khôi phục từ `.backups/20260830_v3.0_jobs_client_dropdown_scroll_and_keyboard_nav`.

---

### Snapshot `SNAP-20260830-33` (30/08/2026 22:11) - Previous Version (`v3.0-RC70`)
* **Mục tiêu:** 🛡️⚡ **Fix React setState Side-Effect in Dropdown Keyboard Handler**:
  1. **Khắc phục lỗi `Cannot update a component ('Router') while rendering a different component`:** Loại bỏ việc gọi `loadNextBatch()` bên trong hàm callback updater của `setActiveIndex(prev => ...)`.
  2. Tính toán giá trị `next` trước, gọi `setActiveIndex(next)` và kích hoạt `loadNextBatch()` ở phạm vi sự kiện sạch, đảm bảo 100% không còn xung đột chu trình render hay warning từ Next.js Server Action Router.
* **Các file tác động:**
  * `g:\My Drive\AI project\ATS\ats-web\src\components\SearchableCandidateDropdown.js`
* **Quy trình Rollback (nếu cần):** Khôi phục từ `.backups/20260830_v3.0_fix_setstate_in_render_router_error`.

---

### Snapshot `SNAP-20260830-32` (30/08/2026 22:10) - Previous Version (`v3.0-RC69`)
* **Mục tiêu:** 🎯🖱️ **Fix Dropdown Scroll Container Constraints & Full Keyboard Navigation**:
  1. **Khắc phục lỗi mất thanh cuộn (Unconstrained Height):** Cố định cứng chiều cao vùng danh sách bằng inline styles `height: '350px'`, `maxHeight: '350px'`, `overflowY: 'scroll'`, `overscrollBehavior: 'contain'`. Ngăn chặn việc container bị giãn dài 2,500px tràn khỏi màn hình.
  2. **Chặn Xung Đột Sự Kiện Cuộn Chuột:** Bổ sung `onWheel={(e) => e.stopPropagation()}` để khi lăn chuột trên danh sách ứng viên, con lăn sẽ trực tiếp cuộn danh sách thay vì bị Modal cha nuốt mất sự kiện.
  3. **Nâng Cấp Bộ Điều Hướng Bàn Phím Toàn Diện:** Gắn `onKeyDown` cho root component, hỗ trợ `ArrowDown`, `ArrowUp`, `PageDown`, `PageUp`, `Enter`, tự động kích hoạt `scrollIntoView` mượt mà cho ứng viên đang chọn.
* **Các file tác động:**
  * `g:\My Drive\AI project\ATS\ats-web\src\components\SearchableCandidateDropdown.js`
* **Quy trình Rollback (nếu cần):** Khôi phục từ `.backups/20260830_v3.0_fix_dropdown_scroll_container_and_keyboard_nav`.

---

### Snapshot `SNAP-20260830-31` (30/08/2026 22:06) - Previous Version (`v3.0-RC68`)
* **Mục tiêu:** 📜⚡ **Server-Side Infinite Scroll Pagination for SearchableCandidateDropdown**:
  1. **Tự Động Nạp Trang Kế Tiếp Khi Cuộn Chuột (Server-Side Pagination on Wheel Scroll):** Lắng nghe sự kiện `onScroll`, khi cuộn gần đáy danh sách (còn 120px) tự động gọi `searchCandidatesServer({ query, limit = 50, offset = results.length })` để nạp thêm 50 ứng viên tiếp theo vào mảng `results`.
  2. **Nút Bấm Nạp Thêm Chủ Động & Spinner Phản Hồi:** Bổ sung nút `Scroll down or click here to load next 50 candidates` ở cuối danh sách giúp người dùng có thể nhấp chuột hoặc cuộn con lăn tùy ý.
  3. **Hỗ Trợ Phím Tắt:** Nhấn mũi tên `↓` xuống gần đáy danh sách sẽ tự động kích hoạt nạp trang kế tiếp.
* **Các file tác động:**
  * `g:\My Drive\AI project\ATS\ats-web\src\components\SearchableCandidateDropdown.js`: Bổ sung `loadNextBatch`, `handleListScroll`, nút nạp thêm và spinner.
* **Quy trình Rollback (nếu cần):** Khôi phục từ `.backups/20260830_v3.0_serverside_infinite_scroll_pagination`.

---

### Snapshot `SNAP-20260830-30` (30/08/2026 22:03) - Previous Version (`v3.0-RC67`)
* **Mục tiêu:** 🛡️🐛 **Fix TypeError CANDIDATE_STAGES.map in AttachCandidateModal**:
  1. **Khắc phục lỗi runtime:** `AttachCandidateModal.js` import nhầm const object `CANDIDATE_STAGES` thay vì array `CANDIDATE_STAGES_LIST`. Đã đổi sang `CANDIDATE_STAGES_LIST.map(st => ...)`.
  2. Modal `+ ATTACH CANDIDATE` mở ra trơn tru, nạp đầy đủ danh sách Stage và tích hợp liền mạch với Server-Side Search.
* **Các file tác động:**
  * `g:\My Drive\AI project\ATS\ats-web\src\components\AttachCandidateModal.js`: Import `CANDIDATE_STAGES_LIST`.
* **Quy trình Rollback (nếu cần):** Khôi phục từ `.backups/20260830_v3.0_fix_candidate_stages_list_attach_modal`.

---

### Snapshot `SNAP-20260830-29` (30/08/2026 22:01) - Previous Version (`v3.0-RC66`)
* **Mục tiêu:** 🛡️⚡ **100% Pure Server-Side PostgreSQL Candidate Search & Zero-Memory Leak Architecture**:
  1. **Server Action `searchCandidatesServer`:** Chuyển đổi toàn bộ logic tìm kiếm ứng viên về PostgreSQL với câu lệnh `sql` có phân trang `LIMIT / OFFSET` và tìm kiếm đa trường (`full_name`, `display_number`, `all_contacts_text`, `blacklist_note`).
  2. **Cắt Giảm 99% Payload của `getCandidateProfile`:** Loại bỏ hoàn toàn mảng `switcherList` (3,377 items) khỏi phản hồi API khi nạp hồ sơ ứng viên. Chuyển sang tính toán Previous/Next ID và Rank trực tiếp trên database. Dung lượng mạng giảm từ ~350KB xuống còn ~3KB.
  3. **Tái Cấu Trúc `SearchableCandidateDropdown` & `SearchableCandidateSwitcher`:** Thiết lập cơ chế Debounce 280ms trước khi gửi request tới server. Hiển thị cờ `isSearching`, đếm số lượng kết quả thực tế trên database và bảo vệ an toàn 100% dữ liệu ứng viên không bao giờ bị lộ trong RAM trình duyệt của Client.
* **Các file tác động:**
  * `g:\My Drive\AI project\ATS\ats-web\src\app\actions.js`: Viết `searchCandidatesServer`, tối ưu `getCandidateProfile`.
  * `g:\My Drive\AI project\ATS\ats-web\src\components\SearchableCandidateDropdown.js`: Tái cấu trúc thành Server-Side debounced component.
  * `g:\My Drive\AI project\ATS\ats-web\src\app\candidates\page.js`: Tích hợp Server-Side Search vào Switcher trên Header.
  * `g:\My Drive\AI project\ATS\ats-web\src\components\AttachCandidateModal.js`: Sử dụng Server-Side Search.
* **Quy trình Rollback (nếu cần):** Khôi phục từ `.backups/20260830_v3.0_pure_serverside_candidate_search`.

---

### Snapshot `SNAP-20260830-28` (30/08/2026 21:57) - Previous Version (`v3.0-RC65`)
* **Mục tiêu:** 🛡️🔒 **Filtering Strategy & Explicit User Approval Protocol Integration**:
  1. **Quy Chuẩn Bắt Buộc Về Lọc Dữ Liệu & Bảo Mật:**
     - Đặt ưu tiên tối cao cho Bảo mật (Security), Toàn vẹn dữ liệu (Data Integrity) và Độ ổn định (Stability).
     - Bắt buộc phân tích và phải có sự đồng ý của User trước khi lựa chọn giữa Frontend In-Memory Filter và Backend Server-Side Query.
     - Cấm tự ý dump dữ liệu lớn về client để lọc trên RAM trình duyệt.
* **Các file tác động:**
  * `g:\My Drive\AI project\ATS\GEMINI.md`: Thêm Phần C.3.
  * `g:\My Drive\AI project\My Porfolio\blue print\GEMINI.md`: Đồng bộ.
  * `C:\Users\trith\ats-web\GEMINI.md`: Đồng bộ.
  * `ATS_3.0_UI_Modernization_Blueprint.md`: Thêm Mục 6.6 và cập nhật `v3.0-RC65`.
* **Quy trình Rollback (nếu cần):** Khôi phục từ `.backups/20260830_v3.0_filtering_strategy_and_user_consent_protocol`.

---

### Snapshot `SNAP-20260830-27` (30/08/2026 21:54) - Previous Version (`v3.0-RC64`)
* **Mục tiêu:** 🎯✨ **Action Menu "+ Attach Candidate" Sourcing Workflow & High-Capacity Scrollable Dropdown**:
  1. **Khắc Phục Lỗi Dropdown Client / Job Trong `NewCandidateModal.js`:** Chuẩn hóa các trường `id`, `client_id`, `name`, `client_name` trong `getJobs()` và `getClients()`, giải quyết triệt để lỗi `All Clients (0)` và `No matching options found`.
  2. **Tách Biệt Quy Trình Sourcing & Bổ Sung Nút `+ ATTACH CANDIDATE` Trên Action Menu (`/`):** Cho phép recruiter cào/nhập hàng loạt ứng viên vào Candidate Database mà không bắt buộc gán Job ngay. Khi cần gán ứng viên vào một Job Order, recruiter chỉ cần bấm nút `+ ATTACH CANDIDATE` trên thanh Toolbar của Action Menu để mở Modal `AttachCandidateModal` gồm 3 bước trực quan và tạo ngay dòng theo dõi trên Action Menu.
  3. **Nâng Cấp `SearchableCandidateDropdown` Xử Lý Hơn 2,000+ Kết Quả:** Triển khai cơ chế nạp tiến trình khi cuộn chuột (Mouse wheel progressive loading / dynamic batch rendering) thay thế việc cắt cứng ở 80 items. Tích hợp thanh cuộn tương phản cao, phím tắt `↑`/`↓`/`Enter` và bộ đếm kết quả thực tế cho cả Candidate Switcher trên Header và Action Modal.
* **Các file tác động:**
  * `g:\My Drive\AI project\ATS\ats-web\src\app\actions.js`: Fix `getJobs`, `getClients`, export `getCandidateSwitcherList`.
  * `g:\My Drive\AI project\ATS\ats-web\src\components\SearchableCandidateDropdown.js`: Tạo component tìm kiếm ứng viên cuộn chuột mượt mà.
  * `g:\My Drive\AI project\ATS\ats-web\src\components\AttachCandidateModal.js`: Tạo modal gán ứng viên cho Action Menu.
  * `g:\My Drive\AI project\ATS\ats-web\src\app\page.js`: Tích hợp nút `+ ATTACH CANDIDATE` và modal.
  * `g:\My Drive\AI project\ATS\ats-web\src\app\candidates\page.js`: Nâng cấp Candidate Switcher với progressive scrolling.
* **Quy trình Rollback (nếu cần):** Khôi phục từ `.backups/20260830_v3.0_attach_candidate_and_high_capacity_dropdown`.

---

### Snapshot `SNAP-20260830-26` (30/08/2026 21:40) - Previous Version (`v3.0-RC63`)
* **Mục tiêu:** 💡🏛️ **Technical Architect Advisory & Consulting Protocol Integration**:
  1. **Thiết Lập Quy Chuẩn Cố Vấn Kiến Trúc Cho Non-Tech User:**
     - Định vị vai trò: Lead Technical Architect giải thích công nghệ bằng ngôn ngữ trực quan, hình tượng, bám sát nghiệp vụ tuyển dụng.
     - Khung phân tích 5 Trụ cột bắt buộc: (1) Điểm Mạnh, (2) Điểm Yếu, (3) Giá Trị Đạt Được, (4) Cái Giá Đánh Đổi, (5) Khuyến Nghị Của Architect.
* **Các file tác động:**
  * `g:\My Drive\AI project\ATS\GEMINI.md`: Thêm Phần C.
  * `g:\My Drive\AI project\My Porfolio\blue print\GEMINI.md`: Đồng bộ.
  * `C:\Users\trith\ats-web\GEMINI.md`: Đồng bộ.
  * `ATS_3.0_UI_Modernization_Blueprint.md`: Bổ sung Mục 6.5 và cập nhật `v3.0-RC63`.
* **Quy trình Rollback (nếu cần):** Khôi phục từ `.backups/20260830_v3.0_technical_architect_advisory_protocol`.

---

### Snapshot `SNAP-20260830-25` (30/08/2026 21:38) - Previous Version (`v3.0-RC62`)
* **Mục tiêu:** 👤✨ **Candidate 360° Master Workbench & Auto Latest Candidate Load**:
  1. **Tự Động Nạp Ứng Viên Mới Nhất:** Khi truy cập Menu `Candidates` (`/candidates`), hệ thống tự động tìm và nạp ngay hồ sơ của Ứng viên mới nhất trong PostgreSQL DB mà không cần bấm chọn thủ công.
  2. **Searchable Candidate Switcher & Record Navigator:** Tích hợp bộ tìm kiếm chuyển đổi ứng viên trên Header theo Tên, ID `#`, SĐT, Email, LinkedIn; hiển thị bộ đếm `Record X of 3,377` kèm 2 nút `◀ Previous` / `Next ▶`.
  3. **Nút `+ New Candidate` & Anti-Duplicate Intake:** Mở Modal chống trùng 100%, tạo xong tự động chuyển thẳng sang hồ sơ mới.
  4. **Cụm Fast Contact Pills:** Gọi nhanh SĐT, mở Zalo, gửi Email, xem nhanh CV và nút `+ Assign to Job`.
  5. **Bố Cục 5:7 Dual Pane:** Cột trái (Thông tin cá nhân, Đánh giá, Blacklist, Contact Points Hub), Cột phải (Applications Pipeline + Timeline Accordion + Embedded CV Viewer).
  6. **Đồng Bộ URL:** Hỗ trợ query `/candidates?id=[uuid]` và chuyển hướng mượt mà từ `/candidates/[id]`.
* **Các file tác động:**
  * `g:\My Drive\AI project\ATS\ats-web\src\app\candidates\page.js`: Tái cấu trúc thành Candidate 360° Master Workbench.
  * `g:\My Drive\AI project\ATS\ats-web\src\app\candidates\[id]\page.js`: Chuyển hướng về canonical route.
  * `g:\My Drive\AI project\ATS\ats-web\src\app\actions.js`: Nâng cấp `getCandidateProfile` với fallback auto-latest và navigation metadata.
  * `docs/frontend/candidates-hub.md`: Cập nhật tài liệu kiến trúc.
  * `ATS_3.0_UI_Modernization_Blueprint.md`: Cập nhật `v3.0-RC62`.
* **Quy trình Rollback (nếu cần):** Khôi phục từ `.backups/20260830_v3.0_candidate_360_master_workbench`.

---

### Snapshot `SNAP-20260830-24` (30/08/2026 15:39) - Previous Version (`v3.0-RC61`)
* **Mục tiêu:** 📚🏛️ **Comprehensive System Architecture & Backend Documentation Guide**:
  1. **Nâng Cấp Bộ Quy Chuẩn Toàn Diện:**
     - **PHẦN A (Automation & Workspace):** Blueprint auto-update, Snapshot & Rollback, Dual Workspace Sync, User Manual Draft, 100% English UI, Proactive UI Pattern Suggestion.
     - **PHẦN B (Frontend UI Rules):** Phân tách rõ ràng Presentational / Container / Custom Hooks; Định nghĩa Interface/Props chặt chẽ, cấm dùng `any`; Tránh Magic Strings (dùng Enum/Const Objects); Bắt buộc TSDoc/JSDoc cho Component Headers và Custom Hooks; Tài liệu hóa README cho các feature lớn.
     - **PHẦN C (Backend & Database Schema Rules):** Khóa chính UUID/CUID, timestamps, Foreign Keys, Constraints, Indexes bắt buộc; Transaction Safety `sql.begin`; Data validation với Schema Parser trước khi chạm Database; JSDoc cho Server Actions (ghi rõ Roles, Request Schema, Error Codes, Side-effects); Comment Inline giải thích lý do ("Why").
  2. **Khởi Tạo Tài Liệu Backend Mẫu:**
     - `docs/backend/schema-map.md`: Sơ đồ ERD chi tiết cho toàn bộ các thực thể ATS (Clients, Jobs, Candidates, Contact Points, Activity, Activity Log) và giải thích quy tắc bảo toàn dữ liệu.
     - `docs/backend/api-contracts.md`: Chuẩn định dạng Response (Success/Error format) và danh sách hợp đồng Server Actions.
* **Các file tác động:**
  * `g:\My Drive\AI project\ATS\GEMINI.md`: Cập nhật toàn diện Phần A và B.
  * `g:\My Drive\AI project\My Porfolio\blue print\GEMINI.md`: Đồng bộ.
  * `C:\Users\trith\ats-web\GEMINI.md`: Đồng bộ.
  * `docs/backend/schema-map.md` & `docs/backend/api-contracts.md`: Khởi tạo mới.
  * `ATS_3.0_UI_Modernization_Blueprint.md`: Cập nhật `v3.0-RC61`.
* **Quy trình Rollback (nếu cần):** Khôi phục từ `.backups/20260830_v3.0_system_architecture_and_backend_docs`.

---

### Snapshot `SNAP-20260830-23` (30/08/2026 15:38) - Previous Version (`v3.0-RC60`)
* **Mục tiêu:** 📜🏛️ **Official ATS 3.0 Development & Maintenance Rules Enforcement**:
  1. **Thiết Lập Bộ Quy Chuẩn Dự Án Bắt Buộc (Mục 7, 8, 9):**
     - **Code Quality & Architecture:** Clean Code, phân tách rõ UI (Components), Business Logic (Hooks/Helpers) và Data Access (Server Actions, PostgreSQL). Đảm bảo Strict Type Safety, Null-safety toàn diện và Error Handling chặt chẽ ở mọi tầng.
     - **Code Comments Standard:** Bắt buộc chuẩn JSDoc/TSDoc cho 100% Functions, Custom Hooks, Helper Utilities và Server Actions (`@param`, `@returns`, `@throws`). Comment inline tập trung vào giải thích lý do nghiệp vụ ("Why").
     - **Documentation & Maintainability:** Duy trì tài liệu kiến trúc, luồng dữ liệu (Data Flow) và hướng dẫn tích hợp mở rộng trong Blueprint kỹ thuật.
* **Các file tác động:**
  * `g:\My Drive\AI project\ATS\GEMINI.md`: Thêm Mục 7, 8, 9.
  * `g:\My Drive\AI project\My Porfolio\blue print\GEMINI.md`: Đồng bộ Mục 7, 8, 9.
  * `g:\My Drive\AI project\My Porfolio\blue print\ATS_3.0_UI_Modernization_Blueprint.md`: Bổ sung Mục 6.4 và cập nhật `v3.0-RC60`.
  * `C:\Users\trith\ats-web\GEMINI.md`: Đồng bộ sang thư mục phát triển cục bộ.

---

### Snapshot `SNAP-20260830-22` (30/08/2026 15:34) - Previous Version (`v3.0-RC59`)
* **Mục tiêu:** 🛡️🐛 **Fix TypeError localeCompare & Null-Safety Guard in Candidate Modal**:
  1. **Khắc phục lỗi Runtime:** Sửa triệt để lỗi `Cannot read properties of undefined (reading 'localeCompare')` xảy ra khi mở Modal `+ New Candidate`.
  2. **Bảo vệ Null-Safety:**
     - Sử dụng `String(a.label || "").localeCompare(String(b.label || ""))` thay vì gọi trực tiếp `a.label.localeCompare` để tránh lỗi khi Client hoặc Job trong database có tên bị null/undefined.
     - Bổ sung kiểm tra mảng `Array.isArray()` và lọc bản ghi hợp lệ trước khi khởi tạo `clientOptions` và `filteredJobOptions`.
* **Các file tác động:**
  * `src/components/NewCandidateModal.js`: Cập nhật logic sắp xếp an toàn.
* **Quy trình Rollback (nếu cần):** Khôi phục từ `.backups/20260830_v3.0_fix_localecompare_null_safety_candidate_modal`.

---

### Snapshot `SNAP-20260830-21` (30/08/2026 15:32) - Previous Version (`v3.0-RC58`)
* **Mục tiêu:** 🎯✨ **Linked Client-First & Searchable Position Filters in New Candidate Modal**:
  1. **Đồng Bộ Pattern UI Theo Action Menu (Rule 6):**
     - Thay thế thẻ `<select>` đơn điệu cũ bằng bộ đôi **SearchableSelect Dropdowns** có ô tìm kiếm thời gian thực, huy hiệu đếm số lượng vị trí, thanh cuộn mượt mà và cờ `✓` xanh lục.
  2. **Bộ Lọc Liên Kết 2 Bước (Client First ➔ Filtered Jobs):**
     - **Bước 1 (Chọn Khách Hàng):** Dropdown tìm kiếm nhanh Client Company theo tên (Beauty Clinic, Shopee, Tech Corp...). Hiển thị số lượng Open Jobs của từng Client.
     - **Bước 2 (Chọn Vị Trí Tuyển Dụng):** Tự động lọc danh sách chỉ hiển thị các Job Order đang mở (`status !== 'Closed'`) thuộc riêng Client đã chọn ở Bước 1. Cho phép gõ tìm kiếm vị trí tuyển dụng nhanh (e.g. `Java`, `Nurse`, `Marketing`).
     - Tự động xóa vị trí tuyển dụng không hợp lệ nếu người dùng đổi sang Khách hàng khác.
* **Các file tác động:**
  * `src/components/NewCandidateModal.js`: Nâng cấp giao diện Section 3 với bộ đôi `SearchableSelect`.
  * `My Porfolio/blue print/ATS_3.0_UI_Modernization_Blueprint.md`: Cập nhật `v3.0-RC58` và Changelog.
* **Quy trình Rollback (nếu cần):** Khôi phục từ `.backups/20260830_v3.0_linked_client_job_searchable_dropdowns_candidate_modal`.

---

### Snapshot `SNAP-20260830-20` (30/08/2026 15:27) - Previous Version (`v3.0-RC57`)
* **Mục tiêu:** 👤🛡️ **Dedicated Candidate Menu & Strict Anti-Duplicate Intake System**:
  1. **Tách Biệt Routing & Navigation:**
     - Thanh điều hướng trên cùng (`NavbarTabs.js`) gồm 4 phân hệ rõ ràng: **Action Menu** (`/`), **Candidates** (`/candidates`), **Jobs & Clients** (`/jobs`), và **Search Menu** (`/search`).
     - Route `/search` tiếp quản toàn bộ bảng tìm kiếm đa thực thể 3-Tab (Candidate, Client, Job Order).
     - Route `/candidates` trở thành bàn làm việc chuyên biệt quản lý hồ sơ ứng viên (3,377+ profiles) kèm thanh tìm kiếm nhanh và nút **`+ New Candidate`**.
  2. **Hệ Thống Kiểm Soát Chống Trùng Lặp 100% (Strict Anti-Duplicate Engine):**
     - **Bắt buộc có Contact Point:** Ứng viên bắt buộc phải có ít nhất 1 thông tin liên lạc (Phone, Email, LinkedIn URL, Facebook, Zalo...).
     - **Quét Trùng Thời Gian Thực (Live Debounce Check):** Khi gõ/dán contact point vào form, hệ thống tự động chuẩn hóa chuỗi và đối soát tức thì trên toàn bộ cơ sở dữ liệu `contact_points` và `candidates`.
     - **Cảnh Báo Chỉ Đích Danh & Link Mở Hồ Sơ:** Nếu phát hiện trùng, hiển thị cảnh báo đỏ rõ ràng: *"⚠️ Conflict Detected: Already belongs to Candidate #ID - [Full Name]"* kèm nút nhấp `↗ Open Profile` mở thẳng hồ sơ ứng viên trùng đó trong tab mới.
     - **Tự Động Lưu Cache Bản Nháp (`localStorage`):** Toàn bộ dữ liệu vừa nhập vào form được lưu cache liên tục. Người dùng có thể click xem ứng viên trùng rồi quay lại (`Back`), form tự động phục hồi để sửa lại contact point mà không mất dữ liệu.
     - **Chặn Tạo Tuyệt Đối Khi Còn Trùng:** Nút **`Save Candidate`** bị vô hiệu hóa khi có bất kỳ contact point nào trùng hoặc chưa hợp lệ.
     - **Gán Thẳng Vào Job Order:** Tùy chọn gán ngay ứng viên vào Job Order đang tuyển để tự động tạo dòng theo dõi trên **Action Menu**.
* **Các file tác động:**
  * `src/app/NavbarTabs.js`: Cập nhật 4 tab điều hướng chính.
  * `src/app/search/page.js`: Tạo trang tìm kiếm đa thực thể `/search`.
  * `src/app/candidates/page.js`: Thiết kế lại trang `/candidates` thành Candidate Hub độc lập.
  * `src/components/NewCandidateModal.js`: Xây dựng Modal tạo ứng viên mới với Live Duplicate Checker & LocalStorage Cache.
  * `src/app/actions.js`: Bổ sung `checkCandidateContactDuplicate` và `createCandidateWithStrictValidation`.
* **Quy trình Rollback (nếu cần):** Khôi phục từ `.backups/20260830_v3.0_dedicated_candidate_menu_and_strict_anti_duplicate_intake`.

---

### Snapshot `SNAP-20260830-19` (30/08/2026 15:14) - Previous Version (`v3.0-RC56`)
* **Mục tiêu:** 🛡️💾 **Client Draft State Machine, Explicit Save & LocalStorage Cache**:
  1. **Dọn dẹp Database:** Xóa sạch 27 dòng dummy `New Client Company` rác do lỗi lặp click trước đó.
  2. **Cơ chế Bản Nháp (Draft Mode & LocalStorage Cache):**
     - Khi bấm `+ New Client`, hệ thống chuyển Header sang **Draft Mode** (`✨ DRAFT`) hoàn toàn phía Client-side mà **KHÔNG** ghi bất kỳ dữ liệu nào vào database.
     - Tự động lưu cache mọi thông tin đang nhập (Name, Tax ID, HQ Address) vào `localStorage` (`ats_draft_new_client`). Nếu người dùng chuyển sang trang khác (Action Menu, Candidate Profile) hoặc vô tình reload trình duyệt, bản nháp sẽ tự động khôi phục nguyên vẹn.
     - Bảng Job Orders hiển thị trạng thái hướng dẫn rõ ràng: *"New Client in Draft Mode - Fill in Company Name and click Save Client to start adding Job Orders."*
  3. **Nút Lưu Tường Minh & Hủy Nháp:**
     - **`💾 Save Client`:** Chỉ khi người dùng bấm Lưu (hoặc Enter tại ô Tên công ty) và tên công ty hợp lệ, hệ thống mới gọi `createClient` ghi vào PostgreSQL, xóa cache nháp và nạp bàn làm việc.
     - **`✕ Cancel`:** Cho phép hủy nháp, xóa cache và quay lại công ty trước đó.
* **Các file tác động:**
  * `src/app/jobs/page.js`: Xây dựng State Machine Draft Mode, localStorage cache và giao diện Save/Cancel.
  * `src/app/actions.js`: Đảm bảo `createClient` an toàn và chuẩn hóa `branches`.
  * `My Porfolio/blue print/ATS_3.0_UI_Modernization_Blueprint.md`: Cập nhật `v3.0-RC56` và Changelog.
* **Quy trình Rollback (nếu cần):** Khôi phục từ `.backups/20260830_v3.0_client_draft_mode_and_save_cache`.

---

### Snapshot `SNAP-20260830-18` (30/08/2026 15:06) - Previous Version (`v3.0-RC55`)
* **Mục tiêu:** 🆕✨ **Fix "+ New Client" Button State Transition & Direct Navigation**:
  1. **Khắc phục lỗi nút + New Client không phản hồi:** Trong mã nguồn trước, khi gọi `createClient`, hàm `handleCreateNewClient` cố gắng gọi `navigateClient(clients.length)`. Do state `clients` cập nhật bất đồng bộ, hàm `navigateClient` kiểm tra `targetIndex >= clients.length` và lập tức thoát ra mà không chuyển trang.
  2. **Điều hướng Trực tiếp & Tức thì:** Cập nhật trực tiếp `clients` với Client mới (`branches: []`), chuyển ngay `currentClientIndex` sang vị trí mới, reset sạch Job Orders / Applications / Persons để bàn làm việc sẵn sàng cho Client mới 100%.
* **Các file tác động:**
  * `src/app/jobs/page.js`: Tối ưu hàm `handleCreateNewClient` chuyển đổi state đồng bộ.
  * `src/app/actions.js`: Khởi tạo mặc định `branches: '[]'::jsonb` khi tạo Client mới.
  * `My Porfolio/blue print/ATS_3.0_UI_Modernization_Blueprint.md`: Cập nhật `v3.0-RC55` và Changelog.
* **Quy trình Rollback (nếu cần):** Khôi phục từ `.backups/20260830_v3.0_fix_create_new_client_navigation`.

---

### Snapshot `SNAP-20260830-17` (30/08/2026 15:03) - Previous Version (`v3.0-RC54`)
* **Mục tiêu:** 🔍✨ **Searchable Client Dropdown & Clean Header Navigation**:
  1. **Xóa bỏ Nút Điều hướng Cũ:** Loại bỏ cụm 4 nút điều hướng `[ ▢ ]` cũ (`ChevronsLeft`, `ChevronLeft`, `ChevronRight`, `ChevronsRight`) trên Header Row 1 để giải phóng không gian và làm sạch giao diện.
  2. **Tích hợp Searchable Client Dropdown (tương tự Action Menu):**
     - Hỗ trợ thanh tìm kiếm real-time: Tìm kiếm nhanh theo Tên công ty hoặc Mã số hiển thị `#` (ví dụ: `Smilegate`, `#2`, `All that`).
     - Tự động focus ô tìm kiếm ngay khi mở Popover.
     - Hiển thị danh sách cuộn mượt mà với badge tích xanh `✓` cho công ty đang chọn.
     - Thống kê số lượng kết quả lọc ở footer (`X of Y options`).
* **Các file tác động:**
  * `src/app/jobs/page.js`: Thêm component `SearchableClientDropdown`, xóa cụm nút điều hướng cũ, tích hợp Searchable Dropdown vào Header.
  * `My Porfolio/blue print/ATS_3.0_UI_Modernization_Blueprint.md`: Cập nhật `v3.0-RC54` và Changelog.
* **Quy trình Rollback (nếu cần):** Khôi phục từ `.backups/20260830_v3.0_searchable_client_dropdown_header`.

---

### Snapshot `SNAP-20260830-16` (30/08/2026 14:58) - Previous Version (`v3.0-RC53`)
* **Mục tiêu:** 🏢🧹 **Streamline Location Popover (Registered Addresses & Empty/Remote Support)**:
  1. **Xóa bỏ Phân mục Standard / Remote:** Loại bỏ hoàn toàn danh sách các thành phố chuẩn (`Remote`, `Overseas`, `Ho Chi Minh`, `Ha Noi`...) khỏi Popover để giao diện tinh gọn, tập trung 100% vào các địa chỉ thực tế của Khách hàng.
  2. **Hỗ trợ để trống Địa chỉ (Remote / Unspecified):** Bổ sung lựa chọn `⚪ None / Unspecified (e.g. Remote)`. Đối với các vị trí làm việc từ xa (Remote), người dùng có thể để trống ô Location (hiển thị ký hiệu `—` mỏng nhẹ) và thiết lập chế độ làm việc trong cột Working Mode (`🌐 Remote`).
* **Các file tác động:**
  * `src/app/jobs/page.js`: Tinh giản Popover chỉ gồm Client Registered Addresses + Clear/None Option + Custom Address.
  * `My Porfolio/blue print/ATS_3.0_UI_Modernization_Blueprint.md`: Cập nhật `v3.0-RC53` và Changelog.
* **Quy trình Rollback (nếu cần):** Khôi phục từ `.backups/20260830_v3.0_streamline_location_popover_registered_only`.

---

### Snapshot `SNAP-20260830-15` (30/08/2026 14:54) - Previous Version (`v3.0-RC52`)
* **Mục tiêu:** 🎯✨ **Fix Location Cell 1-Click Trigger & Overflow Clipping**:
  1. **Khắc phục lỗi Che khuất Popover do CSS:** Thuộc tính `truncate` gắn trực tiếp trên thẻ `<td>` chứa quy tắc `overflow: hidden`, khiến Popover (được định vị `absolute top-full`) bị cắt cụt và ẩn hoàn toàn bên trong ô bảng cao 24px. Đã chuyển `truncate` vào thẻ `<span>` bên trong.
  2. **Tối ưu Cơ chế Kích hoạt (Single-click / Double-click):** Bổ sung sự kiện chặn nổi bọt `e.stopPropagation()` trên `<td>` và thiết kế ô Location thành vùng tương tác với icon Chevron `▾` trực quan (tương tự cột Working Mode). Giờ đây người dùng có thể nhấp 1-click hoặc nhấp đúp để mở bung Popover lựa chọn địa chỉ.
* **Các file tác động:**
  * `src/app/jobs/page.js`: Xóa `truncate` trên `<td>`, bổ sung `e.stopPropagation()` và Chevron trigger cho cột Location.
  * `My Porfolio/blue print/ATS_3.0_UI_Modernization_Blueprint.md`: Cập nhật `v3.0-RC52` và Changelog.
* **Quy trình Rollback (nếu cần):** Khôi phục từ `.backups/20260830_v3.0_fix_location_popover_click_and_unclip`.

---

### Snapshot `SNAP-20260830-14` (30/08/2026 14:52) - Previous Version (`v3.0-RC51`)
* **Mục tiêu:** 🗺️✨ **Interactive Location Popover Dropdown (Eliminate Native Datalist Pre-filtering Bug)**:
  1. **Khắc phục triệt để lỗi Datalist ẩn Chi nhánh:** Thẻ `<datalist>` của trình duyệt (Chrome/Edge) có cơ chế tự động filter theo chuỗi ký tự đang có trong ô input (ví dụ: khi ô input đang có giá trị `53/4 Trần Khánh Dư...`, trình duyệt sẽ ẩn đi mục `Test: ABC` vì không khớp chuỗi).
  2. **Xây dựng Interactive Location Selection Popover:** Chuyển đổi sang Popover Dropdown trực quan tương tự phân hệ Working Mode:
     - Hiển thị danh mục **Client Registered Addresses** gồm: `🏢 Main Headquarters (Ho Chi Minh)` -> `53/4 Trần Khánh Dư...` và `📍 Test (Ho Chi Minh)` -> `ABC` cùng mọi chi nhánh khác của công ty.
     - Dấu tích `✓` xanh lục đánh dấu địa chỉ đang được gán cho Job.
     - Danh mục **Standard / Remote** (`Remote`, `Overseas`, `Ho Chi Minh`, `Ha Noi`...).
     - Khung nhập địa chỉ tự do **Custom Address** kèm nút Save.
  3. **Trải nghiệm 1-click mượt mà:** Người dùng double-click vào ô Location là có thể thấy toàn bộ mạng lưới chi nhánh và click chọn tức thì, không bị trình duyệt che khuất.
* **Các file tác động:**
  * `src/app/jobs/page.js`: Thay thế datalist bằng Interactive Location Popover Dropdown trên cột Location của bảng Job Orders.
  * `My Porfolio/blue print/ATS_3.0_UI_Modernization_Blueprint.md`: Cập nhật `v3.0-RC51` và Changelog.
* **Quy trình Rollback (nếu cần):** Khôi phục từ `.backups/20260830_v3.0_interactive_location_popover`.

---

### Snapshot `SNAP-20260830-13` (30/08/2026 14:48) - Previous Version (`v3.0-RC50`)
* **Mục tiêu:** 🧹✨ **Deduplicate Location Options & Clean Test Branches**:
  1. **Khắc phục lỗi Trùng lặp Gợi ý Location:** Loại bỏ thẻ Trụ sở chính (HQ) khỏi vòng lặp duyệt chi nhánh phụ (`additionalBranches`), ngăn ngừa tình trạng trình duyệt hiển thị 2 lần cùng một địa chỉ `HQ Address` khi người dùng double-click sửa cột Location trên Job Order.
  2. **Dọn dẹp Dữ liệu Test:** Reset sạch chi nhánh test `Testing` khỏi CSDL của khách hàng *All That Beauty Clinic*.
  3. **Chuẩn hóa Bộ đếm Huy hiệu Branches:** Huy hiệu `Branches (N)` trên Header Row 1 và thanh tổng quan Row 2 chỉ đếm số lượng chi nhánh phụ thực tế (loại trừ HQ) để tránh gây hiểu nhầm khi công ty chỉ có duy nhất trụ sở chính.
* **Các file tác động:**
  * `src/app/jobs/page.js`: Tinh chỉnh logic `additionalBranches`, deduplicate gợi ý `datalist` cho Job Location.
  * `My Porfolio/blue print/ATS_3.0_UI_Modernization_Blueprint.md`: Cập nhật `v3.0-RC50` và Changelog.
* **Quy trình Rollback (nếu cần):** Khôi phục từ `.backups/20260830_v3.0_deduplicate_job_location_datalist`.

---

### Snapshot `SNAP-20260830-12` (30/08/2026 14:46) - Previous Version (`v3.0-RC49`)
* **Mục tiêu:** 🏢📍 **Remove Header Location Pill & Use Full Client Address for Job Orders**:
  1. **Tinh Giản Master Client Header:** Xóa bỏ ô chọn `Location` riêng lẻ trên Row 1 của Header (vốn thừa thãi vì đã được quy hoạch vào thanh `HQ Address` và `Branches` chi tiết bên dưới).
  2. **Chuẩn hóa Cột Location trong Bảng Job Orders:** Cột Location của từng Job Order được liên kết trực tiếp với danh sách địa chỉ thực tế của Khách hàng:
     - Gợi ý chọn nhanh (datalist) gồm **Địa chỉ đầy đủ Trụ sở chính** (`🏢 HQ Address: ...`) và **Địa chỉ đầy đủ của từng Chi nhánh** (`📍 Tên chi nhánh: Địa chỉ`).
     - Hiển thị trực quan toàn bộ chuỗi địa chỉ cụ thể của nơi làm việc thay vì chỉ ghi tên viết tắt `HQ`.
     - Mỗi Job Order gắn cố định với duy nhất 1 địa chỉ làm việc (Single Location per Job). Nếu công ty tuyển dụng cho nhiều chi nhánh khác nhau, Recruiter sẽ tạo các Job Order riêng biệt tương ứng.
* **Các file tác động:**
  * `src/app/jobs/page.js`: Xóa Location select trên Row 1 Header, nâng cấp datalist Location trong bảng Job Orders để nạp full address.
  * `My Porfolio/blue print/ATS_3.0_UI_Modernization_Blueprint.md`: Cập nhật `v3.0-RC49` và Changelog.
  * `USER_MANUAL_DRAFT.md`: Cập nhật hướng dẫn gán địa chỉ làm việc cho Job Order.
* **Quy trình Rollback (nếu cần):** Khôi phục từ `.backups/20260830_v3.0_job_full_address_location`.

---

### Snapshot `SNAP-20260830-11` (30/08/2026 14:39) - Previous Version (`v3.0-RC48`)
* **Mục tiêu:** 🏢📍 **Direct Dynamic Branch Address Rows on Header & Address Restoration**:
  1. **Khôi phục Địa chỉ gốc Client:** Khôi phục chính xác 100% dữ liệu gốc cho khách hàng *All That Beauty Clinic* từ Notion về `location: "Ho Chi Minh"`, `address: "53/4 Trần Khánh Dư, Tân Định, TP HCM"`, và `branches: []`.
  2. **Hiển thị trực tiếp các dòng Địa chỉ Chi nhánh (Branch Address Rows):** Tích hợp vùng hiển thị danh sách địa chỉ chi nhánh ngay bên dưới thanh HQ Address trên Master Client Header. Khi một công ty có các chi nhánh đã đăng ký, mỗi chi nhánh hiển thị thành 1 dòng thanh thoát gồm: Tên chi nhánh, Badge Tỉnh/thành phố, Địa chỉ chi tiết, Hotline, nút Sao chép `📋` và nút Sửa nhanh `✏️`.
  3. **Tối ưu trải nghiệm (No Click Required):** Người dùng quan sát được toàn bộ mạng lưới chi nhánh và văn phòng của khách hàng tức thì mà không cần phải nhấp chuột mở Drawer.
* **Các file tác động:**
  * `src/app/jobs/page.js`: Bổ sung container render các dòng địa chỉ chi nhánh trực tiếp trên Master Client Header.
  * `My Porfolio/blue print/ATS_3.0_UI_Modernization_Blueprint.md`: Cập nhật `v3.0-RC48` và Changelog.
  * `USER_MANUAL_DRAFT.md`: Cập nhật mục 1.5.1 hướng dẫn quan sát mạng lưới chi nhánh.
* **Quy trình Rollback (nếu cần):** Khôi phục từ `.backups/20260830_v3.0_direct_branch_address_lines`.

---

### Snapshot `SNAP-20260830-10` (30/08/2026 14:33) - Previous Version (`v3.0-RC47`)
* **Mục tiêu:** 🏢✨ **Unified Branches & HQ Architecture (Tránh Trùng Lặp Thẻ HQ & Hỗ Trợ Đầy Đủ Chức Năng Quản Trị Chi Nhánh)**:
  1. **Tái cấu trúc Hiển thị Danh Sách Chi Nhánh:** Loại bỏ thẻ tĩnh hardcoded "Main Headquarters". Chuyển sang mô hình danh sách động hợp nhất (`branchesList`), trong đó mọi địa điểm (bao gồm cả Trụ sở chính HQ) đều là một thực thể chi nhánh có thể Sửa (`✏️`), Xóa (`🗑️`), hoặc Đặt làm Trụ sở chính (`Set as HQ`).
  2. **Chuẩn hóa Huy hiệu Trụ sở chính (`⭐ HQ`):** Trong toàn bộ danh sách, duy nhất 1 chi nhánh có `is_headquarter: true` được gắn huy hiệu `⭐ HQ`. Các chi nhánh khác hiển thị nút chuyển đổi `Set as HQ`.
  3. **Đồng bộ Dữ liệu 2 chiều Tức thì:** Khi người dùng bấm `Set as HQ` trên bất kỳ chi nhánh nào:
     - Chi nhánh đó nhận cờ `is_headquarter = true` (gắn huy hiệu `⭐ HQ`).
     - Trụ sở chính cũ tự động chuyển thành chi nhánh thường (`is_headquarter = false`).
     - Cột `location` và `address` của Client trên thanh thông tin đầu trang và trong CSDL được cập nhật đồng bộ ngay lập tức.
  4. **Tối ưu Server Actions với `sql.json()`:** Sử dụng hàm chuyển đổi native JSONB của thư viện `postgres-js` đảm bảo dữ liệu `branches` luôn là JSON array hợp lệ, tránh lỗi parse kiểu scalar string.
* **Các file tác động:**
  * `src/app/actions.js`: Nâng cấp 4 Server Actions `addClientBranch`, `updateClientBranch`, `deleteClientBranch`, `setHeadquarterBranch` với `sql.json()`.
  * `src/app/jobs/page.js`: Hợp nhất Grid render các thẻ chi nhánh và xử lý logic xóa/đổi HQ mượt mà.
  * `My Porfolio/blue print/ATS_3.0_UI_Modernization_Blueprint.md`: Cập nhật `v3.0-RC47` và Changelog.
  * `USER_MANUAL_DRAFT.md`: Bổ sung hướng dẫn quản lý Trụ sở chính và Chi nhánh.
* **Quy trình Rollback (nếu cần):** Khôi phục từ `.backups/20260830_v3.0_fix_branch_hq_unification`.

---

### Snapshot `SNAP-20260830-09` (30/08/2026 14:26) - Previous Version (`v3.0-RC46`)
* **Mục tiêu:** 🏢📍 **Multi-Branch Management (`clients.branches jsonb`) & On-Demand UI Linking**:
  1. **Nâng cấp CSDL PostgreSQL:** Bổ sung cột `branches jsonb DEFAULT '[]'::jsonb` cho bảng `clients`. Mỗi chi nhánh lưu trữ `id`, `branch_name`, `city`, `address`, `is_headquarter`, `phone`, `notes`.
  2. **Server Actions CRUD Chi Nhánh:** Triển khai `addClientBranch`, `updateClientBranch`, `deleteClientBranch`, `setHeadquarterBranch`. Đồng bộ tự động `clients.location` & `clients.address` khi thay đổi Trụ sở chính (HQ).
  3. **On-Demand Client Branches & Offices Drawer:** Bổ sung nút `📍 Branches (N)` trên Master Client Header (cạnh nút `👥 Contacts`). Khi mở drawer, hiển thị thẻ Trụ sở chính (`⭐ HQ`) cùng danh sách các chi nhánh/nhà máy đã đăng ký kèm chức năng Sao chép địa chỉ 1-click, Đặt làm HQ, Sửa, Xóa và Form thêm nhanh.
  4. **Liên kết thông minh với Bảng Job Orders:** Khi double-click chỉnh sửa cột Location của Job Order, hệ thống tự động cung cấp danh sách gợi ý (datalist) gồm toàn bộ Chi nhánh của Client + Các tỉnh thành phố chuẩn (`Ho Chi Minh`, `Ha Noi`, `Da Nang`, `Binh Duong`, `Dong Nai`, `Remote`, `Overseas`...).
  5. **Hotfix Lucide Icon Import:** Khắc phục lỗi `ReferenceError: User is not defined` khi mở drawer Contacts bằng cách bổ sung icon `User` vào danh sách import từ thư viện `lucide-react`.
* **Các file tác động:**
  * `src/app/actions.js`: Tích hợp `branches` vào `getClientWorkbenchData` và export 4 Server Actions quản lý chi nhánh.
  * `src/app/jobs/page.js`: Tích hợp nút `Branches (N)`, drawer quản lý chi nhánh và datalist gợi ý vị trí làm việc trên bảng Job Orders.
  * `My Porfolio/blue print/ATS_3.0_UI_Modernization_Blueprint.md`: Cập nhật `v3.0-RC46` và Changelog.
  * `USER_MANUAL_DRAFT.md`: Cập nhật mục 1.5.1 hướng dẫn sử dụng Multi-Branch Hub.
* **Quy trình Rollback (nếu cần):** Khôi phục từ `.backups/20260830_v3.0_client_multi_branches_jsonb`.

---

### Snapshot `SNAP-20260830-08` (30/08/2026 14:15) - Previous Version (`v3.0-RC45`)
* **Mục tiêu:** 🎯 **Job Row Single-Click Focus & Double-Click Inline Edit**:
  1. **Single-Click chọn Job toàn hàng:** Khi người dùng click chuột một lần vào bất kỳ ô nào trên hàng Job (bao gồm Tên Job, Location, Working Mode, ID_Order), sự kiện `handleSelectJob` được kích hoạt ngay lập tức để chọn Job (hiện mũi tên `▶`), đồng thời tự động nạp toàn bộ danh sách ứng viên (Applications & Pipeline) bên cột phải.
  2. **Double-Click để sửa Tên Job / Location:** Chuyển đổi trạng thái hiển thị của Tên Job và Location sang dạng Text tĩnh thanh thoát; Khi người dùng Double-Click vào ô, hệ thống tự động mở Input Box (`autoFocus`) cho phép gõ nội dung mới, tự động lưu khi bấm `Enter` hoặc rời chuột (`onBlur`), và hủy chỉnh sửa khi bấm `Escape`.
* **Các file tác động:**
  * `src/app/jobs/page.js`: Tích hợp các state `editingJobTitleId`, `tempJobTitle`, `editingLocationJobId`, `tempLocation` và tái cấu trúc các cell Job Title & Location.
  * `My Porfolio/blue print/ATS_3.0_UI_Modernization_Blueprint.md`: Cập nhật `v3.0-RC45` và Changelog.
* **Quy trình Rollback (nếu cần):** Khôi phục từ `.backups/20260830_v3.0_job_row_single_click_select_double_click_edit`.

---

### Snapshot `SNAP-20260830-07` (30/08/2026 14:10) - Current Version (`v3.0-RC44`)
* **Mục tiêu:** 🔗 **Fix Deep Linking & Double-Click Navigation for Clients and Jobs Database**:
  1. **Sửa lỗi Double-Click Client Name:** Tại Search Menu (Tab Client Database), double-click vào tên công ty khách hàng sẽ điều hướng chuẩn xác sang `/jobs?client_id=[id]` để mở bàn làm việc của khách hàng đó thay vì nhảy về Action Menu.
  2. **Truy vết và chọn đúng Job Order từ Job Order Database:** Tại Search Menu (Tab Job Order Database), double-click vào Job Title (`/jobs?job_id=[id]`) hoặc Client Name (`/jobs?client_id=[id]`) sẽ:
     * Tự động truy vết ngược để tìm Client sở hữu Job đó.
     * Chọn đúng công ty khách hàng trên Master Header.
     * Đánh dấu con trỏ `▶` và chọn đúng dòng Job Order trong bảng Job Orders.
     * Nạp toàn bộ danh sách đơn ứng tuyển (Applications) của Job đó vào cột bên phải.
* **Các file tác động:**
  * `src/app/actions.js`: Nâng cấp `getClientWorkbenchData` giải quyết `jobId`, `clientId`, `clientName` và tự động chọn đúng `selectedJob`.
  * `src/app/candidates/page.js`: Cập nhật route double-click cho Client Database và Job Order Database.
  * `src/app/jobs/page.js`: Đọc query parameters (`job_id`, `client_id`, `client_name`) qua `useSearchParams` và bọc component bằng `<Suspense>`.
  * `My Porfolio/blue print/ATS_3.0_UI_Modernization_Blueprint.md`: Cập nhật `v3.0-RC44` và Changelog.
* **Quy trình Rollback (nếu cần):** Khôi phục từ `.backups/20260830_v3.0_fix_deep_linking_client_job`.

---

### Snapshot `SNAP-20260830-06` (30/08/2026 14:01) - Current Version (`v3.0-RC43`)
* **Mục tiêu:** 👁️ **On-Demand Collapsible JD Link Input & Airy Clean UX**:
  1. **Tuân thủ Rule 5 (On-Demand Clean UX):** Chuyển trường nhập link JD (`jd_url`) từ khối tĩnh 2 dòng thành dạng thanh thu gọn On-Demand có nút bấm ẩn/hiện (`showJdLinkInput`).
  2. **Hiển thị tinh giản khi thu gọn:** Khi đóng, chỉ hiển thị một dòng tiêu đề mỏng nhẹ với icon file, mũi tên `▼`, nhãn trạng thái `[Link Attached]` (nếu đã có link), nút `Preview JD ↗` và nút `Edit Link`.
  3. **Mở rộng khi cần:** Bấm vào tiêu đề hoặc `Edit Link` sẽ mở bung ô nhập link và nút mở tab ngoài `↗` với hiệu ứng mượt mà. Bấm `Hide` hoặc icon `▲` sẽ thu gọn lại ngay.
* **Các file tác động:**
  * `src/app/jobs/page.js`: Thêm state `showJdLinkInput` và UI toggle JD Link.
  * `My Porfolio/blue print/ATS_3.0_UI_Modernization_Blueprint.md`: Cập nhật `v3.0-RC43` và Changelog.
  * `USER_MANUAL_DRAFT.md`: Cập nhật mục 1.5.
* **Quy trình Rollback (nếu cần):** Khôi phục từ `.backups/20260830_v3.0_ondemand_jd_link_toggle`.

---

### Snapshot `SNAP-20260830-05` (30/08/2026 13:58) - Current Version (`v3.0-RC42`)
* **Mục tiêu:** 🖥️ **Full-Width Bulletproof Flexbox Dual Pane Layout**:
  1. **Khắc phục lỗi Tailwind JIT grid collapse:** Thay thế grid CSS bằng hệ thống Flexbox chuẩn mực `flex gap-3 w-full`.
  2. **Phân bổ không gian hoàn hảo 100% chiều ngang:** Cột trái `w-[45%] min-w-[460px] max-w-[50%]` và Cột phải `flex-1 min-w-0` tự động chiếm trọn 55% diện tích còn lại đến sát mép phải màn hình.
  3. **Không còn khoảng trống thừa (dead space):** Loại bỏ hoàn toàn vùng đen trống 80% màn hình, 2 phân hệ hiển thị song song tuyệt đẹp.
* **Các file tác động:**
  * `src/app/jobs/page.js`: Cập nhật cấu trúc Flexbox toàn màn hình.
  * `My Porfolio/blue print/ATS_3.0_UI_Modernization_Blueprint.md`: Cập nhật `v3.0-RC42` và Changelog.
* **Quy trình Rollback (nếu cần):** Khôi phục từ `.backups/20260830_v3.0_job_working_mode_multiselect`.

---

### Snapshot `SNAP-20260830-04` (30/08/2026 13:56) - Current Version (`v3.0-RC41`)
* **Mục tiêu:** 📐 **Fix Side-by-Side Dual Pane Layout (5:7 Split View Lock)**:
  1. **Khắc phục lỗi rớt hàng (Vertical Stacking):** Khóa cố định tỷ lệ `col-span-5` cho cột trái (Job Orders & Notes) và `col-span-7` cho cột phải (Applications Pipeline & JD Viewer) trong grid 12 cột.
  2. **Đảm bảo luôn hiển thị song song 2 cột:** Triệt tiêu hoàn toàn hiện tượng cột bên phải bị đẩy rớt xuống bên dưới do media query `lg:`, giữ cho giao diện luôn là 2 cột song song chuẩn phong cách bàn làm việc MS Access & CRM hiện đại.
* **Các file tác động:**
  * `src/app/jobs/page.js`: Khóa cố định `col-span-5` và `col-span-7`.
  * `My Porfolio/blue print/ATS_3.0_UI_Modernization_Blueprint.md`: Cập nhật `v3.0-RC41` và Changelog.
* **Quy trình Rollback (nếu cần):** Khôi phục từ `.backups/20260830_v3.0_job_working_mode_multiselect`.

---

### Snapshot `SNAP-20260830-03` (30/08/2026 13:54) - Current Version (`v3.0-RC40`)
* **Mục tiêu:** 🏢⚡🌐 **Working Mode Multi-Select Column for Job Orders & 50-50 Layout Rebalance (`/jobs`)**:
  1. **Di trú cơ sở dữ liệu PostgreSQL:** Chuyển đổi cột `working_mode` trong bảng `jobs` sang kiểu `text[]` (Array) để hỗ trợ lưu nhiều hình thức làm việc đồng thời (ví dụ vừa On-site vừa Remote).
  2. **Thêm cột Working Mode trong Job Orders:** Chèn cột nằm giữa `Location` và `Status`.
  3. **UI Đa Chọn Thông Minh (Multi-Select Popover):** Nhấp vào ô Working Mode mở bảng chọn Checkbox 3 chế độ (`🏢 On-site`, `⚡ Hybrid`, `🌐 Remote`). Khi tích chọn, cập nhật tức thì lên giao diện và lưu tự động vào DB.
  4. **Hiển thị Badge Pill trực quan:** Hiển thị các pill màu sắc tương ứng (`On-site` đen xám, `Hybrid` tím, `Remote` xanh dương) hoặc nút `+ Mode` khi chưa gán.
  5. **Tái cân đối Layout 50:50:** Điều chỉnh tỷ lệ cột trái và cột phải thành 6:6 (`lg:col-span-6 / lg:col-span-6`), đem lại không gian thoáng rộng đồng đều cho cả 2 bảng.
* **Các file tác động:**
  * `src/app/actions.js`: Cập nhật `getClientWorkbenchData`, `updateJobField`, `createJobForClient`.
  * `src/app/jobs/page.js`: Bổ sung cột Working Mode, popover multi-select, handler `handleToggleWorkingMode`, và cập nhật độ rộng grid.
  * `My Porfolio/blue print/ATS_3.0_UI_Modernization_Blueprint.md`: Cập nhật `v3.0-RC40`, DB Schema và Changelog.
  * `USER_MANUAL_DRAFT.md`: Cập nhật hướng dẫn cột Working Mode.
* **Quy trình Rollback (nếu cần):** Khôi phục từ `.backups/20260830_v3.0_job_working_mode_multiselect`.

---

### Snapshot `SNAP-20260830-02` (30/08/2026 13:46) - Current Version (`v3.0-RC39`)
* **Mục tiêu:** 🎯 **Streamline Job Status Lifecycle (Open, On Hold, Closed)**:
  1. **Xóa bỏ trạng thái `Active` thừa:** Chuẩn hóa toàn bộ vòng đời trạng thái của Job Order gồm đúng 3 trạng thái rõ ràng: **`Open`**, **`On Hold`**, **`Closed`**.
  2. **Cập nhật giao diện Jobs Workbench (`/jobs`):** Bỏ lựa chọn `Active` trong dropdown trạng thái của bảng Job Orders và chuyển trạng thái mặc định khi tạo Job mới thành `Open`.
  3. **Cập nhật Search Menu (`/candidates`):** Hiển thị và phân màu badge trực quan cho 3 trạng thái (`Open`: xanh lá, `On Hold`: vàng cam, `Closed`: xám).
  4. **Chuẩn hóa dữ liệu cơ sở dữ liệu PostgreSQL:** Cập nhật 100% bản ghi cũ trong bảng `jobs` sang chuẩn 3 trạng thái.
* **Các file tác động:**
  * `src/app/jobs/page.js`: Cập nhật dropdown chọn status và default status trong `handleAddJob`.
  * `src/app/actions.js`: Cập nhật default status trong `createJobForClient`.
  * `src/app/candidates/page.js`: Phân màu badge trạng thái Job theo 3 giá trị chuẩn.
  * `My Porfolio/blue print/ATS_3.0_UI_Modernization_Blueprint.md`: Cập nhật `v3.0-RC39` và Changelog.
* **Quy trình Rollback (nếu cần):** Khôi phục từ `.backups/20260830_v3.0_job_status_cleanup`.

---

### Snapshot `SNAP-20260830-01` (30/08/2026 13:40) - Current Version (`v3.0-RC38`)
* **Mục tiêu:** 📄 **Embedded JD Document Viewer & JD URL Management for Jobs & Clients Workbench (`/jobs`)**:
  1. **Khai thác thuộc tính `jd_url` của bảng `jobs`:** Bổ sung `jd_url` và `jd_text` vào các truy vấn `getClientWorkbenchData`, `updateJobField`, và `createJobForClient`.
  2. **Quản lý liên kết JD trong Job Orders:** Cho phép xem, nhập và cập nhật link JD (Google Drive, Google Docs, PDF URL) trực tiếp tại ô thông tin Job ở cột trái với nút mở nhanh `Preview JD ↗` và link ngoài `↗`.
  3. **Hệ thống 2 Tab chuyển đổi tại Cột Phải:**
     * **Tab 1: `Applications & Pipeline (N)`**: Quản lý danh sách ứng viên và nhật ký tương tác Action Notes Timeline như trước.
     * **Tab 2: `Embedded JD Viewer`**: Nhúng trực tiếp tài liệu JD qua iframe Google Drive / Google Docs với nút `Open Fullscreen` phóng to toàn màn hình. Khi chưa có link JD, hiển thị giao diện rỗng thanh lịch kèm ô dán link nhanh và nút `Save & View JD`.
* **Các file tác động:**
  * `src/app/actions.js`: Cập nhật `getClientWorkbenchData`, `updateJobField`, `createJobForClient`.
  * `src/app/jobs/page.js`: Bổ sung helper `getEmbeddableJdUrl`, state `activeRightTab`, thanh chuyển Tab 2 chế độ, ô nhập JD link và iframe Viewer.
  * `My Porfolio/blue print/ATS_3.0_UI_Modernization_Blueprint.md`: Cập nhật `v3.0-RC38` và Changelog.
  * `USER_MANUAL_DRAFT.md`: Cập nhật hướng dẫn tính năng nhúng JD.
* **Quy trình Rollback (nếu cần):** Khôi phục từ `.backups/20260830_v3.0_job_embedded_jd_viewer`.

---

### Snapshot `SNAP-20260829-01` (29/08/2026 19:44) - Current Version
* **Mục tiêu:**
  1. Thêm 2 Stage mới: **`Additional Interview`** (cho các vòng phỏng vấn phát sinh thêm của khách hàng) và **`Chasing Feedback`** (cho khâu liên hệ hối thúc phản hồi đánh giá ứng viên) vào nhóm *Assessment & Interview*.
  2. Bổ sung tính năng **Chỉnh sửa trực tiếp Action Notes (Inline Edit)**: Nút bút chì `✏️`, cho phép sửa Stage, ngày giờ, nội dung ghi chú trực tiếp và bấm lưu hoặc `Enter`, tự động đồng bộ lại `current_stage` trên bảng Master.
  3. Xóa bỏ hoàn toàn thanh tab phụ thừa (`Action ✕` / `Search Menu ✕`) dưới Navbar để tối ưu không gian hiển thị cho toàn bộ Dashboard.
* **Các file tác động:**
  * `src/app/actions.js`: Bổ sung server action `updateActivityLog(logId, applicationId, logData)`.
  * `src/app/page.js`: Tích hợp các Stage mới, xây dựng chế độ Inline Edit cho sub-table, loại bỏ sub-bar tab thừa.
  * `src/app/candidates/page.js`: Loại bỏ sub-bar tab thừa, tinh gọn giao diện.
  * `My Porfolio/blue print/ATS_3.0_UI_Modernization_Blueprint.md`: Cập nhật phiên bản `v3.0-RC16` và Changelog.
* **Quy trình Rollback (nếu cần):** Khôi phục từ `.backups/20260829_v3.0_stages_editlog_cleanui`.

---

### Snapshot `SNAP-20260828-17` (28/08/2026 23:30)
* **Mục tiêu:** Xử lý các giá trị Stage/Action Type cũ không nằm trong danh sách chuẩn (ví dụ `Call`, `Reaching Out`, `Keep in touch`, `Phone Screen`,...):
  1. Tự động chuẩn hóa toàn bộ về `Contact` và hiển thị đồng nhất dưới dạng huy hiệu xanh dương **`Contact / Reach Out`**.
  2. Bổ sung bộ ánh xạ thông minh `normalizeStage` và `getStageBadgeLabel` trên giao diện và backend.
* **Các file tác động:**
  * `src/app/page.js`: Tích hợp hàm `normalizeStage`, `getStageBadgeLabel`, `getStageBadgeClass` cho cả Master Table và Sub-table.
  * `src/app/actions.js`: Tích hợp chuẩn hóa `normalizeStage` khi cập nhật dữ liệu.
  * `My Porfolio/blue print/ATS_3.0_UI_Modernization_Blueprint.md`: Cập nhật Changelog.
* **Quy trình Rollback (nếu cần):** Khôi phục từ `.backups/20260828_v3.0_action_menu_default_in_progress_no_limit`.

---

### Snapshot `SNAP-20260828-16` (28/08/2026 23:27)
* **Mục tiêu:** Nâng cấp trải nghiệm Action Menu (`/`):
  1. Đặt trạng thái mặc định của bộ lọc Status là `In progress` ngay khi người dùng truy cập hoặc click Clear, giúp màn hình tập trung tức thì vào các hồ sơ đang xử lý thực tế với tốc độ tải siêu tốc (<0.1s).
  2. Bỏ hoàn toàn giới hạn 200 bản ghi cứng cũ, khi chọn `All Status` hệ thống sẽ bung toàn bộ 3,192 hồ sơ ứng tuyển trực tiếp từ database.
* **Các file tác động:**
  * `src/app/actions.js`: Nâng `limit` lên 5,000 bao phủ toàn bộ cơ sở dữ liệu.
  * `src/app/page.js`: Đặt `statusFilter` mặc định là `"In progress"` khi khởi tạo và khi bấm nút `Clear`.
  * `My Porfolio/blue print/ATS_3.0_UI_Modernization_Blueprint.md`: Cập nhật Changelog.
* **Quy trình Rollback (nếu cần):** Khôi phục từ `.backups/20260828_v3.0_action_menu_backend_search_preserved_ui`.

---

### Snapshot `SNAP-20260828-15` (28/08/2026 23:23)
* **Mục tiêu:** Xử lý dứt điểm tình trạng hiển thị thẻ HTML thô (`<div>Linkedin...</div>`) trong bảng ghi chú Action Notes: làm sạch dữ liệu trong database và tích hợp hàm lọc tự động `stripHtml` ở cả tầng Server Action và Frontend Component.
* **Các file tác động:**
  * `src/app/actions.js`: Tự động loại bỏ HTML tags khỏi `application_note` và `note` trong `getActionMenuData` và `getActivityLogs`.
  * `src/app/page.js`: Bổ sung hàm `stripHtml` và bọc dữ liệu hiển thị ghi chú.
  * `My Porfolio/blue print/ATS_3.0_UI_Modernization_Blueprint.md`: Cập nhật Changelog.
* **Quy trình Rollback (nếu cần):** Khôi phục từ `.backups/20260828_v3.0_action_menu_backend_search_preserved_ui`.

---

### Snapshot `SNAP-20260828-14` (28/08/2026 23:19)
* **Mục tiêu:** Giữ nguyên vẹn 100% thiết kế giao diện, thứ tự cột, nút bấm, popover và sub-table của Action Menu (`/`) gốc như ảnh chụp người dùng cung cấp; chỉ thay đổi cơ chế tìm kiếm & lọc bằng cách gọi trực tiếp Backend SQL `getActionMenuData` có debounce 250ms trên PostgreSQL Index.
* **Các file tác động:**
  * `src/app/actions.js`: Cập nhật `getActionMenuData` nhận `searchTerm`, `status`, `client`, `jobId`, `isPassive` và truy vấn trực tiếp SQL với `LIMIT 200`.
  * `src/app/page.js`: Giữ nguyên 100% JSX/CSS của bản gốc; thay thế effect lọc client-side bằng debounced backend query.
  * `My Porfolio/blue print/ATS_3.0_UI_Modernization_Blueprint.md`: Cập nhật Changelog.
* **Quy trình Rollback (nếu cần):** Khôi phục từ `.backups/20260828_v3.0_combobox_cascading`.

---

### Snapshot `SNAP-20260828-13` (28/08/2026 23:15)
* **Mục tiêu:** Thực hiện Rollback 1 bước cho trang Action Menu (`/`) về chính xác nguyên bản ban đầu (giữ nguyên layout, thứ tự cột `STATUS`, `SOURCING`, `PLANNING DATE`, `ID CANDIDATE`, `FULL NAME`, `ORDER NAME`, `CLIENT`, `ID ORDER`, `CANDIDATE SOURCE`, `STAGE`, icon Excel xanh lá và cơ chế lọc client-side). Trong khi đó, Master Search Menu (`/candidates`) vẫn giữ nguyên kiến trúc Server-side Search & Pagination siêu tốc.
* **Các file tác động:**
  * `src/app/page.js`: Khôi phục 100% nguyên bản từ backup `20260828_v3.0_combobox_cascading/page.js`.
  * `src/app/actions.js`: Khôi phục `getActionMenuData` về định dạng dữ liệu ban đầu.
* **Quy trình Rollback (nếu cần):** Đã hoàn tất rollback thành công.

---

### Snapshot `SNAP-20260828-11` (28/08/2026 23:02)
* **Mục tiêu:** Chuyển đổi toàn diện Search Menu sang kiến trúc Server-side Search & Pagination chuẩn Enterprise; tạo extension `pg_trgm` và GIN Trigram Indexes trên Neon PostgreSQL; tích hợp thanh phân trang thông minh `Page X of Y` và cơ chế debounce 280ms cho ô tìm kiếm.
* **Các file tác động:**
  * `src/app/actions.js`: Viết lại `getCandidateSearchData`, `getClientSearchData`, `getJobSearchData` hỗ trợ phân trang & tìm kiếm SQL index.
  * `src/app/candidates/page.js`: Chuyển sang Server-side reactive search, thanh phân trang `Page X of Y`, và tổng số bản ghi thời gian thực.
  * Neon PostgreSQL: Kích hoạt `pg_trgm`, tạo GIN Trigram Indexes trên `candidates(full_name)`, `candidates(all_contacts_text)`, `clients(name)`, `jobs(job_title)`.
  * `My Porfolio/blue print/ATS_3.0_UI_Modernization_Blueprint.md`: Cập nhật đặc tả và Changelog.
* **Quy trình Rollback (nếu cần):** Khôi phục các file từ `.backups/20260828_v3.0_preaggregated_contacts`.

---

### Snapshot `SNAP-20260828-10` (28/08/2026 22:55)
* **Mục tiêu:** Khắc phục triệt để tình trạng xoay vòng loading do Neon Pooler bị nghẽn khi đọc 15,317 bản ghi thô; chuyển sang lưu trữ cấu trúc mảng contact (`phones`, `emails`, `socials`, `all_contacts_text`) trực tiếp trên bảng `candidates` và rút gọn `getCandidateSearchData` thành 1 câu query duy nhất.
* **Các file tác động:**
  * `src/app/actions.js`: Đơn giản hóa `getCandidateSearchData` thành Single Query.
  * Neon DB: Bổ sung các cột `phones`, `emails`, `socials`, `all_contacts_text` trên bảng `candidates`.
  * `My Porfolio/blue print/ATS_3.0_UI_Modernization_Blueprint.md`: Cập nhật đặc tả và Changelog.
* **Quy trình Rollback (nếu cần):** Khôi phục các file từ `.backups/20260828_v3.0_instant_cache_virtual_scroll`.

---

### Snapshot `SNAP-20260828-09` (28/08/2026 22:51)
* **Mục tiêu:** Tăng tốc độ chuyển trang và tìm kiếm lên mức tức thì 0.00 giây (Instant 0s RAM Cache) khi chuyển đổi giữa các menu; áp dụng Progressive Windowing nạp phân đoạn mượt mà 60 FPS khi cuộn bảng 3,377 ứng viên; thêm nút Reload dữ liệu đám mây.
* **Các file tác động:**
  * `src/app/candidates/page.js`: Tích hợp `globalSearchCache`, `handleTableScroll`, `displayedCandidates`, và nút Reload.
  * `My Porfolio/blue print/ATS_3.0_UI_Modernization_Blueprint.md`: Cập nhật đặc tả và Changelog.
* **Quy trình Rollback (nếu cần):** Khôi phục các file từ `.backups/20260828_v3.0_blacklist_highlighting`.

---

### Snapshot `SNAP-20260828-08` (28/08/2026 22:39)
* **Mục tiêu:** Nhận diện trường `blocked` và `blacklist_note` trong database để tự động bôi đỏ toàn bộ dòng, đổi màu nút tên sang đỏ kèm huy hiệu `🚫 BLACKLIST`, hiển thị lý do blacklist khi hover và cảnh báo trên thanh footer.
* **Các file tác động:**
  * `src/app/actions.js`: Bổ sung `blocked`, `blacklist_note` vào query `getCandidateSearchData`.
  * `src/app/candidates/page.js`: Style hàng, nút tên, icon cảnh báo, và footer summary.
  * `My Porfolio/blue print/ATS_3.0_UI_Modernization_Blueprint.md`: Cập nhật đặc tả và Changelog.
* **Quy trình Rollback (nếu cần):** Khôi phục các file từ `.backups/20260828_v3.0_dropped_experience_history`.

---

### Snapshot `SNAP-20260828-07` (28/08/2026 22:35)
* **Mục tiêu:** Xóa triệt để bảng `experience_history` (chứa 957 dòng lịch sử kinh nghiệm cũ) khỏi Neon PostgreSQL theo yêu cầu người dùng sau khi đã sao lưu bản backup dạng JSON.
* **Các file tác động:**
  * `.backups/20260828_v3.0_dropped_experience_history/experience_history_backup.json`: File sao lưu 957 dòng.
  * `My Porfolio/blue print/ATS_3.0_UI_Modernization_Blueprint.md`: Cập nhật schema và Changelog.
* **Thay đổi Database:**
  * `DROP TABLE IF EXISTS experience_history CASCADE;`
* **Quy trình Rollback (nếu cần):** Tái tạo bảng `experience_history` và nạp lại 957 dòng từ file `experience_history_backup.json`.

---

### Snapshot `SNAP-20260828-06` (28/08/2026 22:33)
* **Mục tiêu:** Xóa bỏ hoàn toàn 2 cột `Current Job Title` và `Current Company` khỏi giao diện Search Menu và loại bỏ subquery `experience_history` khỏi hàm `getCandidateSearchData` để bảng gọn gàng, tăng tối đa không gian cho Smart Contact Hub.
* **Các file tác động:**
  * `src/app/actions.js`: Loại bỏ subquery `experience_history` khỏi `getCandidateSearchData`.
  * `src/app/candidates/page.js`: Xóa bỏ 2 cột khỏi bảng và bộ lọc tìm kiếm.
  * `My Porfolio/blue print/ATS_3.0_UI_Modernization_Blueprint.md`: Cập nhật đặc tả và Changelog.
* **Quy trình Rollback (nếu cần):** Khôi phục các file từ `.backups/20260828_v3.0_smart_contact_hub`.

---

### Snapshot `SNAP-20260828-05` (28/08/2026 22:25)
* **Mục tiêu:** Nâng cấp cấu trúc bảng danh bạ ứng viên sang mô hình **Smart Grouped Contact Hub** (gom thành 3 nhóm cột thông minh: Phones, Emails, Social & Web Profiles), giải quyết triệt để vấn đề 1 ứng viên có vô hạn số điện thoại/email/link mạng xã hội; tối ưu hóa truy vấn song song tốc độ cao 76ms.
* **Các file tác động:**
  * `src/app/actions.js`: Tối ưu `getCandidateSearchData` với parallel SQL và in-memory contact aggregation.
  * `src/app/candidates/page.js`: Xây dựng giao diện Smart Contact Hub, badges `+N`, popovers sao chép, social pills.
  * `My Porfolio/blue print/ATS_3.0_UI_Modernization_Blueprint.md`: Cập nhật đặc tả tính năng và Changelog.
* **Quy trình Rollback (nếu cần):** Khôi phục các file từ `.backups/20260828_v3.0_search_menu`.

---

### Snapshot `SNAP-20260828-04` (28/08/2026 22:10)
* **Mục tiêu:** Xây dựng màn hình Search Menu đa cơ sở dữ liệu (`/candidates`) hỗ trợ tìm kiếm tức thời trên 3 tab (Candidate Database, Client Database, Job Order Database), tích hợp điều hướng Double-click và tương tác sao chép SĐT/Email/Mạng xã hội.
* **Các file tác động:**
  * `src/app/actions.js`: Thêm `getCandidateSearchData`, `getClientSearchData`, `getJobSearchData`.
  * `src/app/candidates/page.js`: Xây dựng Search Menu đa tab, Fixed Viewport, Dark Mode.
  * `src/app/NavbarTabs.js`: Tạo component điều hướng với highlight tab tự động.
  * `src/app/layout.js`: Tích hợp NavbarTabs.
  * `My Porfolio/blue print/ATS_3.0_UI_Modernization_Blueprint.md`: Cập nhật tiến độ Phase 3 và Changelog.
* **Quy trình Rollback (nếu cần):** Khôi phục các file từ `.backups/20260828_v3.0_combobox_cascading`.

---

### Snapshot `SNAP-20260828-03` (28/08/2026 21:54)
* **Mục tiêu:** Nâng cấp bộ lọc tìm kiếm Combobox không bị reset khi dừng gõ, lọc liên hoàn Job theo Client đã chọn, và khởi tạo Blueprint kỹ thuật.
* **Các file tác động:**
  * `src/app/page.js`: Tích hợp component `SearchableFilterDropdown`, bổ sung `availableJobs`, `handleClientFilterChange`.
  * `My Porfolio/blue print/ATS_3.0_UI_Modernization_Blueprint.md`: Tạo mới Blueprint chuẩn kỹ thuật.
* **Thay đổi Database:** Không thay đổi thêm.
* **Quy trình Rollback (nếu cần):** Khôi phục `page.js` từ `.backups/20260828_v3.0_planning_date_sync`.

---

### Snapshot `SNAP-20260828-02` (28/08/2026 21:42)
* **Mục tiêu:** Đồng bộ dữ liệu ngày kế hoạch từ Notion (trước là Due Date) sang Planning Date và loại bỏ cột thừa trên Neon DB.
* **Các file tác động:**
  * `src/app/actions.js`: Chuyển truy vấn sang `TO_CHAR(planning_date, 'YYYY-MM-DD')`, loại bỏ xử lý `due_date`.
  * `src/app/page.js`: Định dạng hiển thị Planning Date.
* **Thay đổi Database:**
  * `UPDATE activity SET planning_date = due_date WHERE planning_date IS NULL AND due_date IS NOT NULL;`
  * `ALTER TABLE activity DROP COLUMN due_date;`
  * Cập nhật các view `applications` và `view_activity_dashboard`.
* **Quy trình Rollback (nếu cần):** Tái tạo cột `due_date` và views tương ứng.

---

### Snapshot `SNAP-20260828-01` (28/08/2026 21:30)
* **Mục tiêu:** Chuyển đổi toàn diện giao diện sang Dark Mode hiện đại (Deep Slate / Emerald) và 100% tiếng Anh; hỗ trợ double-click điều hướng và nút xóa Action Note trực tiếp.
* **Các file tác động:**
  * `src/app/globals.css`: Cập nhật CSS variables cho Dark Theme.
  * `src/app/layout.js`: Cập nhật Dark navbar và `lang="en"`.
  * `src/app/actions.js`: Bổ sung server action `deleteActivityLog` và `getClients`.
  * `src/app/page.js`: Xây dựng layout Fixed Viewport, Smart Auto-Slide, Dark Mode UI, Double-Click router.

### Snapshot `SNAP-20260829-01` (29/08/2026 19:40) - `v3.0-RC16`
* **Mục tiêu:** Bổ sung Stage `Additional Interview` & `Chasing Feedback`, tích hợp Inline Edit `✏️` trực tiếp cho Action Notes trên Database Neon PostgreSQL, dọn dẹp thanh sub-bar thừa.
* **Các file tác động:**
  * `src/app/actions.js`: Bổ sung Server Action `updateActivityLog(logId, applicationId, logData)` và tự động đồng bộ `current_stage`.
  * `src/app/page.js`: Thêm Inline Edit form, nút `✏️` Pencil, Stage dropdowns và chuẩn hóa badge.
  * `src/app/candidates/page.js`: Gỡ bỏ sub-bar thừa.

### Snapshot `SNAP-20260829-02` (29/08/2026 19:55) - `v3.0-RC17`
* **Mục tiêu:** Nâng cấp toàn diện trang Candidate 360° Profile (`/candidates/[id]`) sang chuẩn Dark Mode Deep Slate, quản lý đa liên hệ (Add, Edit, Delete, Copy), tích hợp Iframe CV Viewer trực tiếp và Modal gán ứng viên nhanh vào Job Pipeline (`+ Assign to Job`).
* **Các file tác động:**
  * `src/app/actions.js`: Bổ sung `updateContactPoint`, `deleteContactPoint`, `assignCandidateToJob`, `syncCandidateAggregatedContacts`.
  * `src/app/candidates/[id]/page.js`: Tái cấu trúc 100% giao diện Dark Mode công thái học, chia 2 cột Split-View, Tab chuyển đổi giữa Applications Pipeline và Iframe CV Document Viewer, Contact Hub đầy đủ chức năng và Modal gán Job tự động.

### Snapshot `SNAP-20260829-03` (29/08/2026 20:06) - `v3.0-RC18`
* **Mục tiêu:** Chuyển đổi toàn diện Search Menu (`/candidates`) sang kiến trúc **Frontend In-Memory Instant Filtering & Client-side Cache**, loại bỏ hoàn toàn độ trễ mạng quốc tế (300-500ms) khi gõ tìm kiếm; tối ưu hóa truy vấn song song `Promise.all` cho Candidate 360° Profile.
* **Các file tác động:**
  * `src/app/actions.js`: Bổ sung Server Action `getAllSearchData()`, tối ưu hóa song song `Promise.all` trong `getCandidateProfile`.
  * `src/app/candidates/page.js`: Tích hợp bộ nhớ đệm RAM `globalSearchCache`, chuyển 100% logic tìm kiếm và phân trang sang `useMemo` chạy tức thì trong 0.00ms.

### Snapshot `SNAP-20260829-04` (29/08/2026 20:10) - `v3.0-RC19`
* **Mục tiêu:** Khắc phục triệt để lỗi Runtime TypeError `c.dob.split is not a function` khiến trang Candidate 360° Profile bị treo vòng xoay tải "Đang nạp hồ sơ ứng viên 360°...".
* **Các file tác động:**
  * `src/app/actions.js`: Dùng `TO_CHAR(dob, 'YYYY-MM-DD') AS dob` và format các trường date ngay tại tầng SQL PostgreSQL.
  * `src/app/candidates/[id]/page.js`: Thêm hàm tiện ích `formatDobSafe` xử lý an toàn cho cả kiểu Date object, String và null; bọc toàn bộ hàm `loadCandidate` trong khối `try...catch...finally` để luôn tắt trạng thái loading an toàn.

### Snapshot `SNAP-20260829-06` (29/08/2026 20:15) - Rollback 1 Bước về `SNAP-20260829-02` (`v3.0-RC17`)
* **Mục tiêu:** Thực hiện theo Quy tắc 2 (Rollback Protocol): Khôi phục 100% nguyên trạng file `src/app/candidates/page.js` từ snapshot `SNAP-20260829-02` (thời điểm trước khi thử nghiệm frontend filtering), đưa Search Menu trở lại cơ chế Server-side pagination 80 bản ghi/trang hoàn toàn nguyên bản.
* **Các file tác động:**
  * `src/app/candidates/page.js`: Khôi phục trực tiếp từ `.backups/20260829_v3.0_frontend_instant_filtering/candidates_page.js`.

### Snapshot `SNAP-20260829-07` (29/08/2026 20:21) - `v3.0-RC21`
* **Mục tiêu:** Khôi phục toàn diện cơ chế **Server-side Pagination (80 đơn/trang)** cho Action Menu (`/` - Dashboard chính), thay thế cơ chế bulk load `limit: 5000` trước đây. Giúp Dashboard nạp siêu tốc trong 0.2s và tích hợp bộ điều khiển phân trang đầy đủ tại Footer.
* **Các file tác động:**
  * `src/app/actions.js`: Cập nhật `getActionMenuData` truy vấn song song `COUNT(*)` và `LIMIT 80 OFFSET offset`.
  * `src/app/page.js`: Tích hợp phân trang `page`, `pageSize`, `totalApps`, `isSearching`, reset `page=1` khi lọc và hiển thị thanh điều khiển `|◀ ◀ Page X of Y ▶ ▶|` tại footer.

### Snapshot `SNAP-20260829-08` (29/08/2026 20:28) - `v3.0-RC22`
* **Mục tiêu:** Nâng cấp tab **Applications & Pipeline** tại trang Candidate 360° Profile (`/candidates/[id]`) với cơ chế Accordion mở rộng (**Expand Action Timeline & Sub-Table**). Cho phép Recruiter tương tác toàn diện trực tiếp trên hồ sơ ứng viên (Thêm/Sửa/Xóa Action Notes, sửa Status, Planning Date, Sourcing Checkbox, Source Channel) mà không cần chuyển trang.
* **Các file tác động:**
  * `src/app/candidates/[id]/page.js`: Tích hợp nút bung mở `▼ Action Timeline`, Sub-Panel chỉnh sửa Application (Status, Planning Date, Sourcing Checkbox, Source Channel), bảng Action Notes Timeline với hàng nhập liệu `*` ghim đầu và Inline Edit `✏️` / Delete `🗑️`.

### Snapshot `SNAP-20260829-09` (29/08/2026 20:32) - `v3.0-RC23`
* **Mục tiêu:** Tích hợp cơ chế an toàn **Khóa thao tác thêm mới Action Note khi Status = "Closed" (Đã đóng)** trên cả giao diện **Candidate 360° Profile** và **Action Menu (Dashboard chính)** để ngăn ngừa người dùng vô tình ghi đè / thêm thao tác vào đơn tuyển dụng đã hoàn tất hoặc đã kết thúc.
* **Các file tác động:**
  * `src/app/candidates/[id]/page.js`: Thay thế hàng nhập liệu `*` bằng thanh thông báo trạng thái khóa `🔒 Application Closed` khi `app.status === "Closed"`.
  * `src/app/page.js`: Thay thế hàng nhập liệu `*` bằng thanh thông báo trạng thái khóa `🔒 Hồ sơ ứng tuyển Closed` khi `selectedApp.status === "Closed"`.

### Snapshot `SNAP-20260829-10` (29/08/2026 20:42) - `v3.0-RC24`
* **Mục tiêu:** Rà soát và chuẩn hóa toàn diện dữ liệu **Contact Points**:
  1. Hợp nhất 140 dòng `PersonalWebsiteBlog` vào `Personal Website`, xóa bỏ hoàn toàn trường thừa `PersonalWebsiteBlog`.
  2. Rà soát và loại bỏ sạch sẽ **4,462 bản ghi trùng lặp** trong bảng `contact_points` (loại bỏ các bản ghi trùng lặp URL/SĐT/Email của cùng một ứng viên).
  3. Tự động đồng bộ lại toàn bộ các cột gom JSON và Text Array trên bảng `candidates` (`phones`, `emails`, `socials`, `all_contacts_text`).
  4. Cập nhật chuẩn hóa bộ chọn loại liên hệ và icon hiển thị trên giao diện `candidates/[id]/page.js`.
* **Các file tác động:**
  * `contact_points` (Database): Chuẩn hóa type và khử trùng lặp dữ liệu từ 15,317 xuống 10,855 dòng sạch.
  * `candidates` (Database): Cập nhật lại các trường `phones`, `emails`, `socials`, `all_contacts_text`.
  * `src/app/actions.js`: Tối ưu hàm `syncCandidateAggregatedContacts` với kiểu ép `::text[]` và `::jsonb`.
  * `src/app/candidates/[id]/page.js`: Cập nhật `renderContactIcon` và danh mục `Personal Website`, `Twitter`, `Careerbuilder`, `Vietnamwork`, `Behance`, `Dribbble`, `StackOverflow`.

### Snapshot `SNAP-20260829-11` (29/08/2026 21:02) - `v3.0-RC25`
* **Mục tiêu:** Kết nối **Supabase qua MCP Server** và hoàn tất di trú toàn bộ cơ sở dữ liệu từ **Neon PostgreSQL sang Supabase PostgreSQL (Cụm Singapore `ap-southeast-1`)**:
  1. Thiết lập cấu hình Supabase MCP trong `~/.gemini/config/mcp_config.json`.
  2. Tạo máy chủ Supabase Singapore với đầy đủ Extensions (`pg_trgm`, `uuid_generate_v7()`), ENUM Types (`application_status_type`, `job_status`, `working_mode_type`).
  3. Di trú toàn bộ 13 bảng dữ liệu (3,377 candidates, 10,855 clean contact points, 3,192 activities, 4,310 activity logs, 307 jobs, 189 clients, v.v.) và toàn bộ hệ thống Index hiệu năng cao (B-Tree + GIN Trigram).
  4. Cập nhật `DATABASE_URL` trong `.env.local` sang Supabase Transaction Connection Pooler (`aws-0-ap-southeast-1.pooler.supabase.com:6543`).
  5. Đạt kết quả tăng tốc độ nạp dữ liệu: Ping giảm từ 250ms xuống **~56ms** (⚡ **Nhanh hơn ~4.5x - 5x**).
* **Các file tác động:**
  * `~/.gemini/config/mcp_config.json`: Thêm server Supabase MCP.
  * `.env.local`: Cập nhật `DATABASE_URL` sang Supabase Pooler.
  * `src/lib/db.js`: Tự động kết nối Supabase qua connection pooler.

### Snapshot `SNAP-20260829-12` (29/08/2026 21:10) - `v3.0-RC26`
* **Mục tiêu:** Tái cấu trúc toàn diện menu **Jobs & Clients** (`/jobs`) theo thiết kế **MS Access Master-Detail 4 Tầng** chuyên nghiệp.
* **Các file tác động:**
  * `src/app/actions.js`: Bổ sung Server Actions cho phân hệ Workbench.
  * `src/app/jobs/page.js`: Khởi tạo cấu trúc MS Access Master-Detail.

### Snapshot `SNAP-20260829-13` (29/08/2026 21:16) - `v3.0-RC27`
* **Mục tiêu:** Tối ưu hóa độ đậm đặc không gian (High-Density Layout) và tích hợp phân hệ **Client Contacts (Người liên hệ công ty / HR / Hiring Manager)** vào trực tiếp Header của Client.
* **Các file tác động:**
  * `src/app/actions.js`: Bổ sung CRUD cho `client_contacts`.
  * `src/app/jobs/page.js`: Tinh chỉnh bố cục siêu gọn.

### Snapshot `SNAP-20260829-14` (29/08/2026 21:22) - `v3.0-RC28`
* **Mục tiêu:** Tái cấu trúc phân hệ **Applications & Pipeline** trong Menu Jobs & Clients theo mô hình **Thẻ Ứng Viên Kèm Nút Bật/Tắt Timeline Accordion (`⏱ Timeline ∨/∧`)** đồng bộ với thiết kế Candidate Menu:
  1. **Giải phóng hoàn toàn không gian cột phải:** Thay vì chia đôi màn hình thành 2 bảng cứng ngắc, danh sách ứng viên hiển thị dạng các thẻ sạch sẽ, thoáng đãng với đầy đủ thông tin tóm tắt (Mã ứng viên, Họ tên click mở hồ sơ 360°, Stage Badge, Status, Nguồn, Planning Date, Inbound/Passive).
  2. **Tích hợp nút `⏱ Timeline ∨` trực quan:** Khi bấm vào, thẻ mở rộng mượt mà hiển thị đầy đủ bộ trường chỉnh sửa (Status, Planning Date, Source Channel, Checkbox Passive) và bảng **Action Notes Timeline** (hàng `*` thêm nhanh với phím tắt `Enter`, danh sách các bước tương tác, nút chỉnh sửa `✏️`, xóa `🗑️`, cơ chế khóa `🔒 Closed`).
  3. **Tối ưu trải nghiệm không gian thoáng đãng:** Giúp màn hình không bị bí bách, dễ dàng theo dõi nhiều ứng viên cùng lúc trong một Job Order.
### Snapshot `SNAP-20260829-15` (29/08/2026 21:25) - `v3.0-RC29`
* **Mục tiêu:** Cập nhật quy tắc sắp xếp Client theo **Số thứ tự tăng dần (`display_number ASC NULLS LAST`)** và rà soát chuẩn hóa ID Database:
  1. **Sắp xếp Dropdown & Điều hướng Client theo thứ tự số:** Danh sách khách hàng và bộ nhảy nhanh công ty trong Menu Jobs & Clients được sắp xếp chuẩn theo `#1`, `#2`, `#3`, ..., `#189` thay vì theo alphabet lộn xộn số.
  2. **Rà soát & Xác thực chuẩn hóa Primary Key Database:** 100% 14 bảng trong Supabase đều đang sử dụng chuẩn toàn cầu **UUID / UUIDv7** (RFC 9562) làm Primary Key `id`, đảm bảo tính bảo mật và khả năng scale phân tán.
* **Các file tác động:**
  * `src/app/actions.js`: Cập nhật `getClientWorkbenchData` và `getClients` sắp xếp theo `display_number ASC NULLS LAST`.

### Snapshot `SNAP-20260829-16` (29/08/2026 21:37) - `v3.0-RC30`
* **Mục tiêu:** 🔒 **Bảo mật Cơ sở dữ liệu — Khắc phục 15 Cảnh Báo từ Supabase Security Advisor**:
  1. **Kích hoạt Row Level Security (RLS) trên toàn bộ 13 bảng:** `candidates`, `contact_points`, `activity`, `activity_log`, `clients`, `client_contacts`, `jobs`, `campaigns`, `campaign_social_groups`, `interviews`, `onboarding_history`, `reach_sourcing`, `social_group_urls`. Chặn hoàn toàn các truy cập trái phép qua PostgREST API từ role `anon` / public internet.
  2. **Di chuyển Extension sang Schema chuyên biệt:** Đưa `pg_trgm` từ schema `public` sang `extensions` theo khuyến nghị của Supabase.
  3. **Vá lỗ hổng Function Search Path:** Cố định `search_path = public, pg_temp` cho hàm sinh khóa `uuid_generate_v7()` để triệt tiêu nguy cơ SQL injection qua search_path.
  4. **Đánh giá Supabase Security Advisor:** Giải quyết 100% (13 CRITICAL + 2 WARN → 0 lỗi).
* **Các file/Database tác động:**
  * Supabase PostgreSQL Database: `ALTER TABLE ... ENABLE ROW LEVEL SECURITY`, `ALTER EXTENSION pg_trgm SET SCHEMA extensions`, `ALTER FUNCTION uuid_generate_v7() SET search_path = public, pg_temp`.

### Snapshot `SNAP-20260829-17` (29/08/2026 21:51) - `v3.0-RC31`
* **Mục tiêu:** 🔒 **Gia cố bảo mật sâu (Defense-in-Depth) & Dọn dẹp Index thừa**:
  1. **Thu hồi (REVOKE) toàn bộ quyền trên 13 bảng:** Xóa bỏ 182 quyền thừa từ role `anon` và `authenticated`.
  2. **Bảo toàn quyền nội bộ Supabase (`service_role`):** Giữ nguyên quyền cho `service_role` và `postgres`.
  3. **Xóa bỏ Duplicate Indexes legacy:** Xóa 2 index trùng lặp `idx_applications_candidate_id` và `idx_applications_job_id` trên bảng `activity`.
* **Các file/Database tác động:**
  * Supabase PostgreSQL Database: `REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon, authenticated;`, `DROP INDEX IF EXISTS idx_applications_candidate_id, idx_applications_job_id;`.

### Snapshot `SNAP-20260829-18` (29/08/2026 22:15) - `v3.0-RC32`
* **Mục tiêu:** 💼 **Hiện đại hóa Client Contacts Hub & Tối ưu bố cục phân hệ Jobs & Clients (`/jobs`)**:
  1. **Xóa bỏ trường Email và Notes của Client khỏi Database & UI:** Thực hiện `ALTER TABLE clients DROP COLUMN work_email, DROP COLUMN notes;`.
  2. **Nâng cấp toàn diện Client Contacts Hub:** Đầy đủ CRUD (Add/Edit/Delete/Copy/Direct Action).
  3. **Bỏ toàn bộ viết tắt:** Đổi `LOC` ➔ `Location`, `ADDR` ➔ `Address`, `NAME` ➔ `Client Name`, `ID` ➔ `Client ID`.
* **Các file tác động:**
  * Supabase PostgreSQL: `ALTER TABLE clients DROP COLUMN work_email, DROP COLUMN notes;`.
  * `src/app/actions.js`, `src/app/jobs/page.js`.

### Snapshot `SNAP-20260829-19` (29/08/2026 22:20) - `v3.0-RC33`
* **Mục tiêu:** 🌐 **Chuẩn Hóa 100% Tiếng Anh & Thiết Kế On-Demand Airy Clean UX (Cái gì cần mới gọi ra)**:
  1. **Bổ sung Rule 5 vào Quy tắc bắt buộc của dự án:** Yêu cầu 100% văn bản giao diện (Headings, Labels, Buttons, Badges, Placeholders, Alerts, Empty States) phải dùng tiếng Anh chuẩn doanh nghiệp; Áp dụng triết lý On-Demand Clean UX.
  2. **Tối ưu triệt để không gian màn hình Jobs & Clients (`/jobs`):** Header 1 thanh, On-Demand Contacts Drawer, thu gọn thẻ ứng viên mặc định.
* **Các file tác động:**
  * `g:\My Drive\AI project\ATS\GEMINI.md` & `g:\My Drive\AI project\My Porfolio\blue print\GEMINI.md`: Thêm Rule 5.
  * `src/app/jobs/page.js`.

### Snapshot `SNAP-20260829-20` (29/08/2026 22:23) - `v3.0-RC34`
* **Mục tiêu:** 🧹 **Ẩn Động Các Trường Đơn Ứng Tuyển Khi Trạng Thái Là "Closed" (Dynamic Clean On-Demand Fields)**:
  1. **Ẩn các trường không cần thiết khi Closed:** Ẩn `Planning Date`, `Source Channel`, và `Passive Sourcing`.
  2. **Tự động mở lại khi đổi trạng thái:** Hiển thị lại khi chuyển `In progress`.
  3. **Áp dụng đồng bộ:** Cập nhật trên cả `src/app/jobs/page.js` và `src/app/candidates/[id]/page.js`.

### Snapshot `SNAP-20260829-21` (29/08/2026 22:26) - `v3.0-RC35`
* **Mục tiêu:** 🚀 **Nút Mở Rộng Toàn Màn Hình (Expand Pipeline) & Tối Ưu Tương Tác Single-Active Focus Accordion**:
  1. **Nút bung mở toàn màn hình (Expand Pipeline / Split View):** Bổ sung nút chuyển đổi 12 cols / 7 cols trên Header Applications & Pipeline.
  2. **Cơ chế Single-Active Focus Accordion:** Tự động đóng ứng viên trước đó khi mở ứng viên mới.
  3. **Tối ưu chiều cao hiển thị linh hoạt:** Tận dụng tối đa không gian màn hình với `max-h-80`.
* **Các file tác động:**
  * `src/app/jobs/page.js`.

### Snapshot `SNAP-20260829-22` (29/08/2026 22:40) - `v3.0-RC36`
* **Mục tiêu:** 📇 **Kiến Trúc PostgreSQL Hybrid: Bảng Người Phụ Trách `client_persons` & Danh Bạ Đa Kênh `contact_points jsonb`**:
  1. **Nâng cấp Database chuẩn hóa:** Bảng `client_persons`.
  2. **Server Actions đa kênh:** CRUD functions cho `client_persons` và `contact_points jsonb`.
  3. **Giao diện Thẻ Danh Thiếp Nhân Sự (Stakeholder Business Cards UI):** Thiết kế UI Danh thiếp nhân sự trong Contacts Drawer.
* **Các file tác động:**
  * Supabase Singapore DB, `src/app/actions.js`, `src/app/jobs/page.js`.

### Snapshot `SNAP-20260829-23` (29/08/2026 22:45) - `v3.0-RC37`
* **Mục tiêu:** ✏️ **Chỉnh Sửa Trực Tiếp Từng Kênh Liên Lạc (Inline Channel Edit) & Đồng Bộ Giao Diện Danh Thiếp**:
  1. **Nút sửa trực tiếp `✏️` trên từng pill kênh liên lạc:** Mỗi kênh liên lạc (SĐT, Email, Zalo, LinkedIn, Skype...) nay đều có nút `✏️` riêng. Khi bấm vào sẽ mở form chỉnh sửa nội dung/loại kênh ngay tại chỗ với nút `Save` và `Cancel`.
  2. **Giữ nguyên hiển thị danh sách kênh khi sửa Person:** Khi bấm `✏️` sửa thông tin chung của người phụ trách (Họ tên, Chức vụ, Phòng ban), danh sách các kênh liên lạc bên dưới vẫn được giữ nguyên đầy đủ để không làm mất ngữ cảnh làm việc của người dùng.
* **Các file tác động:**
  * `src/app/jobs/page.js`: Bổ sung state `editingPointKey`, `editingPointData`, và logic render inline edit channel.





















