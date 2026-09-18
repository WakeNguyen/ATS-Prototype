# Feature Guide: Jobs & Clients CRM Workbench (`/jobs`)

> **Route:** `http://localhost:3000/jobs`  
> **Purpose:** Master-detail client management, multi-branch office CRM, job order creation with working mode, and embedded JD viewer.

---

## 1. State Flow & 5:7 Flexbox Dual-Pane Layout

```mermaid
graph TD
    ClientHeader[Searchable Client Header & Quick Switcher] -->|Select Client| Workbench[Dual Pane Flexbox Container]
    
    subgraph LeftPane [Left Pane (45% Width)]
        JobOrders[Job Orders Table: Title, Location, Working Mode, Status]
        JDCollapsible[On-Demand Collapsible JD Link Input]
        JobNotes[Recruitment Job Notes]
    end

    subgraph RightPane [Right Pane (Flex-1 / 55% Width)]
        PipelineTab[Tab 1: Applications Pipeline & Timeline Accordion]
        JDViewerTab[Tab 2: Embedded JD Viewer Iframe / Fullscreen]
    end

    Workbench --> LeftPane
    Workbench --> RightPane
    JobOrders -->|Single-Click ▶| PipelineTab
```

## 2. Core Components & Features
* **`SearchableClientDropdown`:** Searchable header dropdown with live search, company badge, and active indicator. Sắp xếp khách hàng ưu tiên theo ngày tạo mới nhất tới cũ nhất (`created_time DESC NULLS LAST, display_number DESC NULLS LAST`), mặc định chọn khách hàng mới nhất khi mở trang.
* **`Client Branches & HQ Architecture`:** Native JSONB storage in `clients.branches` with direct header address rows and On-Demand Drawer.
* **`Interactive Location Selection Popover & Dynamic Branch Sync`:** One-click address selection linking directly to registered Client HQ or Branch addresses. Khi Job liên kết với một chi nhánh (`job.branch_id`), địa chỉ hiển thị của Job tại bảng Job Orders và Popover sẽ tự động đồng bộ theo địa chỉ mới nhất của chi nhánh đó mà không cần sửa tay từng Job.
* **`Job Orders Table`:** Sắp xếp các vị trí tuyển dụng ưu tiên theo ngày tạo mới nhất tới cũ nhất (`created_time DESC NULLS LAST, display_number DESC NULLS LAST`).
* **`Embedded JD Viewer`:** Google Docs / Google Drive iframe viewer with fullscreen mode.

## 5. Unified Activity Log Timeline (Shared Component)
* **`ActivityLogPanel`:** Phân hệ Jobs & Clients Workbench tích hợp chung component `<ActivityLogPanel>` cho từng Application khi mở rộng Accordion (`expandedAppIds`).
* **Per-log Stage / Result / Reason:** Mỗi dòng log quản lý độc lập Result (Pass/Fail) và Reason (if Failed).
* **Tự động đồng bộ Application-level:** Khi Add/Edit/Delete bất kỳ dòng log nào, trạng thái `current_stage`, `result`, `reason_failed`, `note_failure_reason` cấp Application tự động đồng bộ từ log mới nhất.

_Cập nhật bởi: Antigravity (Implementer) — 2026-09-14: Bổ sung liên kết `branch_id` cho Jobs giúp tự động đồng bộ địa chỉ Job theo chi nhánh._
_Cập nhật bởi: Antigravity (Implementer) — 2026-09-07: Sắp xếp danh sách Khách hàng và Job Orders ưu tiên theo ngày tạo mới nhất tới cũ nhất (Created Date DESC Priority)._
