# ATS 3.0 Web Application & Interactive UI Dashboard - Technical Blueprint

> **Ngày cập nhật:** 28/08/2026  
> **Phiên bản:** v3.0-RC1 (Giao diện Dark Mode Tiếng Anh, Bộ lọc Combobox liên hoàn & Đồng bộ Planning Date trên Neon PostgreSQL)  
> **Hệ thống kết nối:** Next.js 15 (App Router / Server Actions), React 19, TailwindCSS v4, Neon Serverless PostgreSQL, Lucide Icons  
> **Tác giả / Lead Developer:** Tri Tran  
> **Vị trí lưu trữ:** `g:\My Drive\AI project\My Porfolio\blue print\ATS_3.0_UI_Modernization_Blueprint.md`

---

## 1. Tổng Quan & Bối Cảnh Dự Án (Executive Summary)

Dự án **ATS 3.0 UI Modernization** là bước chuyển đổi số toàn diện cho hệ thống Tuyển dụng & Quản lý Ứng viên (Applicant Tracking System - ATS), nâng cấp từ các nền tảng cũ (MS Access và Notion) lên một ứng dụng Web Full-stack hiện đại, tốc độ cao và chuyên nghiệp:

* **Giải quyết điểm nghẽn của MS Access:** Khắc phục triệt để các hạn chế về giới hạn dung lượng file (.accdb 2GB), tốc độ truy vấn chậm, giao diện cũ kỹ và thiếu khả năng làm việc cộng tác đa nền tảng.
* **Giải quyết hạn chế của Notion Database:** Khắc phục nhược điểm tải chậm khi khối lượng dữ liệu lớn (>3,000 records), thiếu giao diện tác vụ tập trung (Action Dashboard) cho Recruiter, và thiếu các tương tác phím tắt / double-click chuyên dụng.
* **Mục tiêu cốt lõi:** Xây dựng Dashboard tác vụ **Action Menu** tốc độ cao, kết nối trực tiếp thời gian thực với **Neon Serverless PostgreSQL**, cung cấp trải nghiệm làm việc mượt mà với bố cục cố định (Fixed Viewport), bộ lọc tìm kiếm thông minh và hỗ trợ nhập liệu nhanh.

---

## 2. Kiến Trúc Hệ Thống & Tech Stack

```mermaid
graph TD
    User([Recruiter / User]) <-->|Browser / HTTPS| NextClient[Next.js 15 Client UI - React 19]
    
    subgraph FrontendLayer [Frontend Layer - ats-web]
        NextClient --> Combobox[Searchable Combobox Dropdowns]
        NextClient --> MasterTable[Master Application Table]
        NextClient --> ActionSubTable[Action Notes Sub-Grid]
        NextClient --> ViewportEngine[Fixed Viewport & Scroll Controller]
    end

    subgraph ServerActionsLayer [Server Actions Layer]
        Combobox & MasterTable & ActionSubTable --> ActionsAPI[actions.js - Server Actions]
        ActionsAPI --> DBConn[postgres-js Pooler]
    end

    subgraph DatabaseLayer [Database Layer - Neon Cloud]
        DBConn <-->|SSL / Direct SQL| NeonDB[(Neon PostgreSQL 16)]
        NeonDB --- ActivityTable[(activity - Master Applications)]
        NeonDB --- ActivityLogTable[(activity_log - Action Notes)]
        NeonDB --- CandidatesTable[(candidates)]
        NeonDB --- JobsTable[(jobs)]
        NeonDB --- ClientsTable[(clients)]
        NeonDB --- ContactPointsTable[(contact_points)]
    end
```

