-- =====================================================================
-- Circuit Breaker Auto-Untick — Migration cho PUBLIC (bị auto-mode
-- classifier chặn khi Claude tự chạy write, kể cả từng câu DDL đơn lẻ).
-- Chạy trong Supabase Studio > SQL Editor, project "ATS 3.0"
-- (mock-supabase-project), schema public.
--
-- CHỈ CHẠY FILE NÀY SAU KHI code đã QA + deploy production (đúng thứ tự
-- an toàn giống lần trước — code mới đọc bảng circuit_breaker_log trước,
-- rồi mới backfill dữ liệu để tránh code cũ ghi đè/không hiểu dữ liệu mới).
--
-- ĐÃ XÁC NHẬN QUA QUERY TRỰC TIẾP (2026-09-15): 5 cặp (campaign, account)
-- hiện đang thỏa điều kiện breaker cũ (>=3 Failed dồn) mà CHƯA từng được
-- gỡ thật khỏi campaign_fb_accounts (vì cơ chế cũ chỉ lọc ngầm, không gỡ).
-- Liệt kê đầy đủ để PO duyệt trước khi chạy — đúng quy tắc GEMINI.md
-- Phần C mục 9 (>5 bản ghi bắt buộc xin phép, ở đây đúng 5 nên vẫn liệt
-- kê tường minh cho chắc):
--
--   1. WINPRO - 3 JOBS (Job Posting)      — Nick Chính, 9 Failed   — có 1 dòng cfa, SẼ bị xoá
--   2. Menlo Research (Job Posting)        — Nick Chính, 10 Failed  — có 1 dòng cfa, SẼ bị xoá
--   3. Accenture - 8 Jobs (Job Posting)    — Nick Chính, 190 Failed — có 1 dòng cfa, SẼ bị xoá
--   4. Test 2 (Warming, ĐÃ Archived)       — Nick Phụ, 15 Failed    — có 1 dòng cfa, SẼ bị xoá (campaign đã archived, không ảnh hưởng vận hành)
--   5. Test Warming Campaign (Warming, Active) — Nick Chính, 7 Failed — KHÔNG có dòng cfa hiện tại (account đã không còn gán), chỉ INSERT log để chặn fallback
--
-- HỆ QUẢ QUAN TRỌNG: sau khi chạy, WINPRO / Menlo Research / Accenture /
-- Test Warming Campaign sẽ có 0 FB account khả dụng và KHÔNG fallback —
-- tức 4 campaign này sẽ dừng hẳn không chạy được cho tới khi PO tự gán
-- account khác (đây là hệ quả ĐÚNG NHƯ THIẾT KẾ, các campaign này thực
-- chất đã không chạy được / đang âm thầm dùng account có vấn đề — script
-- này chỉ làm hệ quả đó HIỆN RÕ ra UI thay vì ẩn).
-- =====================================================================

BEGIN;

-- 1. Tạo bảng audit log circuit breaker (bản public, giống sandbox đã tạo)
CREATE TABLE public.campaign_account_circuit_breaker_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  fb_account_id uuid NOT NULL REFERENCES public.fb_accounts(id) ON DELETE CASCADE,
  trigger_type text NOT NULL CHECK (trigger_type IN ('job_posting','warming')),
  failed_count int NOT NULL,
  disabled_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (campaign_id, fb_account_id)
);

COMMENT ON TABLE public.campaign_account_circuit_breaker_log IS
  'Audit log of FB accounts auto-removed from campaign_fb_accounts by the per-campaign circuit breaker (>=3 Failed items). Existence of a row for a campaign blocks the "fallback to all active accounts" behavior until the user manually re-assigns an account.';

-- 2. Backfill: gỡ thật 4 dòng cfa đang bị breaker trip (1-4 ở trên), ghi log cho cả 5
DELETE FROM public.campaign_fb_accounts
WHERE (campaign_id, fb_account_id) IN (
  ('01a09fcb-4715-70ef-9729-c15b0fb53105', '01a071c3-eb55-a4e0-8a64-e28098a8dbd5'), -- WINPRO / Nick Chính
  ('01a08704-80b3-49a6-a1e0-3e0adc4dfc67', '01a071c3-eb55-a4e0-8a64-e28098a8dbd5'), -- Menlo Research / Nick Chính
  ('01a07b01-92cb-0da3-b13f-923ece51c482', '01a071c3-eb55-a4e0-8a64-e28098a8dbd5'), -- Accenture / Nick Chính
  ('01a076cd-1c8b-a6ab-a442-1e5512bbb55c', '01a07096-5b5d-a5e9-a2c6-e50a356a7210')  -- Test 2 / Nick Phụ
);

INSERT INTO public.campaign_account_circuit_breaker_log (campaign_id, fb_account_id, trigger_type, failed_count, disabled_at)
VALUES
  ('01a09fcb-4715-70ef-9729-c15b0fb53105', '01a071c3-eb55-a4e0-8a64-e28098a8dbd5', 'job_posting', 9,   now()), -- WINPRO
  ('01a08704-80b3-49a6-a1e0-3e0adc4dfc67', '01a071c3-eb55-a4e0-8a64-e28098a8dbd5', 'job_posting', 10,  now()), -- Menlo Research
  ('01a07b01-92cb-0da3-b13f-923ece51c482', '01a071c3-eb55-a4e0-8a64-e28098a8dbd5', 'job_posting', 190, now()), -- Accenture
  ('01a076cd-1c8b-a6ab-a442-1e5512bbb55c', '01a07096-5b5d-a5e9-a2c6-e50a356a7210', 'warming',      15, now()), -- Test 2
  ('01a07240-7368-b7a0-924b-809c2f6a9ecc', '01a071c3-eb55-a4e0-8a64-e28098a8dbd5', 'warming',      7,  now())  -- Test Warming Campaign
ON CONFLICT (campaign_id, fb_account_id) DO NOTHING;

-- 3. Xác nhận kết quả trước khi COMMIT — soi kỹ output này, nếu bất thường
--    thì ROLLBACK thay vì COMMIT
SELECT c.campaign_name, cbl.trigger_type, fa.account_name, cbl.failed_count, cbl.disabled_at
FROM public.campaign_account_circuit_breaker_log cbl
JOIN public.campaigns c ON c.id = cbl.campaign_id
JOIN public.fb_accounts fa ON fa.id = cbl.fb_account_id
ORDER BY c.campaign_name;
-- Kỳ vọng: đúng 5 dòng như liệt kê ở đầu file.

SELECT campaign_id, fb_account_id FROM public.campaign_fb_accounts
WHERE (campaign_id, fb_account_id) IN (
  ('01a09fcb-4715-70ef-9729-c15b0fb53105', '01a071c3-eb55-a4e0-8a64-e28098a8dbd5'),
  ('01a08704-80b3-49a6-a1e0-3e0adc4dfc67', '01a071c3-eb55-a4e0-8a64-e28098a8dbd5'),
  ('01a07b01-92cb-0da3-b13f-923ece51c482', '01a071c3-eb55-a4e0-8a64-e28098a8dbd5'),
  ('01a076cd-1c8b-a6ab-a442-1e5512bbb55c', '01a07096-5b5d-a5e9-a2c6-e50a356a7210')
);
-- Kỳ vọng: 0 dòng (cả 4 đã bị xoá khỏi campaign_fb_accounts).

COMMIT;
