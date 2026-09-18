# Schema Map — ATS 3.0 (Supabase PostgreSQL)

> Đối soát trực tiếp với database thật qua Supabase MCP ngày 2026-09-01.
> Có 2 schema song song: **`sandbox`** (dữ liệu giả lập để dev/test — KHÔNG dùng cho quyết định nghiệp vụ) và **`public`** (chứa dữ liệu thật, số lượng lớn — xem "Ghi chú toàn vẹn dữ liệu" bên dưới). Cả hai schema có cấu trúc 15 bảng giống hệt nhau. Ứng dụng chọn schema đang dùng qua biến môi trường `DB_SCHEMA` (mặc định `sandbox`, xem `src/lib/db.js`).

---

## A. Lõi tuyển dụng (đang dùng chính)

Các bảng này được `actions.js` và các route API dùng trực tiếp cho luồng nghiệp vụ chính: tạo ứng viên → gán vào job → theo dõi tiến trình phỏng vấn.

### `clients` — Công ty khách hàng
- PK: `id` (uuid, `uuid_generate_v7()`)
- Cột chính: `name`, `location`, `status`, `tax_code`, `address`, `industry`, `display_number`, `display_id`, `branches` (jsonb, mảng chi nhánh nhúng trực tiếp trong dòng)
- Row count: `public`=189, `sandbox`=95

### `jobs` — Đơn tuyển dụng
- PK: `id`; FK: `client_id → clients.id` (**chỉ có FK ở `public`, `sandbox` KHÔNG có ràng buộc FK này** — xem mục Known Limitations)
- `status` là enum Postgres `job_status`: `Open | On Hold | Closed | Filled` (lưu ý: code frontend `enums.js` `JOB_STATUSES` hiện chỉ liệt kê 3 giá trị `Open/On Hold/Closed`, thiếu `Filled` — cần AG xác nhận có đang dùng `Filled` ở đâu trong UI không)
- Row count: `public`=310, `sandbox`=156

### `candidates` — Ứng viên
- PK: `id`
- Cột chính: `full_name`, `prefix`, `dob`, `address`, `source`, `cv_url`, `blocked`, `blacklist_note`, `notes`, `display_number`, `display_id`
- **Có 3 cột lưu liên hệ ngay trên bảng này**: `phones` (text[]), `emails` (text[]), `socials` (jsonb), `all_contacts_text` (text, có vẻ là cột tổng hợp phục vụ tìm kiếm), `cv_urls` (jsonb) — song song tồn tại với bảng `contact_points` riêng bên dưới. Xem Known Limitations.
- Row count: `public`=3,381, `sandbox`=1,688

### `contact_points` — Kênh liên hệ của ứng viên (bảng quan hệ chuẩn hoá)
- PK: `id`; FK: `candidate_id → candidates.id`
- Cột: `type`, `value` — đây là bảng mà `actions.js` (`addContactPoint`, dedup engine) thực sự dùng để chống trùng liên hệ giữa các ứng viên.
- Row count: `public`=10,856, `sandbox`=5,064

### `activity` — Tiến trình ứng tuyển (candidate ↔ job)
- PK: `id`; FK (chỉ có ở `sandbox`): `job_id → jobs.id`, `candidate_id → candidates.id`, `parent_item_id → activity.id` (tự tham chiếu — có vẻ dùng cho luồng phụ/lịch sử)
- `status` là enum `application_status_type`: `In progress | Done | Cancelled | Closed`
- Cột `reach_sourcing_id` tồn tại nhưng **không có FK** tới bảng `reach_sourcing` ở cả 2 schema.
- Row count: `public`=3,192, `sandbox`=1,600

### `activity_log` — Nhật ký hành động trên từng `activity`
- PK: `id`; FK: `application_id → activity.id` (có ở cả 2 schema)
- Row count: `public`=4,310, `sandbox`=2,218

### `interviews` — Lịch phỏng vấn
- PK: `id`; cột `application_id` **không có FK** tới `activity.id` ở cả 2 schema (dù tên cột gợi ý quan hệ đó)
- Row count: `public`=69, `sandbox`=48

---

## B. Đang phát triển / chưa rõ mức độ sử dụng

