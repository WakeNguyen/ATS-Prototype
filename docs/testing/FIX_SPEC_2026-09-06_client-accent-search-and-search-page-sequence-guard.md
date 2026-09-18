# FIX_SPEC_2026-09-06 — Chuan hoa tim kiem khong dau (client-side JS) + Sequence-guard cho search/page.js

**Boi canh**: Trong luc ra soat sau cho "Test Tong" (PHAN 5, `master_test_matrix.md`), phat hien 2 van de MOI, doc lap voi PHAN B da fix truoc do (PHAN B la fix o TANG SQL qua `unaccent()`, chi ap dung cho cac ham `getCandidateSearchData`/`getClientSearchData`/`getJobSearchData`). 2 van de duoi day nam o TANG CLIENT-SIDE JS thuan, KHONG duoc PHAN B che phu.

---

## PHAN A — Tim kiem/loc client-side khong xu ly tieng Viet co dau (5 vi tri)

### Root cause
5 noi dung `.toLowerCase().includes(...)` de loc du lieu co the chua ten/tu tieng Viet co dau, nhung khong strip dau — nen go khong dau (vd "nguyen") se KHONG khop voi du lieu co dau ("Nguyễn"), va nguoc lai.

### Fix — them 1 ham dung chung `stripAccents()` vao `src/lib/utils.js` (file util client-safe co san, dang co `cn()`, `formatDateVN()`...), roi ap dung tai ca 5 noi:

**1. Them vao `src/lib/utils.js`:**
```js
// Chuan hoa chuoi tieng Viet co dau thanh khong dau + lowercase, dung cho MOI noi filter/search
// client-side JS thuan (KHONG thay the unaccent() o tang SQL — 2 lop rieng biet).
export function stripAccents(str) {
  if (!str) return "";
  return String(str)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase();
}
```

**2. `src/app/jobs/page.js`** (ham `filteredClients` trong `SearchableClientDropdown`, dong ~121-128) — them import `import { stripAccents } from "src/lib/utils";` o dau file, roi sua:
```js
const filteredClients = useMemo(() => {
  if (!search.trim()) return clients;
  const q = stripAccents(search.trim());
  return clients.filter((c, i) => {
    const dispNum = String(c.display_number || i + 1);
    const name = stripAccents(c.name || "");
    return name.includes(q) || dispNum.includes(q);
  });
}, [clients, search]);
```

**3. `src/app/campaigns/page.js`** (ham `filteredFbAccounts`, dong ~815-822) — them import, roi sua:
```js
const filteredFbAccounts = useMemo(() => {
  const q = stripAccents(fbAccountSearch);
  return fbAccounts.filter(
    (a) =>
      stripAccents(a.name).includes(q) ||
      stripAccents(a.account_ref).includes(q) ||
      stripAccents(a.proxy_url).includes(q)
  );
}, [fbAccounts, fbAccountSearch]);
```

**4. `src/app/components/AssignGroupsToCampaignsModal.js`** (ham `filteredCampaigns`, dong ~75-88) — them import, roi sua PHAN `matchSearch` (giu nguyen `matchType`):
```js
const filteredCampaigns = useMemo(() => {
  const q = stripAccents(search.trim());
  return campaigns.filter((c) => {
    const cName = c.campaign_name || c.name || "";
    const matchSearch =
      !q ||
      stripAccents(cName).includes(q) ||
      stripAccents(c.channel || "").includes(q) ||
      stripAccents(c.job_title || "").includes(q);

    const matchType =
      typeFilter === "ALL" || (c.campaign_type || "Job Posting") === typeFilter;

    return matchSearch && matchType;
  });
}, [campaigns, search, typeFilter]);
```

**5. `src/app/page.js`** (component `SearchableFilterDropdown`, ham `filteredOptions`, dong ~72-76) — them import, roi sua:
```js
const filteredOptions = useMemo(() => {
  if (!search.trim()) return options;
  const q = stripAccents(search);
  return options.filter(opt => stripAccents(opt.label || "").includes(q));
}, [options, search]);
```

**6. `src/app/actions.js`** (ham `getClientWorkbenchData`, nhanh fallback resolve theo `clientName`, dong ~1141-1146) — uu tien THAP hon (2 ve so sanh deu tu cung 1 field DB nen it kha nang lech dau), nhung sua cho TRIET DE theo yeu cau — them import, roi sua:
```js
if (clientName && !resolvedClientId) {
  const cleanName = stripAccents(clientName.trim());
  const matched = formattedClients.find(c => stripAccents(c.name) === cleanName || stripAccents(c.name).includes(cleanName));
  if (matched) {
    resolvedClientId = matched.id;
  }
}
```

### Yeu cau verify PHAN A
1. O moi trong 4 dropdown/search UI tren (Jobs > chon Client, Campaigns > tim FB Account, modal Gan nhom vao Campaign, bat ky `SearchableFilterDropdown` nao dang hien du lieu co dau vd ten Client/Job) — go KHONG dau (vd "nguyen", "cong ty tnhh") va CO dau, xac nhan ca 2 cach go deu ra dung ket qua.
2. Test rieng chu "Đ/đ" (vd ten cong ty co "Đông", "Đức...") — go "dong"/"duc" khong dau van phai khop.
3. `node --check` tung file da sua de chac chan khong loi syntax.

