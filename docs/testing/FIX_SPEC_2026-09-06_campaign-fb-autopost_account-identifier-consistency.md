# FIX_SPEC_2026-09-06 — Dinh danh tai khoan FB (account_ref) khong nhat quan giua Workflow A/C + co the bi sua tuy y gay gay he thong

**Boi canh**: Phat hien qua 2 buoc dieu tra lien tiep trong ngay 06/09. Gom chung vao 1 spec de AG lam 1 lan va Claude test lai 1 lan cho ca 2 phan (PHAN A + PHAN B) vi cung lien quan truc tiep den dinh danh `account_ref`.

---

## PHAN A — [BLOCKING] Workflow A gui SAI dinh danh tai khoan (UUID thay vi account_ref) cho VPS Bridge

### Trieu chung thuc te
Job Posting bao loi that: `fb-session.json not found for account "01a071c3-eb55-a4e0-8a64-e28098a8dbd5"` — dung UUID Supabase cua tai khoan "Nick Chinh" (`acc_02`). Loi nay la GIA — session that cua acc_02 van con nguyen va hop le (da xac nhan qua Warming chay thanh cong dung tai khoan nay it gio truoc, va khong co Warming nao chay chong cheo voi lan Job Posting fail nay).

### Root cause (xac nhan qua doc truc tiep code ca 2 workflow tren n8n MCP)
**Workflow C (`L8QdckqW7FDwanRq`, node "Smart Group Allocator & Dispatcher")** dung DUNG:
```js
const accId = acc.account_ref || acc.id;
assignedAccounts.push({ accountId: accId, fbAccountId: acc.id, ... });
```

**Workflow A (`9W588GooZeZhiSKm`, node "Build FB Post Bridge Payload")** dung SAI:
```js
accountId: d.fbAccountId || '',   // <-- SAI: gui thang UUID Supabase
```

VPS Bridge (`run-batch.js`/`post-to-group.js`) dung gia tri `accountId` nhan duoc de tim folder session tai `data/sessions/{accountId}/fb-session.json`. Workflow A gui UUID nen bridge tim nham `data/sessions/01a071c3-eb55-a4e0-8a64-e28098a8dbd5/fb-session.json` (khong ton tai) thay vi `data/sessions/acc_02/fb-session.json` (ton tai that).

Object `dispatch` gui tu app ATS 3.0 sang Workflow A DA CO SAN field `accountRef` (`src/app/campaign_actions.js` dong ~754, giu nguyen xuyen suot qua `triggerCampaignRun`) — chi la node n8n cua Workflow A khong doc field nay.

### Fix — sua dung 1 dong trong node "Build FB Post Bridge Payload" cua Workflow A (n8n)
Doi:
```js
accountId: d.fbAccountId || '',
```
thanh:
```js
accountId: d.accountRef || d.fbAccountId || '',
```
KHONG doi gi khac trong node/workflow nay.

### Yeu cau verify PHAN A
1. Sau khi sua + publish Workflow A, chay lai 1 lan Job Posting that cho campaign dung tai khoan `acc_02` — xac nhan HET loi "fb-session.json not found".
2. Doi chieu payload gui sang VPS Bridge (`Call VPS Bridge: facebook-post-v2`) co truong `accountId: "acc_02"` (khong con la UUID).
3. Test lai voi `acc_01` de dam bao khong regression.

---

## PHAN B — [PHONG NGUA] Khoa truong "Account Ref (Code)" khong cho sua sau khi tai khoan da duoc tao

### Ly do (User tu phat hien qua UI, xac nhan hop ly)
`account_ref` (vi du `acc_02`) chinh la TEN FOLDER SESSION THAT tren VPS (`data/sessions/{account_ref}/fb-session.json`, dung chung boi ca Job Posting/Warming/Sync — xem PHAN A). Folder nay nam co dinh tren o dia VPS, KHONG tu doi ten theo khi User sua `account_ref` trong database qua UI.

Hien tai o `src/app/components/FbAccountEditModal.js`, o input "Account Ref (Code)" (dong ~273-282) la 1 text input tu do, khong `readOnly`, khong canh bao gi — neu User (hoac ai do) lo sua gia tri nay khi EDIT 1 tai khoan da ton tai, ca Workflow A (sau khi fix PHAN A) lan Workflow C (Warming) se gay THAT ngay lap tuc, vi gia tri gui cho VPS Bridge se khong con khop ten folder that tren dia nua.

Backend `updateFbAccount` (`src/app/campaign_actions.js` dong ~1179) cung dang cho phep update `account_ref` khong dieu kien:
```js
account_ref = COALESCE(${account_ref?.trim()}, account_ref),
```

### Fix — khoa ca 2 lop (UI + Server, phong thu 2 tang)

**1. UI (`FbAccountEditModal.js`)**: component da co san bien `isEdit = Boolean(accountId)` (dong 46). Sua input "Account Ref (Code)" (dong ~273-282) them `readOnly={isEdit}` va style/placeholder phan anh trang thai khoa khi dang edit, kem 1 dong ghi chu nho vi du: "Khong the doi sau khi tao — day la ten folder session that tren VPS." Truong nay CHI cho nhap tu do khi tao moi tai khoan (`isEdit === false`).

**2. Server (`campaign_actions.js`, ham `updateFbAccount`)**: bo tham so `account_ref` ra khoi cau UPDATE hoan toan (khong nhan gia tri moi cho truong nay tu client nua khi update, bat ke client co gui len hay khong) — day la lop phong thu thu 2, dam bao dung goi thang server action cung khong sua duoc, khong chi dua vao UI disable. Neu can doi ten that su trong tuong lai (vi du sau khi da doi ten folder that tren VPS thu cong), phai lam qua 1 quy trinh rieng (vi du 1 script/endpoint dac biet co xac nhan ro rang), KHONG qua form sua thong thuong nay.

### Yeu cau verify PHAN B
1. Mo modal Edit cho 1 tai khoan da ton tai — xac nhan o "Account Ref (Code)" hien thi nhung khong the go/sua duoc (readOnly), cac truong khac (Account Name, Status, Quota, Proxy, Notes, Joined Groups) van sua duoc binh thuong.
2. Mo modal Add tai khoan MOI — xac nhan o "Account Ref (Code)" van nhap tu do binh thuong (khong bi khoa).
3. Thu goi truc tiep server action `updateFbAccount` voi 1 gia tri `account_ref` khac (gia lap bypass UI) — xac nhan gia tri trong DB KHONG doi (van giu nguyen `account_ref` cu).

---

## Yeu cau chung
Cap nhat `docs/DEVELOPMENT_LOG.md` (ca bang tong hop + phan chi tiet) cho ca PHAN A va PHAN B trong cung 1 entry (vi cung 1 lan giao viec), ghi ro 2 phan tach biet.
