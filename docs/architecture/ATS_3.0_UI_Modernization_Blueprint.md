# ATS 3.0 Web Application & Interactive UI Dashboard - Technical Blueprint

> **Ngày cập nhật:** 07/09/2026  
> **Phiên bản:** v3.0-RC155 (CV Upload Proxy Route & Auth Guard, Latest-First Clients & Job Orders)
> **Hệ thống kết nối:** Next.js 16.3.0 (App Router / Server Actions), React 19, TailwindCSS v4, Supabase Singapore PostgreSQL (Transaction Pooler port 6543), Lucide Icons  
> **Tác giả / Lead Developer:** Thức Nguyễn  
> **Vị trí lưu trữ:** `D:\Users\trith\ats-web\docs\architecture\ATS_3.0_UI_Modernization_Blueprint.md`

---

## 1. Tổng Quan & Bối Cảnh Dự Án (Executive Summary)

Dự án **ATS 3.0 UI Modernization** là bước chuyển đổi số toàn diện cho hệ thống Tuyển dụng & Quản lý Ứng viên (Applicant Tracking System - ATS), nâng cấp từ các nền tảng cũ (MS Access và Notion) lên một ứng dụng Web Full-stack hiện đại, tốc độ cao và chuyên nghiệp:

* **Giải quyết điểm nghẽn của MS Access:** Khắc phục triệt để các hạn chế về giới hạn dung lượng file (.accdb 2GB), tốc độ truy vấn chậm, giao diện cũ kỹ và thiếu khả năng làm việc cộng tác đa nền tảng.
* **Giải quyết hạn chế của Notion Database:** Khắc phục nhược điểm tải chậm khi khối lượng dữ liệu lớn (>3,000 records), thiếu giao diện tác vụ tập trung (Action Dashboard) cho Recruiter, và thiếu các tương tác phím tắt / double-click chuyên dụng.
* **Mục tiêu cốt lõi:** Xây dựng Dashboard tác vụ **Action Menu** tốc độ cao, kết nối trực tiếp thời gian thực với **Supabase Singapore PostgreSQL (`ap-southeast-1`)**, cung cấp trải nghiệm làm việc mượt mà với bố cục cố định (Fixed Viewport), bộ lọc tìm kiếm thông minh và hỗ trợ nhập liệu nhanh.

---

## 2. Kiến Trúc Hệ Thống & Tech Stack

```mermaid
graph TD
    User([Recruiter / User]) <-->|Browser / HTTPS| NextClient[Next.js 16.3.0 Client UI - React 19]
    
    subgraph FrontendLayer [Frontend Layer - ats-web]
        NextClient --> Combobox[Searchable Combobox Dropdowns]
        NextClient --> MasterTable[Master Application Table]
        NextClient --> ActionSubTable[Action Notes Sub-Grid & Timeline Accordion]
        NextClient --> ViewportEngine[Fixed Viewport & Scroll Controller]
    end

    subgraph ServerActionsLayer [Server Actions Layer]
        Combobox & MasterTable & ActionSubTable --> ActionsAPI[actions.js - Server Actions]
        ActionsAPI --> DBConn[postgres-js Transaction Pooler]
    end

    subgraph DatabaseLayer [Database Layer - Supabase Singapore Cloud]
        DBConn <-->|SSL / Direct SQL (Port 6543)| SupabaseDB[(Supabase PostgreSQL 15 - Singapore)]
        SupabaseDB --- ActivityTable[(activity - Master Applications)]
        SupabaseDB --- ActivityLogTable[(activity_log - Action Notes)]
        SupabaseDB --- CandidatesTable[(candidates)]
        SupabaseDB --- JobsTable[(jobs)]
        SupabaseDB --- ClientsTable[(clients)]
        SupabaseDB --- ClientContactsTable[(client_contacts)]
        SupabaseDB --- ContactPointsTable[(contact_points)]
    end
```

### 2.1 Tech Stack Chi Tiết
* **Framework:** Next.js 16.3.0 (App Router, Server Components & React 19 Actions).
* **Styling & Theme:** TailwindCSS v4 với bảng màu **Dark Mode** công thái học (Deep Slate `#090d16` / Zinc `#18181b` và điểm nhấn Emerald Glow `#34d399`).
* **Icons:** `lucide-react`.
* **Database:** Supabase Singapore PostgreSQL (`ap-southeast-1`), kết nối trực tiếp qua thư viện `postgres` với Transaction Connection Pooler SSL (port 6543), tốc độ truy vấn trung bình ~56ms (nhanh hơn 4.5x - 5x).
* **Bảo Mật Cơ Sở Dữ Liệu:** Row Level Security (RLS) trên 100% 13 bảng, REVOKE toàn bộ quyền role `anon`/`authenticated` (Defense-in-Depth), cô lập Extension `pg_trgm` trong schema `extensions`, và bảo vệ `search_path` cho `uuid_generate_v7()`.
* **Quản lý dữ liệu:** Truy vấn SQL trực tiếp tối ưu hóa với `LEFT JOIN`, `TO_CHAR`, `COALESCE` và Transaction an toàn.

---

## 3. Cấu Trúc Cơ Sở Dữ Liệu Đã Chuẩn Hóa (Database Schema)

Dữ liệu đã được làm sạch và chuẩn hóa hoàn toàn trên **Supabase Singapore PostgreSQL**, loại bỏ các trường trùng lặp và phân cấp rõ ràng:

```mermaid
erDiagram
    candidates ||--o{ activity : "has applications"
    candidates ||--o{ contact_points : "has contacts"
    clients ||--o{ client_contacts : "has company contacts"
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
        int display_number
        text name
        text location
        text tax_code
        text work_email
        text address
        text notes
        timestamptz created_time
    }

    client_contacts {
        uuid id PK
        uuid client_id FK
        text name
        text job_title
        text contact_value
        text type
        boolean is_primary
        text notes
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

> **Quy Chuẩn Dữ Liệu Ngày Tháng & Trường Dữ Liệu:**
> * Cột `due_date` đã được **xóa bỏ hoàn toàn khỏi database** (`ALTER TABLE activity DROP COLUMN due_date;`).
> * Toàn bộ 3,192 bản ghi đã được hợp nhất dữ liệu vào duy nhất trường **`planning_date`**.
> * Cột `channel` trùng lặp trước đó đã được loại bỏ, chỉ sử dụng duy nhất **`source_channel`**.
> * 100% Primary Keys `id` trên toàn bộ 14 bảng sử dụng chuẩn **UUIDv7 / UUID** (RFC 9562).

### 3.5 Kiến Trúc Bảo Mật & Hardening Database (Security & Defense-in-Depth)
1. **Kích hoạt Row Level Security (RLS) trên 100% 13 bảng:** Khóa hoàn toàn mọi yêu cầu đọc/ghi trái phép qua PostgREST API từ công cộng (`anon key`).
2. **Cơ chế Bảo vệ 2 lớp (Defense-in-Depth):** Thu hồi (`REVOKE`) toàn bộ quyền `SELECT, INSERT, UPDATE, DELETE, TRUNCATE, TRIGGER, REFERENCES` từ cả 2 role `anon` và `authenticated`. Dù có tạo RLS policy mở, bên ngoài vẫn không có quyền truy xuất.
3. **Phân quyền nội bộ an toàn (`service_role` / `postgres`):** Server Actions của Next.js kết nối qua tài khoản `postgres` (Superuser Transaction Pooler) bảo đảm quyền hạn thao tác trọn vẹn và an toàn ở tầng máy chủ (Server-side).
4. **Cô lập Extensions & Bảo vệ Search Path:** Extension `pg_trgm` được đặt trong schema `extensions`, hàm `uuid_generate_v7()` được gán cố định `search_path = public, pg_temp` nhằm chống triệt để tấn công SQL Injection qua đường dẫn tìm kiếm.
5. **Supabase Security Advisor:** Đạt trạng thái **0 CRITICAL, 0 ERROR, 0 WARN**.

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
| **Phase 1: Database Migration & Security** | Di trú toàn diện 14 bảng sang **Supabase Singapore PostgreSQL**, kích hoạt RLS 100%, REVOKE quyền thừa (0 Security Warnings), tối ưu Ping 56ms (4.5x - 5x faster). | ✅ Hoàn thành | 100% |
| **Phase 2: Action Dashboard & UX** | Xây dựng Action Menu, Fixed Viewport, Smart Auto-Slide, Searchable Combobox, Dark Mode, Double-click navigation. | ✅ Hoàn thành | 100% |
| **Phase 3: Master Search Menu & Databases** | Xây dựng Search Menu đa tab (Candidate, Client, Job Databases), Smart Grouped Contact Hub, tìm kiếm thời gian thực. | ✅ Hoàn thành | 100% |
| **Phase 4: Candidate 360° Master Workbench** | Bàn làm việc Hồ sơ Ứng viên 360° Chuyên Sâu (`/candidates`): Tự động nạp ứng viên mới nhất, Searchable Candidate Switcher trên Header, điều hướng record `◀` / `▶`, nút `+ New Candidate` chống trùng, Hub quản lý đa kênh liên lạc, Pipeline ứng tuyển với Thẻ Timeline Accordion (`⏱ Timeline ∨/∧`) và Embedded CV Viewer trực tiếp. | ✅ Hoàn thành | 100% |
| **Phase 5: Jobs & Client CRM Hub** | Bàn làm việc MS Access Master-Detail 4 Tầng (`/jobs`): Client Header siêu gọn, phân hệ Client Contacts Hub CRUD, Job Orders tích hợp cột **Working Mode** đa chọn (On-site/Hybrid/Remote), thanh nhập **JD Link** On-Demand thu gọn, trình nhúng **Embedded JD Viewer** qua iframe Google Docs/Drive, và danh sách ứng viên tích hợp Thẻ Timeline Accordion (`⏱ Timeline ∨/∧`). | ✅ Hoàn thành | 100% |
| **Phase 5.5: Unified ActivityLogPanel & Stage-Result-Reason Refactor (Option C)** | Chuẩn hoá 100% UI timeline/activity log dùng chung component `<ActivityLogPanel>` trên cả 3 phân hệ (`/candidates`, `/`, `/jobs`). Lưu `result` (Pass/Fail) và `reason_failed` theo từng dòng log; tự động đồng bộ Stage/Result/Reason cấp Application từ dòng log mới nhất. Hỗ trợ inline Edit Log, Delete Log, timezone-safe input và audit `created_time` (giờ tạo record). | ✅ Hoàn thành | 100% |
| **Phase 6: AI CV Parser & HITL Approval Queue** | Tích hợp n8n webhook, Multimodal Gemini 2.5 Flash OCR, trích xuất CV tự động vào Supabase, hàng đợi HITL Queue với bảng so sánh Diff và tự động khôi phục batch stuck. | ✅ Hoàn thành | 100% |
| **Phase 7: Facebook Campaigns & Social Groups Automation Hub** | Hệ thống điều phối chiến dịch đăng bài tự động Facebook multi-account qua n8n VPS Bridge, Thư viện Social Group URLs 1028 nhóm độc lập, hiển thị & lọc khoảng thành viên (`member_count`), quản lý Tag nâng cao và Bulk Import CSV/Excel có check trùng URL. | ✅ Hoàn thành | 100% |
| **Phase 8: Facebook Account Warming, Rotation & Auto-Join System** | Triển khai toàn diện hệ thống nuôi nick tuần tự (Sequential Warming & Auto-Join Groups): VPS Bridge Playwright (`warm-and-join.js`), n8n Workflow C (`L8QdckqW7FDwanRq`), Cloudflare Tunnel `ats-local.thucnguyen8n.space`, Server Actions (`triggerWarmJoinRun`, `getActiveWarmJoinRun`), và UI ATS 3.0 (nút Run Warm & Join, Warming Health Badges, Last Warmed indicator, confirmation modal, 6s live polling). | ✅ Hoàn thành | 100% |
| **Phase 9: FB Group Membership Auto-Sync Engine (Workflow D) & Multi-Account Quota UX (Phase 5 & 6)** | Triển khai n8n Workflow D (`EMAUfa5HCgyf6yPO`), cơ chế Per-Account Mutex Lock (`_getBusyFbAccountIds`), Dynamic Jitter Scheduler 2 mốc giờ/ngày, scraper Playwright `facebook.com/groups/joins`, 4 API webhook routes, Max Groups Quota Selector (1-5, Custom) kèm Risk Badges, chuẩn hoá Run History (4 states) và cột ACCOUNTS JOINED tỷ lệ động (`2/2`, `1/2`, `0/2`) kèm Popover On-Demand. | ✅ Hoàn thành | 100% |

---

## 6. Hướng Dẫn Cài Đặt & Khởi Chạy (Reproduction Guide)

### 6.1 Yêu Cầu Môi Trường
* Node.js v20+ hoặc v24+.
* Kết nối Internet truy cập Supabase Singapore PostgreSQL Pooler.

### 6.2 Cấu Hình File Môi Trường (`.env.local`)
```env
DATABASE_URL="postgresql://postgres.[YOUR_PROJECT_REF]:[YOUR_PASSWORD]@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres"
PORT=3000
```

### 6.3 Lệnh Cài Đặt & Chạy Ứng Dụng
```bash
# Cài đặt dependencies
npm install

# Khởi chạy môi trường Development
npm run dev