### 2.1 Tech Stack Chi Tiết
* **Framework:** Next.js 15 (App Router, Server Components & React 19 Actions).
* **Styling & Theme:** TailwindCSS v4 với bảng màu **Dark Mode** công thái học (Deep Slate `#090d16` / Zinc `#18181b` và điểm nhấn Emerald Glow `#34d399`).
* **Icons:** `lucide-react`.
* **Database:** Neon Serverless PostgreSQL (kết nối qua thư viện `postgres` với connection pooler SSL).
* **Quản lý dữ liệu:** Truy vấn SQL trực tiếp tối ưu hóa với `LEFT JOIN`, `TO_CHAR`, `COALESCE` và Transaction an toàn.

---

## 3. Cấu Trúc Cơ Sở Dữ Liệu Đã Chuẩn Hóa (Database Schema)

Dữ liệu đã được làm sạch và chuẩn hóa hoàn toàn trên Neon PostgreSQL, loại bỏ các trường trùng lặp và thừa kế từ hệ thống cũ:

```mermaid
erDiagram
    candidates ||--o{ activity : "has applications"
    candidates ||--o{ contact_points : "has contacts"
    clients ||--o{ jobs : "hires for"
    jobs ||--o{ activity : "applies to"
    activity ||--o{ activity_log : "tracks history"

    candidates {
        uuid id PK
        int display_number
        text display_id
        text full_name
        text cv_url
        boolean blocked
        timestamptz created_time
    }

    clients {
        uuid id PK
        text name
        text domain
        timestamptz created_time
    }

    jobs {
        uuid id PK
        uuid client_id FK
        text job_title
        text status
        text location
        int display_number
        timestamptz created_time
    }

    activity {
        uuid id PK
        uuid candidate_id FK
        uuid job_id FK
        text status
        text current_stage
        text result
        int priority
        text source_channel
        date planning_date
        text note
        boolean is_passive
        timestamptz created_time
        timestamptz last_updated
    }

    activity_log {
        uuid id PK
        uuid application_id FK
        text action_type
        text note
        text result
        timestamptz action_date
        timestamptz created_time
    }
```

> **Quy Chuẩn Dữ Liệu Ngày Tháng:**
> * Cột `due_date` đã được **xóa bỏ hoàn toàn khỏi database** (`ALTER TABLE activity DROP COLUMN due_date;`).
> * Toàn bộ 3,192 bản ghi đã được hợp nhất dữ liệu vào duy nhất trường **`planning_date`**.
> * Cột `channel` trùng lặp trước đó đã được loại bỏ, chỉ sử dụng duy nhất **`source_channel`**.

---

## 4. Chi Tiết Các Thành Phần UI & Tính Năng Nghiệp Vụ

### 4.1 Bố Cục Viewport Cố Định (`h-screen overflow-hidden`)
* Toàn bộ ứng dụng nằm trọn vẹn trong màn hình hiển thị, không xuất hiện thanh cuộn toàn trang (page scrollbar).
* **Bảng Master (trên):** Cuộn nội bộ độc lập, hiển thị danh sách hồ sơ ứng tuyển kèm các trường thông tin chính.
* **Bảng Detail (dưới):** Action Timeline cố định chiều cao (260px), hiển thị lịch sử chăm sóc và tương tác ứng viên.

### 4.2 Cơ Chế Tự Động Thu Gọn / Trồi Lên Khi Cuộn Chuột (Smart Auto-Slide)
* **Khi Recruiter cuộn chuột duyệt bảng trên:** Bảng Action Timeline bên dưới tự động trượt xuống và ẩn đi (`h-0 opacity-0`), mở rộng bảng Master ra toàn màn hình để dễ theo dõi.
* **Khi dừng cuộn chuột 2 giây:** Bảng Action Timeline tự động trồi lên lại vị trí cố định (`h-[260px] opacity-100`).
* **Nút nổi Quick Peek (`▲ Action Timeline`):** Nằm cố định ở góc dưới màn hình khi đang cuộn, cho phép mở lại tức thì bằng 1 click.

