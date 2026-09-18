# FIX_SPEC_2026-09-06 — Modal "Run Warm & Join Session" bao 0 tai khoan eligible neu chua tung vao tab FB Accounts truoc do

**Boi canh**: Sau khi PHAN A/B cua spec truoc (`FIX_SPEC_2026-09-06_campaign-fb-autopost_hardening-regression-and-cv-webhook-publish.md`) da duoc AG fix va verify PASS, User bao tiep 1 loi khac: bam nut "Run" tren 1 campaign loai Warming thi modal hien "Eligible Active Accounts: 0" va "No active accounts available" (khong chay duoc), nhung neu thoat modal, chuyen sang tab khac (vi du tab "FB Accounts") roi quay lai chon campaign do lan nua thi modal hien dung du tai khoan va chay duoc binh thuong. Claude da doc truc tiep code `src/app/campaigns/page.js` de xac dinh chinh xac root cause — khong doan.

## Root cause (xac nhan qua doc code)
Modal "Run Warm & Join Session" (JSX quanh dong ~2428 tro di trong `src/app/campaigns/page.js`) hien thi "Eligible Active Accounts" va "Target Account Queue" bang cach doc TRUC TIEP tu state client `fbAccounts` (dong 2482, 2584, 2589, 2633 — deu dung `fbAccounts.filter(a => a.status === 'Active')`), KHONG goi lai server de lay du lieu moi khi modal mo.

State `fbAccounts` chi duoc nap DUY NHAT boi ham `loadFbAccountsList()`, va ham nay CHI duoc goi tu 1 `useEffect` co dieu kien:

```js
useEffect(() => {
  if (activeTab === "fb_accounts") {
    loadFbAccountsList();
    checkActiveWarmRun();
  }
}, [activeTab, loadFbAccountsList, checkActiveWarmRun]);
```

Nghia la `fbAccounts` CHI duoc fetch khi User tung chuyen sang tab "FB Accounts" it nhat 1 lan trong phien lam viec. Nut "Run" tren campaign Warming (dong ~1220) chi goi:

```js
onClick={() => {
  setWarmFeedback(null);
  setWarmCampaignTarget(c);
  setConfirmWarmModalOpen(true);
}}
```

— KHONG goi `loadFbAccountsList()`. Neu User mo thang campaign Warming tu tab Campaigns ma CHUA TUNG vao tab FB Accounts truoc do trong phien, `fbAccounts` van la mang rong `[]` (gia tri khoi tao `useState([])`), khien modal luon hien 0 tai khoan eligible du du lieu that trong DB co the co 2 tai khoan Active. Sau khi User vao tab FB Accounts (kich hoat useEffect tren, nap du lieu lan dau), quay lai campaign Warming thi state da co du lieu nen modal hien dung.

## Fix — goi `loadFbAccountsList()` ngay khi mo modal, dam bao du lieu luon moi bat ke lich su tab da tham

Sua handler onClick cua nut "Run" (campaign Warming, dong ~1220) trong `src/app/campaigns/page.js`:

```js
onClick={() => {
  setWarmFeedback(null);
  setWarmCampaignTarget(c);
  setConfirmWarmModalOpen(true);
  loadFbAccountsList(); // dam bao Eligible Active Accounts luon la du lieu moi nhat, khong phu thuoc da tung vao tab FB Accounts hay chua
}}
```

**Luu y**: `loadFbAccountsList` da la 1 `useCallback` khong phu thuoc gi (deps rong `[]`), nen goi truc tiep o day an toan, khong can them vao dependency array nao khac. Neu muon chac chan hon nua (tranh moi truong hop tuong tu trong tuong lai), co the can nhac bo luon dieu kien `if (activeTab === "fb_accounts")` va goi `loadFbAccountsList()` ngay tu useEffect nap trang ban dau (cung cho voi `loadCampaignsList()` va `loadAllTagOptions()`) — nhung day la thay doi rong hon, AG chon phuong an nao cung duoc mien fix dung trieu chung, uu tien phuong an sua tai diem goi modal (it thay doi hon, dung nguyen tac minimal fix).

## Yeu cau verify (BAT BUOC truoc khi bao PASS)
1. Mo lai app o phien moi (hoac hard refresh), KHONG vao tab FB Accounts truoc, bam thang "Run" tren 1 campaign Warming — xac nhan modal hien dung so luong Eligible Active Accounts (khop voi so tai khoan `status = 'Active'` that trong `fb_accounts`) va danh sach Target Account Queue day du, khong con hien "No active accounts available" sai.
2. Xac nhan van chay dung binh thuong sau khi da tung vao tab FB Accounts truoc do (khong gay regression cho luong cu).
3. Cap nhat `docs/DEVELOPMENT_LOG.md` (ca bang tong hop + phan chi tiet) voi commit hash chinh xac.
