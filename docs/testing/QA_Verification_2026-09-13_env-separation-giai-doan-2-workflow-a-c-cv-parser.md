**Từ:** Claude (Architect/QA)

# QA Verification — Environment-Separation Giai đoạn 2 (Workflow A, Workflow C nhánh Webhook, CV Parser)

**Ngày:** 2026-09-13
**Kết quả:** ✅ PASS toàn bộ — verify bằng bằng chứng trực tiếp (code diff, cấu trúc workflow n8n
thật, dữ liệu SQL trên Supabase, và 1 lần chạy CV Parser bằng dữ liệu thật trên production).

## Phạm vi đã verify

### 1. Workflow A: FB Group Auto-Post (`9W588GooZeZhiSKm`)
- `src/lib/db.js`: thêm export `sqlSandbox` (client thứ 2, `search_path=sandbox`), giữ nguyên 100%
  client `sql` gốc — đọc trực tiếp xác nhận.
- `campaign_actions.js`, `campaign-run-callback/route.js`, `campaign-run-progress/route.js`: đọc
  trực tiếp, khớp 100% spec (`sqlClient = body.environment === 'sandbox' ? sqlSandbox : sql`).
- n8n: `get_workflow_details` xác nhận đúng 2 node (`Process Bridge Results`,
  `Build Final Run Summary`) có thêm field `environment`, không đổi gì khác.
- **Live test:** tạo campaign/campaign_run/notification test trong `sandbox`, gọi thật
  `campaign-run-progress` + `campaign-run-callback` qua dev server local với
  `environment: "sandbox"` → dữ liệu ghi đúng vào `sandbox.campaign_run_items`,
  `sandbox.campaign_runs` (status → Completed), `sandbox.campaigns` (status → Ready); `public`
  không có gì. Phát hiện + fix 1 gap hạ tầng: RLS enabled nhưng thiếu policy cho `ag_dev_role` trên
  4 bảng `campaigns/campaign_runs/campaign_run_items/fb_accounts` — đã verify an toàn cho production
  (role `postgres` có `rolbypassrls: true`, bypass RLS hoàn toàn) trước khi tạo policy, User đã duyệt.
  Đã dọn dẹp toàn bộ dữ liệu test bằng DELETE theo ID.

### 2. Workflow C: FB Auto-Warm & Group Auto-Joiner, nhánh Webhook (`L8QdckqW7FDwanRq`)
- `campaign_actions.js` (`triggerWarmJoinRun`), `warm-join-run-callback/route.js`,
  `warm-join-run-progress/route.js`: đọc trực tiếp, khớp 100% spec.
- n8n: `get_workflow_details` xác nhận đúng 5 node (`Validate Internal Secret`,
  `Prepare Cron Context`, `Smart Group Allocator & Dispatcher`, `Process Bridge Warm Results`,
  `Build Final Warm Run Summary`) có thay đổi đúng như spec — đặc biệt xác nhận
  `Prepare Cron Context` hardcode `environment: 'public'` (không đọc từ input nào), đảm bảo nhánh
  cron luôn là production thật theo đúng yêu cầu.
- **Live test:** tạo warm_join_run/notification test trong `sandbox`, gọi thật
  `warm-join-run-progress` + `warm-join-run-callback` qua dev server local với
  `environment: "sandbox"` → dữ liệu ghi đúng vào `sandbox.warm_join_run_items`,
  `sandbox.warm_join_runs` (status → Completed); `public` không có gì. Cũng phát hiện + fix cùng 1
  gap RLS cho `warm_join_runs`/`warm_join_run_items` (cùng cơ chế an toàn đã verify ở Workflow A).
  Đã dọn dẹp toàn bộ dữ liệu test.

### 3. CV Parser (`fofSZKkdyhlVd9Lc`) — verify bằng dữ liệu THẬT trên production
- `cv-upload-proxy/route.js`, node `Config` (n8n): đọc trực tiếp, khớp 100% spec.
- User tự nạp 2 CV thật lên production UI. Kiểm tra n8n execution `#7321` (webhook, production):
  `baseUrl` resolve đúng `https://crm-ats-web-hazel.vercel.app` (không có field `baseUrl` nào được
  gửi, đúng vì production không set `DB_SCHEMA=sandbox`), xử lý thành công 2/2 file
  (`newCount: 2, failedCount: 0`). Đối chiếu DB: 2 candidate mới ("Danh Le" #3443, "Nguyen Le Chuong"
  #3444) nằm đúng ở `public.candidates`, không xuất hiện ở `sandbox.candidates`.

## Đánh giá rủi ro production (User yêu cầu kiểm tra kỹ riêng — đã trả lời chi tiết trong chat)

Tất cả route callback đều có fallback an toàn: thiếu field `environment` hoặc bất kỳ giá trị nào
khác `"sandbox"` → luôn dùng client `sql` gốc, hành vi y hệt trước khi có thay đổi. n8n chỉ thêm
field vào JSON đã có, không đổi node/URL/kết nối nào khác. `sqlSandbox` kết nối lazy (không tự động
mở connection khi import file), không có rủi ro crash khi khởi động. Policy RLS mới chỉ áp dụng cho
role `ag_dev_role`, không ảnh hưởng role `postgres` (bypass RLS) mà production dùng.

## Kết luận

**Environment-separation cho toàn bộ 3 hạng mục trong kế hoạch (Google Contacts Sync, Workflow A,
Workflow C nhánh Webhook, CV Parser) đã hoàn thành và verify đầy đủ**, bao gồm cả 1 lần verify bằng
dữ liệu thật trên production (CV Parser) không phát sinh regression. Workflow D (đang disable) và
Workflow E (job nền, luôn phải production) cố tình không đụng theo đúng kế hoạch gốc. Việc phụ còn
treo: dọn 17 bản ghi notification cũ bị lẫn vào `sandbox` từ lúc tạo schema (data hygiene, không
khẩn).