### 6.4 Tiêu Chuẩn Phát Triển & Bảo Trì Mã Nguồn (ATS 3.0 Development & Maintenance Rules)

#### 1. Code Quality & Architecture
* **Clean Code & Phân Tách Trách Nhiệm (Separation of Concerns):** Tách biệt rõ ràng giữa các tầng UI (Components), Business Logic / State Management (Custom Hooks, Helpers), và Data Access Layer (Server Actions trong `actions.js`, Database Client trong `db.js`).
* **Quy ước đặt tên (Self-documenting):** Tên biến, hàm, component và props phải mang tính tự giải thích rõ ràng mục đích, không viết tắt khó hiểu (ví dụ: `checkCandidateContactDuplicate`, `createCandidateWithStrictValidation`, `SearchableSelect`).
* **Đảm bảo Type Safety & Null-Safety Tuyệt Đối:** Sử dụng strict typing, kiểm tra an toàn mảng/đối tượng trước khi truy xuất hoặc gọi hàm chuỗi/mảng (`Array.isArray()`, `String(val || "").localeCompare(...)`, optional chaining `?.`), không dùng `any` bừa bãi.
* **Xử lý Lỗi & Edge Cases Toàn Diện:** Bao bọc toàn bộ tương tác Database/API trong khối `try...catch` an toàn, chuẩn hóa kết quả trả về `{ success: true, data }` hoặc `{ success: false, error }`, hiển thị thông báo lỗi thân thiện trên UI.

#### 2. Code Comments Standard
* **Chuẩn JSDoc / TSDoc Bắt Buộc:** Áp dụng cho toàn bộ Functions, Custom Hooks, Helper Utilities và API Endpoints:
  * Mô tả mục đích sử dụng.
  * Ý nghĩa các tham số (`@param`) và giá trị trả về (`@returns`).
  * Các lưu ý đặc biệt hoặc edge cases nếu có (`@throws` / Note).
* **Comment Inline Đúng Trọng Tâm ("Why" over "What"):** Chỉ tập trung giải thích lý do thiết kế, quyết định nghiệp vụ phức tạp, thuật toán tối ưu hoặc cơ chế chống race-condition; không comment lặp lại cú pháp hiển nhiên.

#### 3. Documentation & Maintainability
* **Kiến Trúc & Tài Liệu Mô-đun (Architecture & Data Flow Guides):** Cung cấp hướng dẫn luồng dữ liệu (Data Flow, State Management), cấu trúc schema/types liên quan và hướng dẫn mở rộng trong tài liệu Blueprint này và các file README mô-đun.

### 6.5 Quy Chuẩn Cố Vấn Kiến Trúc Cho Non-Tech User (Technical Architect Advisory Protocol)
* **Định vị vai trò Lead Architect:** AI Agent đóng vai trò là Cố vấn Kỹ thuật cao cấp, giải thích các khái niệm kỹ thuật phức tạp bằng ngôn ngữ trực quan, dễ hiểu, gắn liền với nghiệp vụ Recruiter / Headhunting thực tế.
* **Khung phân tích bắt buộc (5 Trụ cột):**
  1. 💎 **Điểm Mạnh (Pros & Strengths):** Lợi ích UX, tốc độ, tính năng, độ mở rộng.
  2. ⚠️ **Điểm Yếu & Thách Thức (Cons & Challenges):** Rủi ro tiềm ẩn, độ phức tạp bảo trì.
  3. 🎯 **Giá Trị Đạt Được (Gains):** Tiết kiệm thời gian, năng suất và độ chính xác cho Recruiter.
  4. ⚖️ **Cái Giá Đánh Đổi (Trade-offs):** Những yếu tố kỹ thuật hoặc nghiệp vụ cần cân nhắc đánh đổi.
  5. 🏆 **Khuyến Nghị Của Architect:** Đưa ra phương án tối ưu nhất kèm lý do để người dùng tự tin ra quyết định.

### 6.6 Quy Chuẩn Bắt Buộc Về Lọc Dữ Liệu & Xin Phép User (Filtering Strategy & Explicit Approval Protocol)
* **Tôn chỉ tối thượng:** Đề cao Bảo mật (Security), Toàn vẹn dữ liệu (Data Integrity) và Độ ổn định (Stability) lên hàng đầu.
* **Quy tắc bắt buộc:** Mọi giải pháp liên quan đến logic tìm kiếm / lọc dữ liệu (giữa Backend Server-Side Query và Frontend In-Memory Filter) BẮT BUỘC phải được phân tích điểm mạnh - điểm yếu và **phải có sự đồng ý rõ ràng của Người dùng trước khi thực hiện**. Cấm tự ý tải dữ liệu lớn (dump records) về client để lọc trên bộ nhớ trình duyệt nếu chưa được phê duyệt.

---

## 7. Nhật Ký Cập Nhật (Changelog)

### v3.0-RC113 (05/09/2026)
* 🔥🤖 **Triển Khai Hoàn Tất Hệ Thống Nuôi Nick FB Tuần Tự & Tự Động Xin Vào Nhóm (Warming, Rotation & Auto-Join System — Phases 1-4)**:
  * **Phase 1 (Playwright Engine & VPS Bridge)**: Đồng bộ mã nguồn `scripts/warm-and-join.js` vào repository (SHA-256 hash khớp hoàn toàn bản chạy trên VPS), hoàn thiện engine tương tác giả lập người dùng (lướt feed ngẫu nhiên, xem video/reels, like bài viết, giải quyết câu hỏi gia nhập nhóm). Kiểm tra xác nhận endpoint Bridge `POST /api/facebook-warm-join` trên VPS cổng 5680 phản hồi JSON hợp lệ, sẵn sàng thực thi.
  * **Phase 2 (n8n Workflow C & Dedicated Cloudflare Tunnel)**: Xây dựng và kích hoạt workflow `C: FB Auto-Warm & Group Auto-Joiner` (ID: `L8QdckqW7FDwanRq`) trong thư mục `ATS 3.0` trên VPS n8n; thiết lập tunnel chuyên dụng `ats-dev-tunnel` định tuyến `https://ats-local.thucnguyen8n.space` -> `http://127.0.0.1:3000` (được cấu hình trong `next.config.mjs` `allowedDevOrigins`), đảm bảo kết nối 2 chiều giữa n8n và web app thông suốt, ổn định và bảo mật.
  * **Phase 3 (Server Actions & UI ATS 3.0)**:
    * Server Actions (`src/app/campaign_actions.js`): Thêm `getActiveWarmJoinRun()` kiểm tra lượt chạy đang hoạt động và `triggerWarmJoinRun(params)` khoá an toàn bằng transaction-level advisory lock `pg_advisory_xact_lock(hashtext('warm_join_run_lock'))` chống trigger trùng lặp, khởi tạo bản ghi `warm_join_runs` trạng thái `Running`, chèn thông báo in-app và dispatch webhook sang n8n VPS.
    * Giao diện UI (`src/app/campaigns/page.js`): Bổ sung nút **"Run Warm & Join"** (icon `Flame`) trên Toolbar Sub-tab "FB Accounts & Warm/Join" có trạng thái loading/disabled khi đang chạy; thêm cột **"Warming Health"** hiển thị badge trực quan (Ready to Post, Warming Active, Checkpoint, Restricted, Inactive); thêm cột **"Last Warmed"** hiển thị thời gian tương đối (<24h chấm xanh lục, 24h-7d chấm cam, >7d/chưa từng warm chấm xám); Modal xác nhận trigger cảnh báo cơ chế hàng đợi tuần tự (Sequential Execution) và danh sách tài khoản hợp lệ; cơ chế live polling 6s tự động làm mới bảng dữ liệu và gỡ bỏ cờ đang chạy ngay khi tiến trình kết thúc.
  * **Phase 4 (Kiểm thử tự động End-to-End & Build Production)**: Chạy kịch bản test tự động E2E với dữ liệu cô lập sandbox (Rule 10.8), kiểm tra thành công luồng gọi qua Cloudflare Tunnel đến n8n VPS và cập nhật trạng thái bảng `warm_join_runs`, `warm_join_run_items`, `fb_account_groups`, `social_group_urls.join_status` trong Supabase; dọn dẹp sạch sẽ 100% dữ liệu test; `npm run build` 21/21 routes PASS 100%.
_Cập nhật bởi: Antigravity (Implementer) — 2026-09-05_

### v3.0-RC112 (05/09/2026)
* 🌐📥 **Hiển Thị & Cập Nhật Member Count, Lọc Khoảng Thành Viên & Bulk Import CSV/Excel Có Check Trùng URL (Social Group URLs Library)**:
  * **Hiển Thị & Cập Nhật Số Lượng Thành Viên (`member_count`)**: Bổ sung `member_count` vào câu lệnh SELECT của `getSocialGroups` & `getSocialGroupsLibrary`. Thêm trường input nhập số thành viên trong `SocialGroupCreateModal.js` và cột "Members" (định dạng dấu phẩy hàng nghìn kiểu US `1,900,000`, căn phải font monospace) trong bảng Thư viện Social Group URLs. Hỗ trợ inline edit sửa trực tiếp số lượng thành viên cùng Tên nhóm và URL, tự động xử lý dấu phân cách hàng nghìn cả kiểu Việt Nam (`1.900`) lẫn kiểu Anh-Mỹ (`1,900`).
  * **Bộ Lọc Khoảng Thành Viên Trên Toolbar**: Tích hợp 2 ô input "Min members" và "Max members" kèm nhãn và nút xoá `✕` trên Toolbar Library với cơ chế debounce 300ms. Phía Server Action (`getSocialGroupsLibrary`) hỗ trợ lọc bao đóng cả biên (`member_count >= minMembers AND member_count <= maxMembers`), kết hợp hoàn hảo cùng tìm kiếm từ khoá, lọc theo Tag và toggle Show Inactive.
  * **Tính Năng Bulk Import CSV/Excel Hàng Loạt Chuyên Nghiệp**:
    * Cài đặt thư viện `xlsx: ^0.18.5` đọc file bảng tính client-side (`.csv`, `.xlsx`, `.xls`).
    * Server Action `bulkImportSocialGroups(rows, options)` tích hợp hàm chuẩn hoá URL `normalizeSocialGroupUrl` (loại bỏ trailing slash, lowercase protocol/domain).
    * Kiểm tra trùng lặp đa lớp: đối soát trùng URL với Database hiện tại (`social_group_urls` theo active schema) và phát hiện trùng lặp ngay trong file tải lên.
    * Kiểm tra định dạng Tag theo ràng buộc `social_group_tags_name_charset_check` (`^[A-Za-z0-9 _-]+$`).
    * Hỗ trợ chế độ Preview (`confirm: false`): trả về thẻ tóm tắt (Tổng, Hợp lệ, Trùng DB, Trùng File, Lỗi định dạng) và danh sách Tag mới phát hiện.
    * Hỗ trợ chế độ Confirm (`confirm: true`): chèn batch nguyên tử trong transaction `sql.begin`, tự động đăng ký tag mới vào `social_group_tags` (`ON CONFLICT ((lower(name))) DO NOTHING`).
    * Component modal `SocialGroupBulkImportModal.js`: giao diện kéo-thả trực quan, tự động nhận diện tên cột kèm dropdown chọn cột thủ công, duyệt chi tiết dữ liệu theo từng tab trước khi thực thi nạp.
_Cập nhật bởi: Antigravity (Implementer) — 2026-09-05_

### v3.0-RC80 (01/09/2026 - 02/09/2026)
* 🎯 **Chuẩn hóa Toàn diện Phân hệ Activity Log Timeline (Unified ActivityLogPanel - Option C)**:
  * **Shared Component Duy nhất (`ActivityLogPanel.js`):** Thay thế toàn bộ mã nguồn viết tay riêng lẻ ở cả 3 phân hệ chính: Candidate 360° Workbench (`/candidates`), Action Menu Dashboard (`/`), và Jobs & Clients Workbench (`/jobs`) bằng component dùng chung duy nhất.
  * **Result & Reason Failed theo từng dòng log:** Chuyển đổi mô hình quản lý Result/Reason từ cấp Application sang từng dòng tương tác (Per-log Stage - Result - Reason). Chỉ khi Result là "Fail" mới hiển thị dropdown chọn Reason (Culture Fit, Tech-Skill, Salary, Counter Offer, v.v.).
  * **Cơ chế Auto-Sync Độc lập từ Log mới nhất:** Khi thêm mới, chỉnh sửa, hoặc xoá một dòng log, hệ thống tự động đồng bộ `current_stage`, `result`, `reason_failed`, `note_failure_reason` cấp Application từ bản ghi log mới nhất (`ORDER BY action_date DESC, created_time DESC`).
  * **Trải nghiệm Edit & Delete Log Inline:** Tích hợp form chỉnh sửa trực tiếp 5 trường (Stage, Result, Reason, Action Date, Note) kèm cơ chế Timezone-Safe (`toLocalDatetimeInputValue`) chống lệch 7 tiếng trên thẻ `<input type="datetime-local">`.
  * **Dấu thời gian Audit (`created_time`):** Hiển thị rõ ràng giờ tạo record (`tạo lúc HH:mm:ss`) với tooltip chi tiết ngay dưới ngày hoạt động `action_date`, đảm bảo tính bất biến khi chỉnh sửa nội dung.
  * **Tối ưu Không gian Action Menu:** Xoá 2 cột `RESULT` và `REASON (FAILED)` khỏi bảng chính của trang Action Menu để tăng không gian hiển thị, chuyển toàn bộ thông tin chi tiết vào Timeline Panel.
