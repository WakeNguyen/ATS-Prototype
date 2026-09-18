# PLAN: Tích Hợp FB Group Auto-Post (Campaign) + Auto-Warm/Auto-Join Multi-Account vào ATS 3.0

> **Từ:** Claude (Architect/QA)
> **Ngày:** 2026-09-02 (cập nhật lần 2 — bổ sung workflow Auto-Warm/Auto-Join + dữ liệu FB Accounts thật)
> **Loại tài liệu:** Kiến trúc & Kế hoạch triển khai (chưa phải Implementation Spec chi tiết từng PHẦN — dùng để User duyệt hướng đi trước khi Claude viết spec thi hành cho từng PHẦN)
> **Vị trí lưu:** `docs/architecture/PLAN_2026-09-02_campaign-fb-autopost-integration.md`
> **Phạm vi:** 3 workflow n8n liên quan tới nhau — (A) `FB Group Auto-Post (Campaign)` (đăng bài), (B) `Import Social Group URL` (nạp danh sách nhóm), (C) `FB Auto-Warm & Group Auto-Joiner` (nuôi nick + tự động xin vào nhóm) — cùng dùng chung dữ liệu `fb_accounts`/`social_group_urls` nên phải thiết kế đồng bộ trong 1 plan.

---

## 0. Quyết định của User (đã chốt trước khi viết plan này)

1. **FB Accounts** (nick Facebook, proxy, daily quota, group đã tham gia) → quản lý bằng bảng + UI mới ngay trong ATS 3.0.
2. **Nút "Run Campaign"** → trigger từ ATS 3.0 UI (gọi thẳng webhook n8n), không còn bấm từ Notion.
3. **Notion Campaigns + Social Group URL cũ** → cutover hẳn 1 lần khi ATS 3.0 pass QA, không chạy song song dài hạn.
4. **Dữ liệu `campaigns`/`social_group_urls` hiện có trong Supabase** (bản migrate cũ, lỗi) → coi là rác, re-migrate sạch từ Notion, nằm trong scope plan này.

---

## 1. Hiện Trạng Đã Khảo Sát Thật (không suy đoán)

### 1.1. n8n — 2 workflow đang tồn tại (cả hai `active: false`)

**`FB Group Auto-Post (Campaign) v2 Multi-Job`** (id `9JilETy92f8Pv6bk`, 28 node) — đây là bản **ĐANG CHẠY THẬT** hiện nay, KHÔNG PHẢI bản multi-account trong Blueprint đính kèm:
- Trigger: Webhook `campaign-trigger` (nhận `page_id` của Notion) — Notion Trigger polling đã bị `disabled`.
- Đọc campaign + danh sách Social Group URL + Posting Logs 7 ngày qua **trực tiếp từ 3 Notion database** (phân trang tới 10 trang/query).
- Lọc nhóm đã đăng trong 24h bằng JS, gửi preview qua Telegram (kèm ảnh nếu có), chờ duyệt qua n8n Form (`Wait for Approval`), sau khi Approve thì gọi `POST http://host.docker.internal:5680/api/facebook-post` — **đây là endpoint engine v1, KHÔNG PHẢI `/api/facebook-post-v2`** — nghĩa là **chưa hề có multi-account thật, vẫn đăng bằng 1 tài khoản duy nhất**.
- Ghi log: tạo **từng page Notion riêng lẻ** trong Posting Logs DB (1 request/nhóm, batch 400ms).
- Kết thúc: PATCH campaign Notion `Status=Completed` + nhồi text vào field `Execution log` (chính là cột `execution_log` dạng text phẳng đang thấy trong Supabase — không có cấu trúc, không tra cứu được).

**`Import Social Group URL to Notion`** (id `1lZOT3eiA3qFFaPp`, 14 node):
- Tải 1 file CSV public trên Google Sheets.
- Node **`Get Existing Notion Records`**: `operation: getAll, returnAll: true` — **kéo TOÀN BỘ record hiện có trong Notion Social Group URL DB về (455 dòng ở `public`)** mỗi lần chạy, rồi build `Set` trong JS để so trùng URL.
- Đây chính là nguyên nhân chậm anh nhận thấy: **thời gian chạy tỉ lệ thuận với số dòng đã có trong DB**, càng nhiều group thì càng chậm, vì Notion API phải phân trang trả về hết dữ liệu cũ trước khi so sánh được 1 dòng mới. Tạo record mới cũng làm từng page 1, không batch.

### 1.2. Blueprint "v3 Multi-Account" và "Auto-Warm/Auto-Join" — CẢ HAI CHƯA được import thành workflow n8n thật

Xác nhận qua `search_workflows` (query rỗng, quét toàn bộ 6 workflow trong folder "ATS 3.0"; thêm query riêng "warm"/"join"): không có workflow nào tên "v3", "multi-account", "warm" hay "join" tồn tại trên n8n — chỉ có bản v2 đơn tài khoản (mục 1.1) và `Import Social Group URL to Notion`. Cả 2 blueprint sau đều **đã soạn kỹ (kèm JSON export sẵn để import) nhưng chưa từng chạy qua n8n**:
- **`FB Group Auto-Post v3 Multi-Account`** (file `n8n-fb-group-auto-post-v3-multi-account-blueprint.json`, 33KB) — Smart Dispatcher đăng bài đa tài khoản (đã mô tả ở Blueprint anh đính kèm ban đầu).
- **`FB Auto-Warm & Group Auto-Joiner`** (file `n8n-fb-auto-warm-autojoin-blueprint.json`, 12KB, tài liệu `N8N_Facebook_AutoWarm_AutoJoin_Blueprint.md`) — workflow PHỤ nhưng quan trọng anh vừa nêu: nuôi nick (feed warming: scroll/like/xem Reels/Story) + tự động xin vào nhóm (tự trả lời câu hỏi xét duyệt, tick checkbox quy định, submit join request) + tự xoay IP 4G qua mProxy giữa các phiên. Chạy theo lịch cố định (cron 08:30/12:30/20:30) hoặc webhook, dùng chung `warm-and-join.js` + endpoint `POST :5680/api/facebook-warm-join` (khác endpoint đăng bài `/api/facebook-post-v2`).

Cả 3 workflow (đăng bài, import group, warm & join) đều **cùng phụ thuộc vào 1 nguồn dữ liệu chung**: `FB Accounts` + `Social Groups` — nên phải thiết kế schema Supabase 1 lần cho cả 3, không tách rời.

