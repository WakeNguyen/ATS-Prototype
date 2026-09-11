# FIX_SPEC: Cutover DB_SCHEMA sandbox → public + sửa data lệch + verify 3-way lock (06/09/2026)

Giao AG thực hiện toàn bộ (backup, sửa data, migration, đổi schema) theo đúng thứ tự dưới đây. Claude sẽ QA lại bằng query đọc sau khi AG báo xong — KHÔNG cần AG tự QA lại, chỉ cần làm đúng spec và báo kết quả mỗi bước (số dòng ảnh hưởng).

Bối cảnh: User cần dùng ATS 3.0 thật (schema `public`) từ ngày mai, dùng tài khoản Facebook thật. Toàn bộ dữ liệu campaign/FB account/warm-join hiện đang nằm ở schema `sandbox` (build/test bằng tài khoản thật), cần chuyển nguyên sang `public`.

## Bước 0 — Backup (BẮT BUỘC, làm trước khi chạy bất kỳ UPDATE/INSERT nào ở các bước sau)

```sql
CREATE SCHEMA IF NOT EXISTS backup_20260906;
CREATE TABLE backup_20260906.campaigns AS SELECT * FROM sandbox.campaigns;
CREATE TABLE backup_20260906.campaign_runs AS SELECT * FROM sandbox.campaign_runs;
CREATE TABLE backup_20260906.campaign_run_items AS SELECT * FROM sandbox.campaign_run_items;
CREATE TABLE backup_20260906.fb_accounts AS SELECT * FROM sandbox.fb_accounts;
CREATE TABLE backup_20260906.fb_account_groups AS SELECT * FROM sandbox.fb_account_groups;
CREATE TABLE backup_20260906.campaign_fb_accounts AS SELECT * FROM sandbox.campaign_fb_accounts;
CREATE TABLE backup_20260906.campaign_social_groups AS SELECT * FROM sandbox.campaign_social_groups;
CREATE TABLE backup_20260906.warm_join_runs AS SELECT * FROM sandbox.warm_join_runs;
CREATE TABLE backup_20260906.warm_join_run_items AS SELECT * FROM sandbox.warm_join_run_items;
CREATE TABLE backup_20260906.notifications AS SELECT * FROM sandbox.notifications;
```
Đây là backup ở tầng DB (đủ để rollback nếu migration bước sau sai). Báo lại số dòng mỗi bảng backup khớp với bảng gốc.

## Bước 1 — Sửa 1 dòng data lệch (đã xác định chính xác, KHÔNG cần điều tra thêm)

Đã kiểm tra lại `sandbox.campaign_runs` (`id=01a073da-78db-4b22-a5dc-bc552240eaf5`) và `sandbox.campaign_run_items` (`id=01a073da-802a-7a2e-bf81-a4331160e3ff`) — **CẢ 2 bảng này đã đúng rồi** (status='Failed', summary/error_message khớp thực tế — có thể đã được tự sửa ở lần fix trước, không phải lỗi hiện tại nữa). Chỉ còn `sandbox.notifications` (`id=01a073da-7884-2ce0-8b0b-46b19bf29109`) có `metadata->'progress'` bị lệch (còn ghi `sent:1, completed:1` từ lúc bug false-success, trong khi các field khác đã đúng là thất bại):

```sql
UPDATE sandbox.notifications
SET metadata = jsonb_set(
  metadata,
  '{progress}',
  '{"sent":0,"failed":1,"skipped":0,"completed":0,"milestone":100,"checkpoint":0,"totalPlanned":1}'::jsonb
)
WHERE id = '01a073da-7884-2ce0-8b0b-46b19bf29109';
```

## Bước 2 — Migration data campaign: `sandbox` → `public`

`public` hiện đang RỖNG ở toàn bộ các bảng dưới đây (đã verify), nên giữ nguyên `id` khi copy — KHÔNG cần remap gì cho các bảng này:

```sql
INSERT INTO public.fb_accounts SELECT * FROM sandbox.fb_accounts;
INSERT INTO public.campaigns SELECT * FROM sandbox.campaigns;
INSERT INTO public.campaign_runs SELECT * FROM sandbox.campaign_runs;
INSERT INTO public.campaign_run_items SELECT * FROM sandbox.campaign_run_items;
INSERT INTO public.campaign_fb_accounts SELECT * FROM sandbox.campaign_fb_accounts;
INSERT INTO public.warm_join_runs SELECT * FROM sandbox.warm_join_runs;
INSERT INTO public.warm_join_run_items SELECT * FROM sandbox.warm_join_run_items;
```

