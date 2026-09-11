# FIX SPEC — PHẦN 3: Server Actions + Webhook API cho Campaign FB Auto-Post/Warm-Join

**Từ:** Claude (Architect/QA)
**Gửi:** Antigravity (Implementer)
**Ngày:** 2026-09-02
**Bắt buộc đọc trước:** `docs/architecture/PLAN_2026-09-02_campaign-fb-autopost-integration.md` (toàn bộ, đặc biệt mục 3, 5, 11 — 11.1 đến 11.6 là các quyết định kỹ thuật đã chốt cùng anh Thức, spec này triển khai cụ thể theo đúng các quyết định đó). Spec này KHÔNG lặp lại toàn bộ ngữ cảnh — nếu có gì mâu thuẫn giữa spec và Plan, báo lại cho Claude thay vì tự suy đoán.

---

## 0. Phạm vi PHẦN 3 (làm ĐÚNG phần này, không hơn không kém)

✅ Trong phạm vi:
1. File mới `src/app/campaign_actions.js` (toàn bộ Server Actions liệt kê ở mục 3).
2. File mới `src/lib/encryption.js` (helper mã hoá AES-256-GCM, mục 2).
3. 6 route mới dưới `src/app/api/webhooks/` (mục 4).
4. Sửa `src/app/components/PendingCVClientWrapper.js` — **CHỈ** thêm mapping icon/label cho 3 `notification.type` mới (mục 5). Không đổi logic hiển thị hiện có.
5. Thêm biến môi trường mẫu vào `.env.local.example` (nếu file này tồn tại trong repo) hoặc ghi rõ trong báo cáo hoàn thành các biến môi trường mới cần khai báo.

❌ NGOÀI phạm vi PHẦN 3 (đừng động vào, dù thấy tiện):
- UI (trang Campaigns, trang FB Accounts, modal duyệt) — đây là PHẦN 5, sẽ có spec riêng.
- Sửa workflow n8n — Claude tự làm (PHẦN 4), AG không có quyền n8n MCP.
- Script migration dữ liệu Notion → Supabase — PHẦN 2, Claude tự làm.

Nếu phát hiện cần sửa thêm gì ngoài danh sách file ở mục 0.1-0.5 (kể cả 1 file docs nhỏ), **DỪNG LẠI và báo Claude xin xác nhận trước**, theo đúng mục 10 GEMINI.md.

---

## 1. Schema đã có sẵn trong Supabase (Claude đã tạo xong ở PHẦN 1 — chỉ dùng, không tự tạo/sửa DDL)

Đã tạo/sửa trên CẢ HAI schema `sandbox` và `public` (app dùng biến `DB_SCHEMA`, mặc định `sandbox`):

- `campaigns` (đã có từ trước, mới thêm cột): `..., target_criteria, start_date, end_date, is_active, auto_spin_content, max_posts_per_run`. FK mới: `job_id → jobs.id`.
- `campaign_runs` (bảng mới): `id, campaign_id, status ('Running'|'Completed'|'Failed'|'PartialSuccess'), triggered_by, trigger_source, started_at, completed_at, stats (jsonb), summary, error_message, n8n_execution_id, notification_id (→ notifications.id), created_time`. Có unique partial index `one_running_run_per_campaign` (chỉ 1 run `Running`/campaign tại 1 thời điểm — DB tự chặn double-trigger).
- `campaign_run_items` (bảng mới): `id, run_id, social_group_id, fb_account_id, group_name, group_url, status ('Sent'|'Failed'|'Skipped'|'Checkpoint'), error_message, posted_at, created_time`.
- `fb_accounts` (bảng mới): `id, notion_id, account_name, account_ref (unique), fb_profile_url, proxy_url, reset_ip_url, daily_quota, status ('Active'|'Cooldown'|'Restricted'|'Checkpoint'|'Inactive'), last_posted_at, last_warmed_at, notes, created_time, updated_time`.
- `fb_account_groups` (junction mới): `fb_account_id, social_group_id, joined_at`.
- `campaign_fb_accounts` (junction mới): `campaign_id, fb_account_id` — chỉ định account cụ thể cho 1 campaign (trống = dispatcher tự chọn mọi account `Active`).
- `social_group_urls` (đã có từ trước, mới thêm cột): `..., is_active, join_status ('Not Joined'|'Pending Approval'|'Joined'|'Needs Custom Answer'|'Manual Join Only'), admin_questions, custom_join_answer, question_screenshot_url, last_posted_account_id (→ fb_accounts.id)`. Unique index `lower(trim(url))` **chỉ có ở `sandbox`** — bên `public` CHƯA có (dữ liệu cũ có trùng lặp, Claude sẽ dọn riêng ở PHẦN 2), code viết chung cho cả 2 schema nhưng đừng giả định `public` luôn dedup được ngay bây giờ.
- `warm_join_runs` / `warm_join_run_items` (bảng mới, đối xứng `campaign_runs`/`campaign_run_items`): xem cấu trúc chi tiết trong Plan mục 3.6.
- `notifications` (đã có từ trước, dùng lại nguyên bản, KHÔNG sửa schema): `id, type, title, message, severity, link, is_read, metadata (jsonb), created_at, updated_at`.

