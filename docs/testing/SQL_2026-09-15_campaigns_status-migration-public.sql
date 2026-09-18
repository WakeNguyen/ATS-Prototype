-- =====================================================================
-- Campaign Status Redesign — Migration cho PUBLIC (bị auto-mode classifier
-- chặn, kể cả từng câu DDL đơn lẻ). Chạy trong Supabase Studio > SQL Editor,
-- project "ATS 3.0" (mock-supabase-project), schema public.
--
-- Code đã QA + deploy production (commit de98ffb) TRƯỚC KHI chạy file này —
-- đúng thứ tự an toàn: code mới không còn ghi giá trị status cũ nữa, nên
-- giờ thêm constraint chặn giá trị cũ mới an toàn.
--
-- Đã xác nhận qua query trực tiếp: public.campaigns hiện có 6 dòng, TOÀN BỘ
-- đang mang status='Ready' — trong đó 2 dòng có is_active=false (bằng chứng
-- sống của bug checkCampaignAutoCompletion cũ: tự đóng campaign nhưng quên
-- update status). Vì vậy migration bên dưới KHÔNG map cứng theo status text
-- cũ, mà dựa thêm vào is_active hiện có để phân biệt đúng 2 case.
-- =====================================================================

BEGIN;

-- 1. Gỡ constraint cũ (chỉ có 7 giá trị, THIẾU hẳn 'Archived' — nghĩa là
--    trước giờ chưa từng có ai set được Archived thành công trên public)
ALTER TABLE public.campaigns DROP CONSTRAINT campaigns_status_check;

-- 2. Map lại status cũ -> mới, có xét is_active để phân biệt "còn hoạt động"
--    và "đã bị hệ thống tự đóng nhưng lỡ giữ nguyên status cũ"
UPDATE public.campaigns SET status = 'Active'   WHERE status IN ('Ready','Running','Failed') AND is_active = true;
UPDATE public.campaigns SET status = 'Archived' WHERE status IN ('Ready','Running','Failed') AND is_active = false;
UPDATE public.campaigns SET status = 'Draft'    WHERE status = 'Paused';
UPDATE public.campaigns SET status = 'Archived' WHERE status = 'Completed';

-- 3. Đồng bộ lại is_active theo đúng status mới (nguồn xác định duy nhất từ nay)
UPDATE public.campaigns SET is_active = (status = 'Active');

-- 4. Dọn auto_run_enabled rác trên campaign đã Archived
UPDATE public.campaigns SET auto_run_enabled = false WHERE status = 'Archived' AND auto_run_enabled = true;

-- 5. Thêm constraint mới, đúng 4 giá trị
ALTER TABLE public.campaigns ADD CONSTRAINT campaigns_status_check
  CHECK (status IN ('Draft', 'Active', 'Archived', 'Needs Review'));

-- 6. Xác nhận kết quả trước khi COMMIT — soi kỹ output này, nếu bất thường
--    thì ROLLBACK thay vì COMMIT
SELECT status, is_active, auto_run_enabled, count(*) AS cnt
FROM public.campaigns
GROUP BY status, is_active, auto_run_enabled
ORDER BY status;
-- Kỳ vọng: 4 dòng status='Active' (is_active=true, 1 trong số đó
-- auto_run_enabled=true), 2 dòng status='Archived' (is_active=false,
-- auto_run_enabled=false). Không còn dòng nào status='Ready'.

COMMIT;
