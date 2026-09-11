# ATS 3.0 Web Application - Phác Thảo Sổ Tay Hướng Dẫn Sử Dụng (User Manual Draft)

> **Mục đích tài liệu:** Tổng hợp và ghi chép chi tiết toàn bộ các tính năng đã hoàn thiện, hướng dẫn các bước thao tác thực tế và đánh dấu các vị trí cần chụp ảnh màn hình minh họa (với Database Dummy) sau khi dự án hoàn tất.  
> **Ngày khởi tạo:** 28/08/2026  
> **Phiên bản ghi nhận:** `v3.0-Draft`  
> **Tác giả:** Tri Tran

---

## 📑 MỤC LỤC TÍNH NĂNG ĐÃ HOÀN THIỆN

* [Phần 1: Action Menu Dashboard (Bàn Làm Việc Tác Vụ Chính)](#phần-1-action-menu-dashboard-)
* [Phần 2: Master Search Menu & Smart Contact Hub (Tra Cứu Cơ Sở Dữ Liệu)](#phần-2-master-search-menu--smart-grouped-contact-hub-candidates)
* [Phần 3: Candidate 360° Profile Detail (Hồ Sơ Toàn Diện Ứng Viên)](#phần-14-candidate-360-profile-detail-candidatesid)
* [Phần 4: Jobs & Clients Workbench (Bàn Làm Việc Khách Hàng & Vị Trí Tuyển Dụng)](#phần-15-jobs--clients-workbench-jobs)
* [Phần 5: Các Quy Ước Thao Tác Chuẩn & Phím Tắt Tiện Ích](#phần-4-các-quy-ước-thao-tác-chuẩn--phím-tắt)
* [Phần 6: Kế Hoạch Tạo Dữ Liệu Mẫu (Dummy Data) & Chụp Ảnh Minh Họa](#phần-5-kế-hoạch-nạp-dummy-database--chụp-ảnh-minh-họa)
* [Phần 7: Chiến Dịch Tự Động Đăng Bài & Nuôi Nick Facebook (Campaigns, Warming & Auto-Join Hub)](#7-chiến-dịch-tự-động-đăng-bài--nuôi-nick-facebook-campaigns-warming--auto-join-hub)

---

## PHẦN 1: ACTION MENU DASHBOARD (`/`)

### 1.1 Bố Cục Viewport Cố Định & Bảng Kép (Dual Viewport Layout)
* **Mô tả:** Màn hình làm việc chính được thiết kế không có thanh cuộn toàn trang (`h-screen overflow-hidden`), chia làm 2 phần:
  * **Bảng trên (Master Table):** Danh sách toàn bộ các hồ sơ ứng tuyển với các thông tin: ID, Full Name, Order Name, Client, Planning Date, Current Stage, Result, Reason (nếu Failed), Priority, Source Channel, Note.
  * **Bảng dưới (Detail Table):** Action Notes Timeline hiển thị lịch sử chăm sóc ứng viên theo dòng thời gian.
* *[📷 Vị trí ảnh chụp 1.1: Toàn cảnh giao diện Action Menu với bảng trên và bảng dưới]*

---

### 1.2 Cơ Chế Tự Động Thu Gọn / Trồi Lên Thông Minh Khi Cuộn Chuột (Smart Auto-Slide)
* **Cách hoạt động:**
  1. Khi bạn bắt đầu cuộn chuột duyệt danh sách hồ sơ ở bảng trên ➔ Bảng Action Notes bên dưới sẽ **tự động trượt xuống và ẩn đi** để mở rộng không gian cho bảng trên.
  2. Khi bạn **dừng cuộn chuột trong 2 giây** ➔ Bảng Action Notes sẽ **tự động trồi lên lại vị trí ban đầu**.
  3. Khi bảng dưới đang ẩn, nút nổi **`▲ Action Timeline`** ở góc dưới bên phải màn hình cho phép bạn click để mở lại bảng dưới ngay lập tức mà không cần đợi 2 giây.
* *[📷 Vị trí ảnh chụp 1.2: Trạng thái bảng dưới tự trượt xuống và nút nổi Quick Peek]*

---

### 1.3 Bộ Lọc Tìm Kiếm Combobox Thông Minh (Searchable Dropdowns)
* **Cách hoạt động:**
  * Bộ lọc **Client** và **Position (Job)** có thanh tìm kiếm `🔍 Search...` tích hợp bên trong menu thả xuống.
  * Khi gõ từ khóa, thanh tìm kiếm giữ nguyên chữ bạn vừa gõ, không bị tự động xóa sau 1-2 giây như các menu cũ.
  * Có nút `✕` tích hợp ngay trên nút filter để xóa nhanh bộ lọc về trạng thái `All`.
* *[📷 Vị trí ảnh chụp 1.3: Popover Combobox tìm kiếm Client kèm ô Search bar]*

---

### 1.4 Bộ Lọc Liên Hoàn (Cascading Dependent Filter)
* **Cách hoạt động:**
  * Khi bạn chọn một **Client** (Khách hàng) cụ thể ➔ Menu **Position** bên cạnh sẽ tự động lọc và **chỉ hiển thị các Job thuộc riêng Khách hàng đó**.
  * Nếu đổi sang Khách hàng khác mà Job đang chọn không khớp, hệ thống tự động reset vị trí về `All Positions`.
* *[📷 Vị trí ảnh chụp 1.4: Minh họa chọn Client và danh sách Job tương ứng]*

---

### 1.5 Điều Hướng Nhanh Bằng Nhấp Đúp Chuột (Double-Click Navigation)
* **Quy ước điều hướng:**
  * **Single Click (1 lần):** Chọn dòng hồ sơ, làm sáng dòng và nạp Action Notes của ứng viên tương ứng.
  * **Double Click (Nhấp đúp):**
    * Nhấp đúp vào cột **`Full Name`** ➔ Mở trang hồ sơ chi tiết **Candidate 360° Profile** (`/candidates/[id]`).
    * Nhấp đúp vào cột **`Order Name`** ➔ Mở trang chi tiết Job (`/jobs?job_id=[id]`).
    * Nhấp đúp vào cột **`Client`** ➔ Tự động áp dụng bộ lọc theo Khách hàng đó.
* *[📷 Vị trí ảnh chụp 1.5: Thao tác Double-click vào ô Full Name và Client]*

---

### 1.6 Pinned Quick Action Form & Phím Tắt Nhập Liệu
* **Cách hoạt động:**
  * Hàng nhập liệu `*` luôn ghim cố định ở đầu bảng Action Notes, không bị trôi khi danh sách nhật ký dài.
  * Hỗ trợ đầy đủ các Stage tuyển dụng nâng cao: **`Additional Interview`** (phỏng vấn phát sinh thêm), **`Chasing Feedback`** (hối thúc phản hồi đánh giá từ Client), bên cạnh các Stage tiêu chuẩn như *Received CV, Contact / Reach Out, 1st Interview, 2nd Interview, Final Interview, Offer, Onboard...*
  * **Phím tắt:**
    * Nhấn **`Shift + Enter`** trong ô Ghi chú để xuống dòng viết chi tiết.
    * Nhấn **`Enter`** để lưu nhanh bước hành động lên cơ sở dữ liệu.
* *[📷 Vị trí ảnh chụp 1.6: Hàng nhập liệu ghim đầu bảng Action Notes và phím tắt]*

---

### 1.7 Chỉnh Sửa Trực Tiếp (Inline Edit) & Xóa Action Note
* **Cách hoạt động:**
  * **Chỉnh sửa `✏️` (Pencil):** Nhấp vào icon cây bút chì ở cuối dòng để chuyển dòng đó sang chế độ chỉnh sửa trực tiếp. Recruiter có thể sửa Stage/Action Type, ngày giờ và nội dung ghi chú. Nhấn **`Enter`** hoặc nút xanh `✓` để lưu thay đổi, nhấn **`Esc`** hoặc nút `✕` để hủy.
  * **Xóa `🗑️` (Trash):** Nhấp vào icon thùng rác để xóa bỏ dòng ghi chú không cần thiết.
  * **Tự động đồng bộ Stage:** Cả hai thao tác Thêm / Sửa / Xóa đều tự động kích hoạt bộ tính toán cập nhật lại cờ **`Current Stage`** trên bảng Master ứng tuyển.
* *[📷 Vị trí ảnh chụp 1.7: Giao diện Inline Edit với ô chọn Stage, Date-picker và nút lưu/hủy]*

---

### 1.8 Thanh Phân Trang & Lọc Dữ Liệu Server-side Toàn Diện
* **Cách hoạt động:**
  * Toàn bộ các bộ lọc (**Search, Status, Channel, Client, Position**) đều được chuyển về PostgreSQL xử lý với các chỉ mục Index tối ưu, bao phủ 100% toàn bộ hơn 3,100 hồ sơ ứng tuyển.
  * Bảng hiển thị 80 hồ sơ mỗi trang kèm bộ phân trang tại Footer: `|◀ First` `◀ Prev` `Page X of Y` `Next ▶` `Last ▶|` `(Z total applications)`.
* *[📷 Vị trí ảnh chụp 1.8: Thanh điều hướng phân trang Page X of Y tại Footer của Action Menu]*

---

### 1.9 Gán Ứng Viên Có Sẵn Vào Job Order (`+ ATTACH CANDIDATE`)
* **Mô tả & Nghiệp vụ Sourcing linh hoạt:**
  * Recruiter có thể cào hoặc nhập hàng loạt CV vào **Candidate Database** mà không bắt buộc phải gán ngay vào Job.
  * Khi tìm được ứng viên phù hợp với một Job Order đang mở, nhấp nút **`+ ATTACH CANDIDATE`** trên thanh Toolbar của Action Menu.
  * **Bước 1 (Chọn Ứng Viên):** Gõ tìm kiếm tên, ID `#`, SĐT, Email hoặc LinkedIn trong danh sách hơn 3,377 ứng viên. Hỗ trợ cuộn chuột mượt mà (Mouse wheel scroll) qua hàng nghìn ứng viên không bị giới hạn.
  * **Bước 2 (Chọn Khách Hàng & Vị Trí Tuyển Dụng):** Chọn Client Company ➔ Dropdown vị trí tự động lọc chỉ hiển thị các Job Order đang mở (`Open`) thuộc riêng Client đó.
  * **Bước 3 (Thiết Lập Stage & Ghi Chú):** Chọn Stage ban đầu (`Talent Mapping`, `Received CV`, `Contact`...), Kênh tìm kiếm và nhập ghi chú ban đầu.
  * Khi bấm **`Attach & Create Action Record`**, hệ thống tự động tạo dòng ứng tuyển mới trên bảng Action Menu và làm mới danh sách tức thì!
* *[📷 Vị trí ảnh chụp 1.9: Modal + Attach Candidate To Job Order Pipeline với 3 bước trực quan]*

---

## PHẦN 2: CANDIDATE 360° MASTER WORKBENCH & ANTI-DUPLICATE SOURCING INTAKE (`/candidates`)

### 2.1 Bàn Làm Việc Hồ Sơ Ứng Viên 360° Chuyên Sâu (Master-Detail Candidate Workbench)
* **Mô tả:** Phân hệ chuyên sâu phục vụ xem, chỉnh sửa toàn diện hồ sơ ứng viên, quản lý đa kênh liên lạc, lịch sử ứng tuyển và xem CV trực tiếp:
  * **Tự Động Nạp Ứng Viên Mới Nhất:** Khi truy cập `/candidates`, hệ thống tự động tìm và hiển thị ngay hồ sơ của Ứng viên mới nhất trong hệ thống mà không cần nhấp chọn qua bảng trung gian.
  * **Bộ Chuyển Đổi Ứng Viên Nhanh (`Searchable Candidate Switcher`):** Nằm trên Master Header, cho phép gõ tìm kiếm thời gian thực theo Tên, Mã số `#`, SĐT, Email, LinkedIn; hiển thị bộ đếm `Record X of 3,377` kèm 2 nút điều hướng `◀ Previous` / `Next ▶` để lật xem từng ứng viên siêu tốc.
  * **Cụm Fast Contact Pills (Header):** Gọi nhanh SĐT (1-click copy), mở Zalo chat, gửi Email, xem nhanh CV, và nút **`+ Assign to Job`** (gán nhanh vào vị trí tuyển dụng mới).
  * **Nút `+ New Candidate`:** Mở Modal Sourcing Intake chống trùng lặp. Khi tạo xong, hệ thống tự động chuyển ngay sang hồ sơ Ứng viên mới đó.
  * **Cột Trái (42% Width):**
    * *Personal Information:* Danh xưng Prefix, Họ tên, Ngày sinh, Kênh nguồn, Địa chỉ, Link CV Google Drive, Đánh giá năng lực / Ghi chú chi tiết, Cờ Blacklist và nút **`💾 Save Profile`**.
    * *Contact Points Hub:* Danh sách toàn bộ kênh liên lạc (SĐT, Email, LinkedIn, Zalo, Facebook, Github...) kèm 1-click Copy, link trực tiếp `↗`, Sửa trực tiếp `✏️` và Xóa `🗑️`.
  * **Cột Phải (58% Width):**
    * *Tab 1 - Applications & Pipeline:* Thẻ các Job Order đã ứng tuyển, huy hiệu Stage động, cờ Inbound/Outbound, đường dẫn `Open in Action Menu ↗` và Thẻ mở rộng **`⏱ Timeline ∨/∧`** (xem lịch sử nhật ký phỏng vấn và thêm ghi chú nhanh).
    * *Tab 2 - Embedded CV Viewer:* Trình xem CV trực tiếp qua Google Drive / PDF iframe mà không cần tải file về máy.
* *[📷 Vị trí ảnh chụp 2.1: Bàn làm việc Candidate 360° Master Workbench với Searchable Switcher và Dual-Pane Layout]*

---

### 2.2 Quy Trình Tạo Ứng Viên Mới Chống Trùng Lặp 100% (Strict Anti-Duplicate Engine)
* **Cách hoạt động:**
  * **Nút Kích Hoạt `+ New Candidate`:** Nhấp để bung mở Modal On-Demand **New Candidate Sourcing Intake**.
  * **Khối 1 (Candidate Identification):** Nhập Danh xưng (Prefix), Họ và tên (Full Name - bắt buộc), Ngày sinh (Date of Birth), Địa chỉ nơi ở và Đường dẫn CV / Google Drive.
  * **Khối 2 (Contact Points & Kênh Liên Hệ - Bắt buộc tối thiểu 1 kênh):**
    * Cho phép thêm linh hoạt các kênh liên lạc: **LinkedIn URL**, **Phone Number**, **Email Address**, **Facebook**, **Zalo**, **GitHub**, **Website/Blog**...
    * **Quét Trùng Thời Gian Thực (Live Anti-Duplicate Check):** Khi bạn dán link LinkedIn hoặc gõ Email/SĐT, hệ thống tự động chuẩn hóa và đối soát trên toàn bộ database.
    * **Cảnh Báo Chỉ Đích Danh:** Nếu phát hiện trùng, form lập tức hiện thông báo đỏ: *"⚠️ Conflict Detected: Already belongs to Candidate #ID - [Full Name]"* kèm nút nhấp **`↗ Open Profile`** để mở ngay hồ sơ của ứng viên đó trong tab mới.
    * **Tự Động Lưu Cache Bản Nháp (`localStorage`):** Khi bạn nhấp sang xem hồ sơ ứng viên trùng hoặc chuyển trang, toàn bộ thông tin đang nhập được lưu lại tự động. Khi quay lại (`Back`), form tự nạp lại nguyên vẹn để bạn sửa lại contact point.
    * **Khóa Nút Lưu Khi Còn Trùng:** Nút **`Save Candidate`** chỉ sáng lên khi không còn bất kỳ contact point nào trùng và thông tin hợp lệ.
  * **Khối 3 (Gán Trực Tiếp Vào Pipeline Tuyển Dụng Qua Bộ Đôi Dropdown Tìm Kiếm Thông Minh):**
    * Tích chọn *Attach Directly to Active Job Order Pipeline*.
    * **Bước 1 (Chọn Khách Hàng):** Dùng dropdown tìm kiếm thông minh `Select Client Company (Filter)` để chọn công ty khách hàng (e.g. *All That Beauty Clinic*). Dropdown hiển thị số lượng vị trí đang tuyển của từng khách hàng.
    * **Bước 2 (Chọn Vị Trí Tuyển Dụng):** Dropdown `Target Position` tự động lọc danh sách và chỉ hiển thị các Job Order đang mở (`Open`) thuộc riêng Client đã chọn ở Bước 1, hỗ trợ gõ tìm kiếm vị trí (`Search position (e.g. Java, Nurse, Marketing)`).
    * Chọn Stage ban đầu (`Talent Mapping` / `Contact` / `Received CV`...) và Kênh tuyển dụng (`LinkedIn Headhunt` / `Direct Sourcing`...), nhập ghi chú ban đầu (Sourcing Notes).
    * Khi bấm **`Save Candidate`**, hệ thống tự động tạo Ứng viên, tạo các Contact Point, tự động điều hướng mở hồ sơ Ứng viên mới và tạo dòng theo dõi trên **Action Menu (`/`)** tức thì.
* *[📷 Vị trí ảnh chụp 2.2: Modal + New Candidate Intake với bộ đôi Searchable Dropdown Client và Position]*

---

### 2.3 Bộ Chuyển Đổi & Tìm Kiếm Ứng Viên Cuộn Chuột Không Giới Hạn (High-Capacity Scrollable Dropdown)
* **Cách hoạt động khi tìm kiếm diện rộng (như `@gmail.com` với hơn 2,000 kết quả):**
  * **Cơ chế nạp tiến trình (Progressive Infinite Scroll):** Thay vì bị cắt ngắn cứng ở 80 kết quả, danh sách tự động nạp thêm các cụm bản ghi mới khi bạn cuộn con lăn chuột xuống dưới, cho phép duyệt mượt mà qua toàn bộ hơn 2,000+ kết quả mà không làm đơ trình duyệt.
  * **Thanh cuộn tương phản cao (High-Contrast Scrollbar):** Con trỏ cuộn màu ngọc bích nổi bật giúp bạn nhận biết vị trí hiện tại trong danh sách hoặc nhấp giữ kéo chuột trực tiếp.
  * **Bộ đếm thời gian thực:** Hiển thị rõ số lượng kết quả khớp (ví dụ: `2,150 matches found • Displaying 1–120`) kèm gợi ý cuộn để tải thêm.
  * **Phím tắt điều hướng:** Dùng phím mũi tên **`↓`** / **`↑`** để di chuyển vệt sáng chọn ứng viên và nhấn **`Enter`** để nạp hồ sơ ngay lập tức.
* *[📷 Vị trí ảnh chụp 2.3: Menu tìm kiếm với thanh cuộn tương phản cao và bộ đếm kết quả]*

---

## PHẦN 3: MULTI-ENTITY GLOBAL SEARCH MENU (`/search`)

### 3.1 3 Tab Cơ Sở Dữ Liệu Tìm Kiếm Tổng Hợp (3-in-1 Search Hub)
* **Mô tả:** Phân hệ tìm kiếm tập trung đa thực thể, hỗ trợ chuyển đổi linh hoạt giữa 3 tab:
  1. 👤 **`Candidate Database`** (Hơn 3,377 ứng viên).
  2. 🏢 **`Client Database`** (Danh sách công ty khách hàng, ngành nghề, người liên hệ, số Job đang tuyển).
  3. 📋 **`Job Order Database`** (Danh sách các vị trí tuyển dụng, trạng thái, địa điểm, số lượng ứng viên).
* *[📷 Vị trí ảnh chụp 3.1: 3 Tab chuyển đổi dữ liệu trên thanh Toolbar của Search Menu]*
  * Rê chuột vào tên sẽ thấy lý do bị chặn và thanh Footer hiển thị cảnh báo chi tiết.
* *[📷 Vị trí ảnh chụp 2.3: Dòng ứng viên bị Blacklist được bôi đỏ nổi bật]*

---

### 2.4 Thanh Tìm Kiếm Đa Năng (Server-side Search)
* **Cách hoạt động:**
  * Thanh tìm kiếm hỗ trợ tìm kiếm trực tiếp trên Neon PostgreSQL theo mọi trường dữ liệu: Tên, Mã ID, bất kỳ số điện thoại nào, bất kỳ email nào, link LinkedIn/Facebook/GitHub, ghi chú Blacklist...
  * Tích hợp bộ đệm thời gian gõ phím thông minh (Debounce 280ms) giúp giảm tải kết nối và mang lại phản hồi nhanh chóng, mượt mà.
  * Có nút **`Clear`** để xóa nhanh từ khóa tìm kiếm và nút **`Reload 🔄`** để làm mới dữ liệu từ Database khi cần.
* *[📷 Vị trí ảnh chụp 2.4: Thanh Search và kết quả tìm kiếm theo thời gian thực]*

---

### 2.5 Thanh Phân Trang & Điều Hướng Bản Ghi (Server-side Pagination 80 Bản Ghi/Trang)
* **Cách hoạt động:**
  * Bảng phân bổ **80 bản ghi mỗi trang** giúp bảo vệ tuyệt đối bộ nhớ RAM của trình duyệt Chrome (chỉ tốn ~1MB), tránh tình trạng lag/đơ/crash khi cơ sở dữ liệu có hàng chục nghìn hồ sơ.
  * Thanh Footer tích hợp bộ điều hướng trang chuyên nghiệp:
    * `|◀`: Nhảy về Trang đầu tiên (First Page).
    * `◀`: Chuyển về Trang trước (Previous Page).
    * `Page X of Y`: Hiển thị số trang hiện tại và tổng số trang.
    * `▶`: Chuyển sang Trang kế tiếp (Next Page).
    * `▶|`: Nhảy đến Trang cuối cùng (Last Page).
    * `(Z total)`: Tổng số lượng bản ghi khớp trong cơ sở dữ liệu.
* *[📷 Vị trí ảnh chụp 2.5: Thanh điều hướng phân trang Page X of Y tại Footer]*

---

## PHẦN 3: HỒ SƠ ỨNG VIÊN CHUYÊN SÂU CANDIDATE 360° (`/candidates/[id]`)

### 3.1 Bố Cục 2 Cột Split-View Dark Mode Công Thái Học
* **Mô tả:** Giao diện hồ sơ chuyên sâu chuyển sang chuẩn Dark Mode cao cấp (Deep Slate `#090d16` / Emerald Glow).
  * **Cột trái (5 cols):** Thông tin cá nhân (Prefix, Họ tên, DOB, Địa chỉ, Nguồn, Link CV, Ghi chú, Cờ Blacklist) và Trung tâm quản lý Đa liên hệ (Contact Points Hub).
  * **Cột phải (7 cols):** Hệ thống chuyển đổi Tab giữa **Danh sách đơn tuyển dụng (Applications & Pipeline)** và **Trình xem CV trực tiếp (Embedded CV Viewer)**.
* *[📷 Vị trí ảnh chụp 3.1: Giao diện Candidate 360° Profile 2 cột trên Dark Mode]*

---

### 3.2 Quản Lý Đa Đầu Mối Liên Hệ (Contact Points Hub)
* **Cách hoạt động:**
  * Hỗ trợ lưu trữ và phân loại đa kênh: `Phone`, `Email`, `Zalo`, `LinkedIn`, `Facebook`, `GitHub`, `Skype`, `Personal Website`, `Twitter`, `Careerbuilder`, `Vietnamwork`, `Behance`, `Dribbble`, `StackOverflow`, `Other`.
  * **Hợp nhất & Khử trùng lặp:** Hệ thống tự động hợp nhất các dạng liên hệ website cá nhân thành `Personal Website` và loại bỏ hoàn toàn các liên kết trùng lặp.
  * **Thêm mới:** Chọn loại liên hệ, nhập giá trị và nhấn nút `+`.
  * **Chỉnh sửa `✏️` (Inline Edit):** Cho phép sửa trực tiếp loại hoặc giá trị liên hệ ngay trên dòng.
  * **Xóa `🗑️`:** Xóa liên hệ không còn hiệu lực.
  * **Sao chép nhanh `📋`:** 1-Click sao chép vào clipboard.
  * **Tự động đồng bộ:** Mọi thay đổi đều tự động đồng bộ sang bảng tổng hợp trên cơ sở dữ liệu `candidates`.
* *[📷 Vị trí ảnh chụp 3.2: Danh sách Contact Points với các nút thao tác nhanh Edit, Delete, Copy]*

---

### 3.3 Trình Xem CV Trực Tiếp Tích Hợp (Embedded CV Viewer)
* **Cách hoạt động:**
  * Khi ứng viên có link Google Drive hoặc file PDF trong hồ sơ, Recruiter chuyển sang tab **Embedded CV Viewer** để đọc trực tiếp file hồ sơ trên màn hình mà không cần chuyển tab trình duyệt.
  * Tích hợp nút phóng to mở toàn màn hình (Fullscreen / Open in new tab).
* *[📷 Vị trí ảnh chụp 3.3: Tab Embedded CV Viewer hiển thị file PDF/Google Drive trực quan]*

---

### 3.4 Gán Nhanh Ứng Viên Vào Job Order (`+ Assign to Job Pipeline`)
* **Cách hoạt động:**
  * Nút xanh nổi bật **`+ Assign to Job`** tại thanh Header cho phép đưa ứng viên vào quy trình tuyển dụng của bất kỳ Job nào:
    1. **Chọn Khách hàng (Client Company - Optional):** Hộp chọn tìm kiếm thông minh dạng gõ phím (`Searchable Combobox`), hỗ trợ tìm nhanh theo tên công ty hoặc mã `#`. Danh sách khách hàng mặc định sắp xếp theo thứ tự ngày tạo từ **mới nhất tới cũ nhất (`created_time DESC`)**.
    2. **Chọn Vị trí tuyển dụng (Job Position - Required):** Hộp chọn tìm kiếm thông minh dạng gõ phím (`Searchable Combobox`), hỗ trợ tìm kiếm nhanh theo chức danh công việc, mã Job `#` hoặc tên Khách hàng. Danh sách tự động lọc theo Khách hàng được chọn và sắp xếp từ **mới nhất tới cũ nhất (`created_time DESC`)**.
    3. **Chọn Kênh nguồn (Source Channel) & Giai đoạn khởi tạo (Initial Pipeline Stage):** Mặc định `Direct Sourcing` và `Talent Mapping`.
    4. **Nhập ghi chú đánh giá ban đầu (Initial Note / Evaluation):** Nhập nhận xét hoặc bối cảnh trao đổi ban đầu.
    5. Nhấn **`+ Assign to Job`** để hoàn tất việc đưa ứng viên vào Pipeline.
* *[📷 Vị trí ảnh chụp 3.4: Modal gán nhanh ứng viên vào Job Order với Searchable Comboboxes và sắp xếp Newest-First]*

---

### 3.5 Tương Tác Action Notes Trực Tiếp Bằng Khối Bung Mở (Accordion Action Timeline)
* **Cách hoạt động:**
  * Trong tab **Applications & Pipeline**, mỗi đơn tuyển dụng của ứng viên được trang bị nút **`▼ Action Timeline`**.
  * **Bung ra (Expand):** Nhấp vào thẻ hoặc nút `▼ Timeline` để mở ra khu vực tương tác chuyên sâu giống thiết kế MS Access / Action Menu:
    1. **Chỉnh sửa nhanh thông tin Application:** Sửa **Status** (`In progress`/`Closed`), chọn **Planning Date**, tick chọn **Passive Sourcing**, và sửa kênh **Source Channel**.
    2. **Hàng nhập liệu `*` ghim ở đầu bảng:** Chọn Stage tuyển dụng, nhập nội dung ghi chú và nhấn **`Enter`** hoặc nút **`Save Action`** để thêm nhanh bước hành động mới.
    3. **Khóa an toàn khi Closed `🔒`:** Khi Status chuyển sang **Closed**, hệ thống sẽ tự động khóa hàng nhập liệu `*` và hiển thị cảnh báo `🔒 Đơn ứng tuyển đang ở trạng thái Closed. Chức năng thêm Action Note đã bị khóa` để bảo vệ tính toàn vẹn của hồ sơ đã kết thúc.
    4. **Chỉnh sửa `✏️` & Xóa `🗑️`:** Nhấp vào biểu tượng bút chì để sửa trực tiếp bất kỳ ghi chú nào trong quá khứ hoặc biểu tượng thùng rác để xóa.
    5. **Tự động đồng bộ Stage:** Mọi thao tác đều tự động cập nhật Stage badge bên ngoài và lưu lên Neon PostgreSQL theo thời gian thực mà không cần rời khỏi trang hồ sơ ứng viên.
* *[📷 Vị trí ảnh chụp 3.5: Giao diện Accordion Action Timeline bung mở tương tác trực tiếp và thanh khóa trạng thái Closed]*

---

## PHẦN 1.5: JOBS & CLIENTS WORKBENCH (`/jobs`)

### 1.5.1 Bàn Làm Việc Jobs & Clients On-Demand & Chuẩn Giao Diện Tiếng Anh 100%
* **Mô tả:** Bàn làm việc tập trung 1 màn hình chuẩn công thái học On-Demand (`h-screen overflow-hidden`):
  * **Tầng 1 (Client Master Header, On-Demand Contacts Drawer & Multi-Branch Hub):**
    * Xem/sửa thông tin công ty khách hàng rõ ràng bằng tiếng Anh: **Client Name**, **Client ID**, **Tax ID**, **Status**, cùng thanh **HQ Address** và **Branches** bên dưới.
    * **Hộp chọn Tìm kiếm Khách hàng thông minh & Chế độ Tạo Khách Hàng An Toàn (Draft & Save Mode):** Tìm kiếm và chọn nhanh công ty theo Tên hoặc Mã số `#` (tự động focus, lọc real-time). Danh sách khách hàng và bảng vị trí tuyển dụng (Job Orders) mặc định sắp xếp ưu tiên theo ngày tạo mới nhất tới cũ nhất (`created_time DESC`), tự động nạp ngay khách hàng mới nhất khi mở trang. Khi bấm nút `+ New Client`, hệ thống chuyển sang chế độ **Draft Mode** (`✨ DRAFT`) an toàn (không ghi vào database), tự động lưu cache bản nháp vào `localStorage` chống mất dữ liệu khi chuyển trang/reload. Chỉ khi người dùng bấm nút **`💾 Save Client`** (hoặc Enter) thì công ty mới chính thức được tạo vào database (tự động đưa lên đầu danh sách), hoặc bấm **`✕ Cancel`** để hủy nháp.
    * **Nút kích hoạt `👥 Contacts (N)` On-Demand:** Nhấp để bung mở Drawer quản lý **Stakeholders & Client Contacts Hub** theo cấu trúc Danh Thiếp Nhân Sự: Mỗi người phụ trách (HR, Hiring Lead, CTO) là 1 chiếc danh thiếp độc lập chứa đầy đủ các kênh liên lạc (Phone, Email, Zalo, LinkedIn...). Hỗ trợ nút `+ Add Channel` để thêm nhiều số điện thoại/email cho cùng 1 người, gọi điện (`tel:`), gửi email (`mailto:`), mở link mạng xã hội, sửa thông tin (`✏️`), xóa (`🗑️`), và form thêm nhanh người mới bên dưới.
    * **Nút kích hoạt `📍 Branches (N)` On-Demand:** Nhấp để bung mở Drawer **Client Branches & Office Locations**: Quản lý tập trung toàn bộ danh sách các trụ sở, chi nhánh, nhà máy, kho bãi hoặc văn phòng đại diện của công ty:
      * **Mô hình Danh sách Chi nhánh Hợp nhất:** Mọi địa điểm (bao gồm cả Trụ sở chính HQ) đều là một thực thể chi nhánh độc lập có đầy đủ nút Chỉnh sửa (`✏️`), Xóa bỏ (`🗑️`), Sao chép địa chỉ (`📋`) và Đổi Trụ sở chính (`Set as HQ`).
      * **Huy hiệu Trụ sở chính (`⭐ HQ`):** Trong toàn bộ danh sách, duy nhất 1 chi nhánh được gán vai trò HQ và gắn huy hiệu `⭐ HQ`.
      * **Chuyển đổi Trụ sở chính 1-click (`Set as HQ`):** Nhấp vào nút `Set as HQ` trên bất kỳ chi nhánh nào để biến chi nhánh đó thành Trụ sở chính mới; Trụ sở chính cũ sẽ tự động trở về trạng thái chi nhánh thông thường, và thông tin `Location`, `Address` của Client trên thanh Header được tự động đồng bộ tức thì.
      * **Hiển thị trực tiếp các dòng Địa chỉ Chi nhánh (No Click Required):** Khi công ty có các chi nhánh đã đăng ký, toàn bộ địa chỉ chi nhánh sẽ tự động hiển thị thành các dòng thanh thoát ngay dưới thanh HQ Address kèm Tên chi nhánh, Badge Tỉnh/thành phố, Địa chỉ chi tiết, Hotline, nút Sao chép `📋` và nút Sửa nhanh `✏️`, giúp quan sát được mọi văn phòng công ty tức thì mà không cần mở Drawer.
      * **Form thêm nhanh chi nhánh mới:** Hàng nhập liệu ở cuối Drawer cho phép thêm nhanh chi nhánh mới với Tên, Tỉnh/thành phố, Địa chỉ, Hotline và ghi chú. Khi thêm chi nhánh đầu tiên, hệ thống tự động bảo lưu địa chỉ ban đầu của Client thành chi nhánh Trụ sở chính mặc định.
  * **Tầng 2 (Bảng Dữ Liệu Tác Vụ Chính - Không Gian Rộng Thoáng Tối Đa):**
    * **Cột Trái (Job Orders, Working Mode & JD Link Sub-Table):** Danh sách tất cả các vị trí tuyển dụng đang có của khách hàng được chọn, gồm các cột: **ID_Order**, **Job Title**, **Location**, **Working Mode** (hỗ trợ Multi-Select Popover cho phép chọn linh hoạt `🏢 On-site`, `⚡ Hybrid`, `🌐 Remote`), và **Status** (`Open`, `On Hold`, `Closed`). 
      * **Single-Click chọn Job toàn hàng:** Click chuột 1 lần vào bất kỳ ô nào trên hàng (Tên Job, Location, ID) để chọn Job (hiện mũi tên `▶`) và nạp ngay pipeline ứng viên tương ứng bên cột phải.
      * **Double-Click sửa Tên Job / Location:** Double-click vào ô Job Title để chỉnh sửa inline; Single-click hoặc Double-click vào ô **Location** để mở bung **Interactive Location Popover Dropdown** gồm **Trụ sở chính** (`🏢 Main Headquarters`), **Tất cả các Chi nhánh đã đăng ký** (`📍 Tên chi nhánh: Địa chỉ chi tiết`), lựa chọn để trống `⚪ None / Unspecified (e.g. Remote)` (khi vị trí làm việc từ xa được thiết lập qua Working Mode) và ô nhập địa chỉ tự do. Mỗi Job Order gắn với 1 địa chỉ làm việc cụ thể.
      * Con trỏ `▶` đánh dấu vị trí đang xem, hàng `*` bên dưới cho phép tạo nhanh vị trí mới. Khối bên dưới tích hợp thanh **Job Description (`JD Link`)** dạng On-Demand thu gọn (mặc định đóng gọn 1 dòng với nhãn `[Link Attached]` và nút `Edit Link` / `Preview JD ↗`; chỉ mở bung ô nhập link khi người dùng bấm vào), kèm ô ghi chú yêu cầu tuyển dụng.
    * **Cột Phải (Hệ Thống 2 Tab: Applications Pipeline & Embedded JD Viewer):**
      * **Tab 1 `Applications & Pipeline`:** Danh sách ứng viên hiển thị dạng các thẻ sạch sẽ (Mã ứng viên, Họ tên click mở hồ sơ 360°, Stage Badge, Status, Nguồn, Planning Date, Inbound/Passive). Hỗ trợ nút **`Expand Pipeline`** để phóng to phân hệ ứng viên ra toàn màn hình (12 cột) khi cần làm việc chuyên sâu và thu lại **`Split View`** khi xong. Cơ chế **Single-Active Focus Accordion** giúp tự động thu gọn ứng viên khác khi mở một ứng viên, cùng chiều cao linh hoạt `max-h-80`.
      * **Tab 2 `Embedded JD Viewer`:** Nhúng trực tiếp tài liệu mô tả công việc (Google Drive / Google Docs / PDF) qua iframe thông minh với thanh công cụ điều khiển và nút `Open Fullscreen` phóng to toàn màn hình. Khi chưa có JD, hiển thị giao diện rỗng thanh lịch kèm ô dán link nhanh và nút `Save & View JD`.
* *[📷 Vị trí ảnh chụp 1.5.1: Toàn cảnh giao diện Jobs & Clients Workbench thoáng đãng với tỷ lệ 50:50, bảng Job Orders có cột Working Mode đa chọn và Header tinh giản]*
* *[📷 Vị trí ảnh chụp 1.5.2: Thao tác bật/tắt Contacts Drawer dạng Danh Thiếp Nhân Sự và Branches Drawer quản lý đa chi nhánh]*
* *[📷 Vị trí ảnh chụp 1.5.3: Gợi ý nhanh danh sách chi nhánh khi Double-click chỉnh sửa Location trên bảng Job Orders]*
* *[📷 Vị trí ảnh chụp 1.5.4: Tab Embedded JD Viewer hiển thị trực tiếp tài liệu JD qua iframe Google Docs / Google Drive và nút Open Fullscreen]*

---

## PHẦN 4: CÁC QUY ƯỚC THAO TÁC CHUẨN & PHÍM TẮT

| Thao Tác / Phím Tắt | Vị Trí Áp Dụng | Chức Năng |
| :--- | :--- | :--- |
| **`Single Click`** | Bảng Master / Job Orders Table | Chọn dòng, hiển thị mũi tên `▶`, nạp chi tiết đơn ứng tuyển. |
| **`Double Click (Job Title / Location)`** | Bảng Job Orders (Workbench) | Mở ô nhập liệu trực tiếp (Inline Edit) để sửa tên Job hoặc Địa điểm, lưu khi Enter/Blur. |
| **`Double Click (Full Name)`** | Cột Họ Tên Ứng Viên | Mở trang hồ sơ chuyên sâu Candidate 360°. |
| **`Double Click (Order Name)`** | Cột Tên Vị Trí Tuyển Dụng | Mở trang chi tiết công việc / Job Order. |
| **`Double Click (Client Name)`** | Cột Tên Khách Hàng | Mở trực tiếp khách hàng trong Jobs & Clients Workbench. |
| **`Shift + Enter`** | Ô Ghi Chú Action Note | Xuống dòng để viết ghi chú nhiều đoạn. |
| **`Enter`** | Ô Ghi Chú Action Note | Lưu nhanh Action Note lên hệ thống (cả thêm mới và sửa). |
| **`Esc`** | Ô Ghi Chú Action Note | Hủy chế độ chỉnh sửa trực tiếp. |
| **`Click Icon ✏️ Pencil`** | Bảng Action Notes / Contact Hub | Chuyển dòng sang chế độ Inline Edit trực tiếp. |
| **`Click Icon 🗑️ Trash`** | Bảng Action Notes / Contact Hub | Xóa bản ghi và đồng bộ lại hệ thống. |
| **`Click Icon SĐT / Email`** | Cột Phones / Emails | Sao chép nhanh số điện thoại / email vào clipboard. |
| **`Click Icon Social`** | Cột Social & Web Profiles | Mở liên kết LinkedIn / Facebook / GitHub trên tab mới. |
| **`Record Navigator ◀ / ▶`** | Thanh Footer | Chuyển nhanh giữa các bản ghi kế tiếp hoặc trước đó. |

---

## PHẦN 5: CƠ SỞ DỮ LIỆU MẪU CÁCH LY (50% ISOLATED SANDBOX DUMMY DATABASE)

> **Trạng thái:** ✅ Đã hoàn tất khởi tạo và nạp thành công vào schema `sandbox` (Cách ly 100% với dữ liệu sản xuất thật).

1. **Quy mô Dữ liệu Giả lập (Sandbox Target - 50% Volume):**
   * **95 Khách hàng doanh nghiệp:** Các thương hiệu công nghệ & bán lẻ hàng đầu (*VNPAY, MoMo, Tiki, Viettel Digital, FPT Software, Grab, Shopee, Techcombank, VPBank, Pizza 4P's...*).
   * **155 Vị trí tuyển dụng (Job Orders):** Vị trí tuyển dụng phong phú (*Backend Golang, React/Next.js Lead, DevOps AWS, AI/ML PyTorch, QA Automation, Product Manager, CFO, Scrum Master...*) kèm khoảng lương, Working Mode và link JD mẫu.
   * **1,688 Ứng viên (Candidates):** Họ tên tiếng Việt & quốc tế chuẩn, Prefix (Mr/Ms), DOB thực tế, và 3% hồ sơ Blacklist mẫu để kiểm thử cờ cảnh báo.
   * **5,914 Điểm liên lạc (Contact Points):** Số điện thoại Việt Nam hợp lệ (`090x`, `091x`, `098x`), Email cá nhân/công việc, URL LinkedIn và Facebook demo.
   * **1,600 Hồ sơ ứng tuyển (Applications / Activity):** Phân bổ đều trên 15 Stages tuyển dụng chuẩn (*Received CV, Contact, 1st Interview, 2nd Interview, Offer, Onboard...*) kết hợp cùng Result/Reason rõ ràng.
   * **2,218 Dòng nhật ký hoạt động (Activity Logs):** Timeline chi tiết từng bước phỏng vấn, feedback của Hiring Manager và ghi chú trao đổi.
   * **24 Lịch phỏng vấn (Interviews)**, **18 Bản ghi Onboarding History**, **8 Campaigns**, **140 Social Group URLs**.

2. **Kịch bản Chụp ảnh & Hoàn thiện User Manual:**
   * Sử dụng giao diện Sandbox này để chụp độ nét cao các góc màn hình tương ứng với các mục đánh dấu `[📷 Vị trí ảnh chụp 1.1]` đến `[📷 Vị trí ảnh chụp 1.5.4]`.
   * Toàn bộ dữ liệu hiển thị là dữ liệu giả lập chuyên nghiệp, không làm lộ bất kỳ thông tin nhạy cảm (PII) nào của khách hàng và ứng viên thật.
   * Xuất bản tài liệu User Manual hoàn chỉnh dạng PDF / Markdown Portfolio phục vụ đào tạo và giới thiệu sản phẩm.



_Cập nhật bởi: Antigravity (Implementer) — 2026-09-01: Cập nhật tách Result/Reason khỏi Stage._

---

## 5. PHÂN HỆ QUẢN LÝ TIẾN ĐỘ & NHẬT KÝ HOẠT ĐỘNG DÙNG CHUNG (SHARED ACTIVITY LOG PANEL)

> Toàn bộ 3 phân hệ chính (**Candidates 360°**, **Action Menu Dashboard**, và **Jobs & Clients Workbench**) đều sử dụng chung một giao diện Timeline chuẩn hóa duy nhất (`<ActivityLogPanel>`), mang lại trải nghiệm nhất quán 100% trên toàn ứng dụng.

### 5.1 Cấu Trúc Mỗi Dòng Nhật Ký (Log Item)
1. **Bộ 3 Thông Tin (Stage - Result - Reason):**
   * **Stage / Action Type:** Giai đoạn tuyển dụng tương ứng (*Contact, 1st Interview, Offer, v.v.*) với màu sắc nhận diện chuẩn.
   * **Result Badge:** Huy hiệu kết quả cho từng lần tương tác: `Pass` (xanh lá) hoặc `Fail` (đỏ).
   * **Reason Badge (Chỉ khi Fail):** Hiển thị lý do không đạt (*Culture Fit, Tech-Skill, Salary, Counter Offer, Withdrawn, v.v.*) màu cam/hổ phách.
2. **Dấu Thời Gian Hoạt Động & Audit Hệ Thống:**
   * **Ngày hoạt động (`action_date`):** Ngày giờ người dùng chọn cho sự kiện đó (VD ngày phỏng vấn).
   * **Dấu thời gian tạo (`created_time`):** Hiển thị dòng phụ `tạo lúc HH:mm:ss` kèm tooltip đầy đủ ngày giờ hệ thống ghi nhận bản ghi. Dấu thời gian này là **bất biến** và không bị thay đổi khi chỉnh sửa nội dung log.
3. **Nội Dung Ghi Chú (Note):** Hiển thị chi tiết trao đổi, phản hồi của ứng viên hoặc nhận xét của Hiring Manager.

### 5.2 Thao Tác Thêm Mới, Chỉnh Sửa & Xóa
* **Thêm Mới Log (Add Log):**
  * Chọn Stage ➔ Chọn Result (`Pass` / `Fail`) ➔ Nếu chọn `Fail`, hệ thống tự động mở ô chọn Reason ➔ Nhập ghi chú ➔ Bấm **Lưu Bước (Save)**.
* **Chỉnh Sửa Log (Inline Edit):**
  * Nhấp vào biểu tượng ✏️ **Pencil** trên dòng log cần sửa ➔ Form chỉnh sửa trực tiếp 5 trường (Stage, Result, Reason, Ngày giờ, Note) sẽ mở ra ngay tại dòng đó.
  * Hệ thống hỗ trợ chuyển đổi múi giờ chuẩn xác (Timezone-Safe), đảm bảo không bị lệch giờ khi lưu.
* **Xóa Log (Delete):**
  * Nhấp vào biểu tượng 🗑️ **Trash** để xóa dòng log tương ứng.
* **Cơ Chế Tự Động Đồng Bộ (Auto-Sync Application Stage):**
  * Mọi thao tác thêm mới, chỉnh sửa, hoặc xóa log đều tự động kích hoạt cơ chế đồng bộ cấp độ Application. Hồ sơ ứng tuyển sẽ luôn phản ánh chính xác trạng thái của **bản ghi log mới nhất**.
* **Khóa Khi Hồ Sơ Đã Đóng (Closed Application):**
  * Khi đơn ứng tuyển chuyển sang trạng thái `Closed`, thanh thông báo khóa `🔒` sẽ xuất hiện, ẩn form thêm mới nhưng vẫn cho phép xem toàn bộ lịch sử tương tác trước đó.

* *[📷 Vị trí ảnh chụp 5.1: Giao diện ActivityLogPanel dùng chung với đầy đủ Stage, Result, Reason, created_time và form Inline Edit]*

_Cập nhật bởi: Antigravity (Implementer) — 2026-09-02: Bổ sung hướng dẫn chi tiết về Shared ActivityLogPanel chuẩn hóa._

---

## 6. PHÂN HỆ TỰ ĐỘNG NẠP CV BẰNG AI & GIẢI QUYẾT TRÙNG LẶP (CV PARSER & HITL DEDUPLICATION QUEUE)

### 6.1 Nạp Hàng Loạt File CV (Multi-File Batch Upload)
* **Kích hoạt:** Nhấp vào nút **`+ Parse CV (AI)`** trên thanh công cụ trang `/candidates` để mở modal tải lên file CV.
* **Bảo mật & Proxy Upload Route:** Trình duyệt tải tệp lên qua Proxy nội bộ an toàn (`/api/cv-upload-proxy`), được xác thực bằng phiên đăng nhập Google OAuth (NextAuth) và tự động chuyển tiếp tới webhook n8n VPS mà không bị chặn bởi tường lửa đám mây (Vercel Firewall).
* **Hỗ trợ đa tệp:** Cho phép kéo thả hoặc chọn cùng lúc nhiều file PDF (cả file văn bản và file PDF scan/ảnh).
* **Theo dõi tiến độ thời gian thực (Progress Notification):**
  * Ngay khi nạp batch, hệ thống tạo 1 thẻ thông báo tiến trình trong **Notification Center** (biểu tượng chuông trên Header).
  * Thông báo cập nhật liên tục tỷ lệ hoàn tất (ví dụ: `Đang xử lý batch CV: 2/5`), danh sách tên file kèm trạng thái (Hồ sơ mới / Cần duyệt / Trùng lặp) và tổng kết khi hoàn tất.
* **Cơ chế phục hồi tự động (Auto-Resume):** Nếu batch bị gián đoạn do sự cố mạng, workflow cron mỗi 15 phút sẽ tự động phát hiện các batch bị treo và tiếp tục xử lý các item còn lại cho đến khi hoàn tất.

### 6.2 Hàng Đợi Duyệt Hồ Sơ Trùng Lặp (Pending CV Imports / HITL Queue)
Khi hồ sơ tải lên có thông tin (Email, Phone, LinkedIn) khớp với dữ liệu đã có trong hệ thống, hệ thống sẽ đưa vào hàng đợi duyệt tại tab **`Pending Imports`** (`/candidates?tab=pending`).

1. **Trường hợp UPDATE (Khớp chính xác 1 ứng viên):**
   * **Bảng so sánh trường dữ liệu (Field Comparison Table):** Hiển thị trực quan dữ liệu hiện tại trong DB (`Current`) và dữ liệu mới bóc tách từ CV (`New from CV`) cho các trường: Họ tên, Ngày sinh, Địa chỉ, Ghi chú.
   * **Lựa chọn cập nhật từng trường (Checkbox Selector):** Recruiter chủ động tick chọn các trường muốn ghi đè hoặc giữ nguyên.
   * **Điểm liên lạc mới (New Contact Points):** Tự động phát hiện và hiển thị các số điện thoại/email mới chưa có trong hồ sơ cũ kèm checkbox để thêm vào.
   * **Chiến lược lưu file CV (CV Storage Action):**
     * `Append to CV History (Recommended)`: Thêm CV mới vào lịch sử `cv_urls` của ứng viên (đặt tên chuẩn `CV_{display_number}_{seq}.pdf`).
     * `Replace Primary CV`: Đặt CV mới làm CV chính và làm mới lịch sử.
     * `Ignore CV File`: Chỉ cập nhật thông tin chữ, không lưu file CV mới.
   * Nhấp **`Merge Profile`** để hợp nhất hoặc **`Reject`** để từ chối.

2. **Trường hợp CONFLICT (Khớp nhiều ứng viên khác nhau):**
   * Hiển thị danh sách tất cả các hồ sơ có khả năng trùng (thẻ ứng viên kèm ID, Tên, chức danh và danh sách điểm liên lạc).
   * **Chọn ứng viên đích:** Recruiter chọn radio button hồ sơ muốn hợp nhất ➔ Bảng đối soát sẽ chuyển sang so sánh với hồ sơ đã chọn.
   * **Tùy chọn tạo hồ sơ mới độc lập (`Create New Profile`):** Nếu xác định đây là người hoàn toàn khác bị trùng thông tin liên lạc, nhấn **`Create New Profile`** để tạo một ứng viên mới hoàn chỉnh độc lập.

* *[📷 Vị trí ảnh chụp 6.1: Giao diện Hàng đợi Pending CV Imports với bảng Field Diff, chiến lược CV và lựa chọn Conflict Profile]*

_Cập nhật bởi: Antigravity (Implementer) — 2026-09-07: Cập nhật route tải tệp an toàn `/api/cv-upload-proxy` với Google OAuth session guard và hoàn thiện hướng dẫn nạp batch CV._


---

## 7. CHIẾN DỊCH TỰ ĐỘNG ĐĂNG BÀI & NUÔI NICK FACEBOOK (CAMPAIGNS, WARMING & AUTO-JOIN HUB)

### 7.1 Phân Loại Chiến Dịch (Campaign Types: Job Posting & Warming)
Phân hệ **Campaigns & Auto-Post Hub** (`/campaigns`) phân biệt rõ 2 loại chiến dịch khác nhau về mặt bản chất và giao diện:
1. **Job Posting (Đăng bài tuyển dụng):**
   - Phục vụ việc đăng bài giới thiệu vị trí tuyển dụng lên các nhóm Facebook.
   - Gắn với 1 **Job Order** cụ thể, hỗ trợ nội dung bài đăng, ảnh đính kèm, tính năng **AI Spin Content** (chống trùng lặp nội dung), và giới hạn bài đăng tối đa mỗi lượt chạy.
   - Nút hành động **"Run"** kích hoạt **Dispatch Preview Modal** để duyệt bài và phân bổ bài đăng vào các nhóm đã chọn.
2. **Warming & Auto-Join (Nuôi nick & Tự động xin vào nhóm):**
   - Phục vụ việc nuôi dưỡng tài khoản Facebook và tự động gửi yêu cầu tham gia các nhóm Facebook mục tiêu.
   - Tối giản form cấu hình: **Ẩn toàn bộ** các trường liên quan đến Job, Content, Ảnh, AI Spin Content, Max posts/day.
   - Chỉ cấu hình: Tên chiến dịch, Khoảng thời gian chạy, **Pool tài khoản FB mục tiêu** (`campaign_fb_accounts`) và **Danh sách nhóm FB mục tiêu** (`campaign_social_groups`).
   - Nút hành động **"Run"** trực tiếp khởi chạy phiên nuôi nick & auto-join cho riêng chiến dịch đó.

*Khóa bất biến (Immutable Type Guard):* Loại chiến dịch (`campaign_type`) được phép chỉnh sửa tự do khi chiến dịch chưa có lượt chạy nào. Một khi đã có ít nhất 1 lượt chạy (`campaign_runs` hoặc `warm_join_runs`), hệ thống tự động khóa trường này trên cả giao diện và Backend để bảo toàn tính toàn vẹn dữ liệu lịch sử.

* *[📷 Vị trí ảnh chụp 7.1: Modal tạo/chỉnh sửa Campaign với lựa chọn loại Job Posting vs Warming & Auto-Join]*

---

### 7.2 Quản Lý Tài Khoản Facebook Thuần Túy (FB Accounts Management)
Sub-tab **"FB Accounts"** tập trung 100% vào việc quản trị tài khoản Facebook:
- Bảng danh sách tài khoản: Account Name, Ref Code, Profile Link, 4G Proxy (che thông tin nhạy cảm), Warming Health, Last Warmed, Daily Quota, Today Posts, và Status (Active, Cooldown, Restricted, Checkpoint, Inactive).
- **Không còn nút chạy hành động nuôi nick tại tab này**: Mọi tác vụ chạy hành động được chuyển về đúng nơi quản lý là bên trong từng **Warming Campaign**.

* *[📷 Vị trí ảnh chụp 7.2: Bảng quản lý FB Accounts sạch sẽ, bảo mật proxy và hiển thị Warming Health]*

---

### 7.3 Khởi Chạy Nuôi Nick & Auto-Join Bên Trong Warming Campaign
1. **Khởi chạy từ Master Table hoặc Detail Panel:**
   - Trong sub-tab **"Campaigns"**, chọn một chiến dịch loại **Warming**.
   - Tại Detail Panel bên dưới:
     - Tab **"Overview & Groups"**: Hiển thị danh sách tài khoản trong Pool được phân công (`WARM & JOIN POOL`), thông tin thời gian chiến dịch và danh sách nhóm mục tiêu.
     - Nút **"Run Warm & Join"** ở góc phải Header Detail Panel mở modal xác nhận chạy.
2. **Quy trình chạy tự động trên VPS (Playwright Headless Engine):**
   - Tài khoản trong pool được kích hoạt tuần tự (Strict Sequential 1 by 1).
   - Tự động xoay IP 4G qua mProxy giữa các tài khoản và áp dụng khoảng nghỉ an toàn.
   - Phase 1: Nuôi nick tự nhiên (lướt Newsfeed, xem Reels, xem Story, tương tác Like).
   - Phase 2: Tự động gửi yêu cầu tham gia 1–2 nhóm mục tiêu lấy từ danh sách nhóm của chiến dịch (`targetGroups`). Tự động phát hiện modal câu hỏi kiểm duyệt và điền câu trả lời mẫu (`custom_join_answer`).
3. **Theo dõi tiến độ & Lịch sử chạy riêng (Run History Table):**
   - Tab **"Run History"** của Warming Campaign hiển thị toàn bộ các lượt chạy của riêng chiến dịch đó.
   - Bấm vào biểu tượng chi tiết để xem bảng breakdown từng item: Tên nhóm mục tiêu kèm link mở nhanh, tài khoản thực hiện, hành động (`Warmed`, `Joined`, `Checkpoint`, `Failed`) và kết quả chi tiết.
   - Các nhóm đã tham gia thành công sẽ tự động lưu vào `fb_account_groups` để không bị thử lại ở các lượt chạy sau.

* *[📷 Vị trí ảnh chụp 7.3: Giao diện Detail Panel của Warming Campaign với tab Overview, nút Run Warm & Join và bảng Run History mở rộng]*

---

### 7.4 Gán Hàng Loạt Social Group URLs Vào Nhiều Chiến Dịch (Bulk Assign)
Từ sub-tab **"Social Group URLs"**:
1. **Lọc nhóm theo nhu cầu:** Sử dụng ô tìm kiếm tên/URL, bộ lọc Tag ngành nghề (`Mechanical`, `Dev`, `Industrial`, v.v.), hoặc bộ lọc khoảng số lượng thành viên (`Min` – `Max`).
2. **Chọn nhóm:**
   - Tick chọn từng nhóm qua checkbox đầu dòng, hoặc tick ô header **"Select all on this page"**, hoặc bấm **"Select all N matching filter"** trên thanh banner xanh.
3. **Mở modal gán chiến dịch:**
   - Bấm nút **"Add to Campaign..."** trên thanh công cụ nổi.
   - Modal **Assign Groups to Campaigns** hiển thị:
     - Số lượng nhóm đang được chọn.
     - Danh sách toàn bộ các Campaign đang có trong hệ thống, kèm badge phân loại (Job Posting / Warming) và số lượng nhóm hiện tại của chiến dịch.
     - Bộ lọc tìm kiếm nhanh theo tên chiến dịch hoặc lọc theo tab Loại (`All`, `Job Posting`, `Warming`).
   - Tick chọn 1 hoặc nhiều chiến dịch đích (có nút **"Select All Visible"** tiện lợi).
   - Bấm **"Assign to N Campaigns"**.
4. **Kết quả & Tự động làm mới:**
   - Hệ thống chèn hàng loạt các liên kết trong 1 transaction an toàn, tự động bỏ qua các liên kết đã tồn tại từ trước (`ON CONFLICT DO NOTHING`).
   - Thông báo toast chi tiết kết quả (ví dụ: `Successfully assigned 2 group(s) to 2 campaign(s) (4 new links created, 0 already linked)`).
   - Cột **"Campaigns"** trong bảng thư viện tự động cập nhật số lượng chiến dịch mới nhất.

* *[📷 Vị trí ảnh chụp 7.4: Thao tác chọn hàng loạt nhóm và Modal Assign Groups to Campaigns đa chiến dịch]*

---

### 7.5 Bộ Chọn Hạn Mức Max Groups, Tỷ Lệ ACCOUNTS JOINED & Tự Động Đối Soát Trạng Thái Thành Viên
1. **Bộ Chọn Hạn Mức Tùy Chỉnh (Max Groups Quota Selector):**
   - Khi bấm **"Run Warm & Join"**, modal xác nhận cung cấp bộ nút chọn hạn mức nhóm cần tham gia cho mỗi tài khoản trong phiên: `1`, `2 (Safe - Mặc định)`, `3`, `4`, `5` và ô `Custom` (tối đa bằng tổng số nhóm của chiến dịch).
   - Dải cảnh báo rủi ro (Risk Indicator) hiển thị trực quan theo số lượng:
     - `1–2 nhóm/nick`: 🟢 **Safe** (Khuyến nghị cho nick mới / duy trì an toàn).
     - `3–4 nhóm/nick`: 🟡 **Moderate** (Tốc độ trung bình).
     - `5–10 nhóm/nick`: 🟠 **High Risk** (Có thể bị Facebook giới hạn xin vào nhóm tạm thời).
     - `> 10 nhóm/nick`: 🔴 **Critical Risk** (Nguy cơ quét checkpoint).
   - Thuật toán Allocator tự động phân bổ nhóm thiếu riêng cho từng tài khoản: Nick thiếu bao nhiêu nhóm sẽ nhận bấy nhiêu nhóm (lên tới hạn mức đã chọn), không bị trùng lặp nhóm đã tham gia.

2. **Cột ACCOUNTS JOINED & Popover Danh Sách Tài Khoản Đã Tham Gia:**
   - Trong bảng **Social Group URLs Library**, cột trạng thái hiển thị tỷ lệ động theo thời gian thực:
     - 🟢 **`2/2 Joined`**: 100% tài khoản Active trong hệ thống đã là thành viên của nhóm.
     - 🟡 **`1/2 Joined`**: Đạt một phần (có nick đã vào, có nick chưa vào).
     - ⚪ **`0/2 Joined`**: Chưa có tài khoản nào tham gia.
   - Nhấp vào badge tỷ lệ sẽ mở **Popover On-Demand** hiển thị danh sách chi tiết từng tài khoản kèm ngày tham gia (`Joined at dd/MM/yyyy`).

3. **Chuẩn Hóa 4 Trạng Thái Trong Run History Table:**
   - 🟢 **`Joined`**: Vào nhóm ngay thành công.
   - 🟡 **`Join Requested`**: Đã gửi đơn + trả lời câu hỏi, đang chờ Admin duyệt (hiển thị màu vàng hổ phách dịu mắt).
   - 🟠 **`Needs Answer`**: Nhóm có câu hỏi khảo sát cần cấu hình câu trả lời riêng trên ATS.
   - 🔴 **`Failed`**: Lỗi kết nối / checkpoint.

4. **Tự Động Đối Soát Trạng Thái Thành Viên (Workflow D Auto-Sync Engine):**
   - Hệ thống chạy nền tự động quét trang `facebook.com/groups/joins` 2 mốc ngẫu nhiên mỗi ngày (được điều phối bởi lịch gieo xúc xắc lúc 00:05).
   - Tự động bỏ qua các tài khoản đang bận chạy Campaign Đăng bài hoặc Nuôi nick (Per-Account Mutex Lock) để nhường 100% tài nguyên cho chiến dịch chính.

* *[📷 Vị trí ảnh chụp 7.5: Modal Run Warm & Join với Max Groups Selector & Risk Badge, Popover ACCOUNTS JOINED tỷ lệ 2/2 và bảng Run History 4 trạng thái]*

_Cập nhật bởi: Antigravity (Implementer) — 2026-09-06: Bổ sung hướng dẫn chi tiết về Max Groups Quota Selector, ACCOUNTS JOINED ratio popover, Run History 4-state badges và Workflow D Auto-Sync Engine._

