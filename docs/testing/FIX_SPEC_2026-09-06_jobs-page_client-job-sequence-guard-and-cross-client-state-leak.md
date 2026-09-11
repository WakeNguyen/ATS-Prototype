# FIX_SPEC_2026-09-06 — jobs/page.js: sequence-guard cho chuyen Client/Job + chong ghi de sai Client khi sua Branch/Person/Job

**Boi canh**: Hoan tat ra soat sau `jobs/page.js` (PHAN E cua Test Tong, `master_test_matrix.md`). File nay CHUA tung co bat ky sequence-guard nao (khac voi `page.js` — noi `selectRow()` da co san `selectRowSequenceRef` tu baseline). Phat hien 2 nhom loi THAT, cung 1 lop voi UI-01 nhung bien the moi va nghiem trong hon vi co the lam **du lieu cua Client A bi ghi nham vao form dang hien thi cua Client B**.

---

## PHAN A — `navigateClient` va `handleSelectJob` khong co sequence-guard (goc cua UI-01, chua tung duoc fix o file nay)

### Root cause
- `navigateClient(targetIndex)` (dong ~314-333): goi `getClientWorkbenchData(...)` roi `setClientPersons/setJobs/setSelectedJobId/setSelectedJob/setApplications/...` **KHONG co guard**. Click Client A roi B lien tiep (thao tac hoan toan binh thuong, khong can nhanh bat thuong) -> neu response A ve sau B -> Timeline/Jobs/Persons dang hien la cua Client A du dang xem Client B.
- `handleSelectJob(job)` (dong ~918-931): tuong tu, goi `getJobWorkbenchDetails(job.id)` roi `setApplications/setExpandedAppIds/setAppLogsMap` khong guard. Click Job A roi B lien tiep trong cung 1 Client -> co the hien nham Applications cua Job A.
- `loadInitialWorkbench()` (dong ~423-441): doi param URL (`job_id`/`client_id`) lien tuc (vd dieu huong nhanh tu Search Menu) cung khong co guard.

### Fix — them 2 ref moc phien ban dung chung cho ca file (dat gan dau ham `JobsClientsWorkbenchContent`, canh cac `useState` khac):
```js
// Sequence-guard chong stale-overwrite khi chuyen Client/Job nhanh (cung nguyen ly selectRowSequenceRef o page.js)
const clientSeqRef = useRef(0); // bump moi khi CLIENT context doi
const jobSeqRef = useRef(0);    // bump moi khi JOB context doi (bao gom ca khi Client doi, vi Job cung doi theo)
```

**1. `loadInitialWorkbench`:**
```js
async function loadInitialWorkbench() {
  const mySeq = ++clientSeqRef.current; // THEM
  ++jobSeqRef.current; // THEM
  setPageLoading(true);
  const res = await getClientWorkbenchData({ 
    jobId: jobIdParam || null,
    clientId: clientIdParam || null,
    clientName: clientNameParam || null,
    clientIndex: 0 
  });
  if (mySeq !== clientSeqRef.current) return; // THEM: co lan goi moi hon -> bo qua
  if (res.success) {
    setClients(res.clients || []);
    setCurrentClientIndex(res.currentIndex || 0);
    if (res.currentClient) setClientForm(res.currentClient);
    setClientPersons(res.clientPersons || []);
    setJobs(res.jobs || []);
    if (res.selectedJob) {
      setSelectedJobId(res.selectedJob.id);
      setSelectedJob(res.selectedJob);
    } else {
      setSelectedJobId(null);
      setSelectedJob(null);
    }
    setApplications(res.applications || []);
    setExpandedAppIds({});
    setAppLogsMap({});
  }
  setPageLoading(false);
}
```

**2. `navigateClient`:**
```js
async function navigateClient(targetIndex) {
  if (targetIndex < 0 || targetIndex >= clients.length) return;
  const targetClient = clients[targetIndex];
  if (!targetClient) return;

  if (isCreatingClient) {
    setIsCreatingClient(false);
  }

  const mySeq = ++clientSeqRef.current; // THEM
  ++jobSeqRef.current; // THEM: doi client thi job cung coi la doi context

  setCurrentClientIndex(targetIndex);
  setClientForm(targetClient);
  setEditingPersonId(null);
  setActiveAddPointPersonId(null);
  setEditingPointKey(null);
  setLoadingApps(true);

  const res = await getClientWorkbenchData({ clientId: targetClient.id, clientIndex: targetIndex });
  if (mySeq !== clientSeqRef.current) return; // THEM
  if (res.success) {
    setClientPersons(res.clientPersons || []);
    setJobs(res.jobs || []);
    const firstJob = res.selectedJob || null;
    setSelectedJobId(firstJob ? firstJob.id : null);
    setSelectedJob(firstJob);
    setApplications(res.applications || []);
    setExpandedAppIds({});
    setAppLogsMap({});
  }
  setLoadingApps(false);
}
```