### 1.3. ⚠️ CHỈNH SỬA QUAN TRỌNG — Môi trường triển khai thật là VPS, KHÔNG PHẢI Windows

Anh đã xác nhận trực tiếp: **engine Playwright (đăng bài + warm/join) sẽ chạy trên VPS** (cùng nơi n8n đang chạy — `n8n.thucnguyen8n.space`, self-hosted Docker), **không phải trên máy Windows** như Blueprint gốc mô tả (`host.docker.internal:5680`). AG đã tự migrate các file cần thiết lên VPS rồi.

Những gì Claude khảo sát được ở mục dưới đây (`facebook auto posting 2.0/` trên `G:\My Drive\AI project\ATS`) **chỉ là bản trên Google Drive của anh** (rất có thể là bản gốc trước khi migrate, hoặc bản đồng bộ ngược) — **KHÔNG phản ánh trạng thái thật trên VPS**, vì Claude không có kênh SSH/truy cập VPS trực tiếp để kiểm chứng qua phiên này.

- `facebook auto posting 2.0/` (trên Drive) có sẵn: `post-to-group.js`, `run-batch.js`, `save-session.js`, `warm-and-join.js` + `package.json` (chỉ khai báo dependency `playwright`, không có framework HTTP server nào, `main: run-batch.js`) — gợi ý các script này được thiết kế để **chạy trực tiếp bằng lệnh (CLI/Execute Command)**, không nhất thiết cần 1 HTTP bridge riêng như Blueprint Windows mô tả.
- Không tìm thấy `host-runner.js` (cầu nối HTTP `:5680`) ở bản Drive này — nhưng điều đó không quan trọng nữa vì kiến trúc Windows Host Bridge **không còn là mục tiêu triển khai**.
- Đã hỏi anh trực tiếp cơ chế n8n gọi engine trên VPS (HTTP tới 1 service riêng, hay Execute Command gọi thẳng script) — **anh xác nhận chưa nắm rõ chi tiết kỹ thuật AG đã setup, cần hỏi lại AG.**

🔴 **ĐÂY LÀ OPEN ITEM CHẶN PHẦN 4** (xem mục 11) — Claude sẽ viết node n8n gọi engine theo 1 trong 2 phương án dưới đây tuỳ vào câu trả lời của AG, **không tự đoán và viết cứng vào workflow** trước khi có xác nhận:
- **Phương án A (HTTP):** nếu VPS có 1 service/container riêng lắng nghe port cố định (tương đương host-runner cũ, chỉ đổi host) → n8n dùng HTTP Request node gọi `http://<internal-host>:<port>/api/facebook-post-v2` y hệt cấu trúc cũ, chỉ đổi domain/port.
- **Phương án B (Execute Command/SSH):** nếu n8n gọi thẳng `node run-batch.js ...` trên VPS (cùng máy, không qua HTTP) → cần đổi hẳn node "Post to Facebook Execute" từ HTTP Request sang **Execute Command node** (hoặc SSH node nếu chạy khác container), payload truyền qua argument/stdin thay vì JSON body HTTP.

### 1.4. Supabase — schema thật đã đối chiếu trực tiếp

| Bảng | Cột hiện có | Vấn đề |
|---|---|---|
| `campaigns` | `id, notion_id, job_id, campaign_name, status, channel, post_language, post_image_url, content, execution_log, created_time, last_updated` | Không có FK nào (kể cả `job_id → jobs.id`). `execution_log` là text phẳng, không tra cứu được. Dữ liệu hiện tại (`public`, 22 dòng) phần lớn là rác: `campaign_name="Unknown Campaign"`, `channel=NULL`, `job_id=NULL` — bản migrate lỗi. |
| `campaign_social_groups` | `campaign_id, social_group_id` (PK ghép) | Không FK. Không có timestamp/trạng thái riêng từng cặp. |
| `social_group_urls` | `id, notion_id, name, url, group_type[], created_time` | Không unique constraint trên `url` → không dedup được ở tầng DB, đây là lý do n8n phải tự so trùng bằng JS (khảo sát ở 1.1). |
| `notifications` | `id, type, title, message, severity, link, is_read, metadata (jsonb), created_at, updated_at` | **Đã generic sẵn, dùng lại được ngay** cho thông báo campaign, không cần bảng mới. |
| — không có bảng `fb_accounts` nào (trong Supabase) | | Xem mục 1.5 — dữ liệu nguồn THẬT lại nằm ở Notion, không phải "chưa tồn tại" như khảo sát ban đầu của Claude. |

### 1.5. ⚠️ CHỈNH SỬA — FB Accounts Database THẬT SỰ ĐÃ TỒN TẠI (khảo sát lại qua Notion trực tiếp)

Khảo sát ban đầu của Claude (dựa trên Blueprint không ghi Database ID) là **sai** — đã tự kiểm tra lại trực tiếp qua Notion API và xác nhận:

- Database `👤 FB Accounts` **có thật**, ID `3c90900c-7051-8148-924c-000bcd16fb21`, đã tạo tại trang "Testing Job Posting And Nick Warming And Joining".
- **Đã có sẵn 2 tài khoản thật**: `Nick 01 (Main)` (`account_id: acc_01`) và `Nick 02 (HR)` (`account_id: acc_02`), cả 2 `Status: Active`, `Daily Quota: 6`, dùng chung 1 proxy 4G mProxy (`Proxy URL` + `Reset IP URL` đã cấu hình sẵn).
- Schema thật (khác 1 chút so với tài liệu thiết kế `ATS_Notion_FB_MultiAccount_Schema.md`): `Account Name, Account ID, FB Profile URL, Status (Active/Cooldown/Restricted/Checkpoint/Inactive — 5 trạng thái), Proxy URL, Reset IP URL, Daily Quota, Last Posted At, Last Warmed At, Today Posts, Notes/2FA`. Các quan hệ `Joined Groups`/`Assigned Campaigns`/`Posting Logs` trong tài liệu thiết kế **chưa thực sự được thêm vào DB thật** — chỉ là đề xuất, cần Claude tự thiết kế bảng quan hệ tương đương trong Supabase (mục 3.4).
- ⚠️ `Proxy URL` chứa **username:password thật** ở dạng plain text (`http://ThucNguyenNT:***@ip.mproxy.vn:12167`) — khi migrate và khi hiển thị lên UI phải coi là dữ liệu nhạy cảm (không log ra chat/report công khai, cân nhắc che 1 phần khi hiển thị trên UI).

