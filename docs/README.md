# 📚 ATS 3.0 Documentation Repository & Architecture Sitemap

Chào mừng bạn đến với trung tâm tài liệu kỹ thuật, hướng dẫn vận hành và kiến trúc của hệ thống **ATS 3.0 Web Application**.

Toàn bộ tài liệu được phân cấp khoa học và chuẩn hóa theo các danh mục chuyên biệt dưới đây:

---

## 📑 Danh Mục Tài Liệu Hệ Thống (Documentation Sitemap)

### 1. 📋 Nhật Ký Phát Triển & Bản Sao Lưu Phục Hồi (Changelog & Snapshots)
* **[DEVELOPMENT_LOG.md](./DEVELOPMENT_LOG.md):** Ghi chép chi tiết từng mốc phát triển, các thay đổi mã nguồn/database, và bảng tổng hợp Snapshot ID để phục vụ việc Rollback 1 bước khi có sự cố.

### 2. 📖 Hướng Dẫn Sử Dụng & Checkpoints Chụp Ảnh (User Guides)
* **[USER_MANUAL_DRAFT.md](./USER_MANUAL_DRAFT.md):** Phác thảo sổ tay hướng dẫn sử dụng chi tiết cho từng phân hệ nghiệp vụ, tổng hợp phím tắt thao tác nhanh, và đánh dấu các vị trí cần chụp ảnh màn hình minh họa `[📷 Vị trí ảnh chụp...]` trên môi trường Sandbox.

### 3. 🏛️ Kiến Trúc Hệ Thống, Database ERD & Contracts (`architecture/`)
* **[ATS_3.0_UI_Modernization_Blueprint.md](./architecture/ATS_3.0_UI_Modernization_Blueprint.md):** Blueprint kỹ thuật toàn diện của dự án (Executive Summary, Tech Stack, Roadmap, Security Hardening, và quy chuẩn phát triển).
* **[schema-map.md](./architecture/schema-map.md):** Sơ đồ quan hệ thực thể (ERD), ý nghĩa và cấu trúc chi tiết của 14 bảng dữ liệu trong Supabase PostgreSQL Singapore.
* **[api-contracts.md](./architecture/api-contracts.md):** Chuẩn định dạng Response (Success/Error format), Server Actions signature, quy ước Transaction và mã lỗi.
* **[legacy-notion-schema.md](./architecture/legacy-notion-schema.md):** Tài liệu lưu trữ tham khảo cấu trúc cơ sở dữ liệu Notion cũ phục vụ đối soát di trú.

### 4. 🧩 Tài Liệu Kỹ Thuật Từng Phân Hệ Giao Diện (`features/`)
* **[action-menu.md](./features/action-menu.md):** Phân hệ Action Menu Dashboard (`/`): Fixed Viewport, Smart Auto-Slide Timeline, Searchable Combobox, phân trang Server-side và quy trình Attach Candidate.
* **[candidates-hub.md](./features/candidates-hub.md):** Phân hệ Candidate 360° Master Workbench (`/candidates`): Tự động nạp ứng viên mới nhất, Searchable Candidate Switcher, Anti-Duplicate Intake, Contact Points Hub và Embedded CV Viewer.
* **[jobs-clients-workbench.md](./features/jobs-clients-workbench.md):** Phân hệ Jobs & Clients Workbench (`/jobs`): Master-Detail 4 tầng, Contacts Drawer dạng Business Card, Branches Drawer quản lý đa chi nhánh, Working Mode đa chọn, và Embedded JD Viewer.
* **[search-menu.md](./features/search-menu.md):** Phân hệ Global Multi-Entity Search Hub (`/search`): Tra cứu đa thực thể 3 tab (Candidates, Clients, Job Orders), Server-side Debounce và Double-Click deep navigation.

### 5. 🚀 Triển Khai & Vận Hành Hạ Tầng (`deployment/`)
* **[vercel_deployment_guide.md](./deployment/vercel_deployment_guide.md):** Hướng dẫn cấu hình môi trường, biến môi trường (`.env`), Connection Pooling (PgBouncer) và quy trình deploy lên Vercel Production.
* **[n8n_vps_management_guide.md](./deployment/n8n_vps_management_guide.md):** Sổ tay quản trị và bảo trì n8n Automation trên VPS (Docker Compose inline, khắc phục Alpine, nâng cấp an toàn, xử lý tool Facebook).

### 6. 🧪 Kiểm Định Chất Lượng & Báo Cáo QA (`testing/`)
* **[master_test_matrix.md](./testing/master_test_matrix.md):** Ma trận kiểm thử hồi quy (Regression Test Matrix), bao phủ các kịch bản Transaction, Deduplication, Concurrency và Deep Navigation.
* **[QA_Verification_Report_v3.0_RC75.md](./testing/QA_Verification_Report_v3.0_RC75.md):** Báo cáo kiểm định phá hoại (Destructive Testing), Race Condition `pg_advisory_xact_lock`, vá lỗi Connection Pooler `prepare: false` trên Supabase Singapore.
* **[QA_Verification_Report_UI_State.md](./testing/QA_Verification_Report_UI_State.md):** Báo cáo kiểm thử tự động 16 kịch bản Frontend UI State Management (UI-01 đến UI-16), phát hiện Race Condition, Optimistic UI Rollback, Client Name validation và Zod payload coverage.
* **[QA_Verification_Report_UI_State_Retest.md](./testing/QA_Verification_Report_UI_State_Retest.md):** Báo cáo Verification & Regression Testing sau khi vá 4 lỗi (UI-01, UI-02, UI-13, UI-16). Kết quả: 4/4 fixes xác nhận PASS, 0 regressions, 15/16 tổng thể (93.75%).

---

## 📌 Quy Tắc Duy Trì Tài Liệu (Maintenance Standards)
1. **Quy tắc Single Source of Truth:** 100% tài liệu kỹ thuật, hướng dẫn và báo cáo QA của hệ thống ATS BẮT BUỘC phải lưu trữ trong thư mục `ats-web/docs/`.
2. **Tự động cập nhật:** Khi có tính năng mới hoặc thay đổi database, tự động cập nhật `DEVELOPMENT_LOG.md`, `USER_MANUAL_DRAFT.md`, và `ATS_3.0_UI_Modernization_Blueprint.md`.
3. **Thư mục làm việc tập trung:** Dự án chạy trên thư mục Git làm việc duy nhất `D:\Users\trith\ats-web\docs\`.
