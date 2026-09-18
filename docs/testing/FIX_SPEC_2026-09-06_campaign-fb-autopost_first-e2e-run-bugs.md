# FIX_SPEC_2026-09-06 — 3 Loi Phat Hien Tu Lan "Run Campaign" That Dau Tien (Workflow A, execution 515)

**Boi canh**: Day la lan chay E2E THAT dau tien cua Workflow A ("A: FB Group Auto-Post (Campaign)", `9W588GooZeZhiSKm`) sau khi duoc hardening + activate o PHAN 4b. Dung nhu du kien (workflow chua tung duoc test E2E), lan chay nay lo ra 1 loi nghiem trong ve tinh dung dan du lieu + 2 van de UX ve trang thai khong tu cap nhat. Claude da doc TRUC TIEP n8n execution 515 (qua `get_workflow_execution` voi `includeData: true`) va query truc tiep Supabase (schema `sandbox`, dung schema app dev dang dung) de xac nhan CHINH XAC root cause cua ca 3 loi — khong doan.

**Luu y rieng cho User (khong phai bug, chi la du lieu test)**: Loi thuc su khien lan test nay that bai la `fb-session.json not found for account "01a071c3-eb55-a4e0-8a64-e28098a8dbd5"` — tai khoan FB test "Nick Chinh" (acc_02) chua tung duoc luu Playwright session tren VPS. Can chay `node save-session.js 01a071c3-eb55-a4e0-8a64-e28098a8dbd5` tren VPS truoc khi test lai. Day KHONG phai loi code, chi la buoc setup con thieu.

---

## PHAN A — [KHAN CAP, MUC DO NGHIEM TRONG CAO] n8n Workflow A: sua node "Process Bridge Results" doc sai ket qua tu VPS Bridge

### Trieu chung thuc te (tu execution 515)
VPS Bridge (`http://172.18.0.1:5680/api/facebook-post-v2`) tra ve:
```json
{
  "success": true,
  "exitCode": 0,
  "elapsedSeconds": 0.5,
  "output": "[{\"groupName\":\"...\",\"groupUrl\":\"...\",\"accountId\":\"...\",\"success\":false,\"error\":\"fb-session.json not found...\",\"isCheckpoint\":false,...}]\n",
  "error": "...[Job 1] FAILED. Error: fb-session.json not found...\n"
}
```
Nhung `campaign_run_items` cuoi cung lai bi ghi la `status: "Sent"`, `group_name: "Unknown Group"`, `social_group_id: NULL`, `fb_account_id: NULL` — va notification bao "Chien dich hoan tat thanh cong". **Bai dang that su THAT BAI 100% nhung he thong bao THANH CONG 100%.**

### Root cause (xac nhan qua doc code node)
Node "Process Bridge Results" hien tai gia dinh sai hinh dang response cua bridge — no doc `bridgeItems = $input.all()` roi dung TRUC TIEP `j.success`, `j.groupUrl`, `j.error` cua TUNG item — nhung vi bridge tra ve 1 OBJECT DUY NHAT (khong phai mang JSON tran), n8n KHONG tu tach thanh nhieu item, nen `bridgeItems` chi co dung 1 phan tu = chinh cai wrapper `{success, exitCode, elapsedSeconds, output, error}`. Code sau do doc `j.success === true` (day la co `success` cua WRAPPER — nghia la "child process thoat khong loi", KHONG PHAI "bai dang thanh cong") roi gan `status = 'Sent'`. Ket qua that su cua tung nhom (mang JSON) nam trong TRUONG `output` DUOI DANG CHUOI (string) — chua bao gio duoc `JSON.parse()` ca.

**So sanh doi chieu**: node tuong duong ben Workflow C ("Process Bridge Warm Results") DA xu ly dung truong hop nay — no kiem tra `typeof bridgeOutput.output === 'string'` roi `JSON.parse()` de lay mang ket qua that. Workflow A dang thieu chinh xac buoc nay.

**Muc do anh huong**: day la loi he thong — MOI lan chay Job Posting campaign tu truoc gio (thuc ra day la lan DAU TIEN) deu se bi bao sai thanh cong bat ke thuc te dang that bai hay khong, mien la VPS script khong bi crash hoan toan. Day la rui ro rat lon cho mot he thong tu dong dang bai len Facebook that — nguoi dung se tin rang chien dich da chay thanh cong trong khi thuc te khong co bai nao duoc dang.

### Fix — thay THE TOAN BO code cua node "Process Bridge Results"

