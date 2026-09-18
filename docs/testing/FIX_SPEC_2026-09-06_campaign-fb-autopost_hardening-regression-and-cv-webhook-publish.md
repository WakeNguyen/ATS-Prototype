# FIX_SPEC_2026-09-06 — Campaign gay hoan toan (Job Posting + Warming) do sai ten cot trong hardening commit + Webhook CV Upload 404 do chua publish

**Boi canh**: User bao 3 loi qua UI ngay sau khi AG commit `27b59df` (3-way mutex hardening) va `280a52a` (CV Upload in-app modal): (1) Parse CV bao loi n8n webhook 404, (2) Preview & Dispatch Breakdown cua Job Posting bao loi SQL, (3) Warming — bam "Confirm & Run Now" nhung modal khong dong, khong chay gi. Claude da tu verify TRUC TIEP qua Supabase (doc schema that cua `campaign_run_items`) va n8n MCP (doc `versionId`/`activeVersionId` that cua workflow) de xac dinh CHINH XAC root cause ca 3 loi truoc khi giao spec nay — khong doan.

**Muc do nghiem trong**: PHAN A la loi CHAN DUNG hoan toan ca 2 luong Job Posting va Warming (khong ai dispatch/chay campaign duoc nua) — uu tien sua truoc.

---

## PHAN A — [KHAN CAP, BLOCKING] Sai ten cot trong `_getBusyFbAccountIds` (regression tu chinh commit `27b59df`) — gay vo ca Job Posting lan Warming

### Trieu chung thuc te
- UI Job Posting: modal "Preview & Dispatch Breakdown" bao `Cannot Generate Dispatch Preview — column cri.campaign_run_id does not exist`.
- UI Warming: modal "Run Warm & Join Session" — bam nut "Confirm & Run Now" nhung modal KHONG dong, khong co gi xay ra (khong toast loi, khong chuyen trang).

### Root cause (xac nhan qua doc truc tiep schema that tren Supabase, khong doan)
Trong commit `27b59df` ("Hardening: 3-way per-account mutex lock"), ham `_getBusyFbAccountIds` trong `src/app/campaign_actions.js` duoc them 1 query moi:

```js
sqlTx`
  SELECT DISTINCT cri.fb_account_id
  FROM campaign_run_items cri
  JOIN campaign_runs cr ON cr.id = cri.campaign_run_id
  WHERE cr.status = 'Running' AND cri.fb_account_id IS NOT NULL
`,
```

Query nay dung sai ten cot: bang `campaign_run_items` (schema `sandbox`) THAT SU dung cot `run_id` de tham chieu ve `campaign_runs.id`, KHONG PHAI `campaign_run_id`. Da xac nhan lai truc tiep bang `information_schema.columns`:

```
id, run_id, social_group_id, fb_account_id, group_name, group_url, status, error_message, posted_at, created_time
```

Vi `_getBusyFbAccountIds` duoc goi o CA HAI noi:
1. `_getEligibilityState` (dung cho Job Posting "Preview & Dispatch Breakdown") → SQL loi ngay khi tinh eligibility → modal bao loi truc tiep cho User thay (dung nhu screenshot).
2. `_acquireWarmJoinRunLock` (dung cho nut "Confirm & Run Now" cua Warming) → SQL cung loi tuong tu, server action throw exception. Frontend hien khong co try/catch hien thi loi ro rang cho truong hop nay nen modal chi dung im, khong dong, khong bao gi — day la UX bug phu can sua kem (xem yeu cau o duoi).

### Fix — sua dung 1 dong trong `src/app/campaign_actions.js`, ham `_getBusyFbAccountIds`

Doi:
```js
JOIN campaign_runs cr ON cr.id = cri.campaign_run_id
```
thanh:
```js
JOIN campaign_runs cr ON cr.id = cri.run_id
```

**KHONG doi gi khac trong ham nay** — phan con lai (2 query jobPostingBusyCfa/warmingBusy/syncBusy va logic merge `busySet`) da dung, chi sai đúng 1 ten cot nay.

### Yeu cau bo sung — UX loi im lang o modal Warming (Confirm & Run Now)
Khi server action `_acquireWarmJoinRunLock` (hoac ham goi no tu UI Warming) throw loi bat ky (SQL error, business logic error nhu "No active and unbusy FB accounts available"...), UI hien dang KHONG hien thi loi gi cho User — modal chi dung im. Yeu cau: dam bao co try/catch o phia client goi ham nay, hien thi toast/error message ro rang cho User (vi du dung pattern toast dang co san trong du an), thay vi de modal treo khong phan hoi. Day la loi UX co the da ton tai tu truoc (khong chi rieng bug lan nay) nen can ra soat luon.