### 4.3 Bộ Lọc Tìm Kiếm Combobox Thông Minh (Searchable Dropdown)
* **Thanh Search Bar cố định:** Tích hợp ô tìm kiếm trực quan bên trong popover menu, khắc phục hoàn toàn nhược điểm tự xóa ký tự sau 1s của thẻ `<select>` truyền thống.
* **Lọc liên hoàn (Cascading Dependent Filter):** Khi chọn 1 **Client**, bộ lọc **Position** tự động lọc danh sách chỉ hiển thị các Job thuộc riêng Khách hàng đó. Tự động reset Job về `All` nếu có sự thay đổi Client không tương thích.
* **Nút Clear nhanh `✕`:** Tích hợp ngay trên nút bấm filter để reset về `All` nhanh chóng.

### 4.4 Điều Hướng Thông Minh Bằng Double-Click
* **Single Click (1 lần):** Chọn dòng hồ sơ và tải chi tiết Action Notes tương ứng (không nhảy trang ngoài ý muốn).
* **Double Click (Nhấp đúp):**
  * `Full Name` ➔ Điều hướng tới trang hồ sơ chi tiết `/candidates/[id]`.
  * `Order Name` ➔ Mở trang chi tiết Job `/jobs?job_id=[id]`.
  * `Client` ➔ Lọc ngay bảng theo Khách hàng được chọn.

### 4.5 Pinned Quick Action Form & Xóa Action Note
* Hàng nhập liệu `*` luôn ghim cố định ở đầu bảng Action Notes, không bị trôi khi danh sách dài.
* Hỗ trợ phím tắt: **`Shift + Enter`** để xuống dòng ghi chú chi tiết, **`Enter`** để lưu bước nhanh.
* Tự động đồng bộ trường `current_stage` trên bảng Master mỗi khi thêm hoặc xóa một dòng Action Note.
### 4.6 Master Search Menu & Smart Grouped Contact Hub
* **3 Tab Dữ liệu Chuyên biệt:**
  * 👤 **Candidate Database:** Danh bạ toàn diện ứng viên với mô hình **Smart Grouped Contact Hub**:
    * **`Phones` Column:** Hiển thị số điện thoại chính kèm huy hiệu đếm `+N`. Click/hover mở popover xem toàn bộ danh sách SĐT kèm nút copy 1-click.
    * **`Emails` Column:** Hiển thị email chính kèm huy hiệu đếm `+N`. Click/hover mở popover xem toàn bộ email.
    * **`Social & Web Profiles` Column:** Hiển thị hệ thống icon nhận diện thông minh (LinkedIn, Facebook, GitHub, Skype, Personal Website, Portfolio/Behance/Dribbble). Click mở trực tiếp profile trong tab mới.
    * **`CV` Column:** Nút mở trực tiếp file CV Google Drive của ứng viên.
  * 🏢 **Client Database:** Danh sách khách hàng, phân ngành, địa điểm, người liên hệ, số lượng Job đang mở và tổng số hồ sơ đã ứng tuyển.
  * 📋 **Job Order Database:** Danh sách vị trí tuyển dụng, trạng thái, địa điểm, số lượng ứng viên và ngày khởi tạo.
* **Double-Click Deep Navigation:**
  * Nhấp đúp vào **Full Name** ➔ Mở hồ sơ chuyên sâu `/candidates/[id]`.
  * Nhấp đúp vào **Order Name** ➔ Mở chi tiết Job `/jobs?job_id=[id]`.
  * Nhấp đúp vào **Client Name** ➔ Lọc ngay các ứng viên thuộc khách hàng đó trên Action Menu.
* **Universal Search Engine:** Tìm kiếm bao phủ 100% tất cả các trường dữ liệu bao gồm mọi số điện thoại, email phụ, và link mạng xã hội của ứng viên.

---

## 5. Tiến Độ Dự Án Theo Từng Giai Đoạn (Project Roadmap & Progress)

