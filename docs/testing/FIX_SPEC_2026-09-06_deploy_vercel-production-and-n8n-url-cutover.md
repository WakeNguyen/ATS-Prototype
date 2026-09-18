# FIX_SPEC: Deploy production lên Vercel + đổi URL webhook trong 3 workflow n8n (06/09/2026)

Giao AG thực hiện (Claude giữ vai trò Architect/QA/DevOps — viết spec, verify sau khi AG xong, KHÔNG tự deploy/tự sửa n8n). Mục tiêu: app chạy 24/7 trên Vercel, không phụ thuộc PC bật/tắt. PC vẫn giữ nguyên để dev tiếp (`next dev`, không đổi gì ở đó).

## 0. Bối cảnh đã khảo sát (Claude, 06/09/2026)
- Repo hiện **chưa có git remote** (`git remote -v` rỗng). **Quyết định (06/09/2026): dùng thẳng Vercel CLI (`vercel --prod`), KHÔNG cần tạo tài khoản GitHub cho việc deploy ngày mai** — GitHub chỉ cần nếu muốn Vercel tự động deploy mỗi lần `git push` (tiện về sau nhưng không gấp, để làm fast-follow sau khi deploy xong).
- Code không có `export const runtime = 'edge'` ở đâu, không có `middleware.js`, không có `vercel.json` — mặc định chạy Node.js runtime trên Vercel, tương thích package `postgres` (TCP, không chạy được ở Edge runtime nếu có).
- `.env.local` (không commit, có trong `.gitignore`) đang giữ `DATABASE_URL` (pooler port 6543, transaction mode — đã đúng cấu hình serverless-friendly, `prepare:false` trong `src/lib/db.js`), `DB_SCHEMA`, `APP_ENCRYPTION_SECRET`, `INTERNAL_WEBHOOK_SECRET`. Các biến này PHẢI nhập tay vào Vercel Project Settings → Environment Variables (Production) — Vercel không tự đọc `.env.local`.
- ⚠️ **`INTERNAL_WEBHOOK_SECRET` trên Vercel PHẢI khớp giá trị credential "ATS 3.0 Internal Webhook Secret" (`Je1dHcRXyZhrXODl`) đang dùng trong n8n** — nếu không khớp, mọi webhook n8n gọi vào sẽ bị 401.

## 1. Deploy lên Vercel

1. Trong thư mục repo: `vercel link` (hoặc qua Vercel Dashboard import project) → tạo project mới trên Vercel (personal account của User, hiện chưa có project/team nào).
2. Set Environment Variables (Production) trong Vercel Project Settings — copy đúng giá trị từ `.env.local` trên PC:
   - `DATABASE_URL` (giữ nguyên connection string pooler `aws-0-ap-southeast-1.pooler.supabase.com:6543`)
   - `DB_SCHEMA=public`
   - `APP_ENCRYPTION_SECRET`
   - `INTERNAL_WEBHOOK_SECRET`
3. Deploy: `vercel --prod` (hoặc qua Dashboard).
4. Domain: dùng domain mặc định Vercel cấp (`<project-name>.vercel.app`, ổn định cho bản production, không đổi mỗi lần deploy) — nếu muốn domain riêng (vd `ats.thucnguyen8n.space`) thì gắn Custom Domain trong Vercel + trỏ CNAME ở nơi đang quản lý domain `thucnguyen8n.space`, làm sau cũng được, không chặn việc dùng ngày mai.
5. Ghi lại URL production thật (vd `https://ats-web-xxxx.vercel.app`) để dùng ở Bước 2.

## 2. Đổi URL webhook trong 3 workflow n8n (BẮT BUỘC — nếu bỏ qua bước này, campaign/warming/sync sẽ chạy nhưng ATS sẽ KHÔNG nhận được kết quả trả về)

Đổi mọi chỗ `https://ats-local.thucnguyen8n.space` → URL Vercel production thật ở Bước 1. Danh sách chính xác (đã đọc trực tiếp qua n8n MCP, 06/09/2026) — **CHỈ đổi domain, giữ nguyên path**:

**Workflow A "A: FB Group Auto-Post (Campaign)" (`9W588GooZeZhiSKm`)**:
- Node "POST campaign-run-progress" → `/api/webhooks/campaign-run-progress`
- Node "POST campaign-run-callback" → `/api/webhooks/campaign-run-callback`

**Workflow C "C: FB Auto-Warm & Group Auto-Joiner" (`L8QdckqW7FDwanRq`)**:
- Node "Fetch Warm Data from ATS 3.0" → `/api/webhooks/warm-join-data`
- Node "Register Warm Join Run" → `/api/webhooks/warm-join-cron-register`
- Node "POST warm-join-run-progress" → `/api/webhooks/warm-join-run-progress`
- Node "POST warm-join-run-callback" → `/api/webhooks/warm-join-run-callback`

**Workflow D "D: FB Group Membership Auto-Sync" (`EMAUfa5HCgyf6yPO`)**:
- Node "POST Schedule Roll" → `/api/webhooks/group-membership-sync-schedule-roll`
- Node "POST Claim Schedule" → `/api/webhooks/group-membership-sync-claim-schedule`
- Node "GET Sync Data" → `/api/webhooks/group-membership-sync-data`
- Node "POST Membership Sync Callback" → `/api/webhooks/group-membership-sync-callback`

**KHÔNG đổi** node "Call VPS Bridge: ..." (`http://172.18.0.1:5680/...`) — đây là n8n gọi sang VPS Bridge nội bộ, không liên quan tới nơi host app Next.js. Cũng không đổi URL webhook trigger của chính n8n (`https://n8n.example.com/webhook/...`) — đó là địa chỉ app gọi VÀO n8n, không đổi khi app chuyển chỗ host.

Sau khi sửa xong cả 10 node ở 3 workflow, publish lại từng workflow (như đã làm với Workflow A trước đây).

## 3. Test sau khi deploy (AG hoặc User)
- Mở URL Vercel production, xác nhận UI load được, `/candidates` `/jobs` `/campaigns` hiển thị đúng dữ liệu `public` schema thật.
- Chạy thử 1 campaign nhỏ hoặc 1 lần Warming thật, xác nhận `campaign_runs`/`warm_join_runs` cập nhật đúng trạng thái (không bị treo "Running" mãi — dấu hiệu webhook chưa tới nơi).

## 4. Báo lại Claude
Báo: URL Vercel production thật, đã set đủ 4 env var chưa, đã đổi xong 10 node ở 3 workflow chưa (kèm publish), kết quả bước test 1 campaign/warming thật. Claude sẽ QA lại qua Supabase (đọc) + n8n MCP (đọc) sau khi nhận báo cáo — không tự thao tác thay AG.