→ **Kết luận sửa lại:** dữ liệu `fb_accounts` migrate được TRỰC TIẾP từ Notion (2 dòng), không cần anh tự gõ danh sách tay như bản plan lần 1 đã ghi nhầm.

**Kết luận hiện trạng chung:** Phần dữ liệu nguồn (FB Accounts, Social Groups, Campaigns) đã có thật trên Notion — việc còn thiếu hoàn toàn là lớp "dữ liệu + điều phối" phía Supabase/ATS 3.0 (multi-account dispatcher, kết nối UI) và cơ chế gọi engine Playwright trên VPS (mục 1.3) — đây là 2 trọng tâm thật sự của plan này.

---

## 2. Kiến Trúc Mục Tiêu (Target Architecture)

```mermaid
flowchart TD
    UI["ATS 3.0 UI — trang Campaigns"] -->|"1. Click Run Campaign"| SA["Server Action triggerCampaignRun()"]
    SA -->|"2. Lock + insert campaign_runs(Running) + notifications(campaign_started)"| DB[(Supabase)]
    SA -->|"3. POST webhook (campaignId, runId)"| N8N["n8n: FB Auto-Post Orchestrator (mới)"]
    N8N -->|"4. GET /api/webhooks/campaign-data"| API1["ATS 3.0 API"]
    API1 --> DB
    N8N -->|"5. Smart Dispatcher (load balancing theo quota/24h cooldown)"| N8N
    N8N -->|"6. Telegram preview + chờ duyệt (giữ nguyên)"| TG["Telegram Bot"]
    N8N -->|"7. Gọi engine (HTTP hoặc Execute Command — TBD, xem mục 1.3)"| HOST["VPS Playwright Engine (n8n.thucnguyen8n.space, ngoài scope thiết kế chi tiết)"]
    HOST -->|"8. Kết quả từng nhóm/account"| N8N
    N8N -->|"9. POST /api/webhooks/campaign-run-callback (kết quả gộp)"| API2["ATS 3.0 API"]
    API2 -->|"insert campaign_run_items, update campaign_runs/campaigns/fb_accounts, insert notifications(campaign_completed)"| DB
    DB -->|"Notification Center + Run History"| UI
```

Nguyên tắc: **Engine Playwright trên VPS (bước 7-8) giữ nguyên logic browser automation, không đụng vào** — đây không thuộc phạm vi "tích hợp vào ATS 3.0". Phạm vi plan này là lớp dữ liệu (Supabase) + lớp điều phối (n8n orchestration, thay Notion bằng API ATS3.0, và cách n8n gọi engine — HTTP hay Execute Command, tuỳ xác nhận của AG) + lớp UI/thông báo.

Sơ đồ tương tự áp dụng cho workflow (C) **Auto-Warm & Auto-Join**, chỉ khác: trigger là cron (giữ nguyên lịch 08:30/12:30/20:30) thay vì nút bấm UI, và bước 7 gọi engine `warm-and-join.js` thay vì `run-batch.js`/`post-to-group.js`.

---

## 3. Thiết Kế Database (Supabase, áp dụng cho cả `sandbox` và `public`)

### 3.1. Sửa bảng `campaigns`

```sql
ALTER TABLE campaigns
  ADD COLUMN target_criteria text,
  ADD COLUMN start_date date,
  ADD COLUMN end_date date,
  ADD COLUMN is_active boolean NOT NULL DEFAULT true,
  ADD CONSTRAINT campaigns_job_id_fkey FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE SET NULL;
```
- `status` giữ nguyên (text) nhưng đổi ý nghĩa: là trạng thái vòng đời hiện tại (`Ready | Running | Completed | Failed`), được đồng bộ tự động bởi Server Action khi trigger/callback — không cho sửa tay qua UI để tránh lệch với `campaign_runs`.
- `execution_log` (text phẳng cũ): **giữ lại nhưng ngừng ghi mới**, đánh dấu deprecated trong comment cột — sẽ đề xuất DROP ở 1 migration dọn dẹp riêng sau khi cutover ổn định (tránh xoá vội mất lịch sử cũ chưa migrate).
- `total_sent`/`total_replied` theo Notion cũ: **không lưu trùng lặp trên `campaigns`** — tính rollup trực tiếp từ `campaign_runs`/`campaign_run_items` qua query (View hoặc aggregate trong `getCampaignDetail()`), tránh lệch dữ liệu (giống bài học `DEVELOPMENT_LOG.md` bảng tổng hợp bị lệch phần chi tiết).
- Thêm 2 cột từ tài liệu `ATS_Notion_FB_MultiAccount_Schema.md` mục 3 (cấu hình chiến dịch nâng cao):
```sql
ALTER TABLE campaigns
  ADD COLUMN auto_spin_content boolean NOT NULL DEFAULT false, -- tự xáo trộn nội dung chống Facebook quét trùng lặp
  ADD COLUMN max_posts_per_run int; -- giới hạn số bài/lần chạy, NULL = không giới hạn
```
- Bảng nối mới `campaign_fb_accounts` (chỉ định tài khoản cụ thể cho 1 campaign — nếu để trống thì dispatcher tự chọn mọi tài khoản `Active` phù hợp, đúng hành vi thiết kế gốc):
```sql
CREATE TABLE campaign_fb_accounts (
  campaign_id uuid NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  fb_account_id uuid NOT NULL REFERENCES fb_accounts(id) ON DELETE CASCADE,
  PRIMARY KEY (campaign_id, fb_account_id)
);
```

### 3.2. Bảng mới `campaign_runs` — lịch sử từng lượt chạy (đúng yêu cầu chính của anh)

