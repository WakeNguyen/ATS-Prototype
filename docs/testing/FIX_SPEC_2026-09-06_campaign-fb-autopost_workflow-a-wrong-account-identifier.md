# FIX_SPEC_2026-09-06 — Workflow A gui SAI dinh danh tai khoan (UUID thay vi account_ref) cho VPS Bridge, gay "fb-session.json not found" GIA (session THAT van con)

**Boi canh**: User hoi "Warming chay thanh cong tuc la session acc_02 da co roi, co the dung chung folder session giua 2 workflow khong?". Cau hoi nay giup phat hien dung root cause that: session KHONG bi thieu, va kien truc VON DI da dung 1 folder session dung chung tren VPS Bridge cho tat ca automation (`data/sessions/{account_ref}/fb-session.json`) — Job Posting, Warming, Sync deu cung goi vao 1 VPS Bridge Server. Van de la Workflow A dang gui SAI dinh danh tai khoan trong payload.

## Root cause (xac nhan qua doc truc tiep code ca 2 workflow tren n8n MCP)

**Workflow C (`L8QdckqW7FDwanRq`, node "Smart Group Allocator & Dispatcher")** — dung DUNG:
```js
const accId = acc.account_ref || acc.id;
...
assignedAccounts.push({
  accountId: accId,       // gui "acc_02" cho bridge
  fbAccountId: acc.id,    // UUID giu rieng de map nguoc ket qua
  ...
});
```

**Workflow A (`9W588GooZeZhiSKm`, node "Build FB Post Bridge Payload")** — dung SAI:
```js
const jobs = dispatch.map(function (d) {
  return {
    groupName: d.groupName || '',
    groupUrl: d.groupUrl || '',
    accountId: d.fbAccountId || '',   // <-- SAI: gui thang UUID Supabase
    proxyUrl: d.proxyUrl || '',
    resetIpUrl: d.resetIpUrl || ''
  };
});
```

`d.fbAccountId` la UUID that trong Supabase (vi du `01a071c3-eb55-a4e0-8a64-e28098a8dbd5`), KHONG PHAI `account_ref` (`acc_02`). VPS Bridge (`run-batch.js`/`post-to-group.js`) dung gia tri `accountId` nhan duoc de tim folder session tai `data/sessions/{accountId}/fb-session.json` — vi Workflow A gui UUID nen bridge tim `data/sessions/01a071c3-eb55-a4e0-8a64-e28098a8dbd5/fb-session.json`, folder nay KHONG TON TAI (folder that ten la `acc_02`), dan den loi:
```
fb-session.json not found for account "01a071c3-eb55-a4e0-8a64-e28098a8dbd5"
```
**Loi nay la GIA — session that cua acc_02 van con nguyen va hop le** (da xac nhan qua Warming chay thanh cong dung tai khoan nay it gio truoc). Da xac nhan qua Supabase: khong co Warming run nao chay chong voi lan Job Posting fail nay (`last_warmed_at` ca 2 account dung yen tu 00:20 UTC, cach lan fail nay ~9 tieng) — nen day KHONG phai loi race condition nhu nghi ngo o execution 515 truoc do, ma la loi sai dinh danh co ban trong chinh Workflow A.

**Xac nhan them**: object `dispatch` gui tu app ATS 3.0 sang Workflow A (qua webhook `campaign-trigger`) DA CO SAN field `accountRef` (xem `src/app/campaign_actions.js` dong ~754, va duoc giu nguyen xuyen suot qua `triggerCampaignRun`) — chi la node n8n cua Workflow A khong doc field nay.

## Fix — sua dung 1 dong trong node "Build FB Post Bridge Payload" cua Workflow A (n8n)

Doi:
```js
accountId: d.fbAccountId || '',
```
thanh (dung dung pattern da co san va dang chay tot o Workflow C):
```js
accountId: d.accountRef || d.fbAccountId || '',
```

**KHONG doi gi khac trong node nay hay workflow nay** — chi sua dung field nay, giu nguyen toan bo logic con lai (Process Bridge Results, Loop Report, Build Final Run Summary...).

## Yeu cau verify (BAT BUOC truoc khi bao PASS)
1. Sau khi sua + publish Workflow A, chay lai 1 lan Job Posting that cho campaign dung tai khoan `acc_02` (Nick Chinh) — xac nhan KHONG con loi "fb-session.json not found", bai dang thuc su thanh cong (hoac fail vi ly do khac that su, khong phai do sai dinh danh account nua).
2. Doi chieu execution that tren n8n: xac nhan payload gui sang VPS Bridge (`Call VPS Bridge: facebook-post-v2`) co truong `accountId: "acc_02"` (khong con la UUID).
3. Test lai voi tai khoan `acc_01` (Nick Phu) de dam bao khong regression cho tai khoan con lai.
4. Cap nhat `docs/DEVELOPMENT_LOG.md` (ca bang tong hop + phan chi tiet), ghi ro day la fix cho 1 bug co san tu truoc (khong phai regression cua cac fix truoc do trong ngay).

## Ghi chu kien truc (khong can lam gi them, chi de tham khao)
Kien truc VPS Bridge da THIET KE DUNG tu dau: 1 folder session duy nhat cho moi tai khoan (`data/sessions/{account_ref}/`), dung chung cho ca 3 automation (Job Posting, Warming, Sync). Khong can va KHONG NEN tao co che "dung chung folder" moi — no da dung chung san, chi can Workflow A goi dung ten.