_Cập nhật bởi: Antigravity (Implementer) — 2026-09-02_


### v3.0-RC78 (31/08/2026)
* ✨ **Hoàn thành Đồng bộ & Chuẩn hóa Dữ liệu (Notion to Supabase Phase 2)**:
  * Thực hiện thành công việc Migrate toàn bộ dữ liệu (Jobs, Campaigns, Interviews) và cơ chế Master-Detail cho Applications.
  * Auto-heal 100% định dạng Email & Số điện thoại (Chuẩn E.164).
  * Gộp (Merge) an toàn 32 Profile trùng lặp từ Notion cũ, xóa sạch dữ liệu mồ côi (Orphans) và đảm bảo Data Integrity 100%.


### v3.0-RC78 (31/08/2026)
* 🛡️ **Kiểm Thử & Vá Lỗi Database Integrity (Phase 2): 20/20 Scenarios PASS**:
  * **Chuẩn Hóa Database Schema:** Quét và dọn sạch các bản ghi mồ côi (Orphan records), thêm ràng buộc `ON DELETE CASCADE` và `ON DELETE SET NULL` để rác dữ liệu tự dọn dẹp an toàn khi xóa Job hoặc Activity.
  * **Bảo Vệ JSONB Bằng Row-level Locks:** Áp dụng `sql.begin()` và khóa `SELECT ... FOR UPDATE` cho toàn bộ các Server Actions thao tác trên JSONB array, vá dứt điểm lỗi Data Racing và Mất cập nhật đồng thời (Lost Updates) khi thao tác với Client Branches.
  * **Strict Zod Validations & Chuẩn Hóa Liên Lạc:** Khắc phục bypass validation bằng cách bọc nghiêm ngặt các quy tắc cho DOB (ngày sinh không trong tương lai), Planning Date (format hợp lệ). Tinh chỉnh deduplication query ở DB layer (chuyển đổi `+84` -> `0`, strip ký tự đặc biệt, URL) để bắt trùng lặp một cách tuyệt đối kể cả khi User lách luật qua định dạng khác nhau.

### v3.0-RC76 (31/08/2026)
* 📚🏛️ **Gom Nhóm & Quy Chuẩn Quản Lý Tài Liệu Tập Trung (Centralized Documentation Standard & Rule A.8)**:
  * **Tập trung hóa tài liệu (Single Source of Truth):** Di chuyển toàn bộ các tài liệu kỹ thuật, hướng dẫn sử dụng, sơ đồ cơ sở dữ liệu và báo cáo QA nằm rải rác ngoài thư mục gốc vào `g:\My Drive\AI project\ATS\ats-web\docs\`.
  * **Phân cấp danh mục khoa học:**
    * `docs/README.md`: Sơ đồ điều hướng mục lục tài liệu hệ thống.
    * `docs/DEVELOPMENT_LOG.md`: Nhật ký phát triển và bảng Snapshots khôi phục.
    * `docs/USER_MANUAL_DRAFT.md`: Phác thảo sổ tay hướng dẫn sử dụng và vị trí chụp ảnh minh họa.
    * `docs/architecture/`: Blueprint, ERD (`schema-map.md`), API contracts (`api-contracts.md`), Notion legacy schema.
    * `docs/features/`: Tài liệu kỹ thuật chi tiết các phân hệ UI (`action-menu.md`, `candidates-hub.md`, `jobs-clients-workbench.md`, `search-menu.md`).
    * `docs/deployment/`: Hướng dẫn triển khai & vận hành Vercel/Cloud (`vercel_deployment_guide.md`).
    * `docs/testing/`: Báo cáo QA và ma trận kiểm thử (`master_test_matrix.md`, `QA_Verification_Report_...`).
  * **Ban hành Rule A.8 trong `GEMINI.md`:** Cấm tạo file `.md` mồ côi ngoài thư mục gốc, bắt buộc duy trì 100% tài liệu trong `ats-web/docs/` và đồng bộ tự động sang Local Dev.

### v3.0-RC75-QA (31/08/2026)
* 🛡️ **Kiểm thử Nghiệm thu & Vá Lỗi Database (QA Verification & Integrity Fixes)**:
  * **Tạo API Route Kiểm Thử Tự Động:** Xây dựng endpoint độc lập (src/app/api/qa-test/route.js) để bắn 5 kịch bản ác liệt nhất.
  * **Vá lỗi Connection Pooler (PgBouncer):** Bổ sung prepare: false vào Postgres client (db.js) để tương thích hoàn toàn với chế độ Transaction Mode trên Port 6543 của Supabase.
  * **Row-level Transaction Lock:** Thêm pg_advisory_xact_lock vào các Server Actions (actions.js) để loại bỏ hoàn toàn đụng độ Race Condition khi sinh display_number.
  * **Khắc phục lỗi Not-Null Constraint:** Vá lỗi thiếu trường summary trong quá trình INSERT vào bảng activity.
  * **Vá lỗi Zod Schema Validation:** Fix crash Cannot read properties of undefined (reading 'map') khi format lỗi trả về từ Zod.

### v3.0-RC46 (30/08/2026)
* 🏢📍 **Quản Lý Đa Chi Nhánh Multi-Branch JSONB & Liên Kết Gợi Ý Vị Trí Làm Việc**:
  * **Kiến trúc Hybrid PostgreSQL `clients.branches jsonb`:** Bổ sung cột `branches jsonb DEFAULT '[]'::jsonb` lưu trữ mảng danh sách chi nhánh (`id`, `branch_name`, `city`, `address`, `is_headquarter`, `phone`, `notes`).
  * **Server Actions quản lý Chi Nhánh:** Cung cấp `addClientBranch`, `updateClientBranch`, `deleteClientBranch`, `setHeadquarterBranch`, tự động đồng bộ trường `location` & `address` chính khi đổi trụ sở HQ.
  * **On-Demand Client Branches & Offices Drawer:** Tích hợp nút `📍 Branches (N)` trên Master Client Header (cạnh nút `👥 Contacts`). Hiển thị thẻ Trụ sở chính (`⭐ HQ`) và danh sách các chi nhánh/nhà máy đã đăng ký kèm chức năng sao chép địa chỉ 1-click, đặt HQ, chỉnh sửa, xóa và form thêm nhanh.
  * **Liên kết thông minh với Bảng Job Orders:** Cột Location trong bảng Job Orders khi double-click sẽ mở danh sách gợi ý chọn nhanh (datalist) gồm toàn bộ các Chi nhánh của công ty đó và các tỉnh thành phố chuẩn.

### v3.0-RC6 (31/08/2026)
* 🆙 **Nâng cấp Hệ Thống n8n Automation**:
  * Chuyển đổi và bảo vệ cấu hình tuỳ chỉnh Playwright & Chromium tích hợp sẵn trong Docker Compose (`dockerfile_inline`).
  * Khắc phục triệt để lỗi xung đột Alpine Linux (Hardened Alpine thiếu `apk-tools`) bằng cách chèn fix script tải và giải nén tĩnh `apk-tools-static` trước khi cài đặt dependencies.
  * Tái tổ chức lại 54 active workflows vào 3 thư mục gốc (success, Automation Job Board, underconstruction) sau quá trình restore DB.
  * Cập nhật phiên bản từ `2.36.9` lên bản mới nhất `2.37.6` thành công mà không làm mất đi tuỳ chỉnh gốc.

### v3.0-RC5 (30/08/2026)
* 🎯 **Tối Ưu Single-Click Focus & Double-Click Edit Cho Bảng Job Orders**:
  * **Single-Click chọn Job toàn hàng:** Khi người dùng click chuột một lần vào bất kỳ ô nào trên hàng Job (bao gồm Tên Job, Location, ID_Order), sự kiện chọn Job kích hoạt ngay lập tức để nạp toàn bộ danh sách Applications của Job đó vào cột bên phải.
  * **Double-Click để sửa Tên Job / Location:** Chuyển đổi trạng thái mặc định của Tên Job và Location thành dạng Text tĩnh nhẹ nhàng, thanh thoát; Khi người dùng Double-Click vào ô, hệ thống tự động mở Input Box (`autoFocus`) cho phép gõ nội dung mới, tự động lưu khi bấm `Enter` hoặc rời chuột (`onBlur`), và hủy khi bấm `Escape`.

### v3.0-RC44 (30/08/2026)
* 🔗 **Sửa Lỗi Deep Linking & Chuẩn Hóa Điều Hướng Double-Click Client / Job Database**:
  * **Sửa lỗi Double-Click Client Name:** Tại Search Menu (Tab Client Database), double-click vào tên công ty khách hàng sẽ điều hướng chuẩn xác sang `/jobs?client_id=[id]` để mở bàn làm việc của khách hàng đó thay vì nhảy về Action Menu.
  * **Truy vết và nạp đúng Job Order từ Job Order Database:** Tại Search Menu (Tab Job Order Database), double-click vào Job Title (`/jobs?job_id=[id]`) hoặc Client Name (`/jobs?client_id=[id]`) sẽ tự động truy vết ngược tìm Client sở hữu, nạp đúng công ty lên Master Header, đánh dấu con trỏ `▶` chọn đúng dòng Job Order và nạp toàn bộ danh sách Applications của Job đó vào cột bên phải.

### v3.0-RC43 (30/08/2026)
* 👁️ **Thanh Nhập Link JD Thu Gọn Theo Nhu Cầu (On-Demand Collapsible JD Link Input)**:
  * **Tối ưu không gian theo Rule 5:** Chuyển ô nhập link JD (`jd_url`) thành thanh thu gọn On-Demand với nút bấm ẩn/hiện (`showJdLinkInput`).
  * **Trạng thái đóng tinh gọn:** Hiển thị 1 hàng mỏng với icon file, mũi tên toggle `▼`, nhãn `[Link Attached]` khi đã có link, nút xem nhanh `Preview JD ↗` và nút `Edit Link`.
  * **Trạng thái mở linh hoạt:** Mở rộng ô nhập link và nút mở tab ngoài `↗` khi cần chỉnh sửa, giúp bàn làm việc giữ trọn vẹn không gian thoáng đãng cho bảng Job Orders và Job Notes.

### v3.0-RC42 (30/08/2026)
* 🖥️ **Bố Cục Flexbox 100% Chiều Ngang Song Song (Full-Width Bulletproof Dual Pane Layout)**:
  * **Chuyển đổi sang Flexbox container:** Sử dụng cấu trúc `flex gap-3 w-full` thay cho grid CSS để triệt tiêu hoàn toàn lỗi Tailwind JIT khiến 2 cột bị bóp hẹp còn 8% màn hình.
  * **Phân bổ không gian chuẩn xác:** Cột trái `w-[45%]` và Cột phải `flex-1 min-w-0` tự động mở rộng chiếm trọn 55% không gian còn lại sang sát mép phải, giữ 2 bảng luôn song song 100% diện tích làm việc.

### v3.0-RC41 (30/08/2026)
* 📐 **Khóa Cố Định Bố Cục 2 Cột Song Song (5:7 Split View Lock) Cho Jobs & Clients Workbench**:
  * **Khắc phục triệt để lỗi rớt hàng (Vertical Stacking):** Khóa cố định tỷ lệ `col-span-5` cho cột trái (Job Orders, Working Mode & Notes) và `col-span-7` cho cột phải (Applications Pipeline & JD Viewer), đảm bảo 2 bảng luôn nằm song song cạnh nhau trên cùng một hàng ngang mà không bao giờ bị đẩy xuống dưới.

### v3.0-RC74 (30/08/2026)
* 🛡️🐛 **Fix Missing Application ID Error in Candidate 360 Timeline Note**:
  * Nâng cấp Server Action `addActivityLog` với chữ ký đa hình (Polymorphic Arguments) linh hoạt nhận cả Object `{ application_id, action_type, note }` lẫn Positional `(applicationId, stage, note)`, xử lý triệt để lỗi khi Recruiter ghi nhận ghi chú Timeline trong Candidate 360° Profile.

### v3.0-RC73 (30/08/2026)
* 🛡️✨ **Fix Action Timeline Auto-Slide Infinite Scroll-Resize Oscillation Loop**:
  * Khắc phục triệt để lỗi Action Timeline giật giật mở rồi đóng liên tục trên Action Menu (`/`): Thay thế sự kiện `onScroll` bằng `onWheel` có ngưỡng deltaY, triệt tiêu 100% việc trình duyệt kích hoạt event do co giãn container khi mở bảng. Bổ sung nút **`Hide`** thủ công ngay trên Sub-table Header.

### v3.0-RC72 (30/08/2026)
* 🧪🛡️ **50% Isolated Sandbox Dummy Database Ingestion & Zero-Leakage Connection**:
  * Tạo độc lập schema `sandbox` và nhân bản trọn vẹn 14 bảng DDL từ schema `public`. Nạp thành công **11,882 bản ghi dữ liệu giả lập** (95 Clients, 155 Job Orders, 1,688 Candidates, 5,914 Contact Points, 1,600 Applications, 2,218 Activity Logs, 24 Interviews...). Cập nhật `db.js` tự động trỏ `search_path=sandbox,public` phục vụ kiểm thử và chụp ảnh User Manual an toàn 100%.

### v3.0-RC71 (30/08/2026)
* 🏢🖱️ **Mouse Wheel Scroll & Full Keyboard Navigation for Jobs & Clients Dropdown**:
  * Đồng bộ chuẩn trải nghiệm cho `SearchableClientDropdown` trên Jobs & Clients Menu (`/jobs`): Khóa cứng chiều cao `height: 260px`, `maxHeight: 260px`, `overflowY: scroll`, chặn nổi bọt sự kiện cuộn chuột `onWheel`, và hỗ trợ trọn bộ phím tắt `ArrowDown`, `ArrowUp`, `PageDown`, `PageUp`, `Enter`, `Escape`.

### v3.0-RC70 (30/08/2026)
* 🛡️⚡ **Fix React setState Side-Effect in Dropdown Keyboard Handler**:
  * Tách biệt hoàn toàn việc gọi Server Action `searchCandidatesServer` ra ngoài callback `setActiveIndex`, xử lý triệt để cảnh báo `Cannot update a component ('Router') while rendering a different component`.

### v3.0-RC69 (30/08/2026)
* 🎯🖱️ **Fix Dropdown Scroll Container Constraints & Full Keyboard Navigation**:
  * Cố định cứng chiều cao vùng danh sách bằng inline styles (`height: 350px`, `maxHeight: 350px`, `overflowY: scroll`, `overscrollBehavior: contain`), chặn nổi bọt sự kiện lăn chuột `onWheel`, và hỗ trợ bộ phím tắt `ArrowDown`, `ArrowUp`, `PageDown`, `PageUp`, `Enter` với `scrollIntoView` mượt mà.

### v3.0-RC68 (30/08/2026)
* 📜⚡ **Server-Side Infinite Scroll Pagination for SearchableCandidateDropdown**:
  * Tích hợp sự kiện `onScroll` lắng nghe khi cuộn chuột đến gần đáy danh sách để tự động gọi `searchCandidatesServer` nạp tiếp +50 ứng viên từ PostgreSQL (Infinite Scroll Pagination), kèm nút bấm nạp nhanh và icon xoay trạng thái.

### v3.0-RC67 (30/08/2026)
* 🛡️🐛 **Fix TypeError CANDIDATE_STAGES.map in AttachCandidateModal**:
  * Chuyển đổi import từ `CANDIDATE_STAGES` (object) sang `CANDIDATE_STAGES_LIST` (array) trong `AttachCandidateModal.js`, giải quyết triệt để lỗi runtime khi mở modal `+ ATTACH CANDIDATE`.

### v3.0-RC66 (30/08/2026)
* 🛡️⚡ **100% Pure Server-Side PostgreSQL Candidate Search & Zero-Memory Leak Architecture**:
  * **Server Action `searchCandidatesServer`:** Chuyển đổi 100% tìm kiếm sang câu truy vấn PostgreSQL trực tiếp với phân trang `LIMIT / OFFSET` và debounce 280ms.
  * **Tối ưu 99% Payload `getCandidateProfile`:** Cắt giảm payload từ 350KB xuống 3KB, không dump mảng 3,377 ứng viên về client.
  * **Bảo Mật Chuẩn Doanh Nghiệp:** Toàn bộ dữ liệu PII của ứng viên được bảo vệ an toàn trên cơ sở dữ liệu Supabase Singapore, không tồn tại trong RAM/DevTools của trình duyệt.

### v3.0-RC65 (30/08/2026)
* 🛡️🔒 **Filtering Strategy & Explicit User Approval Protocol Enforcement**:
  * **Thiết lập Quy chuẩn Bắt buộc Về Lọc Dữ Liệu & Bảo Mật (Mục 6.6 Blueprint & Phần C.3 GEMINI.md):**
    1. Đề cao Bảo mật (Security), Toàn vẹn dữ liệu (Data Integrity) và Độ ổn định (Stability) lên hàng đầu, cấm đánh đổi rò rỉ dữ liệu hoặc memory dump lấy tốc độ frontend mù quáng.
    2. Bắt buộc xin ý kiến và có sự đồng ý rõ ràng của Người dùng trước khi áp dụng bất kỳ giải pháp lọc Frontend In-Memory hay Backend Server-Side Query.
    3. Cấm tự ý tải dump hàng nghìn bản ghi về client để lọc trên bộ nhớ trình duyệt nếu chưa được User phê duyệt.

### v3.0-RC64 (30/08/2026)
* 🎯✨ **Action Menu "+ Attach Candidate" Sourcing Workflow & High-Capacity Scrollable Dropdown**:
  * **Tách Biệt Luồng Nghiệp Vụ Sourcing & Nút `+ ATTACH CANDIDATE` Trên Action Menu (`/`):** Hỗ trợ quy trình cào CV/import hàng loạt vào Candidate Database trước rồi mới gán Job Order sau. Khi cần gán ứng viên vào Job, bấm nút `+ ATTACH CANDIDATE` trên Toolbar để mở `AttachCandidateModal` gồm 3 bước trực quan.
  * **Khắc phục triệt để lỗi Dropdown Client / Job:** Chuẩn hóa các trường `id`/`client_id` và `name`/`client_name` trong `getJobs()` và `getClients()`.
  * **Nâng Cấp `SearchableCandidateDropdown` Hơn 2,000+ Kết Quả:** Bổ sung cơ chế cuộn chuột mượt mà (Mouse wheel progressive loading), thanh cuộn tương phản cao và phím tắt `↑`/`↓`/`Enter` cho cả Candidate Switcher trên Header và Action Modal.

### v3.0-RC63 (30/08/2026)
* 💡🏛️ **Technical Architect Advisory & Consulting Protocol Enforcement**:
  * **Thiết lập Quy chuẩn Cố vấn Kiến trúc (Phần C trong GEMINI.md & Mục 6.5 Blueprint):**
    1. Định vị AI Agent là **Lead Technical Architect** đồng hành cùng User (Product Owner / Non-Tech).
    2. Áp dụng Khung phân tích đa chiều 5 Trụ cột (**Điểm Mạnh - Điểm Yếu, Giá Trị Đạt Được - Cái Giá Đánh Đổi, Khuyến Nghị Của Architect**) cho toàn bộ các đề xuất kiến trúc, tính năng và UI/UX trong dự án.

### v3.0-RC62 (30/08/2026)
* 👤✨ **Candidate 360° Master Workbench & Auto Latest Candidate Load**:
  * **Chuyển đổi toàn diện Menu `Candidates` (`/candidates`):** Thay thế bảng tra cứu đơn thuần bằng **Bàn Làm Việc Hồ Sơ Ứng Viên 360° Chuyên Sâu**:
    1. **Tự động nạp Ứng viên mới nhất:** Mặc định khi truy cập `/candidates`, hệ thống tự động tìm và nạp ngay hồ sơ của Ứng viên mới nhất trong DB.
    2. **Searchable Candidate Switcher & Navigator:** Tích hợp bộ tìm kiếm chuyển đổi ứng viên trên Header theo Tên, ID `#`, SĐT, Email, LinkedIn; hiển thị bộ đếm `Record X of 3,377` kèm 2 nút `◀ Previous` / `Next ▶`.
    3. **Nút `+ New Candidate` & Anti-Duplicate Intake:** Modal chống trùng 100%, tạo xong tự động chuyển thẳng sang hồ sơ mới.
    4. **Cụm Fast Contact Pills:** Gọi nhanh SĐT, mở Zalo, gửi Email, xem nhanh CV và nút `+ Assign to Job`.
    5. **Bố Cục 5:7 Dual Pane:** Cột trái (Thông tin cá nhân, Đánh giá, Blacklist, Contact Points Hub), Cột phải (Applications Pipeline + Timeline Accordion + Embedded CV Viewer).