```sql
CREATE TABLE campaign_runs (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v7(),
  campaign_id uuid NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'Running' CHECK (status IN ('Running','Completed','Failed','PartialSuccess')),
  triggered_by text,
  trigger_source text NOT NULL DEFAULT 'ats_ui',
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  stats jsonb,
  summary text,
  error_message text,
  n8n_execution_id text,
  created_time timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON campaign_runs (campaign_id, started_at DESC);
-- Chặn cứng ở tầng DB: 1 campaign chỉ được có tối đa 1 run đang "Running" tại 1 thời điểm
CREATE UNIQUE INDEX one_running_run_per_campaign ON campaign_runs (campaign_id) WHERE status = 'Running';
```
`stats` (jsonb) lưu đúng cấu trúc Smart Dispatcher đã trả về trong Blueprint mục 3.1: `{totalInCampaign, eligibleCount, skippedRecentlyCount, skippedNoUrlCount, skippedNoAccountAvailable, accountBreakdown}`.

### 3.3. Bảng mới `campaign_run_items` — chi tiết từng nhóm/account trong 1 lượt chạy (phục vụ fix bug)

```sql
CREATE TABLE campaign_run_items (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v7(),
  run_id uuid NOT NULL REFERENCES campaign_runs(id) ON DELETE CASCADE,
  social_group_id uuid REFERENCES social_group_urls(id) ON DELETE SET NULL,
  fb_account_id uuid REFERENCES fb_accounts(id) ON DELETE SET NULL,
  group_name text,
  group_url text,
  status text NOT NULL CHECK (status IN ('Sent','Failed','Skipped','Checkpoint')),
  error_message text,
  posted_at timestamptz,
  created_time timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON campaign_run_items (run_id);
CREATE INDEX ON campaign_run_items (social_group_id, posted_at DESC); -- thay thế "Fetch Posting Logs" cũ, dùng cho check 24h cooldown
```
`group_name`/`group_url` lưu **snapshot** tại thời điểm chạy (không chỉ dựa vào FK) để log vẫn đọc được đúng dù group bị đổi tên/xoá sau này — giống tinh thần lưu `group_name` độc lập ở code n8n hiện tại.

### 3.4. Bảng mới `fb_accounts` + `fb_account_groups` (khớp schema thật ở Notion, mục 1.5)

```sql
CREATE TABLE fb_accounts (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v7(),
  notion_id uuid, -- lưu vết nguồn migrate, giống pattern campaigns.notion_id/social_group_urls.notion_id
  account_name text NOT NULL,
  account_ref text NOT NULL UNIQUE, -- khớp Account ID trong Notion / tên thư mục session engine, vd "acc_01"
  fb_profile_url text,
  proxy_url text, -- ⚠️ chứa username:password thật, xem cảnh báo mục 1.5
  reset_ip_url text, -- API đổi IP 4G mProxy giữa các phiên
  daily_quota int NOT NULL DEFAULT 6,
  status text NOT NULL DEFAULT 'Active' CHECK (status IN ('Active','Cooldown','Restricted','Checkpoint','Inactive')), -- đúng 5 trạng thái thật ở Notion
  last_posted_at timestamptz,
  last_warmed_at timestamptz,
  notes text, -- gồm cả 2FA backup, coi là nhạy cảm giống proxy_url
  created_time timestamptz NOT NULL DEFAULT now(),
  updated_time timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE fb_account_groups (
  fb_account_id uuid NOT NULL REFERENCES fb_accounts(id) ON DELETE CASCADE,
  social_group_id uuid NOT NULL REFERENCES social_group_urls(id) ON DELETE CASCADE,
  joined_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (fb_account_id, social_group_id)
);
```
✅ **Có dữ liệu thật để migrate ngay** (2 dòng: acc_01, acc_02 — xem mục 1.5 và mục 9), không cần chờ anh cung cấp danh sách tay như bản plan lần 1.

### 3.5. Sửa `campaign_social_groups` và `social_group_urls` (thêm cột phục vụ Auto-Join, theo `ATS_Notion_FB_MultiAccount_Schema.md` mục 2)

```sql
ALTER TABLE campaign_social_groups
  ADD CONSTRAINT campaign_social_groups_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE,
  ADD CONSTRAINT campaign_social_groups_social_group_id_fkey FOREIGN KEY (social_group_id) REFERENCES social_group_urls(id) ON DELETE CASCADE;

ALTER TABLE social_group_urls
  ADD COLUMN is_active boolean NOT NULL DEFAULT true,
  ADD COLUMN join_status text NOT NULL DEFAULT 'Not Joined'
    CHECK (join_status IN ('Not Joined','Pending Approval','Joined','Needs Custom Answer','Manual Join Only')),
  ADD COLUMN admin_questions text,       -- bot tự trích xuất câu hỏi xét duyệt của admin nhóm
  ADD COLUMN custom_join_answer text,    -- User điền sẵn câu trả lời chuẩn để bot tự dùng lại
  ADD COLUMN question_screenshot_url text,
  ADD COLUMN last_posted_account_id uuid REFERENCES fb_accounts(id) ON DELETE SET NULL; -- để luân phiên nick giữa các lần đăng

CREATE UNIQUE INDEX social_group_urls_url_norm_key ON social_group_urls (lower(trim(url)));
```
Unique index chuẩn hoá (`lower(trim(url))`) chính là chìa khoá giải quyết vấn đề tốc độ ở mục 4. `join_status`/`admin_questions`/`custom_join_answer` phục vụ trực tiếp workflow (C) Auto-Join ở mục 6.

### 3.6. Bảng mới `warm_join_runs` + `warm_join_run_items` — lịch sử workflow (C) Auto-Warm & Auto-Join

Thiết kế đối xứng với `campaign_runs`/`campaign_run_items` (mục 3.2-3.3) để nhất quán, phục vụ đúng tinh thần "báo cáo lượt chạy để tiện fix bug" anh yêu cầu — áp dụng luôn cho workflow phụ này, không chỉ Campaign:

```sql
CREATE TABLE warm_join_runs (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v7(),
  status text NOT NULL DEFAULT 'Running' CHECK (status IN ('Running','Completed','Failed','PartialSuccess')),
  trigger_source text NOT NULL DEFAULT 'cron', -- 'cron' | 'ats_ui' (nếu sau này thêm nút "Run Now")
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  stats jsonb, -- {totalAccounts, totalGroupsAssigned, joinedCount, pendingCount, failedCount}
  summary text,
  error_message text,
  n8n_execution_id text,
  created_time timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON warm_join_runs (started_at DESC);
CREATE UNIQUE INDEX one_running_warm_join_run ON warm_join_runs (status) WHERE status = 'Running'; -- chỉ 1 phiên nuôi/join chạy cùng lúc, tránh 2 phiên tranh cùng 1 nick

CREATE TABLE warm_join_run_items (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v7(),
  run_id uuid NOT NULL REFERENCES warm_join_runs(id) ON DELETE CASCADE,
  fb_account_id uuid REFERENCES fb_accounts(id) ON DELETE SET NULL,
  social_group_id uuid REFERENCES social_group_urls(id) ON DELETE SET NULL,
  group_name text,
  group_url text,
  action text NOT NULL CHECK (action IN ('Warmed','JoinRequested','AutoAnswered','Joined','Failed','Checkpoint')),
  error_message text,
  created_time timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON warm_join_run_items (run_id);
```