Các bảng tồn tại trong DB nhưng chưa xác nhận được dùng active bởi luồng nghiệp vụ chính hiện tại. Theo quyết định của Product Owner (2026-09-01): **không xử lý gấp**, giữ nguyên vì dự án còn đang phát triển — chỉ ghi nhận ở đây để không bị quên.

### `campaigns` — Chiến dịch đăng tin tuyển dụng
- PK: `id`; cột `job_id` không có FK tới `jobs.id`
- Row count: `public`=22, `sandbox`=8

### `campaign_social_groups` — Bảng nối campaign ↔ social group
- PK ghép: `(campaign_id, social_group_id)` — không có FK tới `campaigns` hay `social_group_urls`
- Row count: `public`=329, `sandbox`=165

### `social_group_urls` — Danh sách nhóm/kênh mạng xã hội
- PK: `id`, không có FK liên kết vào
- Row count: `public`=455, `sandbox`=140

### `reach_sourcing` — Có vẻ là luồng "chủ động tìm nguồn ứng viên" (sourcing), song song với luồng `activity`
- PK: `id`; các cột `candidate_id`, `job_id` đều không có FK
- Row count: `public`=45, `sandbox`=22

### `onboarding_history` — Lịch sử làm việc trước đó của ứng viên (career history)
- PK: `id`; `candidate_id`, `job_id` không có FK
- Row count: `public`=37, `sandbox`=18

### `client_persons` — Người liên hệ phía khách hàng (kiểu nhúng jsonb `contact_points`)
- PK: `id`; FK `client_id → clients.id` **chỉ có ở `public`**, thiếu ở `sandbox`
- Row count: `public`=2, `sandbox`=0
- **Ghi chú**: test route `qa-test` (BIZ-13) xác nhận đây là bảng đang được `getClientSearchData()` dùng thật (comment trong code: "using client_persons").

### `client_contacts` — Người liên hệ phía khách hàng (kiểu bảng quan hệ chuẩn, KHÔNG có FK)
- PK: `id`; `client_id` không có FK
- Row count: `public`=1, `sandbox`=0
- **Trùng lặp mô hình dữ liệu với `client_persons`** — có vẻ là bản thiết kế cũ hoặc thử nghiệm song song, gần như không có dữ liệu thật. Cần làm rõ với AG bảng nào là canonical trước khi phát triển thêm tính năng liên quan đến liên hệ khách hàng.

### `pending_cv_imports` — Hàng đợi CV import chờ xử lý/khớp ứng viên (dùng bởi webhook `api/webhooks/cv-import`)
- PK: `id`; `matched_candidate_id` không có FK tới `candidates.id`
- Row count: `public`=0, `sandbox`=3

---

## C. Ghi chú toàn vẹn & bảo mật dữ liệu (Known Limitations)

1. **Trùng lặp mô hình liên hệ ứng viên**: `candidates.phones/emails/socials` (mảng/jsonb nhúng trực tiếp) tồn tại song song với bảng quan hệ `contact_points`. Business logic dedup thật (`addContactPoint`) dùng `contact_points`; chưa rõ 3 cột kia trên `candidates` có đang được ghi/đọc đồng bộ hay là dữ liệu cũ còn sót từ migration Notion → Postgres trước đây. **Quyết định: chưa xử lý**, chỉ theo dõi cho tới khi tính năng liên quan hoàn thiện (theo yêu cầu PO 2026-09-01).

2. **Trùng lặp mô hình liên hệ khách hàng**: `client_persons` (canonical, đang dùng thật) vs `client_contacts` (gần như rỗng, không FK) — xem mục B. Cùng lý do, chưa xử lý gấp.

3. **Nhiều cột khoá ngoại (FK) không có ràng buộc thật trong DB** — quan hệ chỉ tồn tại "theo quy ước tên cột", Postgres không tự kiểm tra toàn vẹn:
   - `jobs.client_id` (thiếu FK ở `sandbox`)
   - `activity.reach_sourcing_id`
   - `interviews.application_id`
   - `campaigns.job_id`, `campaign_social_groups.*`
   - `reach_sourcing.candidate_id`, `reach_sourcing.job_id`
   - `onboarding_history.candidate_id`, `onboarding_history.job_id`
   - `client_persons.client_id` (thiếu ở `sandbox`), `client_contacts.client_id` (thiếu ở cả 2)
   - `pending_cv_imports.matched_candidate_id`
   
   Rủi ro: có thể tạo dữ liệu "mồ côi" (orphan rows) trỏ tới ID không tồn tại mà DB không chặn. Chưa xử lý gấp theo quyết định PO — chỉ theo dõi.

