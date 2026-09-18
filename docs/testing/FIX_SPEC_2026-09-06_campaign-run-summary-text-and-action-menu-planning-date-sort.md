# FIX_SPEC_2026-09-06 — Sua text "summary" con sot lai o Job Posting run history + Them sort Planning Date cho Action Menu

**Boi canh**: 2 yeu cau khong lien quan nhau, User muon gom 1 prompt.

---

## PHAN A — [DATA FIX, khong phai code] Cot `campaign_runs.summary` con sot text sai tu execution 515

### Trieu chung thuc te
UI Run History cua "Test Job posting" — dong "06:14 06/09/2026", badge Status da dung "Failed" (da sua o FIX_SPEC truoc), NHUNG cot SUMMARY van hien "Da dang: 1/1 nhom thanh cong" — sai lech voi Status that.

### Root cause (loi cua chinh FIX_SPEC truoc, Claude nhan trach nhiem)
FIX_SPEC `warming-status-sync-and-cleanup` (PHAN B) truoc chi UPDATE 3 bang: `campaign_run_items.status/error_message`, `campaign_runs.status`, `notifications.*` — nhung QUEN mat cot `campaign_runs.summary` (cot text rieng, UI dang doc de hien thi o cot SUMMARY cua Run History) van con gia tri cu do n8n ghi luc dau ("Da dang: 1/1 nhom thanh cong"). Da xac nhan truc tiep qua Supabase: `campaign_runs.id = '01a073da-78db-4b22-a5dc-bc552240eaf5'` co `status='Failed'` nhung `summary='Da dang: 1/1 nhom thanh cong'`.

### Fix — 1 cau SQL duy nhat
```sql
UPDATE campaign_runs 
SET summary = 'Da dang: 0/1 nhom thanh cong, 1 loi'
WHERE id = '01a073da-78db-4b22-a5dc-bc552240eaf5';
```

### Yeu cau verify
Query lai dong nay, xac nhan `summary` da doi; xem lai UI Run History cua "Test Job posting" xac nhan dong "06:14" hien SUMMARY khop voi Status "Failed".

---

## PHAN B — [FEATURE MOI, nho] Action Menu — them sort theo Planning Date (Old→New / New→Old, User tu chon)

### Hien trang (da xac nhan qua doc code that)
- `getActionMenuData()` (`src/app/actions.js`, dong ~12-115) hien LUON sort co dinh `ORDER BY app.display_number DESC NULLS LAST, app.created_time DESC` — khong co tham so sort nao khac, khong lien quan `planning_date`.
- Header cot "PLANNING DATE" (`src/app/page.js`, dong ~778) chi la `<th>` tinh, khong co sort/click nao ca.

### Yeu cau
1. Them 2 tham so moi cho `getActionMenuData({ ..., sortBy = null, sortDir = 'desc' })`:
   - Neu `sortBy === 'planning_date'`: `ORDER BY app.planning_date ${sortDir === 'asc' ? sql\`ASC\` : sql\`DESC\`} NULLS LAST, app.display_number DESC NULLS LAST`.
   - Neu khong truyen `sortBy` (mac dinh): giu nguyen `ORDER BY app.display_number DESC NULLS LAST, app.created_time DESC` nhu hien tai (khong pha vo hanh vi cu).
2. UI (`src/app/page.js`): header "PLANNING DATE" (dong ~778) them icon mui ten nho (vi du dung `lucide-react` co san trong project) + click handler, moi lan click toggle qua 3 trang thai: mac dinh (nhu hien tai) → New→Old (`sortDir='desc'`) → Old→New (`sortDir='asc'`) → quay lai mac dinh. Icon doi chieu tuong ung (mui ten len/xuong) de User biet dang sort chieu nao.
3. State moi `planningDateSort` (`null | 'asc' | 'desc'`) luu trong component, truyen vao `getActionMenuData` moi lan fetch (ca lan dau lan phan trang).

### Ghi chu tham khao (khong bat buoc doi)
Panel "Interview & Activity Timeline" hien dang sort `ORDER BY action_date DESC, created_time DESC` (moi nhat len dau) — User xac nhan thich thu tu nay. Khong can doi gi o day, chi la tham khao thiet ke — De xuat feature Planning Date sort o tren mac dinh cung nen la New→Old khi User bam lan dau (giu nhat quan voi thu tu quen thuoc), nhung User van co the doi sang Old→New neu muon.

### Yeu cau verify PHAN B
1. Bam header Planning Date lan 1 → danh sach sort New→Old theo planning_date (kiem tra vai dong dau/cuoi dung thu tu).
2. Bam lan 2 → Old→New.
3. Bam lan 3 → tro ve mac dinh (display_number DESC nhu truoc gio).
4. Xac nhan phan trang (page 2, 3...) van giu dung sort dang chon, khong bi reset ve mac dinh khi chuyen trang.
5. Xac nhan cac filter khac (status, client, search...) van hoat dong binh thuong khi dang o che do sort Planning Date.

---

## Yeu cau chung
Cap nhat `docs/DEVELOPMENT_LOG.md` cho ca 2 phan (PHAN A la data fix nen ghi ngan gon, PHAN B ghi day du nhu 1 feature moi).
