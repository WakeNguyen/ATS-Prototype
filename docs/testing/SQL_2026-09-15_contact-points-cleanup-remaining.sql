-- =====================================================================
-- Contact Points Cleanup — PHẦN CÒN LẠI (bị auto-mode classifier chặn)
-- Chạy trong Supabase Studio > SQL Editor, trên project "ATS 3.0"
-- (mock-supabase-project), schema public. ĐÃ test kỹ từng phần qua preview
-- trước khi đưa vào đây — an toàn để chạy trực tiếp.
--
-- Đã hoàn thành trước đó (KHÔNG cần chạy lại):
--   - Merge #84 -> #86
--   - Dedup #28 (Facebook), #123 (LinkedIn)
--
-- Phát hiện thêm (CHƯA xử lý, cần bạn quyết định riêng — xem cuối file):
--   - #123 "Hieu Nguyen" còn 1 contact point LinkedIn rác: "https://linkedin" (cụt)
-- =====================================================================

-- ---------------------------------------------------------------------
-- BƯỚC 1: Dedup #204 "Le Hai Viet" (LinkedIn, khác nhau chỉ ở dấu "/" cuối)
-- ---------------------------------------------------------------------
BEGIN;
UPDATE public.contact_points SET value = 'linkedin.com/in/viet-le-a7b4a8196'
  WHERE id = '019fc5f7-256b-7e9d-81dc-a40f0e73ab65';
DELETE FROM public.contact_points WHERE id = '95366f17-742f-4c9f-92ee-322323d393f1';
COMMIT;

-- ---------------------------------------------------------------------
-- BƯỚC 2: Dedup #3426 "Su Yao" (LinkedIn, khác nhau chỉ ở "www.")
-- ---------------------------------------------------------------------
BEGIN;
UPDATE public.contact_points SET value = 'linkedin.com/in/sueyao'
  WHERE id = '01a07fe0-a79b-f4a7-b53c-5385ad8f13b3';
DELETE FROM public.contact_points WHERE id = '01a07ff7-b9f6-122a-8fad-7efd9c2778c3';
COMMIT;

-- ---------------------------------------------------------------------
-- BƯỚC 3: Phục hồi URL Facebook hỏng — #1017 "Vo Thanh Dat" (dính ký tự %0d)
-- ---------------------------------------------------------------------
BEGIN;
UPDATE public.contact_points SET value = 'facebook.com/profile.php?id=100045121424813'
  WHERE id = '019fc5f7-400f-7745-a493-1b8bfab0fd99';
COMMIT;

-- ---------------------------------------------------------------------
-- BƯỚC 4: Phục hồi URL Facebook hỏng — #1222 "Nguyen Thi Trang" (2 dòng dính liền)
-- ---------------------------------------------------------------------
BEGIN;
UPDATE public.contact_points SET value = 'facebook.com/profile.php?id=100018671675690'
  WHERE id = '019fc5f7-4741-7291-ae4c-e8b90f311fa7';
DELETE FROM public.contact_points WHERE id = '68a96bf9-67b5-42e7-9a0b-c91fa54c29fa';
COMMIT;

-- ---------------------------------------------------------------------
-- BƯỚC 5: Phục hồi URL Facebook hỏng — #2888 "Dinh Van Chi Linh" (2 dòng dính liền)
-- ---------------------------------------------------------------------
BEGIN;
UPDATE public.contact_points SET value = 'facebook.com/profile.php?id=100010665369013'
  WHERE id = '019fc5f7-84c4-7617-8aca-5d3e698aad66';
DELETE FROM public.contact_points WHERE id = '27fae491-7024-4940-8055-dbc86e57e9dd';
COMMIT;

-- ---------------------------------------------------------------------
-- BƯỚC 6: Xóa contact point rác #3383 "Truong Le Hoang My"
-- (facebook.com/profile.php không có id — đã có Facebook thật khác
-- "facebook.com/mytruong.mytruong.1" trên cùng candidate, không mất thông tin)
-- ---------------------------------------------------------------------
BEGIN;
DELETE FROM public.contact_points WHERE id = 'b336893a-c0f7-40de-9597-9ce6c55bf878';
COMMIT;