---

## 4. Trả Lời Câu Hỏi Của Anh: Supabase Có Xử Lý Import Social Group URL Nhanh Hơn Không?

**Có, và chênh lệch sẽ rất lớn.** Cơ chế cũ (mục 1.1) phải kéo về **toàn bộ** record hiện có qua Notion API (phân trang, mỗi trang ~100 dòng, độ trễ mạng round-trip từng trang) rồi so trùng bằng JS — thời gian chạy **tỉ lệ thuận với số dòng đã có trong DB**, càng dùng lâu càng chậm.

Với unique index ở mục 3.5, thao tác import chỉ còn là **1 câu SQL duy nhất**, bất kể DB đang có bao nhiêu dòng:
```sql
INSERT INTO social_group_urls (name, url, group_type)
SELECT * FROM unnest($1::text[], $2::text[], $3::text[][])
ON CONFLICT (lower(trim(url))) DO NOTHING
RETURNING id, name, url;
```
n8n chỉ còn việc tải CSV rồi POST nguyên mảng sang 1 API (`/api/webhooks/import-social-groups`), không cần tự so trùng nữa — độ trễ giảm từ "tỉ lệ với kích thước DB" xuống gần như hằng số (1 round-trip DB có index).

---

## 5. Lớp API / Server Actions (`src/app/campaign_actions.js` — file mới, theo đúng pattern `hitl_actions.js`/`notification_actions.js` đã có)

- `getCampaigns(filters)` — danh sách + rollup lượt chạy gần nhất (LEFT JOIN LATERAL `campaign_runs` mới nhất).
- `getCampaignDetail(id)` — campaign + target groups + lịch sử `campaign_runs`.
- `getCampaignRunDetail(runId)` — 1 run + toàn bộ `campaign_run_items`.
- `createCampaign()` / `updateCampaign()` / `setCampaignTargetGroups(id, groupIds[])`.
- **`triggerCampaignRun(campaignId)`** — quan trọng nhất, theo đúng disciplines đã áp dụng cho CV Parser (lock + guard):
  1. `sql.begin`: `pg_advisory_xact_lock(hashtext(campaignId))` (giống PHẦN J.3 CV Parser).
  2. Kiểm tra `campaigns.is_active = true` và chưa có run `Running` (guard kép: check code + unique partial index mục 3.2 chặn ở tầng DB nếu có race).
  3. `INSERT campaign_runs (status='Running', triggered_by=<user>)`.
  4. `UPDATE campaigns SET status='Running'`.
  5. `INSERT notifications (type='campaign_started', metadata={campaignId, runId, campaignName}, link='/campaigns?campaign_id=...&run_id=...')`.
  6. Gọi webhook n8n (POST `{campaignId, runId}`), không chờ kết quả cuối (webhook n8n phản hồi ngay theo cấu hình hiện tại).
- `getFbAccounts()` / `createFbAccount()` / `updateFbAccount()` / `setFbAccountGroups(accountId, groupIds[])` — **`proxy_url`/`notes` che 1 phần khi trả về danh sách** (vd chỉ hiện `ip.mproxy.vn:12167`, ẩn username:password), chỉ hiện đầy đủ khi mở form sửa 1 account cụ thể — đúng tinh thần bảo mật dữ liệu nhạy cảm đã lưu ý ở mục 1.5.
- `importSocialGroupUrls(rows[])` — bulk upsert như mục 4.
- `getWarmJoinRuns()` / `getWarmJoinRunDetail(runId)` — đối xứng với `campaign_runs`, phục vụ tab "Warm & Join History" ở mục 7.

### Webhook API routes mới (`src/app/api/webhooks/`)
- **`campaign-data`** (GET, n8n gọi) — trả về JSON gộp: campaign + target groups đang `is_active` + `fb_accounts` đang `Active` còn quota hôm nay + lịch sử đăng 24h qua từ `campaign_run_items` — **thay thế 3 lệnh Notion cũ (Fetch Active Groups / Fetch Active FB Accounts / Fetch Posting Logs) bằng 1 API call duy nhất**.
- **`campaign-run-callback`** (POST, n8n gọi sau khi Playwright chạy xong) — nhận kết quả gộp toàn bộ run, 1 transaction: bulk insert `campaign_run_items`, update `campaign_runs`/`campaigns`/`fb_accounts` (nếu có checkpoint), insert `notifications(type='campaign_completed')`.
- **`import-social-groups`** (POST, n8n gọi) — bulk upsert mục 4.
- **`warm-join-data`** (GET, n8n gọi, cron trigger) — trả về `fb_accounts` đang `Active` + `social_group_urls` có `join_status != 'Joined'` — thay thế `Fetch Active FB Accounts`/`Fetch Target Social Groups` (Notion) trong workflow (C).
- **`warm-join-run-callback`** (POST, n8n gọi sau khi warm/join chạy xong) — bulk insert `warm_join_run_items`, update `warm_join_runs`, update `fb_accounts.last_warmed_at`/`status`, update `social_group_urls.join_status`/`admin_questions` (nếu bot phát hiện câu hỏi mới cần User điền `custom_join_answer`) — kèm `notifications(type='warm_join_completed')` nếu có group nào rơi vào `Needs Custom Answer` (cần User chú ý ngay).
- Cả 5 route cần header `x-internal-secret` (so với ENV var) để chặn truy cập trái phép — mức tối thiểu bắt buộc trước khi deploy, theo đúng tôn chỉ bảo mật ở GEMINI.md Phần C.1.

---

## 6. Điều Chỉnh n8n Workflow — Node Cũ → Node Mới

