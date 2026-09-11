# ATS 3.0 Web Application - Phác Thảo Sổ Tay Hướng Dẫn Sử Dụng (User Manual Draft)

> **Mục đích tài liệu:** Tổng hợp và ghi chép chi tiết toàn bộ các tính năng đã hoàn thiện, hướng dẫn các bước thao tác thực tế và đánh dấu các vị trí cần chụp ảnh màn hình minh họa (với Database Dummy) sau khi dự án hoàn tất.  
> **Ngày khởi tạo:** 28/08/2026  
> **Phiên bản ghi nhận:** `v3.0-Draft`  
> **Tác giả:** Tri Tran

---

## 📑 MỤC LỤC TÍNH NĂNG ĐÃ HOÀN THIỆN

* [Phần 1: Action Menu Dashboard (Bàn Làm Việc Tác Vụ Chính)](#phần-1-action-menu-dashboard)
* [Phần 2: Master Search Menu & Smart Contact Hub (Tra Cứu Cơ Sở Dữ Liệu)](#phần-2-master-search-menu)
* [Phần 3: Các Quy Ước Thao Tác Chuẩn & Phím Tắt Tiện Ích](#phần-3-quy-ước-thao-tác--phím-tắt)
* [Phần 4: Kế Hoạch Tạo Dữ Liệu Mẫu (Dummy Data) & Chụp Ảnh Minh Họa](#phần-4-kế-hoạch-chụp-ảnh-minh-họa)

---

## PHẦN 1: ACTION MENU DASHBOARD (`/`)

### 1.1 Bố Cục Viewport Cố Định & Bảng Kép (Dual Viewport Layout)
* **Mô tả:** Màn hình làm việc chính được thiết kế không có thanh cuộn toàn trang (`h-screen overflow-hidden`), chia làm 2 phần:
  * **Bảng trên (Master Table):** Danh sách toàn bộ các hồ sơ ứng tuyển với các thông tin: ID, Full Name, Order Name, Client, Planning Date, Current Stage, Result, Priority, Source Channel, Note.
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
  * **Phím tắt:**
    * Nhấn **`Shift + Enter`** trong ô Ghi chú để xuống dòng viết chi tiết.
    * Nhấn **`Enter`** để lưu nhanh bước hành động lên cơ sở dữ liệu.
* *[📷 Vị trí ảnh chụp 1.6: Hàng nhập liệu ghim đầu bảng Action Notes và phím tắt]*

---

### 1.7 Xóa Action Note & Tự Động Đồng Bộ Stage
* **Cách hoạt động:**
  * Mỗi dòng Action Note có nút thùng rác `🗑️` ở cuối dòng.
  * Khi click xóa một ghi chú hành động, hệ thống tự động xóa trên Database và tự động tính toán lại để cập nhật cờ **`Current Stage`** trên bảng Master.
* *[📷 Vị trí ảnh chụp 1.7: Nút thùng rác và thông báo xác nhận xóa Action Note]*

---

### 1.8 Thanh Phân Trang & Lọc Dữ Liệu Server-side Toàn Diện
* **Cách hoạt động:**
  * Toàn bộ các bộ lọc (**Search, Status, Channel, Client, Position**) đều được chuyển về PostgreSQL xử lý với các chỉ mục Index tối ưu, bao phủ 100% toàn bộ hơn 3,100 hồ sơ ứng tuyển.
  * Bảng hiển thị 80 hồ sơ mỗi trang kèm bộ phân trang tại Footer: `|◀ First` `◀ Prev` `Page X of Y` `Next ▶` `Last ▶|` `(Z total applications)`.
* *[📷 Vị trí ảnh chụp 1.8: Thanh điều hướng phân trang Page X of Y tại Footer của Action Menu]*

---

## PHẦN 2: MASTER SEARCH MENU & SMART CONTACT HUB (`/candidates`)

### 2.1 3 Tab Cơ Sở Dữ Liệu Tập Trung (3-in-1 Database Hub)
* **Mô tả:** Cho phép chuyển đổi linh hoạt giữa 3 cơ sở dữ liệu chính:
  1. 👤 **`Candidate Database`** (Hơn 3,300 ứng viên).
  2. 🏢 **`Client Database`** (Danh sách công ty khách hàng, ngành nghề, người liên hệ, số Job đang tuyển).
  3. 📋 **`Job Order Database`** (Danh sách các vị trí tuyển dụng, trạng thái, địa điểm, số lượng ứng viên).
* *[📷 Vị trí ảnh chụp 2.1: 3 Tab chuyển đổi dữ liệu trên thanh Toolbar]*

---

### 2.2 Smart Grouped Contact Hub (Trung Tâm Quản Lý Liên Hệ Thông Minh)
* **Cách hoạt động:**
  * **📱 Cột Phones:** Hiển thị số điện thoại chính. Nếu có nhiều số, hiển thị huy hiệu `+N`. Click vào huy hiệu sẽ mở Popover danh sách tất cả các số kèm nút Copy 1-click.
  * **✉️ Cột Emails:** Hiển thị email chính. Nếu có nhiều email, hiển thị huy hiệu `+N` và Popover danh sách kèm nút Copy.
  * **🌐 Cột Social & Web Profiles:** Hiển thị các icon nhận diện (LinkedIn, Facebook, GitHub, Skype, Website...). Click vào icon sẽ mở thẳng trang cá nhân trong tab mới.
  * **📄 Cột CV:** Nút mở trực tiếp file CV Google Drive.
* *[📷 Vị trí ảnh chụp 2.2: Popover hiển thị danh sách nhiều SĐT/Email và các icon Social]*

---

### 2.3 Nhận Diện & Bôi Đỏ Tự Động Ứng Viên Blacklist
* **Cách hoạt động:**
  * Ứng viên có cờ Blacklist hoặc ghi chú chặn trong database sẽ tự động được **tô màu nền đỏ hồng toàn bộ dòng**.
  * Nút Họ tên chuyển sang màu đỏ kèm biểu tượng `🚫` và huy hiệu **`BLACKLIST`**.
  * Rê chuột vào tên sẽ thấy lý do bị chặn và thanh Footer hiển thị cảnh báo chi tiết.
* *[📷 Vị trí ảnh chụp 2.3: Dòng ứng viên bị Blacklist được bôi đỏ nổi bật]*

---

### 2.4 Thanh Tìm Kiếm Đa Năng Trigram (Server-side Search)
* **Cách hoạt động:**
  * Ô tìm kiếm hỗ trợ tìm theo mọi trường dữ liệu: Tên, Mã ID, bất kỳ số điện thoại nào, bất kỳ email nào, link LinkedIn/Facebook/GitHub...
  * Tìm kiếm được xử lý bằng chỉ mục GIN Trigram trực tiếp dưới Database PostgreSQL, phản hồi kết quả trong tích tắc.
  * Có nút **`Clear`** để xóa nhanh từ khóa tìm kiếm.
* *[📷 Vị trí ảnh chụp 2.4: Thanh Search và kết quả tìm kiếm thời gian thực]*

---

### 2.5 Thanh Phân Trang & Điều Hướng Bản Ghi (Server-side Pagination)
* **Cách hoạt động:**
  * Bảng hiển thị 80 bản ghi mỗi trang giúp giảm tải tối đa cho trình duyệt và đường truyền mạng.
  * Thanh Footer tích hợp bộ điều hướng trang:
    * `|◀`: Nhảy về Trang đầu tiên (First Page).
    * `◀`: Chuyển về Trang trước (Previous Page).
    * `Page X of Y`: Hiển thị số trang hiện tại và tổng số trang.
    * `▶`: Chuyển sang Trang kế tiếp (Next Page).
    * `▶|`: Nhảy đến Trang cuối cùng (Last Page).
    * `(Z total)`: Tổng số lượng bản ghi khớp trong cơ sở dữ liệu.
* *[📷 Vị trí ảnh chụp 2.5: Thanh điều hướng phân trang Page X of Y tại Footer]*

---

## PHẦN 3: CÁC QUY ƯỚC THAO TÁC CHUẨN & PHÍM TẮT

| Thao Tác / Phím Tắt | Vị Trí Áp Dụng | Chức Năng |
| :--- | :--- | :--- |
| **`Single Click`** | Bảng Master / Search Table | Chọn dòng, hiển thị mũi tên `▶`, nạp chi tiết. |
| **`Double Click (Full Name)`** | Cột Họ Tên Ứng Viên | Mở trang hồ sơ chuyên sâu Candidate 360°. |
| **`Double Click (Order Name)`** | Cột Tên Vị Trí Tuyển Dụng | Mở trang chi tiết công việc / Job Order. |
| **`Double Click (Client Name)`** | Cột Tên Khách Hàng | Lọc bảng Action Menu theo khách hàng đó. |
| **`Shift + Enter`** | Ô Ghi Chú Action Note | Xuống dòng để viết ghi chú nhiều đoạn. |
| **`Enter`** | Ô Ghi Chú Action Note | Lưu nhanh Action Note lên hệ thống. |
| **`Click Icon SĐT / Email`** | Cột Phones / Emails | Sao chép nhanh số điện thoại / email vào clipboard. |
| **`Click Icon Social`** | Cột Social & Web Profiles | Mở liên kết LinkedIn / Facebook / GitHub trên tab mới. |
| **`Record Navigator ◀ / ▶`** | Thanh Footer | Chuyển nhanh giữa các bản ghi kế tiếp hoặc trước đó. |

---

## PHẦN 4: KẾ HOẠCH TẠO DỮ LIỆU MẪU (DUMMY DATA) & CHỤP ẢNH MINH HỌA

> **Lưu ý triển khai:** Giai đoạn này được thực hiện sau khi hoàn tất toàn bộ các tính năng của hệ thống.

1. **Kịch bản Dummy Database:**
   * Tạo 10–20 hồ sơ ứng viên mẫu với tên quốc tế/tiếng Việt chuẩn mực, số điện thoại mẫu (`+84 901 234 567`), email demo, link LinkedIn demo, và 1–2 hồ sơ Blacklist mẫu.
   * Tạo 5 Khách hàng mẫu (ví dụ: *Acme Corp, TechStar Vietnam, Global Solutions...*) và 10 Job Orders mẫu.
2. **Kịch bản Chụp ảnh & Hoàn thiện User Manual:**
   * Sử dụng công cụ Chrome DevTools / Browser Screenshot để chụp độ nét cao các góc màn hình tương ứng với các mục đánh dấu `[📷 Vị trí ảnh chụp ...]`.
   * Xuất bản tài liệu User Manual hoàn chỉnh dạng PDF / Markdown Portfolio phục vụ đào tạo và giới thiệu sản phẩm.