RLS đã bật trên toàn bộ 8 bảng touched, REVOKE hết quyền `anon`/`authenticated` — Server Actions của mình kết nối qua `src/lib/db.js` (connection pooler, không phải PostgREST/anon key) nên **không bị ảnh hưởng**, không cần thêm policy nào ở PHẦN 3 này.

---

## 2. `src/lib/encryption.js` — Mã hoá dữ liệu nhạy cảm (theo mục 11.3 AG đã đề xuất, User đã duyệt)

Yêu cầu:
- Thuật toán `AES-256-GCM` (module `crypto` built-in Node.js — không thêm dependency mới).
- Khoá lấy từ biến môi trường `APP_ENCRYPTION_SECRET` (32 byte, khai báo trong `.env.local`; nếu thiếu biến này lúc runtime, throw lỗi rõ ràng ngay khi khởi động thay vì âm thầm lưu plaintext).
- 2 hàm export: `encryptSecret(plainText) → string` (định dạng lưu: `iv:authTag:ciphertext`, mỗi phần base64, nối bằng dấu `:`) và `decryptSecret(cipherText) → string`. `encryptSecret(null/undefined)` trả về `null` (không lỗi).
- Dùng cho đúng 2 cột: `fb_accounts.proxy_url` và `fb_accounts.notes` — mã hoá TRƯỚC khi `INSERT`/`UPDATE`, giải mã SAU khi `SELECT` (chỉ giải mã ở phía server, không bao giờ trả ciphertext thô ra client mà không qua bước mask ở mục 3.5).
- **Không** mã hoá `reset_ip_url` (link API đổi IP, không chứa credential trực tiếp trong URL path theo cấu trúc hiện tại — nhưng nếu để ý thấy URL có chứa key dạng tương tự API key, báo lại Claude, đừng tự quyết định mã hoá thêm ngoài phạm vi đã chốt).

Verify bắt buộc trước khi báo cáo: viết 1 test nhỏ (script tạm, xoá sau khi test xong — không phải QA record chính thức) xác nhận `decryptSecret(encryptSecret(x)) === x` và xác nhận dữ liệu **thực sự khác plaintext** khi xem trực tiếp trong Supabase (query `SELECT proxy_url FROM fb_accounts` phải KHÔNG đọc được username:password gốc).

---

## 3. `src/app/campaign_actions.js` — Server Actions

Theo đúng pattern `src/app/hitl_actions.js`/`src/app/notification_actions.js` đã có (Server Actions, transaction `sql.begin` khi cần, JSDoc mô tả quyền hạn/side-effects theo mục B.2.2 GEMINI.md).