**Do AG không có quyền truy cập MCP n8n, phần này Claude sẽ tự thực hiện trực tiếp** (đúng tiền lệ PHẦN O của CV Parser), không giao spec cho AG.

| Node cũ (Notion-based) | Xử lý |
|---|---|
| Notion Trigger polling | Xoá hẳn (không cần nữa) |
| Webhook nhận `page_id` | Đổi payload nhận `{campaignId, runId}` trực tiếp từ Server Action |
| Extract Page ID / Get Campaign / Update Status Running / Check Status Ready (parse Notion props) | Thay bằng 1 node HTTP Request gọi `GET /api/webhooks/campaign-data` |
| Fetch Active Groups + Fetch Posting Logs (Notion, phân trang) | Đã gộp vào API trên |
| Filter Eligible Groups / Process Groups | Thay bằng Code node **Smart Dispatcher** (logic từ Blueprint mục 3.1, input đổi sang JSON phẳng từ API) |
| Anti-Spam Delay, Prepare Post, Has Image?, Send Preview (+Image), Wait for Approval, Process Approval, Is Approved | **GIỮ NGUYÊN 100%** — luồng duyệt qua Telegram không đổi |
| Post to Facebook Execute (`/api/facebook-post`) | Đổi sang gọi engine trên VPS theo **Phương án A hoặc B ở mục 1.3** (🔴 chưa chốt — cần AG xác nhận trước khi Claude sửa node này), payload thêm `accountId`/`proxyUrl` theo kết quả dispatch |
| Build Log Entry + Save Log (tạo từng page Notion) | Thay bằng 1 HTTP Request POST `/api/webhooks/campaign-run-callback` (gửi gộp toàn bộ kết quả 1 lần — vừa nhanh hơn vừa đúng transaction) |
| Campaign Complete (PATCH Notion) | Gộp vào callback trên |
| Telegram Report | **GIỮ NGUYÊN** |

Workflow `Import Social Group URL`: bỏ `Get Existing Notion Records` + `Custom Compare` + `Create New Pages in Notion` (tạo từng page), thay bằng 1 node HTTP Request POST `/api/webhooks/import-social-groups` gửi nguyên mảng CSV đã tải; giữ nguyên `Download Public CSV` và 2 node Telegram báo cáo.

### Workflow (C) `FB Auto-Warm & Group Auto-Joiner` — node cũ (thiết kế, chưa import) → node mới

| Node theo Blueprint (mục 2-3, dùng Notion) | Xử lý |
|---|---|
| Schedule Trigger (cron 08:30/12:30/20:30) | **GIỮ NGUYÊN** — vẫn chạy tự động theo lịch, không cần nút bấm ATS3.0 UI (có thể bổ sung thêm 1 nút "Run Now" thủ công ở trang FB Accounts sau, không bắt buộc trong lần triển khai đầu) |
| Fetch Active FB Accounts + Fetch Target Social Groups (Notion) | Thay bằng 1 HTTP Request `GET /api/webhooks/warm-join-data` |
| Smart Dispatcher & Group Allocator (Code node, Blueprint mục 3.1) | **GIỮ NGUYÊN logic phân bổ 2-3 nhóm/nick**, chỉ đổi input sang JSON phẳng từ API |
| Execute Auto-Warm & Join (Bridge `:5680/api/facebook-warm-join`) | Đổi sang gọi engine VPS theo Phương án A/B mục 1.3 — **cùng open item với workflow (A)**, khác endpoint/script (`warm-and-join.js`) |
| Sync Group Status to Notion (`Pending Approval`/`Joined`) | Gộp vào 1 HTTP Request POST `/api/webhooks/warm-join-run-callback` |
| Send Summary Report to Telegram | **GIỮ NGUYÊN** |

⚠️ Trường hợp bot gặp câu hỏi xét duyệt mới chưa có `custom_join_answer` sẵn (`join_status = 'Needs Custom Answer'`): callback API phải insert `notifications` mức độ `severity='warning'` để User biết vào điền câu trả lời — không được để lặng lẽ bỏ qua nhóm đó.

---

## 7. Thiết Kế UI (áp dụng đúng mục 1.4 GEMINI.md vừa thêm — MVC, function-first, không hiệu ứng màu mè, tái dùng component có sẵn)

- **Tab điều hướng mới "Campaigns"** trong Action Menu, dùng lại bố cục Master Table + Fixed Viewport + Auto-Slide đã có.
- **Bảng Master Campaigns**: Campaign Name, Channel, Job (liên kết), Status (badge, đồng bộ từ `campaigns.status`), số Target Groups, Last Run (badge trạng thái + thời gian tương đối), Total Sent/Replied (rollup tính từ `campaign_runs`), nút **Run Campaign** (tự disable khi đang `Running`, tái dùng logic tương tự nút xử lý trong `PendingCVClientWrapper.js`).
- **Click 1 dòng → Detail Panel dưới** (giữ nguyên cơ chế Action Timeline hiện có), 2 tab con:
  - **Overview**: content, target_criteria, start/end date, danh sách Social Groups mục tiêu — chọn bằng **`Checkbox` pattern tái dùng nguyên từ `PendingCVClientWrapper.js`**, không viết control mới.
  - **Run History**: bảng `campaign_runs` (mới nhất trước), mỗi dòng mở rộng xem `stats` + `summary` + danh sách `campaign_run_items` lỗi — **tái dùng khung `ActivityLogPanel`** đã dùng chung cho Candidates/Jobs, không viết component timeline mới.
- **Trang riêng "FB Accounts"**: bảng CRUD đơn giản (tên, `account_ref`, `fb_profile_url`, proxy — hiện dạng che bớt như mục 5, quota, status dùng **`Select` tái dùng từ `PendingCVClientWrapper.js`** với đúng 5 option `Active/Cooldown/Restricted/Checkpoint/Inactive`), gán groups đã join bằng Checkbox multi-select. Có 2 tab con:
  - **Accounts**: bảng CRUD như trên.
  - **Warm & Join History**: bảng `warm_join_runs` (mới nhất trước), tái dùng khung `ActivityLogPanel` giống Run History của Campaigns (mục 7 cũ) — mỗi dòng mở rộng xem `stats` + danh sách `warm_join_run_items`.
