# FIX_SPEC_2026-09-06 — Candidate search "vo hinh" do cache denormalize khong dong bo (CV Import) + Search khong bo dau/hoa-thuong

**Boi canh**: User bao search candidate bang email that su ton tai (`new.candidate.26@test.com`, candidate #11853 "Pham Thi D") nhung tra ve "0 matches in database" du Contact Points Hub hien dung 3 contact. Da dieu tra truc tiep qua Supabase — xac nhan 2 loi doc lap, KHONG doan. Day cung CHINH XAC la rui ro **DB-09** da duoc canh bao truoc trong `docs/testing/master_test_matrix.md` (viet tu 30/08) — nay CONFIRMED xay ra that trong production.

---

## PHAN A — [P0, DATA INTEGRITY] Candidate tao qua CV Parser import khong bao gio duoc dong bo cache tim kiem

### Xac nhan qua Supabase (khong doan)
```sql
-- candidate #11853 "Pham Thi D": contact_points CO du 3 dong that, nhung cache candidates trong rong:
phones: [], emails: [], all_contacts_text: ""
-- trong khi contact_points thuc te co: Email, LinkedIn, Phone
```
Dem tong: **22 candidates** hien dang bi tinh trang nay (`all_contacts_text` rong nhung co contact_points that).

### Root cause
File `src/app/api/webhooks/cv-import/route.js`, nhanh "0 MATCHES -> NEW CANDIDATE -> AUTO CREATE" (dong ~32-88): tao candidate (`INSERT INTO candidates`) roi INSERT thang vao `contact_points` (dong ~81), nhung **KHONG BAO GIO** cap nhat lai cac cot cache tren `candidates` (`phones`, `emails`, `socials`, `all_contacts_text`). Day la cot cache duoc `SearchableCandidateDropdown` (component dung chung o nhieu cho: New Candidate duplicate-check, Attach Candidate, etc.) va nhieu server action search khac dua vao de tim kiem — KHONG bao gio query truc tiep `contact_points`. Vi cv-import la nguon tao candidate TU DONG chinh (qua n8n CV Parser), MOI candidate tao qua duong nay deu bi "vo hinh" khi tim theo SDT/email/LinkedIn cho den khi co ai do sua/xoa 1 contact point cua ho (vi `updateContactPoint`/`deleteContactPoint` co logic dong bo lai cache, con `addContactPoint` cung co inline nhung path INSERT MOI CANDIDATE cua cv-import thi khong).

Luu y: day la lo hong o "convenience search", KHONG phai lo hong tao trung candidate that su — vi dedup check RIENG cua chinh `cv-import` (dong ~18-30) van query thang `contact_points` (dung), nen khong tao candidate trung khi import CV moi. Nguy co that la: **Recruiter dung o dropdown tim kiem thu cong de kiem tra candidate co san TRUOC KHI tao thu cong** se khong thay cac candidate nay → co the tao trung ho so bang tay.

### Fix — PHAN A1: sua code (khong de bug tiep tuc phat sinh)
Trong `src/app/api/webhooks/cv-import/route.js`, nhanh AUTO CREATE (trong cung `sql.begin` block, ngay sau dong INSERT `contact_points` ~dong 81), them dung logic dong bo da dung trong `addContactPoint`/`updateContactPoint` (`src/app/actions.js` dong ~662-676):
```js
// Sync denormalized search cache ngay trong cung transaction
const phones = [], emails = [], socials = [];
const texts = [];
for (const cp of contactInserts) {
  const t = (cp.type || "").toLowerCase();
  const v = String(cp.value || "").trim();
  if (t.includes('phone') || t.includes('zalo') || t.includes('whatsapp') || t.includes('mobile')) phones.push(v);
  else if (t.includes('mail')) emails.push(v);
  else socials.push({ type: cp.type, value: v, url: v });
  texts.push(v);
}
await sqlTx`
  UPDATE candidates SET
    phones = ${phones}, emails = ${emails}, socials = ${socials}, all_contacts_text = ${texts.join(' | ')}
  WHERE id = ${newCand.id}
`;
```
(Co the dat truoc hoac sau doan "Update cv_urls" ben canh, mien la van trong CUNG `sql.begin` transaction.)

### Fix — PHAN A2: backfill 1 lan cho 22 candidate hien dang bi anh huong
Chay 1 lan qua Supabase (an toan, chi UPDATE cot cache tu chinh nguon `contact_points`, khong dung toi du lieu nao khac):
```sql
WITH agg AS (
  SELECT
    candidate_id,
    array_agg(value) FILTER (
      WHERE type ILIKE '%phone%' OR type ILIKE '%zalo%' OR type ILIKE '%whatsapp%' OR type ILIKE '%mobile%'
    ) AS phones,
    array_agg(value) FILTER (WHERE type ILIKE '%mail%') AS emails,
    jsonb_agg(jsonb_build_object('type', type, 'value', value, 'url', value)) FILTER (
      WHERE NOT (type ILIKE '%phone%' OR type ILIKE '%zalo%' OR type ILIKE '%whatsapp%'
                 OR type ILIKE '%mobile%' OR type ILIKE '%mail%')
    ) AS socials,
    string_agg(value, ' | ' ORDER BY created_time) AS all_contacts_text
  FROM contact_points
  GROUP BY candidate_id
)
UPDATE candidates c
SET phones = COALESCE(agg.phones, ARRAY[]::text[]),
    emails = COALESCE(agg.emails, ARRAY[]::text[]),
    socials = COALESCE(agg.socials, '[]'::jsonb),
    all_contacts_text = COALESCE(agg.all_contacts_text, '')
FROM agg
WHERE c.id = agg.candidate_id
  AND (c.all_contacts_text IS NULL OR c.all_contacts_text = '');
```

### Yeu cau verify PHAN A
1. Sau backfill, query lai candidate #11853 — xac nhan `emails` co `new.candidate.26@test.com`, `all_contacts_text` khong rong.
2. Mo lai SearchableCandidateDropdown (New Candidate hoac Attach Candidate) → go `new.candidate.26@test.com` → phai thay candidate "Pham Thi D" #11853 hien ra.
3. Test tao 1 CV moi qua CV Parser (n8n) voi contact chua ton tai → xac nhan candidate moi tao ra CO THE tim thay ngay bang email/SDT/LinkedIn vua nhap, khong can sua gi them.
4. Chay lai query dem "affected_candidates" (WHERE all_contacts_text rong nhung co contact_points) → phai tra ve 0.

---

## PHAN B — [P1, UX] Search khong tim duoc khi go khac dau/hoa-thuong tieng Viet

### Yeu cau cua User
Search candidate hien tai (vi du `SearchableCandidateDropdown`, `searchCandidatesServer` va it nhat 6 ham search tuong tu khac trong `actions.js`) da co `LOWER()` (khong phan biet hoa/thuong) nhung CHUA bo dau — go "Nguyen" se KHONG tim ra "Nguyễn".

### Fix
1. Bat extension `unaccent` (co san tren Supabase, chua enable):
```sql
CREATE EXTENSION IF NOT EXISTS unaccent;
```
2. Trong CAC ham search sau (`src/app/actions.js`), boc them `unaccent(...)` quanh ca 2 ve cua moi dieu kien LIKE lien quan ten/contact (giu nguyen LOWER da co, chi them unaccent boc ben ngoai):
   - Dong ~58, 64 (1 ham)
   - Dong ~106, 112 (1 ham)
   - Dong ~523, 525 va 542, 544 (`searchCandidatesServer` — chinh ham gay ra bug user vua gap)
   - Dong ~942
   - Dong ~1992
   - Dong ~2053, 2055 va 2072, 2074
   
   Vi du cu the cho `searchCandidatesServer` (dong ~522-526 va 541-545):
   ```sql
   WHERE (${formattedSearch}::text IS NULL 
          OR unaccent(LOWER(c.full_name)) LIKE unaccent(${formattedSearch})
          OR c.display_number::text LIKE ${formattedSearch}
          OR unaccent(LOWER(c.all_contacts_text)) LIKE unaccent(${formattedSearch})
          OR unaccent(LOWER(COALESCE(c.blacklist_note, ''))) LIKE unaccent(${formattedSearch}))
   ```
   (KHONG can unaccent cot `display_number` vi la so, khong co dau.)
3. Ap dung dung mau nay cho TAT CA vi tri liet ke o tren de dam bao nhat quan toan bo app (Action Menu, Candidates, Jobs & Clients, Search Menu deu dung chung pattern search).

### Luu y hieu nang (khong bat buoc lam ngay)
`unaccent()` khong IMMUTABLE mac dinh nen khong dung truc tiep duoc trong index thong thuong. Voi khoi luong hien tai (~1710 candidates) `LIKE` full-scan van du nhanh. Neu sau nay thay cham, co the can tao cot generated `full_name_unaccented` + GIN trigram index rieng — de xuat lam sau, KHONG can lam trong fix nay.

### Yeu cau verify PHAN B
1. Go "nguyen" (khong dau) → phai tim ra candidate ten "Nguyễn...".
2. Go "NGUYEN" (hoa, khong dau) → van tim ra.
3. Go "Nguyễn" (co dau, dung hoa-thuong nhu cu) → van tim ra binh thuong (khong bi vo hieu boi thay doi).
4. Test tren it nhat 2-3 ham search khac trong danh sach o PHAN B (khong chi rieng `searchCandidatesServer`) de dam bao ap dung dong bo.

---

## PHAN C — [P0, MOI PHAT HIEN khi ra soat mo rong] Cung 1 loi denormalize-cache o 2 noi nua trong `hitl_actions.js`

### Root cause
Sau khi tim ra loi o `cv-import/route.js` (PHAN A), ra soat mo rong phat hien **CUNG 1 loi y het** o 2 cho khac trong `src/app/hitl_actions.js` (luong xu ly hang doi CV trung/nghi ngo — HITL queue):

1. **`createCandidateFromPayload(sqlTx, payload)`** (dong ~61-116, dung khi Recruiter bam "FORCE_CREATE" tren 1 CV bi nghi trung nhung Recruiter xac nhan la candidate moi that): INSERT `contact_points` (dong 91) nhung KHONG BAO GIO dong bo lai `candidates.phones/emails/socials/all_contacts_text`.

2. **Nhanh MERGE trong `resolvePendingCVImport`** (dong ~167-192, khi Recruiter chon merge CV moi vao 1 candidate co san va them contact points moi): INSERT `contact_points` moi (co dedup dung, khong trung) nhung sau do CUNG KHONG dong bo lai cache tren `candidates` cho candidate DICH (candidate co san dang duoc merge vao).

### Fix — them dung 1 doan (giong het PHAN A1) vao CA 2 vi tri
Sau moi lan INSERT `contact_points` thanh cong o ca 2 nhanh tren (van trong CUNG `sqlTx` transaction dang co san), them:
```js
const allContacts = await sqlTx`SELECT type, value FROM contact_points WHERE candidate_id = ${/* newCand.id hoac targetCandidateId tuy nhanh */}`;
const phones = [], emails = [], socials = [];
const texts = [];
for (const cp of allContacts) {
  const t = (cp.type || "").toLowerCase();
  const v = String(cp.value || "").trim();
  if (t.includes('phone') || t.includes('zalo') || t.includes('whatsapp') || t.includes('mobile')) phones.push(v);
  else if (t.includes('mail')) emails.push(v);
  else socials.push({ type: cp.type, value: v, url: v });
  texts.push(v);
}
await sqlTx`
  UPDATE candidates SET
    phones = ${phones}, emails = ${emails}, socials = ${socials}, all_contacts_text = ${texts.join(' | ')}
  WHERE id = ${/* id tuong ung */}
`;
```

### Yeu cau verify PHAN C
1. Test FORCE_CREATE tu 1 CV bi nghi trung → candidate moi tao ra phai tim duoc ngay qua SearchableCandidateDropdown bang contact vua nhap.
2. Test MERGE 1 CV vao candidate co san voi contact point moi → candidate do phai tim duoc ngay bang contact MOI vua them (khong chi contact cu).
3. Chay lai query dem "affected_candidates" (giong PHAN A2) sau khi test ca 2 luong tren — phai van la 0 (khong phat sinh them ban ghi loi).

### Ghi chu QA (khong phai yeu cau ky thuat)
Day la lan thu 3 phat hien CUNG 1 loi (cv-import AUTO CREATE, hitl FORCE_CREATE, hitl MERGE) — xac nhan day la 1 loi he thong (bat ky duong tao/sua contact_points nao KHONG di qua `addContactPoint`/`updateContactPoint`/`deleteContactPoint` chuan deu co nguy co nay). Da ghi thanh nguyen tac chung trong `docs/testing/master_test_matrix.md` (PHAN cap nhat 06/09) de tranh lap lai o cac tinh nang tuong lai (vi du: import hang loat qua Excel, migration script, etc. — bat ky cho nao INSERT/UPDATE `contact_points` truc tiep deu phai kiem tra lai nguyen tac nay).