```js
const bridgeOutput = $input.first().json;
const webhookBody = $('Webhook: Campaign Trigger').first().json.body || {};
const dispatch = webhookBody.dispatch || [];
const runId = webhookBody.runId;
const campaignId = webhookBody.campaignId;

const dispatchByUrl = {};
for (const d of dispatch) {
  dispatchByUrl[d.groupUrl] = d;
}

// VPS Bridge (scripts/bridge-server.js executeScript()) LUON boc ket qua trong
// { success, exitCode, elapsedSeconds, output, error } -- `success`/`exitCode` o day
// phan anh viec CHILD PROCESS (run-batch.js) co thoat sach (exit code 0) hay khong,
// KHONG PHAI tung bai dang co thanh cong hay khong. Ket qua THAT cua tung nhom nam
// trong truong `output` DUOI DANG CHUOI JSON (stdout cua run-batch.js) -- BAT BUOC
// phai JSON.parse() o day. Xac nhan qua execution that 515 (2026-09-06): thieu buoc
// nay da khien 1 bai dang that bai 100% bi bao la "Sent" thanh cong 100%.
let rawResults = [];
if (Array.isArray(bridgeOutput)) {
  rawResults = bridgeOutput;
} else if (bridgeOutput.data && Array.isArray(bridgeOutput.data)) {
  rawResults = bridgeOutput.data;
} else if (typeof bridgeOutput.output === 'string') {
  try {
    const parsed = JSON.parse(bridgeOutput.output.trim());
    if (Array.isArray(parsed)) rawResults = parsed;
    else if (parsed && Array.isArray(parsed.data)) rawResults = parsed.data;
  } catch (e) {}
} else if (Array.isArray(bridgeOutput.output)) {
  rawResults = bridgeOutput.output;
}

const isBridgeLevelFailure = rawResults.length === 0 && (!bridgeOutput.success || (bridgeOutput.exitCode !== undefined && bridgeOutput.exitCode !== 0) || bridgeOutput.error || bridgeOutput.message);

const progressResults = [];

if (isBridgeLevelFailure) {
  const errMsg = bridgeOutput.error || bridgeOutput.message || 'VPS bridge request failed, timed out, or returned no result.';
  for (const d of dispatch) {
    progressResults.push({
      socialGroupId: d.socialGroupId || null,
      groupName: d.groupName || 'Unknown Group',
      groupUrl: d.groupUrl || '',
      fbAccountId: d.fbAccountId || null,
      status: 'Failed',
      errorMessage: String(errMsg).substring(0, 500)
    });
  }
} else {
  for (const r of rawResults) {
    const matched = dispatchByUrl[r.groupUrl] || {};
    let status = 'Failed';
    if (r.success === true) status = 'Sent';
    else if (r.isCheckpoint === true) status = 'Checkpoint';
    progressResults.push({
      socialGroupId: matched.socialGroupId || null,
      groupName: r.groupName || matched.groupName || 'Unknown Group',
      groupUrl: r.groupUrl || '',
      fbAccountId: matched.fbAccountId || null,
      status: status,
      errorMessage: r.error ? String(r.error).substring(0, 500) : null
    });
  }
}

return progressResults.map(function (item) {
  return { json: { runId: runId, campaignId: campaignId, completedItem: item } };
});
```

Luu y: `isBridgeLevelFailure` chi kich hoat khi `rawResults.length === 0` (khong parse duoc gi ca — that su la bridge crash/timeout), KHONG PHAI khi tung job that bai binh thuong (truong hop do da duoc xu ly dung trong nhanh `else` phia duoi, `r.success === false` -> `status = 'Failed'`). Dieu kien nay copy dung 1:1 tu node tuong duong ben Workflow C de dam bao dong nhat logic giua 2 workflow.

### QUAN TRONG — Du lieu sai da ghi vao DB tu execution 515 (khong phai viec cua AG, Claude se tu xu ly)

`campaign_run_items` (id `01a073da-802a-7a2e-bf81-a4331160e3ff`), `campaign_runs` (id `01a073da-78db-4b22-a5dc-bc552240eaf5`, dang ghi `status: 'Completed'` sai), va notification lien quan (id `01a073da-7884-2ce0-8b0b-46b19bf29109`, dang ghi "hoan tat thanh cong" sai) trong schema `sandbox` hien dang chua du lieu SAI tu lan chay loi nay. **AG KHONG can va KHONG duoc tu sua data nay** (thuoc pham vi Architect/QA, khong phai Implementer) — Claude se rieng bao User va tu xu ly sau khi AG code xong fix nay.

---

## PHAN B — Frontend: Master Table campaign khong tu cap nhat trang thai (phai F5 thu cong)

### Trieu chung
Sau khi bam "Run" (Job Posting), trang thai campaign chuyen "Running" dung 1 lan ngay luc dispatch, nhung sau do KHONG BAO GIO tu cap nhat nua du run that su da xong (backend da dung: xac nhan `campaigns.status` trong DB da ve `'Ready'` dung 3.3 giay sau khi dispatch) — nguoi dung phai bam nut refresh thu cong hoac F5 trinh duyet moi thay dung trang thai.