- **Cột `Join Status` trên bảng Social Groups** (trong Master Search Menu tab Social Groups, hoặc thêm cột vào bảng chọn Target Groups ở Campaign Overview): badge theo 5 trạng thái (`Not Joined/Pending Approval/Joined/Needs Custom Answer/Manual Join Only`) — nhóm `Needs Custom Answer` nên có màu cảnh báo rõ để User biết cần vào điền `custom_join_answer`.

## 8. Notification Center

Không cần bảng mới — bảng `notifications` đã đủ tổng quát. Chỉ cần thêm 3 `type` mới:
- `campaign_started` (lúc trigger campaign) và `campaign_completed` (lúc callback nhận kết quả) — `metadata` chứa `{campaignId, runId, campaignName}`, `link` trỏ thẳng vào trang Campaigns kèm query params.
- `warm_join_needs_attention` (khi có group rơi vào `Needs Custom Answer`, mục 6) — `metadata` chứa `{runId, socialGroupId, groupName}`, `link` trỏ tới Social Group cần điền câu trả lời.
- `PendingCVClientWrapper.js` đã có cơ chế hiển thị/đánh dấu đã đọc — chỉ thêm mapping icon/label cho 3 `type` mới, không viết lại component.

---

## 9. Kế Hoạch Di Chuyển Dữ Liệu (Migration & Cutover)

1. Script Node chạy 1 lần: đọc trực tiếp Notion API **4 database** (Campaigns 22 dòng, Social Group URL 455 dòng ở `public`, **FB Accounts 2 dòng** — mục 1.5), map đúng field, upsert sạch vào Supabase (sửa các lỗi "Unknown Campaign"/thiếu `job_id`/`channel` hiện tại). **Không cần anh cung cấp danh sách tay nữa** — 2 account thật (`acc_01`, `acc_02`) migrate được trực tiếp; anh chỉ cần thêm account mới sau này qua UI mới nếu có.
2. Sau khi ATS 3.0 pass QA end-to-end (chạy thử ít nhất 1 campaign thật quy mô nhỏ + 1 chu kỳ warm/join), archive 3 workflow n8n cũ (kể cả 2 bản mới chưa từng chạy nếu không dùng tới) + Notion Trigger polling, thông báo dừng dùng nút bấm trên Notion.

---

## 10. Lộ Trình Triển Khai (chia PHẦN để giao AG theo đúng quy trình 2-agent)

| PHẦN | Nội dung | Ai làm |
|---|---|---|
| 0 | **Xác nhận với AG cơ chế gọi engine Playwright trên VPS** (HTTP service riêng hay Execute Command — mục 1.3) | **User + AG** — chặn PHẦN 4, nên làm song song lúc Claude đang làm PHẦN 1-3 |
| 1 | DDL: tạo/sửa 8 bảng, FK, unique index (mục 3) | **Claude** (schema core, qua Supabase MCP trực tiếp) |
| 2 | Script migration dữ liệu sạch từ Notion (Campaigns + Social Groups + **FB Accounts** — cả 3 đều có dữ liệu thật, tự động hoá được 100%) | **Claude** |
| 3 | Server Actions + 5 webhook API routes (mục 5) | **AG** (giao Implementation Spec chi tiết) |
| 4 | Điều chỉnh 3 workflow n8n — (A) đăng bài, (B) import group, (C) warm & join (mục 6) | **Claude** (AG không có quyền n8n MCP) — cần kết quả PHẦN 0 trước khi sửa node gọi engine |
| 5 | UI: Campaigns list/detail/run history, trang FB Accounts (2 tab), Join Status trên Social Groups, notification mapping (mục 7-8) | **AG** (giao Implementation Spec chi tiết, áp dụng mục 1.4 GEMINI.md) |
| 6 | QA end-to-end: chạy thử 1 campaign thật nhỏ + 1 chu kỳ warm/join, xác nhận toàn luồng, rồi cutover Notion | **Claude** |

## 11. Rủi Ro, Phản Hồi Từ User & Giải Đáp Kỹ Thuật Từ AG (Cập Nhật 2026-09-02)

_Cập nhật bởi: Antigravity (Implementer) — 2026-09-02 (theo chỉ đạo từ User)_

---

### 11.1. [ĐÃ GIẢI TỎA CHẶN PHẦN 4] Cơ chế n8n gọi engine Playwright trên VPS
* **Vấn đề đặt ra ban đầu:** Chưa xác định cơ chế n8n gọi script Playwright trên VPS (HTTP service riêng hay Execute Command).
* **Phản hồi kỹ thuật từ Antigravity (Implementer) gửi Claude (Architect/QA):**
  1. **Hiện trạng mã nguồn:** Các script Playwright (`run-batch.js`, `post-to-group.js`, `warm-and-join.js`) được thiết kế nhận input qua file JSON/CLI argument (`node run-batch.js <payload.json>`, `node warm-and-join.js <payload.json>`) và xuất kết quả qua `stdout`.
  2. **Vì sao KHÔNG nên dùng Execute Command trực tiếp từ container n8n:**
     - n8n Docker trên VPS mặc định bật cờ bảo mật sandbox (`N8N_BLOCK_ENV_ACCESS_IN_NODE=true`) và không cài sẵn trọn bộ dependencies đồ họa Linux của Chromium (`libnss3`, `libasound2`, `libgbm1`...).
     - Việc chạy browser automation trực tiếp trong n8n container dễ gây nghẽn tài nguyên và nguy cơ crash n8n engine.
  3. **Đề xuất chốt Phương án A (HTTP Microservice Bridge qua PM2/Docker):**
     - Triển khai một HTTP Bridge service siêu nhẹ (Node.js/Express, chạy daemon qua **PM2** trên VPS hoặc container riêng) lắng nghe cổng nội bộ (ví dụ `http://172.17.0.1:5680` hoặc internal domain).
     - Cung cấp 2 endpoint:
       - `POST /api/facebook-post-v2`: Nhận payload chiến dịch từ n8n ➔ spawn `node run-batch.js <temp_path>` ➔ trả JSON kết quả gộp `{ success, results }` về cho n8n.
       - `POST /api/facebook-warm-join`: Nhận payload nuôi nick từ n8n ➔ spawn `node warm-and-join.js <temp_path>` ➔ trả JSON kết quả về cho n8n.
     - **Phía n8n:** Chỉ cần dùng **HTTP Request Node** chuẩn (đọc `baseUrl` từ node `Config` tập trung), cấu hình `timeout: 3600000` (1 tiếng) và `continueOnFail: true`.