**3. `handleSelectJob`:**
```js
async function handleSelectJob(job) {
  if (job.id === selectedJobId) return;
  const mySeq = ++jobSeqRef.current; // THEM
  setSelectedJobId(job.id);
  setSelectedJob(job);
  setLoadingApps(true);

  const res = await getJobWorkbenchDetails(job.id);
  if (mySeq !== jobSeqRef.current) return; // THEM
  if (res.success) {
    setApplications(res.applications || []);
    setExpandedAppIds({});
    setAppLogsMap({});
  }
  setLoadingApps(false);
}
```

---

## PHAN B — Branch/Person/Job handlers ghi vao state KHONG kiem tra con dung Client dang xem hay khong (bien the moi, nghiem trong hon UI-01)

### Root cause
Cac ham sau goi server action roi ghi thang vao `clientForm`/`clientPersons`/`jobs` **khong kiem tra client hien tai (`clientForm.id`) co con khop voi client luc bat dau thao tac hay khong**:
- `handleAddBranch`, `handleSaveEditBranch`, `handleDeleteBranch`, `handleSetHeadquarter` (dong ~617-716): `setClientForm(prev => ({...prev, branches: res.branches, ...}))` — day la merge THANG vao `prev` (form dang hien thi), KHONG loc theo ID. Neu user dang sua Branch cho Client A, roi chuyen sang xem Client B TRUOC KHI response ve (modal Branches khong tu dong dong khi chuyen client) -> `branches`/`location`/`address` cua Client A bi ghi nham vao form dang hien thi cua Client B.
- `handleAddPerson` (dong ~776): `setClientPersons(prev => [...prev, res.person])` — APPEND thang, khong kiem tra client. Tao Person cho A roi chuyen sang B truoc khi resolve -> Person cua A bi noi nham vao danh sach dang hien cua B.
- `handleAddJob` (dong ~927): `setJobs(prev => [res.job, ...prev])` — tuong tu, Job moi tao cho Client A co the bi noi nham vao danh sach Jobs dang hien cua Client B.

Day la bien the NGHIEM TRONG HON UI-01 goc: khong chi "hien sai du lieu tam thoi" ma con co the khien user **tuong nham da luu dung** trong khi thuc ra du lieu vua ghi vao dung SAI client dang xem tren UI (du du lieu THAT trong DB van dung client, chi la UI hien thi sai ngay luc do).

### Fix — dung lai `clientSeqRef` da them o PHAN A, kiem tra TRUOC khi merge vao state hien thi (khong can tang, chi DOC de so sanh):

**`handleAddBranch`:**
```js
async function handleAddBranch() {
  if (!clientForm.id || !newBranchForm.branch_name.trim()) return;
  const mySeq = clientSeqRef.current; // THEM: chi doc, khong tang
  setAddingBranch(true);
  const res = await addClientBranch(clientForm.id, {
    branchName: newBranchForm.branch_name.trim(),
    city: newBranchForm.city,
    address: newBranchForm.address.trim(),
    isHeadquarter: newBranchForm.is_headquarter,
    phone: newBranchForm.phone.trim(),
    notes: newBranchForm.notes.trim()
  });
  if (mySeq !== clientSeqRef.current) { setAddingBranch(false); return; } // THEM: da chuyen client khac, bo qua
  if (res.success) {
    setClientForm(prev => ({
      ...prev,
      branches: res.branches,
      ...(newBranchForm.is_headquarter ? { location: newBranchForm.city, address: newBranchForm.address.trim() } : {})
    }));
    setClients(prev => prev.map(c => c.id === clientForm.id ? {
      ...c,
      branches: res.branches,
      ...(newBranchForm.is_headquarter ? { location: newBranchForm.city, address: newBranchForm.address.trim() } : {})
    } : c));
    setNewBranchForm({
      branch_name: "", city: "Ho Chi Minh", address: "", is_headquarter: false, phone: "", notes: ""
    });
  }
  setAddingBranch(false);
}
```

Ap dung **dung mau tuong tu** (chup `mySeq = clientSeqRef.current` dau ham, kiem tra ngay sau await, giu nguyen `setClients(...)` — cai nay AN TOAN vi da loc theo `c.id` — chi can them dieu kien bao quanh khoi `setClientForm`) cho:
- `handleSaveEditBranch(branchId)` — sau `updateClientBranch(...)`.
- `handleDeleteBranch(branchId)` — sau `deleteClientBranch(...)` (nhanh `branchId === 'default_hq'` goi `handleClientFieldChange` rieng, khong can sua).
- `handleSetHeadquarter(branchId)` — sau `setHeadquarterBranch(...)`.