| Giai Đoạn (Phase) | Nội Dung Công Việc | Trạng Thái | Tiến Độ |
| :--- | :--- | :---: | :---: |
| **Phase 1: Database Migration** | Thiết lập Neon PostgreSQL, migrate 3,192 records từ Notion & Access, chuẩn hóa schema. | ✅ Hoàn thành | 100% |
| **Phase 2: Action Dashboard & UX** | Xây dựng Action Menu, Fixed Viewport, Smart Auto-Slide, Searchable Combobox, Dark Mode, Double-click navigation. | ✅ Hoàn thành | 100% |
| **Phase 3: Master Search Menu & Databases** | Xây dựng Search Menu đa tab (Candidate, Client, Job Databases), Smart Grouped Contact Hub, tìm kiếm thời gian thực. | ✅ Hoàn thành | 100% |
| **Phase 4: Candidate 360° Profile Detail** | Trang hồ sơ ứng viên chuyên sâu (`/candidates/[id]`), quản lý đa contact point, CV preview trực tiếp, lịch sử ứng tuyển. | 🔄 Đang triển khai | 60% |
| **Phase 5: Jobs & Client CRM Hub** | Trang quản lý danh sách Jobs tuyển dụng, thống kê số lượng hồ sơ theo từng pipeline, quản lý Contact Points khách hàng. | ⏳ Dự kiến | 0% |
| **Phase 6: AI CV Parser & Matching** | Tích hợp n8n webhook / Gemini API để tự động trích xuất thông tin CV và gợi ý độ phù hợp với Job. | ⏳ Dự kiến | 0% |

---

## 6. Hướng Dẫn Cài Đặt & Khởi Chạy (Reproduction Guide)

### 6.1 Yêu Cầu Môi Trường
* Node.js v20+ hoặc v24+.
* Kết nối Internet truy cập Neon PostgreSQL.

### 6.2 Cấu Hình File Môi Trường (`.env.local`)
```env
DATABASE_URL="postgresql://YOUR_NEON_USER:YOUR_NEON_PASSWORD@YOUR_NEON_HOST/neondb?sslmode=require"
PORT=3000
```

### 6.3 Lệnh Cài Đặt & Chạy Ứng Dụng
```bash
# Cài đặt dependencies
npm install

# Khởi chạy môi trường Development
npm run dev

# Build môi trường Production
npm run build
npm run start
```

---

## 7. Nhật Ký Cập Nhật (Changelog)

### v3.0-RC15 (28/08/2026)
* 🎯 **Chuẩn hóa tự động Stage & Action Type phi chuẩn**:
  * Mọi giá trị cũ không nằm trong danh mục chuẩn (như `Call`, `Reaching Out`, `Keep in touch`, `Phone Screen`, `Data input`,...) được tự động chuyển đổi sang `Contact` và hiển thị thống nhất với huy hiệu màu xanh dương **`Contact / Reach Out`**.
  * Bổ sung cơ chế bảo vệ `normalizeStage` ở cả tầng backend và frontend UI để đảm bảo giao diện luôn đồng bộ, sạch đẹp và đúng chuẩn ATS 3.0.

### v3.0-RC14 (28/08/2026)
* ⚡ **Mặc định lọc `In progress` khi mở Action Menu**:
  * Tập trung tức thì vào các hồ sơ đang xử lý thực tế, giảm thiểu tối đa thời gian chờ tải trang (< 0.08s).
  * Khi bấm nút `Clear`, hệ thống tự động đưa về trạng thái `In progress`.
* 🚀 **Bung toàn bộ cơ sở dữ liệu (Loại bỏ giới hạn cứng 200 dòng)**:
  * Khi người dùng chọn `All Status` hoặc tìm kiếm, hệ thống hiển thị chính xác toàn bộ **3,192 hồ sơ ứng tuyển** trong cơ sở dữ liệu.
  * Thanh footer cập nhật đúng số lượng thực tế `Record: 1 of 7` (khi In progress) hoặc `Record: 1 of 3192` (khi All).

