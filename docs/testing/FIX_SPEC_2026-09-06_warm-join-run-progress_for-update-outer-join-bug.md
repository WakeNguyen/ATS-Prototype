# FIX_SPEC_2026-09-06 — `warm-join-run-progress` luon loi 500 (FOR UPDATE tren LEFT JOIN) — mat toan bo item-level data moi run Warming

**Boi canh**: Execution n8n #581 (Workflow C) bao "Succeeded" 36m36s, nhung ATS 3.0 lai hien Run "Failed" va "No individual item breakdowns recorded for this run". Da dieu tra truc tiep qua n8n MCP (`get_workflow_execution`, includeData) va doc code that — xac dinh CHINH XAC 2 nguyen nhan doc lap, KHONG doan:

---

## Nguyen nhan 1 — [KHONG PHAI BUG, la that bai that ngoai doi] Ca 2 tai khoan that bai khi join nhom

Node "Process Bridge Warm Results" cua execution #581 tra ve ca 2 account (`01a071c3...`, `01a07096...`) deu `accountAction: "Failed"` voi cung 1 loi:
```
[Group Error] Failed joining group https://www.facebook.com/groups/tuyendungvieclamcokhi/: page.goto: Timeout 45000ms exceeded.
```
Day la Playwright timeout that khi load trang nhom Facebook (co the do mang cham, proxy, hoac Facebook cham phan hoi) — KHONG lien quan code ATS 3.0. Summary "0/2 acc thanh cong, 2 loi" hien tren UI la **DUNG THUC TE**, khong phai bug hien thi.

## Nguyen nhan 2 — [BUG THAT, CAN SUA] `warm-join-run-progress/route.js` luon crash 500 vi cu phap SQL sai, lam mat toan bo du lieu chi tiet item

### Root cause (xac nhan qua doc n8n execution data — node "POST warm-join-run-progress" tra ve `error: "500 - FOR UPDATE cannot be applied to the nullable side of an outer join"` cho CA 2 lan goi)

File `src/app/api/webhooks/warm-join-run-progress/route.js` (them moi trong commit `77ba148` — feature "progress-reporting parity", CHUA qua FIX_SPEC/QA review truoc khi trien khai) dong ~125-132:

```js
const [run] = await sqlTx`
  SELECT wjr.id, wjr.campaign_id, wjr.notification_id, wjr.stats,
         COALESCE(c.campaign_name, 'Global Warming & Auto-Join') AS campaign_name
  FROM warm_join_runs wjr
  LEFT JOIN campaigns c ON wjr.campaign_id = c.id
  WHERE wjr.id = ${runId}
  FOR UPDATE
`;
```

Khac voi ban goc `campaign-run-progress/route.js` (dung `JOIN campaigns c` — INNER JOIN, vi Job Posting LUON co campaign_id), ban Warming phai dung `LEFT JOIN` (vi Warming co the chay cron toan thu vien, `campaign_id = NULL`). Postgres KHONG cho phep `FOR UPDATE` don gian tren truy van co LEFT JOIN (khong khoa duoc "phia nullable" cua outer join) — loi cu phap nay xay ra 100% cac lan goi, khong phu thuoc data.

Vi toan bo ham nam trong 1 transaction `sql.begin(async (sqlTx) => {...})`, loi nay lam ROLLBACK CA CAC CAU INSERT `warm_join_run_items` da chay truoc do trong CUNG transaction — dan den ket qua: du 2 tai khoan that su co bao loi chi tiet gui len (`accountErrorMessage` day du), KHONG CO DONG NAO duoc ghi vao `warm_join_run_items` — UI hien "No individual item breakdowns recorded for this run", va cot `stats` cua `warm_join_runs` toan so 0 (`totalItems:0, failedCount:0...`) du summary text van dung (vi summary den tu n8n gui thang, khong doc tu DB).

Vi node HTTP Request "POST warm-join-run-progress" trong n8n dang bat che do tiep tuc khi loi (khong lam sap workflow), nen toan bo execution van hien "Succeeded" cho du webhook nay that bai ca 2/2 lan — day la ly do UI/n8n hien 2 trang thai co ve mau thuan nhau.

### Fix — sua dung 1 tu trong cau SQL
Doi:
```sql
FOR UPDATE
```
thanh:
```sql
FOR UPDATE OF wjr
```
(chi khoa dong cua bang `warm_join_runs`, bo qua phia nullable cua LEFT JOIN — cu phap Postgres hop le).

### Yeu cau verify (BAT BUOC)
1. Sau khi sua, chay lai 1 warming that (co the dung chinh kich ban da that bai — 2 tai khoan, nhom `tuyendungvieclamcokhi`) hoac 1 kich ban that bai gia lap khac.
2. Xac nhan node "POST warm-join-run-progress" trong execution moi tra ve `success: true` (khong con loi 500) qua n8n MCP `get_workflow_execution`.
3. Xac nhan `warm_join_run_items` CO du dong (it nhat 1 dong account-level + N dong group-level moi tai khoan) — query truc tiep Supabase.
4. Xac nhan `warm_join_runs.stats` (`totalItems`, `failedCount`...) khop voi so luong item that vua ghi — khong con toan so 0.
5. Xac nhan UI Run History → click mo rong dong run do → hien day du breakdown tung account/group (khong con "No individual item breakdowns recorded").
6. Test them 1 kich ban THANH CONG (vi du group khac khong bi timeout) de xac nhan duong "Joined" van hoat dong dung, notification milestone 25/50/75/100% van cap nhat dung.

### Luu y quy trinh (khong phai yeu cau ky thuat)
Toan bo tinh nang "progress-reporting parity" (commit `77ba148`) la 1 thay doi kien truc dang ke (them 1 webhook route moi + sua workflow C them 2 node), duoc trien khai truoc khi co FIX_SPEC/duyet kien truc. Lan sau voi cac thay doi quy mo tuong tu, de nghi di qua quy trinh FIX_SPEC nhu thuong le de tranh cac loi cu phap kieu nay lot qua truoc khi len production.
