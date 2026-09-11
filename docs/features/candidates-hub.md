# Feature Guide: Candidate 360° Master Workbench (`/candidates`)

> **Route:** `http://localhost:3000/candidates` (or `?id=[uuid]`)  
> **Purpose:** Master-detail 360° candidate workbench, live searchable switcher, zero duplicate intake, and complete application timeline management.

---

## 1. State Flow & Architecture

```mermaid
graph TD
    User([Recruiter]) -->|Open /candidates| AutoLoad[Auto-load Latest Candidate Profile]
    
    subgraph MasterHeader [Master Candidate Header]
        Switcher[SearchableCandidateSwitcher - Live Name/ID/Phone/Email Search]
        NavButtons[◀ Prev / Next ▶ Record Navigator - 1 of 3,377]
        FastContact[Fast Contact Pills: Call, Zalo, Email, Preview CV]
        NewCandBtn[+ New Candidate Button]
        AssignBtn[+ Assign to Job Button]
    end

    subgraph DualPaneLayout [5:7 Dual Pane Workbench]
        subgraph LeftPane [Left Pane (42% Width)]
            PersonalInfo[Personal Information Form & Blacklist Toggle]
            ContactHub[Contact Points Hub - Add/Edit/Delete/Copy Multi-channel]
        end

        subgraph RightPane [Right Pane (58% Width)]
            PipelineTab[Tab 1: Applications Pipeline & Timeline Accordion]
            CVViewerTab[Tab 2: Embedded CV Viewer Google Drive/PDF Iframe]
        end
    end

    AutoLoad --> MasterHeader
    MasterHeader --> DualPaneLayout
    Switcher -->|Select Candidate| LoadProfile[actions.js - getCandidateProfile]
    LoadProfile --> DualPaneLayout
```

---

## 2. Core Components & Features
* **`SearchableCandidateSwitcher`:** Live searchable dropdown on the header to instantly switch between 3,377+ candidates by typing name, ID `#`, phone, email, or LinkedIn.
* **`Auto-load Latest Candidate`:** Defaults to opening the newest candidate profile in database when navigating to `/candidates`.
* **`Record Navigator (◀ / ▶)`:** Step through candidates sequentially with record index (`Candidate X of 3,377`).
* **`+ New Candidate (Sourcing Intake)`:** Integrated modal with zero duplicate guard. When saved, automatically loads the new candidate profile.
* **`Contact Points Hub`:** Full CRUD for phone, email, LinkedIn, Zalo, Facebook, Github with 1-click copy.
* **`Applications & Timeline Accordion`:** Expandable interview and activity note logs with quick log entry.
* **`Embedded CV Viewer`:** Live Google Drive / PDF iframe viewer with fullscreen mode.

## 3. Assign Candidate to Job Pipeline Modal (`+ Assign to Job`)
* **`+ Assign to Job` Trigger:** Nút thao tác nhanh trên Header hồ sơ ứng viên để gán ứng viên vào một vị trí tuyển dụng (Job Order) cụ thể.
* **Cấu trúc trường thông tin:**
  * **1. Filter by Client Company (Optional):** Hộp chọn công ty khách hàng để lọc nhanh các Job thuộc về khách hàng đó. Hỗ trợ tìm kiếm thời gian thực bằng cách gõ phím (`Searchable Combobox`) và danh sách công ty được sắp xếp theo thứ tự ngày tạo từ **mới nhất tới cũ nhất (`created_time DESC`)**.
  * **2. Select Target Position * (Required):** Hộp chọn vị trí tuyển dụng mục tiêu. Hỗ trợ tìm kiếm trực tiếp bằng gõ phím (`Searchable Combobox`) theo Tên Job, Mã `#`, Tên Khách hàng và danh sách được sắp xếp từ **mới nhất tới cũ nhất (`created_time DESC`)**.
  * **Initial Pipeline Stage:** Hộp chọn giai đoạn khởi tạo (mặc định `Talent Mapping`).
  * **Source Channel:** Kênh nguồn tuyển dụng (mặc định `Direct Sourcing`).
  * **Initial Note / Evaluation:** Ghi chú hoặc đánh giá ban đầu của Recruiter.

## 6. AI CV Batch Intake & HITL Deduplication Queue
* **`+ Parse CV (AI)` Trigger:** Kích hoạt modal tải lên nhiều file PDF kết nối trực tiếp workflow n8n trên VPS qua Proxy an toàn nội bộ (`/api/cv-upload-proxy`, bảo vệ bởi NextAuth Google OAuth session guard).
* **Notification Center Progress Tracker:** Tự động đồng bộ tiến độ batch (`cv_batch_progress`) theo thời gian thực và tổng kết khi xử lý xong.
* **Automatic Resume Engine:** Xử lý và phục hồi các batch bị treo qua subworkflow định kỳ.
* **Pending Imports Hub (`/candidates?tab=pending`):**
  * **UPDATE Review:** Bảng Field Diff so sánh từng trường dữ liệu, checkbox chọn lọc ghi đè, phát hiện contact points mới và quản lý lịch sử file CV (`cv_urls`).
  * **CONFLICT Resolution:** Phân biệt và cho phép chọn ứng viên đích cần gộp hoặc bấm `Create New Profile` (`FORCE_CREATE`) tạo ứng viên mới hoàn toàn.
  * **Google Drive Auto-Rename:** Đồng bộ đổi tên file theo định dạng `CV_{display_number}_{seq}.pdf`.

_Cập nhật bởi: Antigravity (Implementer) — 2026-09-07: Bổ sung đặc tả nâng cấp hộp chọn Searchable Combobox & Sắp xếp Mới nhất (Newest-First DESC) cho Modal Assign Candidate to Job Pipeline._