---

## PHAN B — `search/page.js`: `fetchData` (doi trang / bam Reload) thieu sequence-guard chong ghi de response cu

### Root cause
`fetchData(tab, term, targetPage, isManualReload)` (dong ~74-110) duoc goi tu 3 noi: debounce search (dong ~120), `handlePageChange` (dong ~133), nut "Reload" (dong ~215) — nhung KHONG co co che nao dam bao response VE SAU ghi de response VE TRUOC theo dung thu tu goi. Neu 2 lan goi chong nhau (vd doi trang lien tuc, hoac go nhanh + bam Reload gan nhu cung luc) va response VE TRUOC lai VE SAU (do mang cham hon), ket qua cu se ghi de ket qua moi — dung 1 lop loi voi UI-01 nhung o man hinh Search Menu, muc do it xay ra hon (can thao tac rat nhanh) nhung van la 1 lo hong that.

### Fix — dung lai chinh xac pattern `selectRowSequenceRef` da dung trong `page.js`, ap dung cho `search/page.js`

**1. Them 1 ref moc phien ban, dat canh `debounceTimerRef` (dong ~71):**
```js
const searchSeqRef = useRef(0); // THEM: moc "phien ban" cho moi lan goi fetchData, chong response cu ghi de
```

**2. Sua ham `fetchData`** (dong ~74-111) — chi them 1 dong dau ham va them dieu kien kiem tra NGAY SAU moi `await`, KHONG doi logic khac:
```js
const fetchData = useCallback(async (tab, term, targetPage = 1, isManualReload = false) => {
  const mySeq = ++searchSeqRef.current; // THEM: claim phien ban moi nhat cho lan goi nay
  if (isManualReload) setLoading(true);
  else setIsSearching(true);

  try {
    if (tab === "candidate") {
      const res = await getCandidateSearchData({ searchTerm: term, page: targetPage, pageSize });
      if (mySeq !== searchSeqRef.current) return; // THEM: co request moi hon da goi sau -> bo qua ket qua nay
      if (res.success) {
        setCandidates(res.data || []);
        setCurrentTotal(res.totalCount || 0);
        if (!term) setTotalCounts(prev => ({ ...prev, candidate: res.totalCount }));
        if (res.data?.length > 0) setSelectedId(res.data[0].candidate_id);
        else setSelectedId(null);
      }
    } else if (tab === "client") {
      const res = await getClientSearchData({ searchTerm: term, page: targetPage, pageSize });
      if (mySeq !== searchSeqRef.current) return; // THEM
      if (res.success) {
        setClients(res.data || []);
        setCurrentTotal(res.totalCount || 0);
        if (!term) setTotalCounts(prev => ({ ...prev, client: res.totalCount }));
        if (res.data?.length > 0) setSelectedId(res.data[0].client_id);
        else setSelectedId(null);
      }
    } else if (tab === "job") {
      const res = await getJobSearchData({ searchTerm: term, page: targetPage, pageSize });
      if (mySeq !== searchSeqRef.current) return; // THEM
      if (res.success) {
        setJobs(res.data || []);
        setCurrentTotal(res.totalCount || 0);
        if (!term) setTotalCounts(prev => ({ ...prev, job: res.totalCount }));
        if (res.data?.length > 0) setSelectedId(res.data[0].job_id);
        else setSelectedId(null);
      }
    }
  } catch (err) {
    console.error("Fetch search data failed:", err);
  } finally {
    if (mySeq === searchSeqRef.current) { // THEM: chi tat loading/isSearching neu van la request moi nhat
      setLoading(false);
      setIsSearching(false);
    }
  }
}, [pageSize]);
```

Khong can sua gi them o 3 noi goi (`useEffect` debounce, `handlePageChange`, nut Reload) — ca 3 van goi `fetchData(...)` y het cu, guard nam gon trong 1 ham.

### Yeu cau verify PHAN B
1. Mo tab Candidate, bam nut phan trang (Next) LIEN TUC that nhanh nhieu lan — xac nhan bang cuoi cung dung LA trang cuoi cung da bam, khong bi "nhay lui" ve trang cu do response tra ve khong dung thu tu.
2. Go search nhanh nhieu ky tu roi xoa gan het (tao nhieu request debounce gan nhau) — xac nhan ket qua cuoi cung khop dung voi search term cuoi cung dang hien trong o input, khong bi lac.
3. Bam Reload trong luc dang go search — xac nhan khong bi loi javascript, ket qua on dinh.

---

## Yeu cau chung
Cap nhat `docs/testing/master_test_matrix.md` PHAN 5 (muc D va F) tu "cho quyet dinh" sang "da fix, cho AG commit + QA" sau khi verify xong, va cap nhat `docs/DEVELOPMENT_LOG.md` nhu thong le (SNAP moi, cot Git = commit hash).