4. **[Bảo mật — ĐÃ BÁO CÁO & TẠM HOÃN theo quyết định PO ngày 2026-09-01]**: Row Level Security (RLS) đang **tắt** trên toàn bộ 15 bảng schema `sandbox` + bảng `public.pending_cv_imports`. Nghĩa là nếu app từng lộ `anon key` ra client (điều bình thường với Supabase), bất kỳ ai có key đó đều đọc/sửa được toàn bộ các bảng này trực tiếp, bỏ qua mọi logic nghiệp vụ trong `actions.js`. 
   - PO đã quyết định **tạm hoãn xử lý** vì hiện chưa có deployment thật (chưa deploy Vercel) và `sandbox` chỉ dùng nội bộ.
   - **Bắt buộc phải xử lý trước khi deploy production thật hoặc trước khi lộ `anon key` ra bất kỳ client nào truy cập từ internet.**
   - SQL khắc phục (chỉ bật RLS, CHƯA kèm policy — nếu chạy riêng sẽ chặn toàn bộ truy cập kể cả từ app, cần viết policy đi kèm trước khi chạy):
     ```sql
     ALTER TABLE sandbox.activity ENABLE ROW LEVEL SECURITY;
     ALTER TABLE sandbox.activity_log ENABLE ROW LEVEL SECURITY;
     ALTER TABLE sandbox.campaign_social_groups ENABLE ROW LEVEL SECURITY;
     ALTER TABLE sandbox.campaigns ENABLE ROW LEVEL SECURITY;
     ALTER TABLE sandbox.candidates ENABLE ROW LEVEL SECURITY;
     ALTER TABLE sandbox.client_contacts ENABLE ROW LEVEL SECURITY;
     ALTER TABLE sandbox.client_persons ENABLE ROW LEVEL SECURITY;
     ALTER TABLE sandbox.clients ENABLE ROW LEVEL SECURITY;
     ALTER TABLE sandbox.contact_points ENABLE ROW LEVEL SECURITY;
     ALTER TABLE sandbox.interviews ENABLE ROW LEVEL SECURITY;
     ALTER TABLE sandbox.jobs ENABLE ROW LEVEL SECURITY;
     ALTER TABLE sandbox.onboarding_history ENABLE ROW LEVEL SECURITY;
     ALTER TABLE sandbox.reach_sourcing ENABLE ROW LEVEL SECURITY;
     ALTER TABLE sandbox.social_group_urls ENABLE ROW LEVEL SECURITY;
     ALTER TABLE sandbox.pending_cv_imports ENABLE ROW LEVEL SECURITY;
     ALTER TABLE public.pending_cv_imports ENABLE ROW LEVEL SECURITY;
     ```
   - Ngoài ra, hầu hết bảng `public.*` đã bật RLS nhưng **chưa có policy nào** (mức INFO, an toàn hơn vì mặc định chặn hết khi thiếu policy, nhưng cần thêm policy đúng trước khi app cần truy cập các bảng đó qua client trực tiếp).

5. **[Dữ liệu — quan trọng]** Schema `public`, dù không phải schema đang active cho dev (`DB_SCHEMA=sandbox`), **chứa dữ liệu thật với số lượng lớn**, không phải dữ liệu giả:
   - `public.candidates` = 3,381 dòng
   - `public.contact_points` = 10,856 dòng
   - `public.jobs` = 310 dòng
   - `public.clients` = 189 dòng
   - `public.activity` = 3,192 dòng
   - `public.activity_log` = 4,310 dòng
   
   → Phải luôn coi `public` là dữ liệu nhạy cảm/production-like. **Không được chạy bất kỳ thao tác xoá/sửa hàng loạt nào trên schema `public` mà không có sự cho phép rõ ràng của Product Owner**, kể cả khi thử nghiệm hay debug.

---

*Tài liệu này được đối soát trực tiếp với DB thật qua Supabase MCP + `schema-dump.mjs`. Cập nhật lần cuối: 2026-09-01.*
