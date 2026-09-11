# QA_2026-09-06 — Target Groups "Only Selected" Filter + Remove Duplicate Run Warm & Join Button

**Spec doi chieu**: `docs/testing/FIX_SPEC_2026-09-06_campaign-fb-autopost_target-groups-selected-filter-and-remove-duplicate-run-button.md`
**Commit implement**: `10de957` (feat), `1a6863c` (devlog)
**QA boi**: Claude (Architect/QA) - doc diff truc tiep qua `git show`, khong chay code.

## Doi chieu Part A (backend getSocialGroups)
- OK Them param ids = null vao destructure.
- OK Early return { success: true, data: [], totalCount: 0 } khi ids la mang rong.
- OK hasIdsFilter + dieu kien AND (hasIdsFilter = false OR id = ANY(ids::uuid[])) them dung ca 2 cau SELECT va COUNT, ket hop AND voi search/tagFilters hien co - khop 100% code mau trong spec.

## Doi chieu Part B (frontend campaigns/page.js)
- OK Import ListChecks tu lucide-react.
- OK State showOnlySelectedGroups them dung vi tri.
- OK fetchTargetGroups nhan them param thu 4 onlySelected, truyen ids: onlySelected ? Array.from(targetGroupIds) : null; dependency array cap nhat them targetGroupIds.
- OK Tat ca call site cap nhat dung: loadCampaignDetailData (reset showOnlySelectedGroups ve false khi doi campaign), debounce useEffect (them showOnlySelectedGroups vao deps), handleGroupPageChange, onAnswerUpdated callback.
- OK Toggle button "Only Selected (N)" them dung vi tri canh search input.
- OK "Select All" bi disabled={showOnlySelectedGroups}; "Deselect All" KHONG bi disable - dung khuyen nghi trong spec.
- OK visibleGroups client-side filter them dung, dung thay allSocialGroups trong render map + empty-check + "Showing X of Y" text.
- OK Khoi JSX nut "Run Warm & Join" trong Detail Panel header bi xoa HOAN TOAN va dung chinh xac doan spec da trich dan.
- OK 4 dependency duoc yeu cau giu lai (isWarmingRunning, setWarmFeedback, setWarmCampaignTarget, setConfirmWarmModalOpen) - verify bang grep: van con dung day du o Master Table Run button (dong ~1200-1211) va cac modal xac nhan Warm & Join khac. Khong co tham chieu nao bi orphan.

## Verify bo sung cua AG (doc trong DEVELOPMENT_LOG SNAP-20260906-94)
- Automated test scratch/test_only_selected_filter.mjs: 5/5 PASS.
- Chrome DevTools MCP live UI: 6/6 kich ban PASS.
- npm run build: PASS 22/22 routes.

## Ket luan
**PASS - khong phat hien loi.** Ca 2 phan A va B khop chinh xac voi FIX_SPEC, khong co side-effect/orphan reference nao.