**`handleAddPerson`:**
```js
async function handleAddPerson(e) {
  e?.preventDefault();
  if (!clientForm.id || !newPersonForm.full_name.trim()) return;
  const mySeq = clientSeqRef.current; // THEM
  setAddingPerson(true);
  const res = await addClientPerson({ ...newPersonForm-mapped-as-cu... });
  if (mySeq !== clientSeqRef.current) { setAddingPerson(false); return; } // THEM
  if (res.success && res.person) {
    setClientPersons(prev => [...prev, res.person]);
    setNewPersonForm({ full_name: "", job_title: "HR", department: "", is_primary: false, initial_type: "Phone", initial_value: "" });
  }
  setAddingPerson(false);
}
```
(giu nguyen phan goi `addClientPerson({...})` y het code cu, chi them 2 dong moc/kiem tra bao quanh).

**`handleAddJob`:**
```js
async function handleAddJob(e) {
  e?.preventDefault();
  if (!newJobTitle.trim()) {
    alert("Vui lòng nhập tên Job Order trước khi tạo.");
    return;
  }
  if (!clientForm.id) return;
  const mySeq = clientSeqRef.current; // THEM
  setAddingJob(true);
  const res = await createJobForClient(clientForm.id, {
    job_title: newJobTitle.trim(), location: clientForm.location || "Ho Chi Minh", status: "Open", working_mode: ["On-site"]
  });
  if (mySeq !== clientSeqRef.current) { setAddingJob(false); return; } // THEM
  if (res.success && res.job) {
    ++jobSeqRef.current; // THEM: job moi duoc auto-select, vo hieu hoa handleSelectJob nao dang cho dang bay
    setJobs(prev => [res.job, ...prev]);
    setSelectedJobId(res.job.id);
    setSelectedJob(res.job);
    setApplications([]);
    setExpandedAppIds({});
    setAppLogsMap({});
    setNewJobTitle("");
  }
  setAddingJob(false);
}
```

**`handleSaveNewClient`** (dong ~587): them 2 dong bump o dau nhanh `if (res.success && res.client)` (TRUOC cac `set...` hien co, khong doi gi khac):
```js
if (res.success && res.client) {
  ++clientSeqRef.current; // THEM: vo hieu hoa moi response cu dang cho tu client truoc do
  ++jobSeqRef.current; // THEM
  const createdCl = { ...res.client, branches: [] };
  ... (giu nguyen phan con lai)
```

Khong can sua `handleSaveEditPerson`/`handleSaveNewContactPoint`/`handleSaveEditPoint`/`handleDeleteContactPoint`/`handleDeletePerson` — cac ham nay update qua `.map(p => p.id === personId ? ... : p)` theo dung `personId` (ID toan cuc, khong trung giua cac client) nen AN TOAN (khong khop se khong lam gi, khong co nguy co ghi nham).

---

## Yeu cau verify

1. **PHAN A**: Mo Client A, click nhanh sang Client B roi C (khong can qua nhanh, click binh thuong lien tiep) — xac nhan Persons/Jobs/Applications hien dung LA cua Client cuoi cung duoc chon, khong bi "nhay lui" ve du lieu cua client truoc do.
2. Trong cung 1 Client co nhieu Jobs, click nhanh giua cac Job — xac nhan Applications luon dung voi Job dang chon.
3. **PHAN B**: Mo modal Branches cho Client A, bam "Add Branch" (co the throttle Network trong DevTools de de tai hien do tre), **ngay lap tuc** chuyen sang xem Client B truoc khi thay toast thanh cong — xac nhan sau khi request xong, form dang hien thi CUA CLIENT B **KHONG bi** branch/address cua Client A ghi de len. Lap lai tuong tu voi Add Person va Add Job.
4. Test lai luong binh thuong (khong chuyen client giua chung) — xac nhan add/edit/delete Branch/Person/Job/Headquarter van hoat dong dung 100% nhu truoc, khong regression.
5. `node --check src/app/jobs/page.js` xac nhan khong loi syntax.

## Yeu cau chung
Cap nhat `docs/testing/master_test_matrix.md` PHAN 5 muc E tu "chua hoan tat" sang "da doc xong toan bo + da viet FIX_SPEC cho phat hien moi" sau khi AG commit xong, va them entry moi vao `docs/DEVELOPMENT_LOG.md`.