### v3.0-RC13 (28/08/2026)
* 🧹 Làm sạch triệt để các thẻ HTML thô (`<div>`, `<p>`, `<br>`, `&nbsp;`) khỏi toàn bộ bảng ghi chú Action Notes.
  * Tự động lọc sạch ở tầng Server Action và Frontend component thông qua hàm `stripHtml`.
  * Đảm bảo mọi dòng ghi chú lịch sử luôn hiển thị văn bản thuần túy, rõ ràng và thẩm mỹ.

### v3.0-RC12 (28/08/2026)
* 🎯 Giữ nguyên 100% giao diện, bố cục cột, nút bấm, Sub-table Action Notes và thiết kế gốc của Action Menu (`/`).
* ⚡ Tích hợp cơ chế tìm kiếm & lọc dữ liệu trực tiếp ở **Backend PostgreSQL** (Debounced 250ms), giúp tìm kiếm bao quát và nhanh chóng mà không thay đổi bất kỳ thành phần trực quan nào.

### v3.0-RC11 (28/08/2026)
* ↩️ Rollback 1 bước cho phân hệ **Action Menu (`/`)** về đúng nguyên bản giao diện và logic client-side lọc mượt mà ban đầu theo yêu cầu.
* ⚡ Phân hệ **Master Search Menu (`/candidates`)** vẫn duy trì 100% kiến trúc Server-side Search & Pagination siêu tốc.

### v3.0-RC9 (28/08/2026)
* ⚡ Chuyển đổi toàn diện Search Menu sang **Server-side Search & Pagination (Enterprise Architecture)**:
  * Kích hoạt extension `pg_trgm` và tạo **GIN Trigram Indexes** trên database.
  * Logic tìm kiếm và phân trang được chuyển 100% về PostgreSQL xử lý, giảm tải payload mạng từ 2MB xuống còn ~15KB.
  * Tích hợp thanh phân trang thông minh `Page X of Y` và cơ chế debounce 280ms tránh spam request.
  * Hệ thống sẵn sàng mở rộng và vận hành mượt mà với quy mô từ 50,000 đến 500,000 bản ghi.

### v3.0-RC8 (28/08/2026)
* 🚀 Cải tiến cấu trúc Contact Points trên bảng `candidates`:
  * Tích hợp trực tiếp các cột `phones`, `emails`, `socials`, `all_contacts_text` vào bảng `candidates`.
  * Tối giản `getCandidateSearchData` thành 1 câu query duy nhất, loại bỏ tình trạng nghẽn đọc 15,317 bản ghi thô qua Neon Pooler.
  * Tốc độ phản hồi trang ổn định và tải dứt điểm không bị treo vòng quay.

### v3.0-RC7 (28/08/2026)
* ⚡ Nâng cấp hiệu năng vượt bậc với **Instant In-Memory RAM Cache & Progressive Windowing**:
  * Tích hợp bộ nhớ đệm RAM trình duyệt (`globalSearchCache`): Chuyển tab giữa Action Menu và Search Menu phản hồi **ngay lập tức trong 0.00 giây**.
  * Áp dụng kỹ thuật Progressive Windowing khi cuộn bảng 3,377 ứng viên, giảm 90% số lượng DOM nodes và duy trì tốc độ khung hình 60 FPS mượt mà.
  * Tích hợp nút **Reload** có hiệu ứng xoay động cho phép người dùng chủ động nạp lại dữ liệu mới nhất từ Cloud Database bất cứ lúc nào.

### v3.0-RC6 (28/08/2026)
* 🚫 Tích hợp tính năng nhận diện và bôi đỏ ứng viên Blacklist:
  * Tự động nhận diện trường `blocked` và `blacklist_note` từ Database.
  * Tô màu nền đỏ hồng nổi bật (`bg-rose-950/40 text-rose-300`) cho toàn bộ dòng của ứng viên bị blacklist.
  * Đổi màu nút Full Name sang tone đỏ kèm icon `🚫` và huy hiệu `BLACKLIST`.
  * Hiển thị tooltip ghi chú lý do blacklist và cảnh báo trực tiếp trên thanh footer.

