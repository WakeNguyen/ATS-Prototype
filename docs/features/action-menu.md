# Feature Guide: Action Menu Dashboard (`/`)

> **Route:** `http://localhost:3000/`  
> **Purpose:** Daily recruitment pipeline tracking, live candidate stage management, and unified activity logging.

---

## 1. State Flow & Architecture

```mermaid
graph LR
    subgraph ClientSide [Client State - React 19]
        FilterBar[Real-time Searchable Filters: Client / Position / Status]
        MasterList[Master Applications Table - 80 rows/page]
        ActionPanel[ActivityLogPanel - Shared Card-Stack Timeline]
    end

    subgraph ServerSide [Server Actions & Database]
        getFilteredActivities[getFilteredActivities - Server-side Filter & Pagination]
        activityLogActions[addActivityLog / updateActivityLog / deleteActivityLog]
        Supabase[(Supabase PostgreSQL 15 ap-southeast-1)]
    end

    FilterBar -->|Debounced Query| getFilteredActivities
    getFilteredActivities --> Supabase
    Supabase --> MasterList
    MasterList -->|Select Row ▶| ActionPanel
    ActionPanel -->|Add / Edit / Delete| activityLogActions
    activityLogActions -->|Auto-sync latest log to activity| Supabase
```

## 2. Core Components & Hooks
* **`SearchableFilterDropdown`:** Real-time searchable combobox with option counters, active checkmark, and quick clear `✕`.
* **`Master Applications Table`:** Focused 80-row grid displaying Candidate, Job, Client, Stage, and Planning Date (Result/Reason moved to per-log timeline).
* **`Planning Date Overdue Indicator`:** Chỉ báo trực quan trạng thái ngày kế hoạch:
  * **Quá hạn (`planning_date < today`):** Tô màu đỏ cảnh báo (`bg-red-950 text-red-200 border-red-800`).
  * **Đúng hạn / Tương lai (`planning_date >= today`):** Hiển thị màu trung tính chuẩn (`bg-slate-900 text-slate-200 border-slate-700`).
  * **Trống / Chưa đặt:** Màu mờ (`text-slate-500`).
* **`ActivityLogPanel` (Shared):** Unified card-stack timeline displaying per-log Stage, Result (Pass/Fail), Reason (if Failed), Action Date, and Audit Timestamp (`created_time`).
* **`syncApplicationFromLogs`:** Automatically derives and syncs Application-level `current_stage`, `result`, `reason_failed`, `note_failure_reason` from the most recent log.

_Cập nhật bởi: Antigravity (Implementer) — 2026-09-07: Bổ sung đặc tả Planning Date Overdue Indicator cho bảng Action Menu._