### Root cause
`src/app/campaigns/page.js`: sau khi dispatch (`CampaignDispatchPreviewModal`'s `onSuccess`), `loadCampaignsList()` chi duoc goi DUNG 1 LAN ngay luc do. Khong co co che polling/tu dong refresh nao cho Job Posting ca. (Warming co polling rieng qua `isWarmingRunning` + interval 6s, nhung CHI cho Warming, khong dong bo — vi pham nguyen tac "Warming cung chi la 1 loai campaign".)

### Fix — them polling CHUNG cho CA 2 loai campaign_type

Trong `loadCampaignsList` (dong ~296), sau khi set state, them kiem tra co campaign nao dang "Running" khong:

```js
  const loadCampaignsList = useCallback(async () => {
    setLoadingCampaigns(true);
    try {
      const filters = {};
      if (campaignStatusFilter !== "ALL") filters.status = campaignStatusFilter;
      if (campaignTypeFilter !== "ALL") filters.campaign_type = campaignTypeFilter;
      if (campaignSearch.trim()) filters.search = campaignSearch.trim();

      const res = await getCampaigns(filters);
      if (res.success) {
        setCampaigns(res.data || []);
        setHasRunningCampaign((res.data || []).some((c) => c.status === "Running"));
      }
    } catch (err) {
      console.error("Failed to fetch campaigns:", err);
    } finally {
      setLoadingCampaigns(false);
    }
  }, [campaignStatusFilter, campaignTypeFilter, campaignSearch]);
```

Them state moi gan cac state khac cua trang (vi du canh `campaigns`):
```js
  const [hasRunningCampaign, setHasRunningCampaign] = useState(false);
```

Them 1 `useEffect` polling MOI (dat gan `useEffect` polling `isWarmingRunning` da co de de doi chieu, KHONG thay the no — day la polling BO SUNG danh CHUNG cho ca 2 loai campaign qua danh sach, con polling Warming cu van giu nguyen cho rieng phan Detail Panel cua no):

```js
  useEffect(() => {
    if (!hasRunningCampaign) return;
    const interval = setInterval(() => {
      loadCampaignsList();
      if (selectedCampaignId) loadCampaignDetailData(selectedCampaignId);
    }, 8000);
    return () => clearInterval(interval);
  }, [hasRunningCampaign, selectedCampaignId, loadCampaignsList, loadCampaignDetailData]);
```

Dat `useEffect` nay SAU noi `loadCampaignDetailData` da duoc khai bao (kiem tra thu tu khai bao trong file, dung dependency array day du nhu ESLint react-hooks/exhaustive-deps yeu cau, giong cach cac `useEffect`/`useCallback` khac trong file nay dang lam).

---

## PHAN C — Frontend: Notification Center khong tu cap nhat (phai bam "da doc" moi thay noi dung moi)

### Trieu chung
`src/app/components/PendingCVClientWrapper.js` chi refresh du lieu notification (`router.refresh()`) khi nguoi dung CHU DONG bam vao 1 notification, bam "danh dau da doc", hoac "danh dau tat ca da doc" — khong co polling nao ca. Notification duoc fetch 1 LAN DUY NHAT o server component (`layout.js`) luc trang duoc render/dieu huong.

### Fix — them polling nhe, don gian (theo dung tinh than "minimal, non-over-engineered")

Trong `src/app/components/PendingCVClientWrapper.js`, tim noi khai bao `router` (tu `useRouter()`) va cac `useEffect` hien co (dong ~47, ~51), them 1 `useEffect` MOI:

```js
  useEffect(() => {
    const interval = setInterval(() => {
      router.refresh();
    }, 15000);
    return () => clearInterval(interval);
  }, [router]);
```

Dat cho nay chay o cap layout (component nay duoc mount o `layout.js`, ap dung cho toan bo app) nen se tu dong lam moi Notification Center moi 15 giay bat ke dang o trang nao — don gian, khong can dieu kien phuc tap ve "co dang chay campaign hay khong", dung tinh than uu tien giai phap don gian cua du an.

---

## Kiem tra sau khi implement

1. `npm run build` PASS 22/22.
2. **PHAN A la uu tien so 1** — neu co the, yeu cau User chay `node save-session.js 01a071c3-eb55-a4e0-8a64-e28098a8dbd5` tren VPS de co the test lai E2E that voi 1 tai khoan co session hop le, xac nhan: (a) neu that bai that (vi du session het han) -> `campaign_run_items.status = 'Failed'`, dung `social_group_id`/`fb_account_id`, notification bao that bai; (b) neu thanh cong that -> `status = 'Sent'` dung.
3. Neu chua co session hop le de test that, it nhat xac nhan bang cach doc lai code: gia lap thu cong 1 payload giong execution 515 (bridge tra `{success:true, exitCode:0, output:"[{...success:false...}]", error:"..."}`) va trace tay qua code moi de xac nhan ra `status: 'Failed'` dung, khong con `status: 'Sent'` sai nua.
4. PHAN B: dispatch 1 campaign Job Posting that, KHONG bam refresh thu cong, doi toi da 8-10s, xac nhan Master Table TU DONG chuyen tu "Running" ve trang thai cuoi cung dung (Ready/Failed) ma khong can F5.
5. PHAN C: sau khi 1 run hoan tat, KHONG bam vao notification nao ca, doi toi da 15-16s, xac nhan Notification Center TU DONG hien noi dung moi nhat.
6. Cap nhat CA HAI phan `docs/DEVELOPMENT_LOG.md` (Bang Tong Hop + Chi Tiet Tung Snapshot), ghi ro day la fix phat sinh tu lan E2E that dau tien cua Workflow A (execution 515), kem link execution id de tra cuu sau nay.

**KHONG duoc tu active/publish workflow trong n8n sau khi sua PHAN A — Claude se QA lai qua `get_workflow_details`/`get_workflow_version` (xem draft, khong can publish) truoc, roi bao User tu bam Publish (gioi han platform da xac nhan truoc do).**

---

## ĐÍNH CHÍNH (2026-09-06, sau khi viết spec) — root cause thật của "fb-session.json not found" CÓ THỂ KHÔNG PHẢI thiếu session

Sau khi User hỏi lại và Claude verify qua Supabase (`sandbox.warm_join_runs`/`warm_join_run_items`), phát hiện: cùng account Nick Chinh (`01a071c3-eb55-a4e0-8a64-e28098a8dbd5`) da CHAY THANH CONG nhieu lan Warming that (join duoc cac nhom FB that, khac nhau moi lan — vi du `01a073d5-3b89-...` luc 23:09:08-23:14:57 UTC 2026-09-05, joined 2 nhom that: `HIỆP HỘI CƠ KHÍ TOÀN QUỐC`, `HIỆP HỘI CƠ KHÍ VIỆT NAM`). Dieu nay CHUNG MINH session THAT SU TON TAI va hoat dong binh thuong cho account nay.

**Phat hien quan trong**: Warming run tren (23:09:08 - 23:14:57 UTC) va execution 515 (Job Posting that bai, bat dau 23:14:53 UTC) **CHAY GAN NHU DONG THOI** — cung dung account Nick Chinh. Rat co kha nang day la 1 **XUNG DOT TRUY CAP DONG THOI (race condition)**: 2 automation khac loai (Warming + Job Posting) cung co gang dung 1 luc file session/browser profile cua CUNG 1 FB account, gay ra loi "not found" tam thoi — KHONG PHAI session chua tung duoc tao.

He thong hien tai CHUA co co che khoa nao ngan 1 FB account bi 2 automation khac loai (Job Posting va Warming) dung DONG THOI — chi co khoa THEO CAMPAIGN (Job Posting, `one_running_run_per_campaign`) va khoa TOAN CUC theo LOAI (Warming, `one_running_warm_join_run`), khong co khoa THEO TUNG ACCOUNT xuyen suot ca 2 loai. Day CHINH LA "Per-Account Mutex Lock" da duoc de cap trong `docs/architecture/BLUEPRINT_2026-09-04_fb-account-warming-and-rotation-strategy.md` (Tru cot 9) va `HANDOVER_2026-09-06_fb-warming-workflow-d-architect-request.md` — truoc day chi la de xuat ly thuyet, GIO DA CO BANG CHUNG THUC TE tu chinh su co nay chung minh no can thiet.

**Khuyen nghi cho AG**: KHONG voi ket luan "account thieu session" — truoc khi sua PHAN A (parsing bug, van dung, van can sua vi la loi that doc lap), hay test lai: chay Job Posting CHO NICK CHINH trong luc CHAC CHAN khong co Warming nao dang chay (kiem tra `warm_join_runs` khong co dong `status='Running'`), roi xem con loi "fb-session.json not found" nua khong. Neu KHONG con loi, xac nhan day dung la do xung dot dong thoi, khong phai thieu session — luc do "Per-Account Mutex Lock" (Workflow D) can duoc uu tien lam SOM hon du kien, khong chi la "nice-to-have" trong tuong lai.

**KHONG rut lai** khuyen nghi PHAN A (van la bug that, doc lap voi phat hien nay) — chi rut lai gia dinh "can chay lai save-session.js" trong phan Boi Canh dau file, vi co the khong can thiet.