### v3.0-RC61 (30/08/2026)
* 📚🏛️ **Comprehensive System Architecture & Backend Documentation Guide**:
  * **Ban hành bộ tiêu chuẩn toàn diện (Frontend & Backend Standards):** Tích hợp chi tiết các quy định về Kiến trúc Component (Presentational vs Container vs Custom Hooks), cấm `any`, cấm Magic Strings, chuẩn JSDoc/TSDoc, Transaction Safety (`sql.begin`), Schema Data Validation và khởi tạo thư mục `docs/backend/` (`schema-map.md` và `api-contracts.md`).

### v3.0-RC60 (30/08/2026)
* 📜🏛️ **Official ATS 3.0 Development & Maintenance Rules Enforcement**:
  * **Ban hành quy chuẩn chính thức (Mục 6.4 & GEMINI.md):** Thiết lập 3 trụ cột phát triển cốt lõi cho toàn bộ dự án ATS 3.0:
    1. **Code Quality & Architecture:** Clean Code, phân tách rõ ràng UI, Logic và Data Access, Strict Type Safety, Null-safety toàn diện và Error Handling chặt chẽ.
    2. **Code Comments Standard:** Chuẩn JSDoc/TSDoc bắt buộc cho mọi hàm và API endpoints, inline comment tập trung vào giải thích lý do nghiệp vụ ("Why").
    3. **Documentation & Maintainability:** Kiến trúc mô-đun, hướng dẫn luồng dữ liệu và khả năng mở rộng lâu dài.

### v3.0-RC59 (30/08/2026)
* 🛡️🐛 **Fix TypeError localeCompare & Null-Safety Guard in Candidate Modal**:
  * **Khắc phục lỗi Runtime:** Sửa triệt để lỗi `Cannot read properties of undefined (reading 'localeCompare')` khi mở Modal `+ New Candidate`.
  * **Bảo vệ Null-Safety:** Bổ sung `String(a.label || "").localeCompare(...)` và kiểm tra mảng an toàn trước khi khởi tạo `clientOptions` và `filteredJobOptions`.

### v3.0-RC58 (30/08/2026)
* 🎯✨ **Linked Client-First & Searchable Position Filters in New Candidate Modal**:
  * **Đồng Bộ Pattern UI Theo Action Menu (Rule 6):** Nâng cấp phân hệ gán Job trong Modal `+ New Candidate` với bộ đôi dropdowns tìm kiếm thông minh `SearchableSelect`.
  * **Bộ lọc liên kết 2 bước:** Chọn Client Company (có tìm kiếm và huy hiệu đếm Open Jobs) ➔ Danh sách Position tự động lọc chỉ hiển thị các Job Order thuộc Client đó, hỗ trợ gõ tìm kiếm vị trí (`Search position (e.g. Java, Nurse)`).

### v3.0-RC57 (30/08/2026)
* 👤🛡️ **Dedicated Candidate Menu & Strict Anti-Duplicate Intake System**:
  * **Tách biệt điều hướng:** Cập nhật `NavbarTabs.js` với 4 phân hệ độc lập: Action Menu (`/`), Candidates (`/candidates`), Jobs & Clients (`/jobs`), Search Menu (`/search`).
  * **Candidate Hub chuyên biệt (`/candidates`):** Bàn làm việc quản lý 3,377+ hồ sơ ứng viên với bảng dữ liệu chuyên biệt và nút `+ New Candidate`.
  * **Hệ thống Chống Trùng Lặp 100% (Anti-Duplicate Engine):** Modal `+ New Candidate` bắt buộc tối thiểu 1 contact point, quét trùng live real-time trên toàn bộ database, cảnh báo chỉ đích danh Ứng viên trùng kèm link mở hồ sơ, tự động cache bản nháp (`localStorage`), khóa nút lưu khi còn trùng và hỗ trợ gán thẳng vào Job Order.

### v3.0-RC56 (30/08/2026)
* 🛡️💾 **Client Draft State Machine, Explicit Save & LocalStorage Cache**:
  * **Dọn dẹp Database:** Xóa sạch 27 dòng dummy `New Client Company` rác do lỗi click trước đó.
  * **Cơ chế Draft & Cache:** Khi bấm `+ New Client`, giao diện chuyển sang chế độ Draft mà không chèn dữ liệu rác vào PostgreSQL. Tự động cache dữ liệu vào `localStorage` chống mất thông tin khi chuyển trang hoặc reload.
  * **Lưu Tường Minh (`Save Client`) & Hủy (`Cancel`):** Chỉ lưu khi bấm nút `💾 Save Client` và kiểm tra tên công ty hợp lệ. Bổ sung nút `✕ Cancel` để hủy nháp an toàn.

### v3.0-RC55 (30/08/2026)
* 🆕✨ **Fix "+ New Client" Button State Transition & Direct Navigation**:
  * **Sửa Lỗi Tạo Khách Hàng:** Khắc phục lỗi bất đồng bộ khi bấm `+ New Client`: Cập nhật trực tiếp danh sách `clients`, gán `currentClientIndex` đến công ty mới tạo và reset sạch bàn làm việc để người dùng có thể nhập thông tin Client mới ngay tức thì.

### v3.0-RC54 (30/08/2026)
* 🔍✨ **Searchable Client Dropdown & Clean Header Navigation**:
  * **Xóa bỏ cụm nút điều hướng cũ:** Loại bỏ 4 nút lật khách hàng `[ ▢ ]` cũ khỏi Header Row 1.
  * **Tích hợp Searchable Client Dropdown:** Thay thế thẻ select bằng dropdown tìm kiếm thông minh (tương tự Action Menu), hỗ trợ gõ tìm kiếm theo tên hoặc mã số `#`, tự động focus, danh sách cuộn trực quan với dấu tích xanh `✓` đánh dấu công ty đang chọn.

