# FIX_SPEC_2026-09-06 — Bang Campaign va Panel chi tiet nhap nhay nhu F5 moi 8 giay khi co campaign dang chay, kem reset filter/pagination

**Boi canh**: User dang test that "Test Job posting" (status Running) va bao man hinh giat/nhap nhay giong nhu dang refresh trang lien tuc. Claude doc code xac nhan day la tac dung phu chua duoc xu ly ky cua tinh nang auto-poll da them trong PHAN B cua fix truoc do (commit `9f07f03`, muc dich tot: tu cap nhat trang thai campaign moi 8s khong can F5 thu cong) — nhung cach lam hien tai gay 2 van de UX ro rang.

## Root cause (xac nhan qua doc truc tiep code `src/app/campaigns/page.js`)

Effect polling (dong ~549):
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

Goi lai 2 ham NGUYEN VAN moi 8 giay, ca 2 ham nay deu:

1. `loadCampaignsList` (dong ~301): `setLoadingCampaigns(true)` khong dieu kien luc bat dau, `setLoadingCampaigns(false)` khi xong. UI (dong ~1130) render **thay THE TOAN BO noi dung bang** bang 1 dong "Loading campaigns..." khi `loadingCampaigns === true` — moi 8 giay bang campaign bi xoa trang roi ve lai, gay cam giac F5.

2. `loadCampaignDetailData` (dong ~457): tuong tu, `setLoadingDetail(true)/false` khong dieu kien — UI (dong ~1332) cung thay the toan bo panel chi tiet bang spinner. **Nghiem trong hon**: ham nay con LUON `setShowOnlySelectedGroups(false)`, `setGroupPage(1)`, roi goi lai `fetchTargetGroups(1, ...)` — nghia la moi 8 giay, neu User dang xem trang Target Groups khac trang 1, hoac dang bat filter "Only Selected", se BI RESET VE MAC DINH lien tuc trong suot thoi gian campaign chay.

## Fix — them tham so `silent` cho ca 2 ham, chi bo qua UI loading + KHONG reset filter/pagination khi goi ngam tu polling

Sua `loadCampaignsList` (giu nguyen logic ben trong, chi bo qua set loading khi silent):
```js
const loadCampaignsList = useCallback(async (silent = false) => {
  if (!silent) setLoadingCampaigns(true);
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
    if (!silent) setLoadingCampaigns(false);
  }
}, [campaignStatusFilter, campaignTypeFilter, campaignSearch]);
```

Sua `loadCampaignDetailData` (giu filter/pagination hien tai cua User khi silent, khong ep ve trang 1 / tat filter):
```js
const loadCampaignDetailData = useCallback(
  async (id, silent = false) => {
    if (!id) return;
    if (!silent) setLoadingDetail(true);
    try {
      const detailRes = await getCampaignDetail(id);
      if (detailRes.success && detailRes.data) {
        const cData = detailRes.data.campaign || detailRes.data;
        const flattened = {
          ...cData,
          name: cData.campaign_name || cData.name,
          targetGroups: detailRes.data.targetGroups || [],
          fbAccounts: detailRes.data.assignedAccounts || [],
          runs: detailRes.data.runs || []
        };
        setCampaignDetail(flattened);
        const tIds = new Set((detailRes.data.targetGroups || []).map((g) => g.id));
        setTargetGroupIds(tIds);
      }
      if (!silent) {
        setShowOnlySelectedGroups(false);
        setGroupPage(1);
        await fetchTargetGroups(1, groupSearchTerm, selectedTagFilters, false);
      } else {
        // Silent background refresh: giu nguyen trang/filter hien tai cua User, chi lam moi du lieu
        await fetchTargetGroups(groupPage, groupSearchTerm, selectedTagFilters, showOnlySelectedGroups);
      }
    } catch (err) {
      console.error("Failed to load campaign detail:", err);
    } finally {
      if (!silent) setLoadingDetail(false);
    }
  },
  [fetchTargetGroups, groupSearchTerm, selectedTagFilters, groupPage, showOnlySelectedGroups]
);
```

Sua effect polling truyen `silent = true`:
```js
useEffect(() => {
  if (!hasRunningCampaign) return;
  const interval = setInterval(() => {
    loadCampaignsList(true);
    if (selectedCampaignId) loadCampaignDetailData(selectedCampaignId, true);
  }, 8000);
  return () => clearInterval(interval);
}, [hasRunningCampaign, selectedCampaignId, loadCampaignsList, loadCampaignDetailData]);
```

**Luu y**: TAT CA cac noi goi `loadCampaignsList()` / `loadCampaignDetailData(id)` KHAC trong file (vi du sau khi bam nut Run, sau khi Cancel, khi chon campaign lan dau...) giu nguyen KHONG truyen tham so (mac dinh `silent = false`) — CHI co lenh goi trong polling interval nay moi truyen `true`. Khong doi hanh vi loading spinner cho cac truong hop User chu dong thao tac.

## Yeu cau verify (BAT BUOC truoc khi bao PASS)
1. Chay 1 campaign Job Posting/Warming that, quan sat bang danh sach VA panel chi tiet trong luc campaign dang "Running" it nhat 30 giay (2-3 chu ky poll) — xac nhan KHONG con hien tuong nhap nhay/xoa trang, du lieu (status, Total Sent...) van tu cap nhat dung.
2. Trong luc campaign dang chay, chuyen sang trang 2 cua Target Groups (hoac bat filter "Only Selected") roi cho tiep 1-2 chu ky poll (16-24s) troi qua — xac nhan KHONG bi nhay ve trang 1 / tat filter tu dong.
3. Xac nhan cac thao tac chu dong (bam Run, chon campaign khac, F5 thu cong) van hien loading spinner binh thuong nhu cu (khong bi mat loading state can thiet).
4. Cap nhat `docs/DEVELOPMENT_LOG.md` (ca bang tong hop + phan chi tiet).