**Ngoại lệ — 2 bảng dưới đây PHẢI remap vì tham chiếu `social_group_urls`, mà `public.social_group_urls` và `sandbox.social_group_urls` tuy trùng 100% URL nhưng ID khác hoàn toàn (đã verify: 0/1028 id match):**

```sql
-- campaign_social_groups: remap social_group_id theo URL
INSERT INTO public.campaign_social_groups (campaign_id, social_group_id, /* liệt kê đủ cột còn lại trừ id/social_group_id nếu có default, hoặc SELECT tường minh từng cột */ created_at)
SELECT csg.campaign_id, pub_sgu.id, csg.created_at
FROM sandbox.campaign_social_groups csg
JOIN sandbox.social_group_urls sbx_sgu ON sbx_sgu.id = csg.social_group_id
JOIN public.social_group_urls pub_sgu ON lower(trim(pub_sgu.url)) = lower(trim(sbx_sgu.url));

-- fb_account_groups: remap social_group_url_id (tên cột thật cần AG xác nhận qua \d fb_account_groups) theo URL
INSERT INTO public.fb_account_groups (fb_account_id, social_group_id, /* các cột khác giữ nguyên */ ...)
SELECT fag.fb_account_id, pub_sgu.id, /* ... */
FROM sandbox.fb_account_groups fag
JOIN sandbox.social_group_urls sbx_sgu ON sbx_sgu.id = fag.social_group_id  -- đổi đúng tên cột FK thật
JOIN public.social_group_urls pub_sgu ON lower(trim(pub_sgu.url)) = lower(trim(sbx_sgu.url));
```

⚠️ AG cần tự chạy `\d sandbox.campaign_social_groups` và `\d sandbox.fb_account_groups` để lấy đúng tên cột (Claude không có structure đầy đủ 2 bảng này trong ngữ cảnh hiện tại) rồi viết lại `INSERT ... SELECT` liệt kê đủ cột thật thay vì `SELECT *` (vì phải remap 1 cột giữa chừng, không thể dùng `SELECT *` nguyên khối cho 2 bảng này).

**Notifications — chỉ migrate phần liên quan campaign** (đã khảo sát: sandbox có 47 dòng, gồm `campaign_completed` 7, `warm_join_started` 5, `warm_join_completed` 5 — 3 loại này chắc chắn liên quan campaign; `cv_batch_progress` 14, `cv_single_import` 7 KHÔNG liên quan — bỏ qua; `workflow_error` 9 dòng cần AG tự kiểm tra `metadata`/`link` xem có phải lỗi của campaign/warming không rồi quyết định gộp thêm hay bỏ):

```sql
INSERT INTO public.notifications
SELECT * FROM sandbox.notifications
WHERE type IN ('campaign_completed', 'warm_join_started', 'warm_join_completed');
-- Tự xét thêm type='workflow_error' nếu metadata/link cho thấy liên quan campaign/warming.
```

## Bước 3 — Đổi schema production

Sửa `.env.local`: `DB_SCHEMA=public` (đang là `sandbox`). Restart Next.js process để áp dụng (biến env chỉ đọc lúc process khởi động).

## Bước 4 — Báo cáo lại cho Claude QA

Sau khi xong, báo lại: số dòng đã insert mỗi bảng ở Bước 2 (đối chiếu đúng bằng số liệu backup Bước 0), và xác nhận `.env.local` đã đổi + đã restart. Claude sẽ tự query đối chiếu `public` vs `sandbox` (row count + vài dòng mẫu) trước khi coi là xong.

## Ghi chú thêm — KHÔNG cần làm gì thêm cho race condition 3-way lock

Đã verify code hiện tại (`campaign_actions.js`, commit `27b59df` "Hardening: 3-way per-account mutex lock", đã merge vào `master`): `_getBusyFbAccountIds()` đã được gọi ở CẢ 3 nơi (Job Posting `_getEligibilityState` dòng ~595, Warming `_acquireWarmJoinRunLock` dòng ~1567, và Workflow D route `group-membership-sync-data`), check đủ 4 nguồn bận (Job Posting qua `campaign_runs`+`campaign_run_items`, Warming qua `warm_join_runs` cửa sổ 2h, Sync qua `group_membership_sync_runs` cửa sổ 30 phút). Race condition 3 chiều đã được xử lý — KHÔNG còn là rủi ro mở, không cần fix thêm gì cho việc này trước khi deploy.