### Yeu cau verify (BAT BUOC truoc khi bao PASS)
1. Test lai "Preview & Dispatch Breakdown" cho 1 campaign Job Posting that — xac nhan khong con loi SQL, breakdown hien danh sach tai khoan/nhom dung.
2. Test lai "Run Warm & Join Session" → bam "Confirm & Run Now" — xac nhan modal dong, warming run duoc tao that trong `warm_join_runs`.
3. Chay lai doc lap cau query da sua truc tiep tren Supabase (khong chi tin code) doi chieu ket qua voi `_getBusyFbAccountIds` tra ve.
4. Test them 1 kich ban co tinh huong loi that su (vi du tat ca account dang bung Warming) de xac nhan toast loi moi hien thi dung, khong con modal treo im lang.

---

## PHAN B — Webhook "cv-upload" 404 vi thay doi n8n chua duoc publish len ban dang chay that

### Trieu chung thuc te
UI modal "Parse CV — AI Extraction" bao: `n8n webhook failed: {"code":404,"message":"The requested webhook \"POST cv-upload\" is not registered.","hint":"The workflow must be active for a production URL to run successfully..."}`

### Root cause (xac nhan qua `get_workflow_details` tren n8n MCP, khong doan)
Workflow "CV Parser → ATS 3.0 (Supabase) Dedup" (`fofSZKkdyhlVd9Lc`) hien co:
- `versionId` (ban DRAFT, moi nhat, co chua node "Webhook: CV Upload" — trigger POST `/webhook/cv-upload`): `1781d755-1d33-43ad-8ec0-93dc707cac64`
- `activeVersionId` (ban dang PUBLISH THAT, dang xu ly production traffic): `3dd2fa46-0b95-4aef-bffb-f62d5f2577c8`

Hai gia tri nay KHAC NHAU — nghia la node Webhook: CV Upload moi (them trong commit `280a52a`) moi chi nam trong ban draft, CHUA duoc publish len ban active. Do do URL production `/webhook/cv-upload` chua duoc n8n dang ky, dan den loi 404 dung nhu message tra ve. Xac nhan them: `activeVersionTriggerInfo` cua ban active hien TAI CHI co Form Trigger ("CV Upload Form"), khong co Webhook Trigger nao — khop chinh xac voi trieu chung.

### Fix
AG tu `publish_workflow` cho workflow `fofSZKkdyhlVd9Lc` qua n8n MCP cua AG de dua ban draft (co Webhook: CV Upload) thanh ban active. Claude khong tu publish workflow nay (ngoai pham vi vai tro Architect/QA da thong nhat).

**Luu y quan trong — tranh lap lai su co PHAN O truoc do**: workflow nay tung bi 1 su co node Upload CV ghi nham vao Google Drive folder Candidate THAT (da fix xong truoc do, hien dang tro dung folder Temp). Truoc khi publish, AG vui long kiem tra lai node Upload/Rename trong workflow van dang tro DUNG folder Temp (khong bi revert ve Candidate that trong qua trinh chinh sua them node Webhook lan nay) — chi can doc lai cau hinh node, khong can sua gi neu van dung.

### Yeu cau verify (BAT BUOC truoc khi bao PASS)
1. Sau khi publish, xac nhan `versionId` == `activeVersionId` qua `get_workflow_details`.
2. Xac nhan node Upload van tro dung folder Temp (khong bi revert).
3. Test 1 lan upload CV that qua modal in-app (`CVUploadModal.js`) voi it nhat 1 file that — xac nhan khong con loi 404, file duoc nhan boi n8n, CV duoc parse va vao dung hang doi Pending/Temp folder.

---

## Yeu cau chung cho ca PHAN A + B
- Cap nhat `docs/DEVELOPMENT_LOG.md` — CA 2 phan: bang tong hop dau file VA phan chi tiet o duoi (dung SNAP-ID moi tiep theo), ghi ro day la fix cho regression cua chinh commit `27b59df` (PHAN A) va publish-gap cua commit `280a52a` (PHAN B).
- Sau khi sua xong, bao lai commit hash chinh xac (khop voi `git log --oneline -1` thuc te).
