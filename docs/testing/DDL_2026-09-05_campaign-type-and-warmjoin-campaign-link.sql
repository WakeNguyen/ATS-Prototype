-- DDL_2026-09-05_campaign-type-and-warmjoin-campaign-link.sql
-- Bối cảnh đầy đủ: xem FIX_SPEC_2026-09-05_campaign-fb-autopost_campaign-type-split-and-bulk-group-assign.md
-- QUAN TRỌNG: chạy TOÀN BỘ khối lệnh bên dưới đúng 1 lần, áp dụng cho CẢ 2 schema (public + sandbox đã viết sẵn ở 2 khối riêng).
-- Đã xác nhận qua Supabase MCP tại thời điểm viết script này: campaigns = 0 dòng và warm_join_runs = 0 dòng ở CẢ 2 schema
-- -> an toàn thêm NOT NULL ngay, không cần bước backfill riêng.

-- ========================================================================
-- SCHEMA: public
-- ========================================================================

ALTER TABLE public.campaigns
  ADD COLUMN campaign_type text NOT NULL DEFAULT 'Job Posting'
    CHECK (campaign_type IN ('Job Posting', 'Warming'));

ALTER TABLE public.warm_join_runs
  ADD COLUMN campaign_id uuid REFERENCES public.campaigns(id) ON DELETE CASCADE;

ALTER TABLE public.warm_join_runs
  ALTER COLUMN campaign_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS warm_join_runs_campaign_id_started_at_idx
  ON public.warm_join_runs (campaign_id, started_at DESC);

-- ========================================================================
-- SCHEMA: sandbox
-- ========================================================================

ALTER TABLE sandbox.campaigns
  ADD COLUMN campaign_type text NOT NULL DEFAULT 'Job Posting'
    CHECK (campaign_type IN ('Job Posting', 'Warming'));

ALTER TABLE sandbox.warm_join_runs
  ADD COLUMN campaign_id uuid REFERENCES sandbox.campaigns(id) ON DELETE CASCADE;

ALTER TABLE sandbox.warm_join_runs
  ALTER COLUMN campaign_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS warm_join_runs_campaign_id_started_at_idx
  ON sandbox.warm_join_runs (campaign_id, started_at DESC);

-- ========================================================================
-- KHÔNG ĐỘNG VÀO: unique index one_running_warm_join_run (vẫn giữ khoá TOÀN CỤC
-- theo status='Running', KHÔNG đổi sang khoá theo campaign_id) -- xem PHẦN 1 mục 4
-- trong FIX_SPEC để hiểu lý do (quyết định kiến trúc, không phải thiếu sót).
-- ========================================================================

-- ========================================================================
-- VERIFY -- chạy sau khi apply xong, đối chiếu đúng kết quả mong đợi trong comment
-- ========================================================================

-- (1) Phải trả về đúng 1 dòng 'Job Posting' với count = tổng số campaign hiện có (hoặc 0 dòng nếu bảng đang trống) -- KHÔNG được có dòng nào NULL
SELECT campaign_type, count(*) FROM public.campaigns GROUP BY campaign_type;
SELECT campaign_type, count(*) FROM sandbox.campaigns GROUP BY campaign_type;

-- (2) Phải trả về is_nullable = 'NO' cho cả 2 dòng
SELECT table_schema, column_name, is_nullable
FROM information_schema.columns
WHERE table_name = 'warm_join_runs' AND column_name = 'campaign_id'
  AND table_schema IN ('public', 'sandbox');

-- (3) Phải trả về đúng FK constraint tới campaigns(id) cho cả 2 schema
SELECT tc.table_schema, tc.constraint_name, kcu.column_name, ccu.table_name AS references_table
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage ccu ON tc.constraint_name = ccu.constraint_name AND tc.table_schema = ccu.table_schema
WHERE tc.table_name = 'warm_join_runs' AND tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_schema IN ('public', 'sandbox');
