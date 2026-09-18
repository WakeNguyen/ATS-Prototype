# FIX_SPEC_2026-09-06 — Dong bo campaigns.status cho Warming (giong Job Posting) + don du lieu cu + git hygiene (VONG CUOI truoc khi qua test tong)

**Boi canh**: User hoi tai sao Status hien thi khong nhat quan giua Job Posting va Warming khi dang chay, va nghi rang 2 loai campaign nen dung chung co che. Kiem tra xac nhan: Run History DA dung chung 1 component (`RunHistoryTable`, badge style giong het nhau) — khong phai loi UI component. Loi that nam o BACKEND: campaigns.status cho Warming khong duoc dong bo nhu Job Posting.

---

## PHAN A — [QUAN TRONG] `campaigns.status` khong duoc cap nhat 'Running'/'Ready' cho Warming (co nhung DA co cho Job Posting)

### Doi chieu code that (da xac nhan qua doc truc tiep)
**Job Posting** — DA CO ca 2 chieu:
- Bat dau (`triggerCampaignRun`, `campaign_actions.js` dong ~966): `UPDATE campaigns SET status = 'Running' WHERE id = campaignId`.
- Ket thuc (`campaign-run-callback/route.js` dong ~47-52): `UPDATE campaigns SET status = (status === 'Failed' ? 'Failed' : 'Ready') WHERE id = run.campaign_id`.

**Warming** — CHUA CO chieu nao ca. `_acquireWarmJoinRunLock` (dong ~1456) tao `warm_join_runs` row nhung khong dong bo `campaigns.status`. `warm-join-run-callback/route.js` cung khong dong bo luc dong run.

Hau qua: bang danh sach Campaign tren cung luon hien "Ready" cho campaign Warming du dang co 1 warm_join_run "Running" that ben trong (xem Run History). Ngoai ra tinh nang auto-poll 8s (vua fix nhap nhay) dua vao dieu kien `campaigns.status === 'Running'` (bien `hasRunningCampaign`) — nen SE KHONG BAO GIO tu kich hoat cho campaign Warming, ca table lan detail panel se KHONG tu cap nhat trong luc Warming dang chay, phai F5 thu cong moi thay tien do moi.

### Fix — them dung 2 doan code, dung y het pattern da co cua Job Posting

**1. `_acquireWarmJoinRunLock` (`src/app/campaign_actions.js`)** — ngay SAU doan `INSERT INTO warm_join_runs ... RETURNING id` (dong ~1631), CHI khi co `resolvedCampaignId` (bo qua neu la cron chay toan thu vien khong gan campaign cu the):
```js
if (resolvedCampaignId) {
  await sqlTx`
    UPDATE campaigns SET status = 'Running', last_updated = now()
    WHERE id = ${resolvedCampaignId}
  `;
}
```

**2. `warm-join-run-callback/route.js`** — sua cau `RETURNING id, notification_id` (dong ~63) thanh `RETURNING id, notification_id, campaign_id`, roi them ngay sau buoc dong notification (sau dong ~90):
```js
if (run.campaign_id) {
  const targetStatus = status === 'Failed' ? 'Failed' : 'Ready';
  await sqlTx`
    UPDATE campaigns SET status = ${targetStatus}, last_updated = now()
    WHERE id = ${run.campaign_id}
  `;
}
```

### Yeu cau verify PHAN A
1. Bam "Run" tren 1 campaign Warming, quan sat bang danh sach TRONG LUC dang chay — xac nhan Status chuyen sang "Running" giong het kieu hien thi cua Job Posting.
2. Xac nhan auto-poll 8s bay gio CO chay cho Warming (table/detail tu cap nhat, khong can F5) — dung nhu da hoat dong voi Job Posting.
3. Sau khi run xong, xac nhan Status tro ve "Ready" (hoac "Failed" neu that bai那).
4. Test them 1 lan Warming chay tu CRON (khong co campaignId cu the, che do "Global Warming & Auto-Join") — xac nhan KHONG co campaign nao bi doi status sai (vi cron truong hop nay khong gan 1 campaign cu the).

---

## PHAN B — Don 3 dong du lieu sai con sot lai tu execution 515 (da xac nhan qua Supabase, chua sua)

Day la du lieu LICH SU sai do bug PHAN A da fix xong tu truoc (workflow A bao gia "thanh cong" du that bai). Chi la sua du lieu, KHONG phai sua code. De AG chay 3 cau SQL sau qua Supabase (schema `sandbox`):

```sql
UPDATE campaign_run_items 
SET status = 'Failed', 
    error_message = 'fb-session.json not found for account "01a071c3-eb55-a4e0-8a64-e28098a8dbd5". Please run "node save-session.js 01a071c3-eb55-a4e0-8a64-e28098a8dbd5" first.'
WHERE id = '01a073da-802a-7a2e-bf81-a4331160e3ff';

UPDATE campaign_runs SET status = 'Failed' 
WHERE id = '01a073da-78db-4b22-a5dc-bc552240eaf5';

UPDATE notifications SET 
  type = 'campaign_completed', 
  title = 'Chiến dịch thất bại', 
  message = 'Đã đăng: 0/1 nhóm thành công, 1 lỗi', 
  severity = 'error', 
  is_read = false, 
  updated_at = now() 
WHERE id = '01a073da-7884-2ce0-8b0b-46b19bf29109';
```

### Yeu cau verify PHAN B
Query lai ca 3 id tren, xac nhan gia tri da doi dung nhu tren, khong anh huong ban ghi nao khac.

---

## PHAN C — Git hygiene: commit backlog file untracked (khong phai code, chi la don repo truoc deploy)

`git status` hien con ~30 file untracked (cac FIX_SPEC/QA/HANDOVER/DDL/DATA da viet tu 2026-09-03 den nay, kem file Handover cua chinh Claude). AG vui long:
1. Rieng `docs/architecture/HANDOVER_2026-09-06_fb-warming-workflow-d-architect-request.md` va cac FIX_SPEC/QA moi Claude vua viet trong ngay hom nay — add + commit binh thuong (deu la tai lieu, khong phai code nhay cam).
2. Voi backlog cu hon (DDL/DATA `.sql` script test) — kiem tra qua co con dung/con giu khong, neu la script mot-lan-dung-roi-bo thi co the xoa hoac giu tuy AG, mien la KHONG de sot untracked mai truoc khi deploy.
3. `Claude outputs/` va `scripts/social-group-titles/` da nam trong `.gitignore` tu truoc (commit `ed22f2e`) nen KHONG can add 2 thu muc nay.

Khong yeu cau verify rieng — chi can `git status` sach (khong con untracked ngoai y muon) truoc khi bao xong.

---

## Yeu cau chung
Cap nhat `docs/DEVELOPMENT_LOG.md` (ca bang tong hop + phan chi tiet) cho PHAN A + B (PHAN C la git hygiene, khong bat buoc phai ghi entry rieng neu khong co thay doi code).