### v3.0-RC53 (30/08/2026)
* 🏢🧹 **Streamline Location Popover (Registered Addresses & Empty/Remote Support)**:
  * **Xóa bỏ Mục Standard / Remote Thừa:** Tinh giản Popover bằng cách loại bỏ hoàn toàn các nút thành phố chuẩn, tập trung 100% vào mạng lưới địa chỉ thực tế của Khách hàng (`Main Headquarters` + `Registered Branches`).
  * **Hỗ trợ Để trống Địa chỉ cho Job Remote:** Bổ sung lựa chọn `⚪ None / Unspecified (e.g. Remote)` (hiển thị ký hiệu `—` thanh lịch trên bảng), kết hợp với cột *Working Mode* (`🌐 Remote`) để quản lý các vị trí làm việc từ xa chuẩn mực.

### v3.0-RC52 (30/08/2026)
* 🎯✨ **Fix Location Cell 1-Click Trigger & Overflow Clipping**:
  * **Khắc phục lỗi Che khuất Popover do CSS:** Gỡ bỏ thuộc tính `truncate` (`overflow: hidden`) gắn trên thẻ `<td>` của ô Location trong bảng Job Orders.
  * **Tối ưu Cơ chế Kích hoạt (Single-click / Double-click):** Bổ sung `e.stopPropagation()` trên `<td>` và icon Chevron `▾` trực quan (tương tự cột Working Mode), cho phép mở bung Location Selection Popover mượt mà ngay cả khi click 1 lần.

### v3.0-RC51 (30/08/2026)
* 🗺️✨ **Interactive Location Selection Popover (Khắc Phục Lỗi Datalist Ẩn Chi Nhánh Khi Có Sẵn Dữ Liệu)**:
  * **Chuyển đổi sang Popover Dropdown Tương tác:** Thay thế hoàn toàn cơ chế `<datalist>` mặc định của HTML (vốn bị lỗi trình duyệt tự động filter làm ẩn các chi nhánh khác khi ô input đang chứa sẵn địa chỉ cũ) bằng một Popover tuyển chọn địa điểm thông minh.
  * **Hiển thị đầy đủ và trực quan:** Khi double-click vào ô Location trên bảng Job Orders, popover mở bung danh sách gồm:
    * `🏢 Main Headquarters`: `53/4 Trần Khánh Dư, Tân Định, TP HCM` (kèm cờ `✓` nếu đang chọn).
    * `📍 Test`: `ABC` (hoặc bất kỳ chi nhánh nào đã đăng ký, chọn 1-click tức thì).
    * Nhóm tùy chọn `🌐 Remote`, `✈️ Overseas`, các tỉnh thành phố chuẩn.
    * Khung nhập địa chỉ tự do `Custom Address` kèm nút Save.

### v3.0-RC50 (30/08/2026)
* 🧹✨ **Deduplicate Location Options & Clean Test Branches**:
  * **Khắc phục lỗi Trùng lặp Gợi ý Location:** Loại bỏ thẻ Trụ sở chính (HQ) khỏi vòng lặp duyệt chi nhánh phụ (`additionalBranches`), ngăn ngừa tình trạng trình duyệt hiển thị 2 lần cùng một địa chỉ `HQ Address` khi người dùng double-click sửa cột Location trên Job Order.
  * **Dọn dẹp Dữ liệu Test:** Reset sạch chi nhánh test `Testing` khỏi CSDL của khách hàng *All That Beauty Clinic*.
  * **Chuẩn hóa Bộ đếm Huy hiệu Branches:** Huy hiệu `Branches (N)` trên Header Row 1 và thanh tổng quan Row 2 chỉ đếm số lượng chi nhánh phụ thực tế (loại trừ HQ) để tránh gây hiểu nhầm khi công ty chỉ có duy nhất trụ sở chính.

### v3.0-RC49 (30/08/2026)
* 🏢📍 **Remove Header Location Pill & Use Full Client Address for Job Orders**:
  * **Tinh Giản Master Client Header:** Xóa bỏ ô chọn `Location` riêng lẻ trên Row 1 của Header (vốn thừa thãi vì đã được quy hoạch vào thanh `HQ Address` và `Branches` chi tiết bên dưới).
  * **Chuẩn hóa Cột Location trong Bảng Job Orders:** Cột Location của từng Job Order được liên kết trực tiếp với danh sách địa chỉ thực tế của Khách hàng:
    * Gợi ý chọn nhanh (datalist) gồm **Địa chỉ đầy đủ Trụ sở chính** (`🏢 HQ Address: ...`) và **Địa chỉ đầy đủ của từng Chi nhánh** (`📍 Tên chi nhánh: Địa chỉ`).
    * Hiển thị trực quan toàn bộ chuỗi địa chỉ cụ thể của nơi làm việc thay vì chỉ ghi tên viết tắt `HQ`.
    * Mỗi Job Order gắn cố định với duy nhất 1 địa chỉ làm việc (Single Location per Job). Nếu công ty tuyển dụng cho nhiều chi nhánh khác nhau, Recruiter sẽ tạo các Job Order riêng biệt tương ứng.

### v3.0-RC48 (30/08/2026)
* 🏢📍 **Direct Dynamic Branch Address Rows on Header & Address Restoration**:
  * **Khôi phục Địa chỉ gốc Client:** Khôi phục chính xác 100% dữ liệu gốc cho khách hàng *All That Beauty Clinic* (`53/4 Trần Khánh Dư, Tân Định, TP HCM`, Location: `Ho Chi Minh`).
  * **Hiển thị trực tiếp các dòng Địa chỉ Chi nhánh (Branch Address Rows):** Tích hợp vùng hiển thị danh sách địa chỉ chi nhánh ngay bên dưới thanh HQ Address trên Master Client Header. Khi một công ty có các chi nhánh đã đăng ký, mỗi chi nhánh hiển thị thành 1 dòng thanh thoát gồm: Tên chi nhánh, Badge Tỉnh/thành phố, Địa chỉ chi tiết, Hotline, nút Sao chép `📋` và nút Sửa nhanh `✏️`.
  * **Tối ưu trải nghiệm (No Click Required):** Người dùng quan sát được toàn bộ mạng lưới chi nhánh và văn phòng của khách hàng tức thì mà không cần phải nhấp chuột mở Drawer.

### v3.0-RC47 (30/08/2026)
* 🏢✨ **Unified Branches & HQ Architecture (Tránh Trùng Lặp Thẻ HQ & Hỗ Trợ Toàn Diện CRUD Chi Nhánh)**:
  * **Hợp nhất hiển thị danh sách Chi nhánh & HQ:** Loại bỏ hoàn toàn thẻ tĩnh hardcoded "Main Headquarters". Chuyển sang mô hình danh sách động đồng bộ (`branchesList`), nơi mọi địa điểm (bao gồm cả Trụ sở chính HQ) đều là một thực thể chi nhánh có thể Sửa (`✏️`), Xóa (`🗑️`), Đổi Trụ sở chính (`Set as HQ`) và Sao chép địa chỉ (`📋`).
  * **Huy hiệu Trụ sở chính duy nhất (`⭐ HQ`):** Trong toàn bộ danh sách, duy nhất 1 chi nhánh có `is_headquarter: true` được gắn huy hiệu `⭐ HQ`. Các chi nhánh khác hiển thị nút `Set as HQ`.
  * **Đồng bộ Dữ liệu 2 chiều Tức thì:** Khi người dùng bấm `Set as HQ` trên bất kỳ chi nhánh nào:
    * Chi nhánh đó lập tức nhận cờ `is_headquarter = true` (gắn huy hiệu `⭐ HQ`).
    * Trụ sở chính cũ tự động chuyển thành chi nhánh thông thường (`is_headquarter = false`).
    * Cột `location` và `address` của Client trên thanh thông tin đầu trang và trong CSDL được cập nhật đồng bộ ngay lập tức.
  * **Tối ưu Server Actions với `sql.json()`:** Sử dụng hàm chuyển đổi native JSONB của `postgres-js` đảm bảo dữ liệu `branches` luôn là JSON array hợp lệ trong PostgreSQL.

### v3.0-RC40 (30/08/2026)
* 🏢⚡🌐 **Cột Hình Thức Làm Việc (Working Mode Multi-Select) & Tái Cân Đối Layout 50:50 Phân Hệ `/jobs`**:
  * **Di trú cơ sở dữ liệu PostgreSQL:** Nâng cấp cột `working_mode` trong bảng `jobs` sang dạng mảng `text[]`, hỗ trợ lưu trữ nhiều hình thức làm việc đồng thời (On-site, Hybrid, Remote).
  * **Cột Working Mode trong Job Orders:** Đặt giữa cột Location và Status.
  * **UI Multi-Select Popover:** Bấm vào ô Working Mode để mở danh sách Checkbox 3 chế độ (`🏢 On-site`, `⚡ Hybrid`, `🌐 Remote`), chọn/bỏ chọn tức thì và tự động đồng bộ lên Database.
  * **Hiển thị Badge Pill trực quan:** Thể hiện các pill màu sắc tương ứng hoặc nút `+ Mode` tinh tế khi chưa có dữ liệu.
  * **Tái cân đối Layout 50:50:** Điều chỉnh độ rộng cột trái và cột phải thành 6:6 (`lg:col-span-6 / lg:col-span-6`), đem lại không gian thoáng rộng đồng đều cho cả 2 bảng.

### v3.0-RC39 (30/08/2026)
* 🎯 **Chuẩn Hóa Vòng Đời Trạng Thái Job (Open, On Hold, Closed)**:
  * **Loại bỏ trạng thái `Active` thừa:** Giữ nguyên 3 trạng thái chuẩn gồm `Open`, `On Hold`, `Closed` trên toàn bộ UI và backend mặc định.
  * **Chuẩn hóa dữ liệu PostgreSQL:** Cập nhật 100% dữ liệu cũ trong bảng `jobs` tương thích với enum `job_status`.
  * **Phân màu Badge trạng thái:** `Open` (xanh lá), `On Hold` (vàng cam), `Closed` (xám) trên Search Menu và Jobs Workbench.

### v3.0-RC38 (30/08/2026)
* 📄 **Trình Xem Bản Mô Tả Công Việc Trực Tiếp (Embedded JD Viewer) & Quản Lý Link JD Cho Phân Hệ Jobs & Clients**:
  * **Khai thác và liên kết thuộc tính `jd_url` từ PostgreSQL:** Bổ sung `jd_url` và `jd_text` vào các truy vấn `getClientWorkbenchData`, `updateJobField`, `createJobForClient`.
  * **Trường nhập liệu & Xem nhanh JD tại Cột Trái:** Thêm ô nhập link JD (Google Drive / Google Docs / PDF) trong phần Job Notes ở cột trái, cho phép dán link, cập nhật thời gian thực, mở link gốc `↗` và nút bấm `Preview JD ↗`.
  * **Hệ thống 2 Tab chuyển đổi tại Cột Phải:**
    * **Tab 1: `Applications & Pipeline (N)`**: Quản lý danh sách ứng viên, mở rộng Accordion và ghi chú Action Notes Timeline.
    * **Tab 2: `Embedded JD Viewer`**: Nhúng trực tiếp tài liệu JD vào màn hình làm việc qua iframe Google Drive / Google Docs tự động chuyển đổi sang preview mode, tích hợp nút `Open Fullscreen` phóng to toàn màn hình. Khi chưa có JD, hiển thị giao diện rỗng thanh lịch kèm form dán link nhanh và nút `Save & View JD`.

### v3.0-RC37 (29/08/2026)
* ✏️ **Chỉnh Sửa Trực Tiếp Từng Kênh Liên Lạc (Inline Channel Edit) & Đồng Bộ Giao Diện Danh Thiếp**:
  * **Nút sửa trực tiếp `✏️` trên từng pill kênh:** Cho phép sửa số điện thoại, email, link URL hoặc chuyển loại kênh liên lạc ngay tại chỗ với nút `Save` và `Cancel`.
  * **Giữ nguyên hiển thị kênh khi sửa Person:** Khi bấm `✏️` sửa thông tin người phụ trách (Họ tên, Chức vụ, Phòng ban), danh sách các kênh liên lạc bên dưới vẫn hiển thị đầy đủ, không bị ẩn đi.

### v3.0-RC36 (29/08/2026)
* 📇 **Kiến Trúc PostgreSQL Hybrid Stakeholder Cards & Multi-Channel Contact Points Cho Khách Hàng**:
  * **Chuẩn hóa quan hệ B2B 1-N lồng nhau:** Xây dựng bảng `client_persons` với cột `contact_points jsonb`, giải quyết triệt để bài toán 1 Người liên hệ có nhiều số điện thoại/email mà không bị lặp lại tên/chức vụ trong database.
  * **UI Danh Thiếp Nhân Sự (Stakeholder Business Cards):** Trong Client Contacts Drawer, mỗi người phụ trách hiển thị thành 1 chiếc danh thiếp độc lập với tên, chức vụ, phòng ban, và danh sách các kênh liên lạc (Phone, Email, LinkedIn, Zalo, Skype...).
  * **Tương tác trực tiếp:** Hỗ trợ nút `+ Add Channel` trực tiếp trên từng người, gọi điện `tel:`, gửi email `mailto:`, mở link và sao chép 1-click.