### 3.1. Campaign CRUD & đọc
- `getCampaigns(filters)` — trả danh sách + rollup lượt chạy gần nhất: `LEFT JOIN LATERAL (SELECT * FROM campaign_runs WHERE campaign_id = c.id ORDER BY started_at DESC LIMIT 1) latest_run ON true`. Tính `total_sent`/`total_replied` bằng aggregate từ `campaign_run_items` (COUNT theo status), KHÔNG lưu cứng vào `campaigns`.
- `getCampaignDetail(id)` — campaign + target groups (JOIN `campaign_social_groups` + `social_group_urls`) + danh sách `campaign_runs` (mới nhất trước).
- `getCampaignRunDetail(runId)` — 1 run + toàn bộ `campaign_run_items` liên quan.
- `createCampaign(data)` / `updateCampaign(id, data)` — validate qua Zod (theo chuẩn B.2.1 GEMINI.md), field cho phép sửa: `campaign_name, channel, post_language, post_image_url, content, target_criteria, start_date, end_date, is_active, auto_spin_content, max_posts_per_run, job_id`.
- `setCampaignTargetGroups(campaignId, groupIds[])` — thay thế TOÀN BỘ danh sách nhóm mục tiêu (DELETE hết dòng cũ trong `campaign_social_groups` theo `campaign_id`, rồi INSERT lại theo danh sách mới) trong 1 transaction. Đây là DELETE có điều kiện WHERE rõ ràng theo `campaign_id`, không phải bulk delete tuỳ tiện — vẫn OK theo mục C.9 GEMINI.md vì luôn giới hạn 1 campaign cụ thể.
- `setCampaignAssignedAccounts(campaignId, accountIds[])` — tương tự cho `campaign_fb_accounts`.

### 3.2. `computeCampaignDispatchPreview(campaignId)` — Smart Dispatcher, chạy ở server, dùng để hiển thị Modal duyệt (mục 11.6)

**Đây là hàm quan trọng nhất, thay thế hoàn toàn việc n8n tự tính dispatch** — theo quyết định bỏ Telegram, việc duyệt bài chuyển hẳn vào UI ATS 3.0, nên dispatch (nhóm nào ghép với nick nào) phải tính XONG ở đây để hiển thị cho User xem trước, KHÔNG để n8n tự tính lại (tránh 2 nơi tính ra 2 kết quả khác nhau).

Logic (chuyển thể từ Blueprint mục 3.1 gốc, đã có trong Plan — **giữ nguyên thuật toán**, chỉ đổi nguồn dữ liệu từ Notion pages sang query SQL trực tiếp):
1. Lấy target groups của campaign (`campaign_social_groups` JOIN `social_group_urls WHERE is_active = true`).
2. Lấy accounts hợp lệ: nếu `campaign_fb_accounts` có dòng nào cho campaign này → chỉ dùng đúng danh sách đó; nếu trống → mọi `fb_accounts WHERE status = 'Active'`.
3. Loại nhóm đã đăng trong 24h qua: `NOT EXISTS (SELECT 1 FROM campaign_run_items cri WHERE cri.social_group_id = sg.id AND cri.status = 'Sent' AND cri.posted_at > now() - interval '24 hours')`.
4. Tính `today_posts` mỗi account: đếm `campaign_run_items WHERE fb_account_id = acc.id AND status = 'Sent' AND posted_at >= date_trunc('day', now())`. `remaining_quota = daily_quota - today_posts`.
5. Ghép account cho từng group đủ điều kiện: ưu tiên account đã có trong `fb_account_groups` (đã join nhóm đó), chọn account có `today_posts + đã_gán_trong_lần_này` thấp nhất (load balancing), account phải còn `remaining_quota > 0`.
6. Nếu `campaigns.max_posts_per_run` có giá trị, cắt bớt danh sách dispatch cho không vượt quá số này.
7. Trả về mảng `{ socialGroupId, groupName, groupUrl, fbAccountId, accountName }[]` + `stats { totalInCampaign, eligibleCount, skippedRecentlyCount, skippedNoAccountAvailable }` — **đây chính là nội dung Modal xem trước sẽ hiển thị** (PHẦN 5 UI sẽ gọi hàm này).

### 3.3. `triggerCampaignRun(campaignId, confirmedDispatch[])` — kích hoạt chạy thật

`confirmedDispatch` là mảng User đã xác nhận trong Modal (có thể đã bỏ tick bớt/đổi account so với `computeCampaignDispatchPreview` gốc — validate lại: mỗi item phải khớp `socialGroupId`/`fbAccountId` hợp lệ đang tồn tại và account đó còn `Active`, không tin tưởng mù nguyên payload từ client).