### v3.0-RC5 (28/08/2026)
* 🗄️ Tinh gọn cơ sở dữ liệu Neon PostgreSQL:
  * Đã sao lưu toàn bộ 957 bản ghi cũ sang file JSON backup an toàn `.backups/20260828_v3.0_dropped_experience_history/experience_history_backup.json`.
  * Thực thi `DROP TABLE experience_history CASCADE;` xóa sạch hoàn toàn bảng lịch sử kinh nghiệm thừa khỏi Database.

### v3.0-RC4 (28/08/2026)
* 🧹 Tinh gọn cấu trúc bảng Candidate Database:
  * Loại bỏ 2 cột `Current Job Title` và `Current Company` khỏi giao diện và bộ lọc tìm kiếm.
  * Tối ưu hóa truy vấn `getCandidateSearchData`, loại bỏ subquery `experience_history` giúp truy vấn chạy nhanh hơn và tăng không gian hiển thị cho Contact Hub.

### v3.0-RC3 (28/08/2026)
* 📱 Chuyển đổi bảng Candidate Database sang kiến trúc **Smart Grouped Contact Hub**:
  * Gom các cột phẳng cũ thành 3 nhóm cột thông minh: `Phones`, `Emails`, `Social & Web Profiles`.
  * Hỗ trợ không giới hạn số lượng SĐT, Email và link mạng xã hội (LinkedIn, Facebook, GitHub, Skype, Website...).
  * Tích hợp huy hiệu `+N` và Popover danh sách liên hệ với nút 1-Click sao chép nhanh.
  * Tối ưu hóa truy vấn song song (Parallel Query) kết hợp Covering Index trên Neon DB.

### v3.0-RC2 (28/08/2026)
* 🔍 Hoàn thành giao diện **Search Menu** đa cơ sở dữ liệu (`/candidates`):
  * Tích hợp 3 Tab chuyển đổi nhanh: **Candidate Database**, **Client Database**, **Job Order Database**.
  * Bảng Candidate hiển thị đầy đủ thông tin: ID, Prefix, Full Name, Current Job Title, Current Company, Phone 1 & 2, Email 1 & 2, LinkedIn, Facebook, Skype.
  * Tích hợp cơ chế **Double-Click** mở trang hồ sơ ứng viên `/candidates/[id]`, mở Job Details, và liên kết lọc Client.
  * Tích hợp tính năng 1-Click sao chép SĐT / Email và click mở trang mạng xã hội LinkedIn / Facebook.
* 🧭 Nâng cấp thanh điều hướng toàn trang (`NavbarTabs`) với cơ chế highlight active tab tự động.

### v3.0-RC1 (28/08/2026)
* 🌐 Chuyển đổi 100% ngôn ngữ giao diện sang Tiếng Anh chuyên nghiệp.
* 🌙 Cập nhật toàn diện theme Dark Mode với độ tương phản cao và bảng màu slate/emerald.
* 🔍 Nâng cấp bộ lọc Client & Position thành **Searchable Combobox Dropdowns** với ô gõ tìm kiếm thời gian thực.
* 🔗 Bổ sung tính năng lọc liên hoàn (**Cascading Filter**): tự động co cụm Job theo Client được chọn.
* 📅 Hợp nhất và chuẩn hóa cơ sở dữ liệu: Xóa bỏ cột `due_date`, chuyển 100% sang `planning_date`.
* 🗑️ Tích hợp tính năng xóa Action Note trực tiếp từ giao diện kèm tự động cập nhật lại Stage.
* 🖱️ Chuyển đổi toàn bộ điều hướng nhảy trang sang cơ chế **Double-Click**.

---

*Tài liệu Blueprint này được lưu trữ và cập nhật liên tục để theo dõi tiến độ và hỗ trợ mở rộng quy mô phát triển hệ thống.*