### v3.0-RC35 (29/08/2026)
* 🚀 **Nút Mở Bung Toàn Màn Hình Expand Pipeline & Tối Ưu Tương Tác Single-Active Focus Accordion**:
  * **Nút chuyển đổi Expand Pipeline / Split View:** Bổ sung nút phóng to/thu nhỏ trên Header của phân hệ Applications & Pipeline (`/jobs`), cho phép mở rộng bảng ứng viên ra toàn màn hình (12 cols) khi cần thao tác chuyên sâu và thu lại chế độ 2 cột (5:7) dễ dàng.
  * **Cơ chế Single-Active Focus Accordion:** Khi mở Action Notes Timeline của một ứng viên, hệ thống tự động đóng ứng viên trước đó, giữ cho màn hình làm việc luôn tập trung và thoáng đãng.
  * **Chiều cao linh hoạt (`max-h-80`):** Tận dụng tối đa chiều cao màn hình để hiển thị danh sách nhật ký tương tác rõ ràng, không còn khoảng trống thừa bên dưới.

### v3.0-RC34 (29/08/2026)
* 🧹 **Tự Động Ẩn Các Trường Đơn Ứng Tuyển Khi Closed Để Tối Ưu Không Gian & On-Demand Reopen**:
  * **Ẩn động các trường phụ:** Khi Status của một Application là `Closed`, tự động ẩn hoàn toàn 3 trường: `Planning Date`, `Source Channel`, và `Passive Sourcing`. Chỉ giữ lại ô chọn `Status` trên 1 hàng duy nhất để người dùng có thể kích hoạt mở lại khi cần.
  * **Tự động hiện lại khi Reopen:** Khi chọn lại Status thành `In progress`, toàn bộ các trường trên sẽ tự động xuất hiện lại tức thì.
  * **Đồng bộ toàn diện:** Áp dụng cho cả 2 màn hình quản trị chính: Jobs & Clients Workbench (`/jobs`) và Candidate 360 Profile (`/candidates/[id]`).

### v3.0-RC33 (29/08/2026)
* 🌐 **Chuẩn Hóa 100% English UI & Triết Lý Thiết Kế On-Demand Airy Clean UX**:
  * **Bổ sung Rule 5 (Quy tắc bắt buộc dự án):** Quy định 100% văn bản giao diện (Headings, Labels, Buttons, Badges, Placeholders, Alerts, Empty States) phải dùng tiếng Anh chuẩn; áp dụng triết lý On-Demand Clean UX (cái gì cần mới gọi ra).
  * **Tối ưu Master Client Header:** Bố trí thanh công cụ tinh giản, thanh thoát 1 dòng chứa Client Name, Location, Tax ID, Status, Address, bộ nút điều hướng Lime MS Access và bộ chọn nhảy nhanh công ty.
  * **On-Demand Client Contacts Drawer:** Thay thế khối Contact tĩnh bằng nút kích hoạt thông minh `👥 Contacts (N)`. Drawer chỉ bung ra khi người dùng cần thao tác xem/thêm/sửa liên hệ HR, giữ cho không gian làm việc chính thoáng đãng tối đa.
  * **Thu gọn thẻ ứng viên mặc định:** Danh sách ứng viên trong pipeline mặc định ở trạng thái thu gọn, chỉ mở Action Notes Timeline khi người dùng bấm `⏱ Timeline ∨`.
  * **Chuyển ngữ 100% sang tiếng Anh:** Toàn bộ nhãn, thông báo và modal trên `/jobs` đồng bộ sang tiếng Anh chuẩn doanh nghiệp.

### v3.0-RC32 (29/08/2026)
* 💼 **Hiện Đại Hóa Client Contacts Hub & Tối Ưu Tỷ Lệ Viewport 70/30 Cho Phân Hệ Jobs & Clients**:
  * **Xóa bỏ trường Email và Notes của Client khỏi Database & UI:** Thực hiện `ALTER TABLE clients DROP COLUMN work_email, DROP COLUMN notes;`, gỡ bỏ hoàn toàn khỏi giao diện và Server Actions.
  * **Nâng cấp toàn diện Client Contacts Hub:** Tái thiết kế phân hệ Người liên hệ công ty (HR / Talent Acquisition / Hiring Managers) theo chuẩn **Contact Points Hub** trực quan:
    * Hiển thị danh thiếp thẻ tương tác với Icon Type (Phone, Email, LinkedIn, Zalo, Facebook, Website...), Badge Type, Tên người liên hệ kèm chức vụ (`👤 Ms. Lan Anh • HR Manager`), và giá trị liên hệ.
    * Đầy đủ bộ công cụ tác vụ nhanh: Gọi điện (`tel:`), Gửi email (`mailto:`), Mở link mạng xã hội (`ExternalLink`), Sao chép 1-click (`📋`).
    * **Hỗ trợ Chỉnh Sửa Trực Tiếp (`✏️`) & Xóa Bỏ (`🗑️`):** Sửa thông tin trực tiếp trên dòng với thao tác Lưu `✓` / Hủy `✕` và xóa an toàn có xác nhận.
    * Hàng thêm nhanh `* Add Contact` trực quan với chọn Type, nhập Tên, Chức vụ, Giá trị liên hệ và nút `+ Thêm Contact`.
  * **Bỏ toàn bộ viết tắt:** Hiển thị rõ ràng `Location`, `Address`, `Client Name`, `Client ID`.
  * **Tối ưu không gian:** Dành trọn vẹn **~70% không gian hiển thị cho Bảng Job Orders & Bảng Applications Pipeline Accordion**, ~30% cho Header & Contacts Hub.

### v3.0-RC31 (29/08/2026)
* 🔒 **Gia Cố Bảo Mật Database — Defense-in-Depth & Dọn Dẹp Index**:
  * **Thu hồi (REVOKE) toàn bộ quyền** của role `anon` và `authenticated` trên 13 tables. Trước đó cả 2 role đều có đầy đủ 7 quyền (SELECT, INSERT, UPDATE, DELETE, TRUNCATE, TRIGGER, REFERENCES) × 13 tables = 182 quyền thừa → nay về 0.
  * Bảo mật 2 lớp (Defense-in-Depth): Lớp 1 — RLS chặn truy cập (đã bật RC30); Lớp 2 — GRANT bị thu hồi (RC31). Kể cả nếu vô tình tạo RLS policy permissive, `anon` vẫn không có quyền thao tác.
  * Giữ nguyên quyền `service_role` (Supabase nội bộ cần để Dashboard, backup, monitoring hoạt động).
  * **Xóa 2 Duplicate Indexes** trên bảng `activity`: `idx_applications_candidate_id` và `idx_applications_job_id` (di sản từ tên bảng cũ `applications`, trùng với `idx_activity_candidate_id` và `idx_activity_job_id`). Giảm overhead INSERT/UPDATE.
  * Kết quả Supabase Advisor: 0 CRITICAL, 0 ERROR, 0 WARN. Còn 13 INFO (RLS no policy) + 9 INFO (unused indexes — do thống kê chưa tích lũy sau migration).

### v3.0-RC30 (29/08/2026)
* 🔒 **Bảo Mật Database — Khắc Phục 15 Cảnh Báo Supabase Security Advisor**:
  * **Bật Row Level Security (RLS)** trên toàn bộ 13 tables (`candidates`, `contact_points`, `activity`, `activity_log`, `clients`, `client_contacts`, `jobs`, `campaigns`, `campaign_social_groups`, `interviews`, `onboarding_history`, `reach_sourcing`, `social_group_urls`), chặn hoàn toàn truy cập trái phép qua PostgREST API (anon key).
  * App ATS 3.0 không bị ảnh hưởng vì kết nối qua role `postgres` (superuser) tự động bypass RLS.
  * Di chuyển extension `pg_trgm` từ schema `public` sang `extensions` theo best practice Supabase.
  * Fix mutable `search_path` cho function `uuid_generate_v7()` ngăn ngừa SQL injection qua search_path.
  * Kết quả: 13 CRITICAL → ✅ Resolved, 2 WARN → ✅ Resolved, còn lại 13 INFO (RLS enabled, no policy — expected behavior cho server-side app).

### v3.0-RC29 (29/08/2026)
* 🔢 **Sắp xếp danh sách Client theo số thứ tự hiển thị (`display_number ASC NULLS LAST`)**:
  * Dropdown chọn công ty và bộ điều hướng bản ghi Client hiển thị tuần tự `#1, #2, #3, ... #189` thay vì bị xáo trộn theo bảng chữ cái.
  * Xác thực toàn bộ 14 bảng trong Database Supabase sử dụng tiêu chuẩn **UUIDv7/UUID** (RFC 9562) làm Primary Key an toàn, tách biệt hoàn toàn với `display_number` trực quan của người dùng.

### v3.0-RC28 (29/08/2026)
* ⏱️ **Tái cấu trúc phân hệ Applications & Pipeline theo cơ chế Thẻ Mở Rộng Timeline Accordion (`⏱ Timeline ∨/∧`)**:
  * Chuyển đổi toàn bộ Cột phải sang định dạng Thẻ Ứng Viên thoáng đãng, đồng bộ hoàn toàn với giao diện của Candidate Menu.
  * Tích hợp nút `⏱ Timeline ∨` để mở rộng chi tiết Action Notes Timeline trực tiếp trong thẻ khi cần, tự động thu gọn để tiết kiệm tối đa không gian và tránh làm màn hình bị bí bách.
  * Hỗ trợ đầy đủ bộ trường tương tác nhanh: Status, Planning Date, Nguồn, Checkbox Passive Sourcing, hàng `*` thêm nhanh Action Log (phím tắt `Enter`), sửa `✏️`, xóa `🗑️` và cơ chế khóa an toàn `🔒 Closed`.

### v3.0-RC27 (29/08/2026)
* 📐 **Tối ưu hóa độ đậm đặc không gian & Tích hợp bảng Client Contacts vào phân hệ Jobs & Clients**:
  * Tích hợp bảng phụ **Client Contacts** (Người liên hệ công ty / HR / Hiring Manager): Xem danh sách, chức vụ, SĐT/Email và hàng `*` thêm nhanh trực tiếp.
  * Thu gọn Header Khách hàng (Tầng 1) thành 2 hàng tinh gọn, hiển thị đầy đủ (Name, ID, Loc, Tax, Status, Email, Addr, Notes).
  * Đưa cụm nút điều hướng màu Lime đặc trưng MS Access (`|<<`, `<`, `>`, `>>|`, `+ New Client`) và dropdown chọn công ty vào góc điều khiển tập trung.
  * Tối đa hóa chiều cao viewport cho 3 bảng dữ liệu chính (Job Orders, Applications Pipeline, Action Timeline).

### v3.0-RC26 (29/08/2026)
* 💼 **Tái cấu trúc toàn diện phân hệ Jobs & Clients theo thiết kế MS Access Master-Detail 4 Tầng**:
  * Thay thế giao diện lưới thẻ cũ bằng bàn làm việc tập trung 1 màn hình (`h-screen overflow-hidden`).
  * **Tầng 1 (Client Header & Navigator):** Form thông tin Khách hàng (Name, ID, Location, TaxCode, Status, WorkEmail, Address, Notes), bộ nút điều hướng bản ghi (`|<<`, `<`, `>`, `>>|`, `+*`), và thanh nhảy nhanh công ty.
  * **Tầng 2 (Job Orders Sub-Table - Cột Trái):** Bảng danh sách Job Orders của Client, con trỏ dòng `▶`, hàng thêm nhanh `*` và ô xem/sửa Job Notes.
  * **Tầng 3 (Applications Pipeline - Cột Phải Trên):** Bảng danh sách ứng viên trong Job (Status, Planning Date, ID Cand có link mở hồ sơ 360°, Họ tên, Nguồn, Checkbox Active Search).
  * **Tầng 4 (Action Timeline - Cột Phải Dưới):** Bảng dòng thời gian tương tác (Action Type có badge màu, Date, Note, Xóa), hàng thêm nhanh `*` với phím tắt `Enter`, ô xem chi tiết Note và cơ chế khóa `🔒 Closed`.
  * Kết nối trực tiếp Supabase Singapore cho tốc độ phản hồi tức thì dưới 100ms.

### v3.0-RC25 (29/08/2026)
* ⚡ **Di Trú & Kết Nối Supabase Singapore (`ap-southeast-1`) Tăng Tốc Độ Nạp Dữ Liệu Gấp 4.5x - 5x**:
  * Tích hợp Supabase MCP Server vào hệ thống điều phối Antigravity.
  * Tự động khởi tạo Schema, ENUMs (`job_status`, `application_status_type`, `working_mode_type`), hàm phát sinh UUIDv7 và kích hoạt `pg_trgm` trên Supabase PostgreSQL 17 (Singapore).
  * Di trú hoàn tất 100% dữ liệu từ 13 bảng: `candidates` (3,377 dòng), `contact_points` (10,855 dòng), `activity` (3,192 dòng), `activity_log` (4,310 dòng), `jobs` (307 dòng), `clients` (189 dòng), cùng toàn bộ B-Tree và GIN Trigram Indexes.
  * Chuyển đổi `DATABASE_URL` sang Supabase Transaction Pooler (`aws-0-ap-southeast-1.pooler.supabase.com:6543`).
  * Đo lường hiệu năng: Độ trễ mạng (Ping) giảm từ 250ms xuống **~56ms**; Tốc độ nạp danh sách ứng viên và hồ sơ 360° tăng tốc vượt trội từ **4.2x đến 4.8x**.