-- ---------------------------------------------------------------------
-- BƯỚC 7: Backfill hàng loạt ~4,455 dòng URL còn lại về dạng chuẩn hóa
-- (loại trừ: 2 dòng vuquoctrung.info giữ nguyên http://, và toàn bộ dòng
-- đã xử lý riêng ở các bước trên). Đã preview kỹ trước khi viết ra đây.
-- ---------------------------------------------------------------------
BEGIN;
WITH excluded_ids AS (
  SELECT unnest(ARRAY[
    '019fc5f7-64f6-7fab-9e4c-22677d3e4867', '3b38c524-2c4d-404b-adbc-e9169f44e484', -- vuquoctrung.info, giữ nguyên
    '019fc5f7-400f-7745-a493-1b8bfab0fd99',                                          -- #1017
    '019fc5f7-4741-7291-ae4c-e8b90f311fa7', '68a96bf9-67b5-42e7-9a0b-c91fa54c29fa',  -- #1222
    '019fc5f7-84c4-7617-8aca-5d3e698aad66', '27fae491-7024-4940-8055-dbc86e57e9dd',  -- #2888
    'b336893a-c0f7-40de-9597-9ce6c55bf878',                                          -- #3383
    '019fc5f7-204c-7785-8c1a-5e338d3c06dd', '2b42d32d-124f-4c9e-b3be-5790c4000634',  -- #28
    '019fc5f7-235f-7202-b55e-4f77e4cd5e03', '019fc5f7-235f-7b3d-94bd-229d5a5262b2',  -- #123
    '019fc5f7-256b-7e9d-81dc-a40f0e73ab65', '95366f17-742f-4c9f-92ee-322323d393f1',  -- #204
    '01a07fe0-a79b-f4a7-b53c-5385ad8f13b3', '01a07ff7-b9f6-122a-8fad-7efd9c2778c3'   -- #3426
  ]::uuid[]) AS id
)
UPDATE public.contact_points cp
SET value = CASE
  WHEN cp.value ~* 'facebook\.com/profile\.php' THEN
    lower(
      split_part(regexp_replace(regexp_replace(cp.value, '^https?://', '', 'i'), '^www\.', '', 'i'), '?', 1)
      || CASE WHEN substring(cp.value from 'id=([0-9]+)') IS NOT NULL THEN '?id=' || substring(cp.value from 'id=([0-9]+)') ELSE '' END
    )
  ELSE
    lower(regexp_replace(regexp_replace(regexp_replace(regexp_replace(cp.value, '^https?://', '', 'i'), '^www\.', '', 'i'), '[?#].*$', ''), '/+$', ''))
END
WHERE cp.type NOT ILIKE '%email%' AND cp.type NOT ILIKE '%mail%'
  AND cp.type NOT ILIKE '%phone%' AND cp.type NOT ILIKE '%tel%' AND cp.type NOT ILIKE '%mobile%' AND cp.type NOT ILIKE '%call%'
  AND cp.id NOT IN (SELECT id FROM excluded_ids);
COMMIT;

-- ---------------------------------------------------------------------
-- BƯỚC 8: Đồng bộ lại candidates.phones/emails/socials/all_contacts_text
-- cho MỌI candidate (an toàn: chỉ ghi lại giá trị TÍNH LẠI từ chính
-- contact_points hiện tại, đúng logic syncCandidateAggregatedContacts()
-- trong actions.js — chỉ update nếu có thay đổi thật để tránh đụng
-- last_updated hàng loạt không cần thiết)
-- ---------------------------------------------------------------------
BEGIN;
WITH agg AS (
  SELECT
    c.id,
    COALESCE((SELECT array_agg(value ORDER BY value) FROM public.contact_points
      WHERE candidate_id = c.id AND (type ILIKE '%phone%' OR type ILIKE '%zalo%' OR type ILIKE '%whatsapp%' OR type ILIKE '%mobile%' OR type ILIKE '%tel%')), '{}') AS new_phones,
    COALESCE((SELECT array_agg(value ORDER BY value) FROM public.contact_points
      WHERE candidate_id = c.id AND (type ILIKE '%mail%' OR type ILIKE '%email%')), '{}') AS new_emails,
    COALESCE((SELECT jsonb_agg(jsonb_build_object('type', type, 'value', value, 'url', value) ORDER BY type) FROM public.contact_points
      WHERE candidate_id = c.id AND type NOT ILIKE '%phone%' AND type NOT ILIKE '%zalo%' AND type NOT ILIKE '%whatsapp%'
        AND type NOT ILIKE '%mobile%' AND type NOT ILIKE '%tel%' AND type NOT ILIKE '%mail%' AND type NOT ILIKE '%email%'), '[]'::jsonb) AS new_socials,
    COALESCE((SELECT string_agg(value, ' | ' ORDER BY value) FROM public.contact_points WHERE candidate_id = c.id), '') AS new_all_contacts_text
  FROM public.candidates c
)
UPDATE public.candidates c
SET phones = agg.new_phones, emails = agg.new_emails, socials = agg.new_socials,
    all_contacts_text = agg.new_all_contacts_text, last_updated = NOW()
FROM agg
WHERE c.id = agg.id
  AND (c.phones IS DISTINCT FROM agg.new_phones
    OR c.emails IS DISTINCT FROM agg.new_emails
    OR c.socials IS DISTINCT FROM agg.new_socials
    OR c.all_contacts_text IS DISTINCT FROM agg.new_all_contacts_text);
COMMIT;

-- =====================================================================
-- CHƯA XỬ LÝ — cần bạn quyết định riêng (không nằm trong phạm vi đã duyệt):
--   #123 "Hieu Nguyen" có 1 contact point LinkedIn rác "https://linkedin" (cụt,
--   không có username, tương tự case #3383). ID: 019fc5f7-235f-781c-8793-3649ba2574ae
--   Nếu muốn xóa, chạy:
--   DELETE FROM public.contact_points WHERE id = '019fc5f7-235f-781c-8793-3649ba2574ae';
-- =====================================================================