Các bước trong 1 `sql.begin` transaction (theo đúng kỷ luật đã áp dụng cho CV Parser PHẦN J.3):
1. `SELECT pg_advisory_xact_lock(hashtext(campaignId::text))`.
2. Kiểm tra `campaigns.is_active = true`; kiểm tra chưa có `campaign_runs` nào `status = 'Running'` cho campaign này (dù đã có unique partial index chặn ở DB, vẫn check trước ở code để trả lỗi thân thiện thay vì để lộ lỗi constraint thô ra UI).
3. `INSERT INTO notifications (type='campaign_started', title, message, severity='info', link='/campaigns?campaign_id='||campaignId, metadata) RETURNING id` — lấy `notification_id`.
4. `INSERT INTO campaign_runs (campaign_id, status='Running', triggered_by=<user hiện tại nếu có auth, else 'system'>, trigger_source='ats_ui', notification_id, stats=<snapshot confirmedDispatch stats>) RETURNING id` — lấy `runId`.
5. `UPDATE campaigns SET status='Running' WHERE id = campaignId`.
6. Insert `confirmedDispatch` vào 1 bảng tạm (KHÔNG có bảng tạm riêng trong schema — dùng luôn `campaign_run_items` với `status` tạm thời không hợp lệ để track "đã lên kế hoạch"? **Không** — theo CHECK constraint hiện tại, `campaign_run_items.status` chỉ nhận `Sent/Failed/Skipped/Checkpoint`, không có trạng thái "Planned". Giải pháp: gửi nguyên `confirmedDispatch` trong payload webhook gọi n8n ở bước 7, KHÔNG ghi vào `campaign_run_items` trước — bảng này chỉ ghi KẾT QUẢ thật sau khi engine chạy xong (qua callback mục 4.3). `campaign_runs.stats` (jsonb) là nơi lưu snapshot kế hoạch dispatch đã duyệt, đủ để đối chiếu sau này.
7. Sau khi transaction commit: gọi webhook n8n (POST, ngoài transaction — không rollback DB nếu gọi n8n lỗi mạng, log lỗi và để User thấy run đang "Running" và tự retry hoặc báo Claude nếu treo lâu) — payload: `{ runId, campaignId, dispatch: confirmedDispatch, content, postImageUrl, postLanguage, autoSpinContent }`.
8. Trả về `{ runId }` cho UI để chuyển sang xem Run History / theo dõi tiến độ.

### 3.4. FB Accounts CRUD (mục 3.5 Plan)
- `getFbAccounts()` — trả danh sách, **field `proxy_url` và `notes` LUÔN qua bước mask ở mục 3.5 dưới đây**, không bao giờ trả ciphertext hay plaintext đầy đủ ở list view.
- `getFbAccountDetail(id)` — dùng khi mở form sửa 1 account cụ thể, giải mã đầy đủ `proxy_url`/`notes` ở đây (server-side), trả về cho form.
- `createFbAccount(data)` / `updateFbAccount(id, data)` — mã hoá `proxy_url`/`notes` bằng `encryptSecret()` trước khi ghi DB.
- `setFbAccountGroups(accountId, groupIds[])` — thay thế `fb_account_groups` theo `fb_account_id`.

### 3.5. Hàm mask dùng chung (`maskProxyUrl(decrypted)` trong `campaign_actions.js` hoặc `src/lib/encryption.js`)
Input dạng `http://user:pass@host:port` → output `http://***:***@host:port` (giữ nguyên host:port để User còn nhận diện được đang dùng proxy nào, che phần credential). Áp dụng cho `getFbAccounts()` list view.

### 3.6. Warm & Join (đọc, không có nút trigger trong PHẦN 3 — mục 11.6 xác nhận vẫn chạy cron tự động)
- `getWarmJoinRuns()` / `getWarmJoinRunDetail(runId)` — đối xứng `getCampaigns`/`getCampaignRunDetail`.
- `updateSocialGroupJoinAnswer(socialGroupId, customJoinAnswer)` — cho phép User điền câu trả lời mẫu khi gặp `join_status = 'Needs Custom Answer'` (link từ notification `warm_join_needs_attention` trỏ tới đây).

---

## 4. Webhook API Routes (`src/app/api/webhooks/`)

Tất cả 6 route dưới đây bắt buộc kiểm tra header `x-internal-secret` khớp biến môi trường `INTERNAL_WEBHOOK_SECRET` **trước khi làm bất kỳ việc gì khác** (theo mục 11.5) — sai/thiếu header → trả `401` ngay, không tiết lộ thêm chi tiết lỗi.

### 4.1. `GET /api/webhooks/campaign-data?campaignId=&runId=`
Trả JSON gộp cho n8n: thông tin campaign cần để post (content, postImageUrl, postLanguage, autoSpinContent) — **KHÔNG cần trả lại phần dispatch** vì n8n giờ nhận thẳng `dispatch[]` qua payload trigger ở mục 3.3 bước 7 rồi, route này chỉ dùng nếu n8n cần refetch lại thông tin campaign giữa chừng (ví dụ retry). Nếu AG thấy route này thực ra không cần thiết nữa do đã gửi đủ payload lúc trigger, **báo lại Claude trước khi bỏ qua không làm** — đừng tự quyết định bỏ route đã ghi trong spec.

### 4.2. `POST /api/webhooks/campaign-run-progress`
Payload: `{ runId, completedItem: { socialGroupId, groupName, groupUrl, fbAccountId, status, errorMessage? } }`. Xử lý:
1. `INSERT INTO campaign_run_items (...)` — 1 dòng cho item vừa hoàn tất.
2. Đọc `campaign_runs.notification_id`, `UPDATE notifications SET message = '<X>/<N> nhóm hoàn tất', metadata = jsonb_set(...), updated_at = now() WHERE id = notification_id` — **update tại chỗ**, không tạo notification mới (đúng mục 11.6.3).
3. Nếu `status IN ('Checkpoint')` → thêm cập nhật `fb_accounts.status = 'Checkpoint', last_checkpoint_at = now()` cho account tương ứng ngay lập tức (không đợi callback cuối), để dispatcher lần chạy sau không gán tiếp account đã dính checkpoint.

### 4.3. `POST /api/webhooks/campaign-run-callback`
Payload: `{ runId, status ('Completed'|'Failed'|'PartialSuccess'), summary, errorMessage?, n8nExecutionId }`. Gọi 1 lần duy nhất khi TOÀN BỘ run kết thúc (các item chi tiết đã được ghi dần qua 4.2 rồi, route này chỉ đóng run):
1. `UPDATE campaign_runs SET status=$status, completed_at=now(), summary=$summary, error_message=$errorMessage, n8n_execution_id=$n8nExecutionId WHERE id = $runId`.
2. `UPDATE campaigns SET status = CASE WHEN $status='Failed' THEN 'Failed' ELSE 'Ready' END WHERE id = (SELECT campaign_id FROM campaign_runs WHERE id=$runId)` — về lại `Ready` để có thể trigger lần sau (không phải `Completed` cứng, vì campaign vẫn có thể chạy lại).
3. `UPDATE notifications SET title='campaign_completed', message=$summary, severity=(CASE WHEN $status='Failed' THEN 'error' ELSE 'success' END) WHERE id = (SELECT notification_id FROM campaign_runs WHERE id=$runId)`.

### 4.4. `POST /api/webhooks/import-social-groups`
Payload: `{ rows: [{ name, url, groupType[] }] }`. 1 câu SQL bulk upsert (mục 4 trong Plan, dùng `unnest`), `ON CONFLICT (lower(trim(url))) DO NOTHING RETURNING id, name, url` — ⚠️ **route này chỉ hoạt động đúng trên schema `sandbox`** (có unique index); nếu `DB_SCHEMA=public`, tạm thời fallback sang kiểm tra tồn tại bằng `WHERE lower(trim(url)) = ANY($1)` trước rồi mới insert phần thiếu (chậm hơn 1 chút nhưng không lỗi), và trả thêm cảnh báo `{ warning: "public schema chưa có unique index, đã dùng fallback" }` trong response để không ai nhầm là đã tối ưu đầy đủ.

### 4.5. `GET /api/webhooks/warm-join-data`
Trả `fb_accounts WHERE status = 'Active'` + `social_group_urls WHERE join_status != 'Joined' AND is_active = true` — thay thế `Fetch Active FB Accounts`/`Fetch Target Social Groups` (Notion) trong workflow (C).

### 4.6. `POST /api/webhooks/warm-join-run-callback`
Payload: `{ runId, status, summary, errorMessage?, items: [{ fbAccountId, socialGroupId, groupName, groupUrl, action, errorMessage? }] }`. Xử lý trong 1 transaction:
1. Bulk insert `warm_join_run_items`.
2. `UPDATE warm_join_runs SET status, completed_at=now(), summary, stats=<tính từ items>`.
3. Với mỗi item có `action='Joined'` → `UPDATE social_group_urls SET join_status='Joined', last_posted_account_id=$fbAccountId WHERE id=$socialGroupId` + `INSERT INTO fb_account_groups (...) ON CONFLICT DO NOTHING`.
4. Với mỗi item có `action` gợi ý cần câu trả lời mới (ví dụ workflow trả về kèm `needsCustomAnswer: true`, `adminQuestions: "..."`) → `UPDATE social_group_urls SET join_status='Needs Custom Answer', admin_questions=$adminQuestions` **và** `INSERT INTO notifications (type='warm_join_needs_attention', severity='warning', link='/campaigns?tab=social-groups&group_id='||socialGroupId, ...)`. Đây là 1 notification MỚI cho mỗi nhóm cần chú ý (khác với progress update tại chỗ ở 4.2 — vì mỗi nhóm là 1 việc cần làm riêng biệt, không gộp).
5. `UPDATE fb_accounts SET last_warmed_at = now() WHERE id = ANY(<danh sách account có trong run>)`.

---

## 5. `PendingCVClientWrapper.js` — mapping 3 notification type mới

Thêm vào bảng mapping icon/label hiện có (không viết lại component, chỉ mở rộng switch/object mapping theo type):
- `campaign_started` → icon dạng "đang chạy" (ví dụ `Loader2` xoay hoặc tương tự icon đã dùng cho trạng thái Running ở nơi khác trong app cho nhất quán), label "Campaign đang chạy".
- `campaign_completed` → icon theo `severity` (`success`→`CheckCircle2`, `error`→`XCircle`, đã có sẵn 2 icon này trong import hiện tại của file).
- `warm_join_needs_attention` → icon `AlertTriangle` (đã có sẵn trong import hiện tại), label "Cần điền câu trả lời xét duyệt nhóm".

---

## 6. Bảo mật & Yêu cầu chống sai lệch (đọc kỹ trước khi code)

1. `proxy_url`/`notes` của `fb_accounts`: **không log ra console, không ghi vào bất kỳ file trong `docs/` (kể cả DEVELOPMENT_LOG.md), không đưa vào response lỗi (error message) nếu lỗi xảy ra khi xử lý field này** — nếu cần debug, chỉ log độ dài chuỗi hoặc `[REDACTED]`.
2. `INTERNAL_WEBHOOK_SECRET`/`APP_ENCRYPTION_SECRET`: chỉ đọc từ `process.env`, không hardcode, không đưa giá trị thật vào bất kỳ commit/spec/report nào — nếu cần ghi ví dụ, dùng placeholder `<sẽ điền sau>`.
3. Toàn bộ 6 webhook route PHẢI test bằng cách gọi thử thiếu/sai `x-internal-secret` và xác nhận nhận `401`, TRƯỚC khi test luồng đúng.
4. `triggerCampaignRun`/dispatch: viết test dữ liệu cô lập theo đúng mục 10.8 GEMINI.md (tự tạo campaign/group/account test riêng, dọn sau khi test) — **không được gọi thẳng lên `campaigns`/`fb_accounts` thật đang có** để thử nghiệm.

---

## 7. Yêu cầu Test & Báo Cáo

- Test tất cả Server Actions + routes trên `sandbox` schema (schema có đủ unique index sạch).
- Với `import-social-groups` fallback trên `public`, chỉ cần test bằng dữ liệu giả lập nhỏ, không chạy full 455 dòng thật.
- Cập nhật `docs/DEVELOPMENT_LOG.md` theo đúng mục 10.2/10.3 GEMINI.md — **cả 2 phần** (bảng tổng hợp đầu file + chi tiết dưới, xem quy tắc đã ghi nhận trước đó về việc từng bị bỏ sót bảng tổng hợp).
- Báo cáo hoàn thành phải nêu rõ: danh sách biến môi trường mới cần khai báo (`APP_ENCRYPTION_SECRET`, `INTERNAL_WEBHOOK_SECRET`), và dòng đầu tiên nêu có/không có "⚠️ Sai lệch so với spec" theo đúng mục 10.7 GEMINI.md.