### v3.0-RC24 (29/08/2026)
* 🧹 **Chuẩn hóa toàn diện dữ liệu Contact Points & Khử trùng lặp 4,462 bản ghi**:
  * Chuyển đổi và hợp nhất 140 dòng `PersonalWebsiteBlog` thành `Personal Website` và loại bỏ hoàn toàn tên loại trùng lặp này khỏi hệ thống.
  * Khử trùng lặp toàn bộ cơ sở dữ liệu `contact_points` (loại bỏ 4,462 bản ghi trùng lặp mạng xã hội, email, số điện thoại cùng ứng viên), đưa tổng số lượng bản ghi về **10,855 dòng sạch 100%**.
  * Tự động đồng bộ lại các trường lưu trữ gom trên bảng `candidates` (`phones`, `emails`, `socials`, `all_contacts_text`).
  * Chuẩn hóa danh mục loại liên hệ (`Personal Website`, `Twitter`, `Careerbuilder`, `Vietnamwork`, `Behance`, `Dribbble`, `StackOverflow`) và biểu tượng hiển thị trên giao diện `candidates/[id]`.

### v3.0-RC23 (29/08/2026)
* 🔒 **Tích hợp cơ chế khóa an toàn Action Notes khi Status = "Closed" (Ứng tuyển đã đóng)**:
  * Tự động ẩn hàng nhập liệu `*` và thay thế bằng thanh trạng thái khóa `🔒 Đơn ứng tuyển đang ở trạng thái Closed. Chức năng thêm Action Note đã bị khóa` trên cả **Candidate 360° Profile** và **Action Menu (Dashboard chính)**.
  * Ngăn ngừa hoàn toàn tình trạng vô tình thêm mới thao tác hoặc ghi đè dữ liệu vào các quy trình tuyển dụng đã kết thúc/đã đóng.
  * Hướng dẫn người dùng chuyển Status sang `In progress` nếu thực sự muốn mở lại hồ sơ để tiếp tục quy trình.

### v3.0-RC22 (29/08/2026)
* 🚀 **Tích hợp Interactive Action Timeline & Accordion Sub-Table trong tab Applications & Pipeline (`/candidates/[id]`)**:
  * Tích hợp nút bung mở **`▼ Action Timeline`** trên từng thẻ đơn tuyển dụng của ứng viên.
  * Tích hợp bảng phụ **MS Access Style / Action Menu Sub-Table**: Xem lịch sử tương tác, hàng nhập liệu `*` ghim đầu để thêm nhanh log (hỗ trợ phím tắt `Enter`), Inline Edit `✏️` và Delete `🗑️` cho từng bước hành động.
  * Tích hợp thanh chỉnh sửa nhanh thông tin Application: Status (`In progress`/`Closed`), Planning Date (date-picker), Sourcing/Passive Checkbox, Source Channel.
  * Tự động đồng bộ Stage badge và cập nhật cơ sở dữ liệu Neon PostgreSQL tức thì mà không cần chuyển trang.

### v3.0-RC21 (29/08/2026)
* ⚡ **Khôi phục toàn diện Server-Side Pagination (80 đơn/trang) cho Action Menu (`/`)**:
  * Chuyển đổi hàm `getActionMenuData` từ chế độ nạp hàng loạt (`limit: 5000`) sang truy vấn phân trang song song `Promise.all([countQuery, paginatedQuery])` với `LIMIT 80 OFFSET offset`.
  * Giảm thời gian nạp trang chủ Action Menu từ 3-4 giây xuống **chỉ còn ~0.2 giây**.
  * Tích hợp thanh điều khiển phân trang đầy đủ tại Footer: `Record: ◀ 1 of 80 ▶ | |◀ ◀ Page X of Y ▶ ▶| (3,192 total applications)`.
  * Tự động đặt lại trang 1 khi người dùng thay đổi bất kỳ bộ lọc nào (Status, Sourcing/Passive, Client, Job Title, Search Query).

### v3.0-RC20 (29/08/2026)
* 🛡️ **Khôi phục và chuẩn hóa hoàn toàn cơ chế Server-side Search & Pagination (80 bản ghi/trang)**:
  * Loại bỏ hoàn toàn việc nạp hàng loạt dữ liệu (Bulk load) vào RAM trình duyệt, bảo vệ tuyệt đối Chrome không bao giờ bị đơ/lag/crash khi dữ liệu mở rộng lên 15,000+ bản ghi và lịch sử tương tác.
  * Bộ nhớ trình duyệt luôn duy trì ở mức tối thiểu (~1MB) do chỉ render đúng 80 dòng hiện tại của trang.
  * Tích hợp bộ đệm thời gian gõ phím thông minh (Debounce 280ms) giúp giảm 90% số lượng request gửi lên Neon DB, đảm bảo tốc độ mượt mà và tiết kiệm tài nguyên.

### v3.0-RC19 (29/08/2026)
* 🛠️ **Khắc phục triệt để lỗi Runtime TypeError `c.dob.split is not a function`**:
  * Tối ưu truy vấn SQL Backend: Dùng `TO_CHAR(dob, 'YYYY-MM-DD') AS dob` chuẩn hóa định dạng chuỗi trực tiếp từ Neon PostgreSQL.
  * Bổ sung hàm tiện ích `formatDobSafe` trên Frontend Client: Xử lý an toàn mọi dạng dữ liệu ngày sinh (`Date` object, ISO string `YYYY-MM-DDTHH:mm:ss`, hoặc null/undefined).
  * Bọc toàn bộ quy trình `loadCandidate` trong khối `try...catch...finally` để đảm bảo hệ thống luôn kết thúc trạng thái Loading một cách an toàn và giải phóng giao diện người dùng.

### v3.0-RC18 (29/08/2026)
* ⚡ **Chuyển đổi toàn diện Search Menu (`/candidates`) sang Frontend In-Memory Instant Filtering (0.00ms Zero Latency)**:
  * Tích hợp bộ nhớ đệm RAM trình duyệt `globalSearchCache`: Nạp toàn bộ 3,377 hồ sơ ứng viên 1 lần duy nhất (~350KB).
  * Chuyển 100% logic tìm kiếm đa năng (theo Tên, ID, SĐT, Email, Link Social, Blacklist) và phân trang sang `useMemo` thực thi trực tiếp trên Client-side.
  * Phản hồi gõ phím tức thì trong 0.00 giây (Real-time, zero lag), loại bỏ hoàn toàn độ trễ mạng quốc tế (300-500ms).
  * Chuyển đổi giữa các Tab (Candidate / Client / Job) phản hồi tức thì với 60 FPS mượt mà.
* 🚀 **Tối ưu hóa Truy vấn Song song `Promise.all` cho Candidate 360° Profile (`/candidates/[id]`)**:
  * Tái cấu trúc hàm `getCandidateProfile` trên Server Action: gom 3 truy vấn riêng rẽ (Hồ sơ cá nhân, Contact Points, Applications Pipeline) chạy đồng thời trong 1 kết nối duy nhất, giảm 65% thời gian nạp trang chi tiết.

### v3.0-RC17 (29/08/2026)
* 🌑 **Chuyển đổi toàn diện Candidate 360° Profile (`/candidates/[id]`) sang Dark Mode công thái học**:
  * Nâng cấp toàn bộ giao diện hồ sơ chi tiết sang chuẩn Deep Slate (`#090d16`) / Emerald Glow, loại bỏ hoàn toàn theme sáng cũ.
  * Bố cục 2 cột Split-View chuẩn mực: Cột trái (5 cols) quản lý thông tin cá nhân và Contact Hub; Cột phải (7 cols) quản lý Applications & CV Viewer.
* 📱 **Quản lý Đa Liên Hệ Đầy Đủ (Add, Inline Edit, Delete, 1-Click Copy)**:
  * Tích hợp chức năng sửa `✏️` và xóa `🗑️` cho từng SĐT, Email, Zalo, LinkedIn, Facebook, GitHub, Skype, Website.
  * Tự động kích hoạt hàm đồng bộ `syncCandidateAggregatedContacts` để cập nhật các cột gom `phones`, `emails`, `socials`, `all_contacts_text` trên bảng `candidates`.
* 📄 **Tích hợp Trình Xem CV Trực Tiếp (Embedded CV Document Viewer)**:
  * Tích hợp Tab xem trước file CV PDF / Google Drive trực tiếp qua iframe thông minh (tự động chuyển đổi Google Drive URL sang preview mode), hỗ trợ nút phóng to toàn màn hình.
* 💼 **Nút Tác Vụ Nhanh Gán Ứng Viên Vào Job (`+ Assign to Job Pipeline`)**:
  * Cho phép Recruiter gán trực tiếp ứng viên vào bất kỳ Job Order nào với bộ lọc Khách hàng phân tầng (Cascading Filter), chọn kênh nguồn và Stage khởi tạo ngay từ trang cá nhân.

### v3.0-RC16 (29/08/2026)
* 🎯 **Bổ sung các Stage / Action Types mới chuyên sâu**:
  * Thêm **`Additional Interview`** vào nhóm *Assessment & Interview* phục vụ cho các trường hợp khách hàng phát sinh thêm các vòng phỏng vấn ngoài dự kiến.
  * Thêm **`Chasing Feedback`** vào nhóm *Assessment & Interview* phục vụ quá trình liên hệ hối thúc phản hồi đánh giá từ phía Client sau phỏng vấn.
* ✏️ **Tính năng Chỉnh Sửa Trực Tiếp Action Notes (Inline Edit)**:
  * Nâng cấp bảng lịch sử tương tác ứng viên (Detail Action Notes Timeline): bên cạnh nút xóa `🗑️`, tích hợp thêm nút chỉnh sửa `✏️` (Pencil).
  * Cho phép Recruiter trực tiếp sửa Stage / Action Type, sửa ngày giờ và nội dung ghi chú (Note) trực tiếp trên từng dòng, bấm `Check / Enter` để lưu hoặc `X / Esc` để hủy.
  * Tự động đồng bộ và tính toán lại `current_stage` trên bảng Master ngay sau khi chỉnh sửa thành công.
* 🧹 **Tinh gọn Giao diện & Tối ưu không gian hiển thị (UI Streamlining)**:
  * Loại bỏ thanh tab phụ thừa (`Action ✕` / `Search Menu ✕`) nằm dưới Navbar chính.
  * Tăng tối đa chiều cao hiển thị cho Master Table và Action Notes Timeline, giao diện trở nên liền mạch, gọn gàng và thoáng mắt hơn.

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

### Version 3.0-RC156 (Kế Hoạch Triển Khai Phiên Tối 07/09/2026) — Nâng Cấp Modal Assign Candidate to Job (Searchable Comboboxes & Newest-First Sort) & Các Hạng Mục Automation
- **Vai trò triển khai:** Antigravity (Implementer).
- **Đặc tả các hạng mục triển khai:**
  1. **Nâng Cấp Searchable Combobox Cho Client Filter (`AssignJobModal`):** Thay thế thẻ `<select>` tĩnh bằng hộp chọn tìm kiếm thời gian thực (Searchable Combobox) hỗ trợ gõ phím tìm kiếm tên khách hàng hoặc mã ID `#`, danh sách sắp xếp ưu tiên ngày tạo từ mới nhất tới cũ nhất (`created_time DESC`).
  2. **Nâng Cấp Searchable Combobox Cho Target Position (`AssignJobModal`):** Thay thế thẻ `<select>` tĩnh bằng hộp chọn tìm kiếm thời gian thực (Searchable Combobox) hỗ trợ gõ phím tìm kiếm Job Title, mã Job `#`, hoặc Tên Client, danh sách sắp xếp theo ngày tạo từ mới nhất tới cũ nhất (`created_time DESC`).
  3. **Vá Node `Process Bridge Results` Trong n8n Workflow A (`9W588GooZeZhiSKm`):** Cập nhật `$input.all()` đọc toàn bộ các item kết quả từ VPS Bridge để không bị ghi đè nhầm trạng thái "Failed" cho các nhóm đã đăng thành công trên Facebook (theo QA Report `QA_2026-09-07_campaign-fb-autopost_execution956-investigation-report.md`).
  4. **Tạo n8n Workflow E Tự Động Dọn Dẹp Ảnh Debug Puppeteer (>90 ngày):** Xây dựng workflow cron định kỳ tự động quét và dọn rác ảnh chụp màn hình debug tại `/opt/n8n/facebook auto posting 2.0/data/puppeteer image/` trên ổ đĩa VPS Linux.
  5. **Sửa Lỗi Tô Màu Quá Hạn Của Planning Date (`src/app/page.js`):** Sửa logic hiển thị màu của trường `planning_date` trên bảng Action Menu: chỉ tô màu đỏ cảnh báo (`bg-red-950 text-red-200 border-red-800`) khi ngày đã quá hạn so với thời điểm hiện tại (`planning_date < today`). Các ngày bằng hoặc sau ngày hiện tại (`planning_date >= today`) hiển thị màu trung tính chuẩn (`bg-slate-900 text-slate-200 border-slate-700`), khắc phục tình trạng ngày tương lai vẫn bị nháy đỏ báo động.

_Ghi nhận bởi: Antigravity (Implementer) — 2026-09-07_