---

### 11.2. Trạng thái các script Playwright trên VPS
* Các script (`post-to-group.js`, `run-batch.js`, `warm-and-join.js`) trên VPS đã được cấu hình đồng bộ tương thích với phiên bản tại `facebook auto posting 2.0/`. Sẽ được kiểm thử E2E trong vòng QA tích hợp.

---

### 11.3. Cơ chế bảo mật thông tin nhạy cảm (`proxy_url`, `notes/2FA` trong `fb_accounts`)
* **Quyết định từ User (Product Owner):** Bắt buộc phải có cơ chế bảo mật chặt chẽ cho các thông tin proxy, mật khẩu và 2FA này.
* **Giải pháp kỹ thuật từ Antigravity (Implementer):**
  1. **Lớp 1 (Encryption at Rest):** Mã hóa các trường nhạy cảm (`proxy_url`, `notes`/2FA) bằng thuật toán chuẩn `AES-256-GCM` (module `crypto` Node.js) với khóa bí mật `APP_ENCRYPTION_SECRET` trong `.env.local` trước khi `INSERT`/`UPDATE` vào Supabase.
  2. **Lớp 2 (Data Masking UI/API):** Hàm `getFbAccounts()` khi trả dữ liệu danh sách cho Frontend mặc định tự động che chuỗi nhạy cảm (`http://***:***@ip.mproxy.vn:12167` hoặc `••••••••••••`). Chỉ mở hiển thị khi người dùng có thẩm quyền mở form sửa tài khoản cụ thể.
  3. **Lớp 3 (Log Sanitization):** Tuyệt đối không log thông tin proxy/2FA ra console/stdout, `DEVELOPMENT_LOG.md`, notification metadata hay git commits.
  4. **Lớp 4 (Internal Header Secret):** Endpoint `GET /api/webhooks/campaign-data` bắt buộc kiểm tra header xác thực `x-internal-secret` trước khi cung cấp proxy cho n8n.

---

### 11.4. Xử lý triệt để vấn đề RLS (Row Level Security)
* **Quyết định từ User (Product Owner):** Yêu cầu xử lý dứt điểm vấn đề RLS trên các bảng mới.
* **Giải pháp kỹ thuật từ Antigravity (Implementer):**
  1. **Bật RLS trên toàn bộ 8 bảng mới:**
     ```sql
     ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;
     ALTER TABLE campaign_runs ENABLE ROW LEVEL SECURITY;
     ALTER TABLE campaign_run_items ENABLE ROW LEVEL SECURITY;
     ALTER TABLE campaign_fb_accounts ENABLE ROW LEVEL SECURITY;
     ALTER TABLE fb_accounts ENABLE ROW LEVEL SECURITY;
     ALTER TABLE fb_account_groups ENABLE ROW LEVEL SECURITY;
     ALTER TABLE warm_join_runs ENABLE ROW LEVEL SECURITY;
     ALTER TABLE warm_join_run_items ENABLE ROW LEVEL SECURITY;
     ```
  2. **Thu hồi toàn bộ quyền từ `anon` và `authenticated` (Chặn 100% public PostgREST API):**
     ```sql
     REVOKE ALL ON campaigns, campaign_runs, campaign_run_items, campaign_fb_accounts, 
                    fb_accounts, fb_account_groups, warm_join_runs, warm_join_run_items 
     FROM anon, authenticated;
     ```
  3. **Ủy quyền cho Backend / Service Role:**
     - Toàn bộ kết nối Next.js chạy từ Server Actions qua connection pooler `postgres` (`src/lib/db.js`) và API routes có `x-internal-secret`, đảm bảo backend hoạt động mượt mà 100% mà không bao giờ bị lộ dữ liệu ra client qua `anon_key`.

---

### 11.5. Webhook API Internal Secret
* Bổ sung biến môi trường `INTERNAL_WEBHOOK_SECRET` vào `.env.local` và cấu hình khớp với header `x-internal-secret` trong node `Config` của n8n.

---

### 11.6. Loại bỏ Telegram — Chuyển toàn bộ sang Notification Center In-App
* **Quyết định từ User (Product Owner):** Loại bỏ hoàn toàn sự phụ thuộc vào Telegram, thay vào đó hãy sử dụng cơ chế của Notification Center (tham khảo phần CV Parser đã làm trước đó).
* **Thiết kế kỹ thuật từ Antigravity (Implementer):**
  1. **Xóa bỏ Telegram Nodes:** Xóa bỏ toàn bộ các node gửi tin nhắn/hình ảnh Telegram trong cả 3 workflow n8n (A, B, C).
  2. **Bàn làm việc Duyệt Chiến Dịch (In-App Preview & Approval Modal):**
     - Khi User bấm nút `Run Campaign` trên trang Campaigns, ứng dụng mở **Modal / Drawer Xem trước (Preview & Dispatch Breakdown)** hiển thị: Nội dung bài viết, hình ảnh, danh sách nhóm mục tiêu và phân bổ Nick FB / Proxy.
     - User có thể tích/bỏ tích nhóm hoặc chọn nick khác ➔ Bấm **`🚀 Confirm & Start Posting`** (hoặc `✕ Cancel`).
  3. **Cập nhật tiến độ Realtime (In-place Notification Updates):**
     - Khi khởi chạy: Sinh thông báo `campaign_started` (`"🚀 Đang chạy chiến dịch [Tên Chiến Dịch]... (0/N nhóm hoàn tất)"`).
     - Trong lúc chạy: Webhook gọi `POST /api/webhooks/notifications` kèm `id` để cập nhật tiến độ tại chỗ sau mỗi nhóm/account đăng xong.
     - Khi hoàn tất: Cập nhật thông báo sang `campaign_completed` kèm tổng kết (thành công / lỗi / checkpoint) và link dẫn thẳng tới tab **Run History** của Campaign.
  4. **Quy trình Auto-Warm & Auto-Join (Workflow C):**
     - Chạy định kỳ tự động theo cron ➔ Bắn thông báo tổng kết vào Notification Center.
     - Nếu phát hiện câu hỏi xét duyệt mới (`Needs Custom Answer`) ➔ Bắn notification mức độ `warning` để User bấm vào điền câu trả lời mẫu ngay trên UI ATS 3.0.