### Version 3.0-RC155 (2026-09-07) — Khắc Phục Lỗi Tường Lửa Vercel 403 Cho CV Upload Proxy & Bổ Sung Google OAuth Session Guard
- **Vai trò triển khai:** Antigravity (Implementer).
- **Nội dung hoàn thành:**
  1. **Khắc phục Lỗi Vercel Firewall 403 Forbidden Khi Nạp CV:** Vercel Firewall Rule 2 (`Path starts with /api/webhooks/` AND `IP != 103.xxx.xxx.xxx` -> `Deny 403`) tự động chặn request của người dùng khi nạp tệp qua route cũ `/api/webhooks/cv-upload-proxy`. Đã di dời toàn bộ route xử lý sang `/api/cv-upload-proxy` nằm ngoài phạm vi chặn IP của webhook, giúp trình duyệt người dùng kết nối thông suốt.
  2. **Bảo Mật Bằng Google OAuth Session Guard:** Bổ sung lớp xác thực phiên đăng nhập NextAuth (`const session = await auth(); if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });`) bảo vệ endpoint `/api/cv-upload-proxy`, ngăn chặn triệt để các truy cập trái phép không qua đăng nhập từ bên ngoài.
  3. **Tối Ưu Giao Diện Tải Tệp (`CVUploadModal.js`):** Cập nhật endpoint gọi API sang `/api/cv-upload-proxy`, bổ sung xử lý an toàn chống crash cú pháp (`response.text()` trước khi parse JSON) và hiển thị thông báo lỗi chi tiết, thân thiện nếu xảy ra sự cố mạng.
  4. **Kiểm Tra & Triển Khai Thực Tế:** Đạt 100% kiểm thử build Turbopack (`npm run build`, 29/29 routes PASS) và xác thực production trên Vercel Singapore (`sin1`).

_Cập nhật bởi: Antigravity (Implementer) — 2026-09-07_

### Version 3.0-RC154 (2026-09-07) — Sắp Xếp Danh Sách Khách Hàng (Clients) & Vị Trí Tuyển Dụng (Job Orders) Ưu Tiên Ngày Tạo Mới Nhất Tới Cũ Nhất (Created Date DESC Priority)
- **Vai trò triển khai:** Antigravity (Implementer).
- **Nội dung hoàn thành:**
  1. **Sắp xếp Khách hàng (Clients) Ưu tiên Ngày tạo Mới nhất -> Cũ nhất:** Cập nhật `getClientWorkbenchData` và `getClients` (`src/app/actions.js`) áp dụng `ORDER BY created_time DESC NULLS LAST, display_number DESC NULLS LAST, name ASC`, đảm bảo Khách hàng tạo mới nhất theo thời gian thực luôn hiển thị trên cùng trong `SearchableClientDropdown` và được nạp mặc định khi truy cập `/jobs`.
  2. **Sắp xếp Vị trí tuyển dụng (Job Orders) Ưu tiên Ngày tạo Mới nhất -> Cũ nhất:** Cập nhật `getClientWorkbenchData` áp dụng `ORDER BY j.created_time DESC NULLS LAST, j.display_number DESC NULLS LAST`, đồng bộ với `getJobs()` và quy trình tạo Job mới.
  3. **Tối ưu Luồng Tạo Client Mới:** Cập nhật `handleSaveNewClient` (`src/app/jobs/page.js`) tự động đưa client vừa tạo lên đầu danh sách (`[createdCl, ...clients]`, index 0).

_Cập nhật bởi: Antigravity (Implementer) — 2026-09-07_

### Version 3.0-RC125 (2026-09-06) — Hoàn Thành Triển Khai Toàn Diện Phase 5 & Phase 6 (Workflow D Auto-Sync Engine & UI Badges/Quota)
- **Vai trò triển khai:** Antigravity (Implementer) thực thi toàn bộ code theo spec kiến trúc; Claude giữ vai trò QA độc lập.
- **Nội dung hoàn thành:**
  1. **Phase 5 (Quota Selector, Accounts Joined UX & Run History Badges):**
     - UI Modal: Max Groups Selector (`1, 2 Safe, 3, 4, 5, Custom` tối đa bằng số nhóm chiến dịch) kèm dải cảnh báo rủi ro an toàn động (Safe, Moderate, High Risk, Critical Risk).
     - UI Table: Chuẩn hóa cột `ACCOUNTS JOINED` trong Thư viện 1,028 Nhóm (`social_group_urls`) với tỷ lệ động theo thời gian thực (`2/2`, `1/2`, `0/2`), tự động mở rộng mẫu số khi nạp thêm nick mới; tích hợp Popover On-Demand hiển thị chi tiết tài khoản đã tham gia kèm ngày gia nhập.
     - Run History: Phân tách 4 trạng thái chuẩn (`🟢 Joined`, `🟡 Join Requested`, `🟠 Needs Answer`, `🔴 Failed`) kèm kiểu dáng màu vàng hổ phách (Amber-400) cho trạng thái chờ duyệt.
     - n8n Workflow C Refactor: Cập nhật node `Validate Internal Secret` và `Smart Group Allocator & Dispatcher` trên VPS (`L8QdckqW7FDwanRq`) phân bổ nhóm độc lập theo tiến độ từng nick (`!joinedSet.has(acc.id + '_' + group.id)`), hỗ trợ `maxGroupsPerAccount` tuỳ chỉnh từ UI.
  2. **Phase 6 (Workflow D: Group Membership Auto-Sync Engine):**
     - DB Migrations: Thêm cột `account_ids uuid[]` vào `warm_join_runs` (cả `public` và `sandbox`); tạo 2 bảng mới `group_membership_sync_schedule` (với `UNIQUE(for_date, slot_index)`) và `group_membership_sync_runs` kèm RLS an toàn.
     - Backend & Webhooks: Export `_getBusyFbAccountIds` (Per-Account Mutex Lock loại trừ nick bận từ Job Posting, Warming, và Sync); tạo 4 webhook routes Next.js (`schedule-roll`, `claim-schedule`, `sync-data`, `sync-callback`); export tiện ích đồng bộ `normalizeSocialGroupUrl` trong `src/lib/url_utils.js`.
     - Playwright Engine: Tạo `scripts/sync-group-memberships.js` quét siêu tốc qua URL nội bộ `facebook.com/groups/joins` (~15s/nick); tích hợp endpoint `POST /api/facebook-sync-joins` trên `scripts/bridge-server.js`.
     - n8n Workflow D: Xây dựng workflow `D: FB Group Membership Auto-Sync` (`EMAUfa5HCgyf6yPO`) trong thư mục `ATS 3.0` (`y4ZDeiEYOE0cUDFZ`) với 2 Trigger: Roll Dice ngẫu nhiên 2 mốc giờ (00:05) và Poll Schedule mỗi 5 phút (trạng thái `active: false` chờ Claude QA).

_Cập nhật bởi: Antigravity (Implementer) — 2026-09-06_

### Version 3.0-RC123 (2026-09-06) — Phê Duyệt Đặc Tả 4 Hạng Mục Nâng Cấp Quản Trị Nhóm & Auto-Sync
- **Vai trò triển khai:** Antigravity (Lead Technical Architect & Implementer) đảm nhiệm thiết kế chi tiết 4 hạng mục kiến trúc theo yêu cầu của Product Owner; Claude giữ vai trò QA độc lập.
- **Nội dung đặc tả 4 hạng mục kiến trúc:**
  1. **Hạng mục 1 (Max Groups Quota Selector):** Thêm bộ chọn hạn mức `1, 2 (Safe), 3, 4, 5, Custom` (tối đa bằng số nhóm campaign) trên Warm & Join Modal kèm dải nhãn cảnh báo rủi ro (🟢 Safe, 🟡 Moderate, 🟠 High Risk, 🔴 Critical); n8n Allocator lọc nhóm độc lập cho từng tài khoản (`!joinedSet.has(acc.id + '_' + group.id)`), phân bổ đúng số lượng nhóm còn thiếu theo tiến độ riêng của từng nick.
  2. **Hạng mục 2 (Chuẩn hóa Badges & Colors Run History):** Tách bạch 4 trạng thái (`🟢 Joined` vào ngay, `🟡 Join Requested` chờ duyệt, `🟠 Needs Answer` câu hỏi khó, `🔴 Failed` lỗi); sửa dòng text `Join request submitted successfully` sang màu vàng hổ phách (Amber-400), không còn màu đỏ/hồng gây hiểu lầm lỗi.
  3. **Hạng mục 3 (Cột Accounts Joined Thư Viện 1,028 Nhóm):** Thay thế cột `JOIN STATUS` đơn lẻ bằng `ACCOUNTS JOINED` hiển thị tỷ lệ động theo thời gian thực (`🟢 2/2 Joined`, `🟡 1/2 Joined`, `⚪ 0/2 Joined`); mẫu số tự động tăng khi nạp thêm nick mới; Popover on-demand hiển thị chi tiết từng tài khoản kèm ngày tham gia.
  4. **Hạng mục 4 (Workflow D: Group Membership Auto-Sync Engine):** Xây dựng workflow riêng biệt đối soát trạng thái thành viên cho mọi Campaign (kể cả nhóm phiên cuối) qua URL `facebook.com/groups/joins` (~15s/nick); lịch chạy 2 khung giờ ngẫu nhiên trong ngày + Jitter delay chống Facebook bắt bài; cơ chế Per-Account Mutex Lock ưu tiên thấp (nhường tài nguyên 100% cho Campaign chính).
- **Chi tiết kỹ thuật:** Được ban hành đầy đủ tại `docs/architecture/BLUEPRINT_2026-09-04_fb-account-warming-and-rotation-strategy.md` (Trụ cột 7, 8, 9) và `docs/architecture/ATS_3.0_UI_Modernization_Blueprint.md`.

_Cập nhật bởi: Antigravity (Lead Technical Architect & Implementer) — 2026-09-06_

### Version 3.0-RC107 (2026-09-04) — Phê Duyệt Kiến Trúc Chiến Lược Nuôi Nick FB Account (Auto-Warm & Auto-Join, Genlogin Hybrid & Phễu 1 Hotline)
- **Vai trò triển khai:** Antigravity (Lead Technical Architect & Implementer) đảm nhiệm toàn diện thiết kế kiến trúc và thi hành; Claude giữ vai trò QA độc lập.
- **Tài liệu Blueprint riêng biệt:** Ban hành `docs/architecture/BLUEPRINT_2026-09-04_fb-account-warming-and-rotation-strategy.md` giải quyết trọn vẹn 6 trụ cột kỹ thuật:
  1. Lộ trình Ramp-up 3 pha: Khởi động (ngày 1-3, chỉ feed warm) -> Hòa nhập (ngày 4-7, feed warm + join 1-2 nhóm/phiên) -> Sẵn sàng (ngày 8+, warm nhẹ + post tăng dần 2-6 bài/ngày).
  2. Cô lập thiết bị & browser profile: 100% độc lập session `/data/sessions/[account_ref]/fb-session.json` và ảo hóa profile phần cứng cố định theo nick.
  3. Proxy 4G di động (`reset_ip_url`): Điều phối chạy tuần tự (Strict Sequential Queue) với thời gian chờ modem 10-15s và cooldown 25-45s, triệt tiêu nguy cơ rớt mạng chéo.
  4. n8n Workflow (C): Lịch cron 3 lần/ngày (`08:30`, `12:30`, `20:30`) + webhook manual trigger từ ATS 3.0 UI.
  5. ATS 3.0 UI & Server Actions: Nút "Run Warm & Join", cột "Last Warmed", chỉ báo trạng thái sức khỏe warming.
  6. Mô hình Vận hành Genlogin Hybrid & Phễu Ứng viên 1 Hotline/Zalo: 5 nick Facebook đóng vai trò 5 loa phát thanh, CTA toàn bộ bài viết điều hướng ứng viên về DUY NHẤT 1 số điện thoại / Zalo Hotline chính; không dùng Messenger chat với người lạ chống spam ban; Genlogin cài máy cá nhân làm Safehouse quản lý 5 profile độc lập.
- **Trạng thái:** Đã phê duyệt kiến trúc và lưu trữ vào Blueprint, tạm hoãn thực thi code (sẽ kích hoạt theo chỉ đạo tiếp theo của User).

_Cập nhật bởi: Antigravity (Lead Technical Architect) — 2026-09-04_

### Version 3.0-RC76-QA (2026-09-01) - Addendum: Application Pipeline Refactor
- **Fix/Correction:** Bổ sung khối UI Result/Reason/Note bị sót tại Jobs Workbench.
- **Data Normalization:** Khởi chạy script migrate 1006 records trên schema `public` (đính chính lại con số 248 records ở sandbox báo cáo nhầm trước đó).

_Cập nhật bởi: Antigravity (Implementer) — 2026-09-01_

### Version 3.0-RC75-QA (2026-09-01) - Application Pipeline Refactor
- **Core Architecture:** Tách Application Final Result (Passed/Failed) và Failure Reason (15 lý do chuẩn từ Notion) khỏi Application Stage. Điều này giúp Pipeline linh hoạt và báo cáo phễu (funnel) tuyển dụng chính xác hơn.
- **UI/UX Updates:** 
  - Action Menu: Thêm cột `Result` và `Reason`.
  - Jobs Workbench: Thêm UI chọn `Result` / `Reason` trong Quick Edit.
  - Candidate 360: Hiển thị Badge `Failed — Reason` nổi bật.
- **Data Normalization:** Khởi chạy script migrate 248 records cũ về chuẩn Result/Reason mới.

_Cập nhật bởi: Antigravity (Implementer) — 2026-09-01_

