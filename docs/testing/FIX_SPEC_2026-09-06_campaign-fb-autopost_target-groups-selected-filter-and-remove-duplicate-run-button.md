# FIX SPEC — Filter "Chỉ Hiện Nhóm Đã Chọn" Trong Target Groups Picker & Xoá Nút "Run Warm & Join" Trùng Lặp

**Từ:** Claude (Architect/QA)
**Ngày:** 2026-09-06
**Nguồn:** User phản hồi trực tiếp qua screenshot khi dùng Detail Panel của Campaign (`src/app/campaigns/page.js`)
**Phạm vi:** CHỈ `src/app/campaigns/page.js` + `src/app/campaign_actions.js` (1 hàm). KHÔNG đụng DB/n8n.

## Vấn đề #1 — Không có cách lọc nhanh các nhóm ĐÃ được chọn cho Campaign

Trong bảng "Target Groups Selector" (Detail Panel → tab "Overview & Groups"), khi Campaign đã gán vài nhóm (VD: 2/1028 nhóm), các nhóm đã chọn nằm rải rác không theo thứ tự cố định trong danh sách 1028 nhóm (sắp xếp theo tên A-Z), User phải kéo/tìm thủ công qua nhiều trang mới thấy hết các nhóm đã tick — rất bất tiện khi muốn rà soát hoặc bỏ bớt.

### Bối cảnh kỹ thuật đã xác nhận (đọc trực tiếp code)
- `targetGroupIds` (state `Set`, dòng ~215) được nạp 1 lần đầy đủ từ `getCampaignDetail(id).targetGroups` khi mở Campaign (dòng ~447-448) — LUÔN chứa đúng và đủ toàn bộ ID nhóm đã gán cho campaign, độc lập với trang/filter hiện tại đang xem trong bảng. Đây là nguồn dữ liệu đáng tin cậy để lọc.
- `allSocialGroups` (state, dòng ~214) là danh sách nhóm ĐANG HIỂN THỊ trên bảng — lấy từ `getSocialGroups(filters)` (server action, `campaign_actions.js` dòng 1706), phân trang server-side (`page`, `pageSize`), lọc theo `search`/`tagFilters`. Hiện hàm này KHÔNG hỗ trợ lọc theo danh sách ID cụ thể.
- `fetchTargetGroups(targetPage, searchVal, tags)` (dòng ~422) là hàm gọi `getSocialGroups` — mọi nơi gọi lại bảng (đổi trang, đổi search/tag, mở campaign) đều qua hàm này.

### Giải pháp

**PHẦN A — Backend: mở rộng `getSocialGroups` (campaign_actions.js dòng 1706) hỗ trợ lọc theo `ids`**

Thêm tham số tuỳ chọn `filters.ids` (mảng UUID). Khi có mặt (không phải `undefined`):
- Nếu mảng rỗng (`ids.length === 0`): trả về ngay `{ success: true, data: [], totalCount: 0 }`, KHÔNG query DB (tránh query rác khi campaign chưa có nhóm nào).
- Nếu có phần tử: thêm điều kiện `AND id = ANY(${ids}::uuid[])` vào CẢ 2 câu SELECT và COUNT hiện có, kết hợp AND với `search`/`tagFilters` đang có sẵn (để User vẫn có thể gõ tìm kiếm/tag NGAY TRONG chế độ "chỉ hiện đã chọn" nếu campaign có nhiều nhóm đã gán).

Ví dụ sửa (giữ nguyên toàn bộ logic cũ, chỉ thêm điều kiện mới):
```js
export async function getSocialGroups(filters = {}) {
  try {
    const { search = '', tagFilters = [], page = 1, pageSize = (filters.limit || 50), ids = null } = filters;

    if (Array.isArray(ids) && ids.length === 0) {
      return { success: true, data: [], totalCount: 0 };
    }

    const term = search.trim() ? `%${search.trim()}%` : null;
    const hasTagFilter = Array.isArray(tagFilters) && tagFilters.length > 0;
    const hasIdsFilter = Array.isArray(ids) && ids.length > 0;
    const offset = (Math.max(1, page) - 1) * pageSize;

    const groups = await sql`
      SELECT id, name, url, group_type, join_status, is_active, admin_questions, custom_join_answer, member_count
      FROM social_group_urls
      WHERE is_active = true
        AND (${term}::text IS NULL OR name ILIKE ${term} OR url ILIKE ${term})
        AND (${hasTagFilter} = false OR group_type && ${tagFilters}::text[])
        AND (${hasIdsFilter} = false OR id = ANY(${ids}::uuid[]))
      ORDER BY name ASC
      LIMIT ${pageSize} OFFSET ${offset}
    `;

    const [{ total }] = await sql`
      SELECT COUNT(*) AS total
      FROM social_group_urls
      WHERE is_active = true
        AND (${term}::text IS NULL OR name ILIKE ${term} OR url ILIKE ${term})
        AND (${hasTagFilter} = false OR group_type && ${tagFilters}::text[])
        AND (${hasIdsFilter} = false OR id = ANY(${ids}::uuid[]))
    `;

    return { success: true, data: groups, totalCount: Number(total || 0) };
  } catch (error) {
    console.error('[getSocialGroups] Error:', error);
    return { success: false, error: error.message };
  }
}
```
Không đụng gì tới `getSocialGroupIdsMatchingFilter` hay các nơi khác đang gọi `getSocialGroups` mà không truyền `ids` — hành vi cũ giữ nguyên 100% vì `ids` mặc định `null`.

**PHẦN B — Frontend: thêm toggle "Only Selected" trong Target Groups Selector**

1. Thêm state mới cạnh `groupSearchTerm`/`selectedTagFilters` (khoảng dòng 217-218):
   ```js
   const [showOnlySelectedGroups, setShowOnlySelectedGroups] = useState(false);
   ```
2. Sửa `fetchTargetGroups` (dòng ~422-441) để nhận thêm tham số và truyền `ids` cho `getSocialGroups` khi bật:
   ```js
   const fetchTargetGroups = useCallback(
     async (targetPage = 1, searchVal = "", tags = new Set(), onlySelected = false) => {
       setLoadingGroups(true);
       try {
         const res = await getSocialGroups({
           search: searchVal,
           tagFilters: Array.from(tags),
           page: targetPage,
           pageSize: groupPageSize,
           ids: onlySelected ? Array.from(targetGroupIds) : null,
         });
         if (res.success) {
           setAllSocialGroups(res.data || []);
           setGroupTotalCount(res.totalCount || 0);
         }
       } catch (err) {
         console.error("Failed to fetch target groups:", err);
       } finally {
         setLoadingGroups(false);
       }
     },
     [groupPageSize, targetGroupIds]
   );
   ```
   (Lưu ý: thêm `targetGroupIds` vào dependency array vì hàm giờ đọc trực tiếp state này.)
3. Cập nhật MỌI lời gọi `fetchTargetGroups(...)` hiện có (trong `loadCampaignDetailData` dòng ~464, debounce `useEffect` dòng ~479-484, `handleGroupPageChange` dòng ~495-497, và bất kỳ chỗ nào khác gọi hàm này — ví dụ dòng 1576 `onAnswerUpdated`) để truyền thêm `showOnlySelectedGroups` làm tham số thứ 4. Thêm `showOnlySelectedGroups` vào dependency array của `useEffect` debounce (dòng ~479-484) để bật/tắt toggle tự động fetch lại trang 1.
4. Thêm UI toggle ngay cạnh ô search (dòng ~1450, trong "Filter Bar & Actions", cùng hàng với input search và `GroupTypeTagEditor`):
   ```jsx
   <button
     type="button"
     onClick={() => setShowOnlySelectedGroups((v) => !v)}
     className={`px-2.5 py-1 rounded text-[11px] font-semibold flex items-center gap-1.5 border transition-colors shrink-0 cursor-pointer ${
       showOnlySelectedGroups
         ? "bg-emerald-600/20 text-emerald-400 border-emerald-500/40"
         : "bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200"
     }`}
     title="Show only groups already assigned to this campaign"
   >
     <ListChecks size={12} />
     <span>Only Selected ({targetGroupIds.size})</span>
   </button>
   ```
   Thêm `ListChecks` vào import `lucide-react` ở đầu file (dòng ~5-34).
5. Khi render bảng (dòng ~1540 `allSocialGroups.map(...)`), thêm 1 lớp lọc client-side ngay trước `.map` để phản ứng tức thì khi User bỏ tick 1 nhóm trong lúc đang ở chế độ "Only Selected" (không cần đợi fetch lại):
   ```js
   const visibleGroups = showOnlySelectedGroups
     ? allSocialGroups.filter((g) => targetGroupIds.has(g.id))
     : allSocialGroups;
   ```
   rồi dùng `visibleGroups` thay `allSocialGroups` trong đoạn render bảng (map + đếm `allSocialGroups.length === 0` ở dòng ~1533 cũng đổi sang `visibleGroups.length === 0`).
6. (Khuyến nghị, không bắt buộc) Vô hiệu hoá nút "Select All (N)" khi `showOnlySelectedGroups` đang bật (vì không có tác dụng thực — mọi nhóm hiển thị đã được chọn sẵn), giữ nguyên "Deselect All" hoạt động bình thường (rất hữu ích: cho phép xoá nhanh toàn bộ nhóm đã gán trong khi đang xem đúng danh sách đó).

## Vấn đề #2 — 2 nút "Run" trùng chức năng trên Warming Campaign

Đọc code xác nhận: nút "Run" (icon `Flame`, dòng ~1190-1210) trên dòng Master Table VÀ nút "Run Warm & Join" (icon `Flame`, dòng ~1291-1319) trong header Detail Panel gọi **CHÍNH XÁC CÙNG 1 logic**:
```js
setWarmFeedback(null);
setWarmCampaignTarget(c /* hoặc campaignDetail */);
setConfirmWarmModalOpen(true);
```
Dòng Master Table của campaign đang mở Detail Panel vẫn luôn hiển thị phía trên panel (không bị ẩn), nên xoá nút trong Detail Panel không làm mất chức năng nào — User vẫn bấm "Run" ở dòng Master Table như cũ.

**Yêu cầu:** Xoá toàn bộ khối JSX sau trong Detail Panel header (`src/app/campaigns/page.js`, ngay trước nút đóng "X" — khối bắt đầu bằng điều kiện `campaignDetail?.campaign_type === "Warming"`):
```jsx
{campaignDetail?.campaign_type === "Warming" && (
  <button
    type="button"
    disabled={isWarmingRunning}
    onClick={() => {
      setWarmFeedback(null);
      setWarmCampaignTarget(campaignDetail);
      setConfirmWarmModalOpen(true);
    }}
    className={`px-3 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all shadow-sm ${
      isWarmingRunning
        ? "bg-amber-950/40 text-amber-500 border border-amber-800/60 cursor-not-allowed"
        : "bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white border border-amber-500/50 hover:shadow-amber-500/20 cursor-pointer"
    }`}
    title={isWarmingRunning ? "A warm-up run is currently in progress" : "Start sequential warm-up & auto-join for this campaign"}
  >
    {isWarmingRunning ? (
      <>
        <Loader2 size={12} className="animate-spin text-amber-400" />
        <span>Warming...</span>
      </>
    ) : (
      <>
        <Flame size={12} className="text-amber-200 fill-amber-200/40" />
        <span>Run Warm &amp; Join</span>
      </>
    )}
  </button>
)}
```
Xoá NGUYÊN khối này (từ `{campaignDetail?.campaign_type === "Warming" && (` tới dấu `)}` đóng khối). Giữ nguyên nút đóng "X" ngay sau đó và mọi thứ khác trong header không đổi. KHÔNG xoá `isWarmingRunning`, `setWarmFeedback`, `setWarmCampaignTarget`, `setConfirmWarmModalOpen` — các state/hàm này vẫn được dùng bởi nút "Run" ở Master Table và modal xác nhận.

## Không cần làm

- KHÔNG đổi logic modal xác nhận Warm & Join (`ConfirmWarmModal` hay tên tương đương) — chỉ xoá điểm gọi trùng.
- KHÔNG đụng tới `AssignGroupsToCampaignsModal.js` (bulk-assign nhiều campaign) hay `CampaignEditModal.js`/`FbAccountEditModal.js` — đây là bảng khác, không nằm trong phạm vi spec này.
- KHÔNG cần thêm filter "Only Selected" tương tự cho sub-tab "Social Group URLs" (Library) hay bulk-assign modal — chỉ áp dụng cho đúng bảng Target Groups Selector trong Detail Panel này (yêu cầu cụ thể của User).

## Yêu cầu verify (AG tự test trước khi báo)

1. Mở 1 campaign đã có ≥2 nhóm gán sẵn (VD: "Test Job posting" trong screenshot User gửi) → bấm "Only Selected (2)" → bảng chỉ còn đúng 2 nhóm đã tick, `Showing 2 of 2 groups`.
2. Trong chế độ "Only Selected", bỏ tick 1 nhóm → nhóm đó biến mất khỏi bảng NGAY (không cần chờ fetch lại) và số đếm "Only Selected (N)" giảm theo.
3. Trong chế độ "Only Selected", gõ thêm search/tag → bảng lọc tiếp trong phạm vi các nhóm đã chọn (kết hợp AND đúng).
4. Tắt "Only Selected" → bảng quay lại đúng hành vi cũ (phân trang toàn bộ 1028 nhóm theo search/tag).
5. Campaign chưa có nhóm nào (`targetGroupIds.size === 0`) → bấm "Only Selected (0)" → bảng hiện "No social groups matched..." ngay, không lỗi, không query rác.
6. Mở lại 1 Warming Campaign bất kỳ → xác nhận Detail Panel header CHỈ còn nút đóng "X" (không còn "Run Warm & Join"), trong khi nút "Run" ở dòng Master Table của đúng campaign đó vẫn hoạt động bình thường, mở đúng modal xác nhận Warm & Join.
7. `npm run build` PASS.
8. Cập nhật `docs/DEVELOPMENT_LOG.md` cả 2 phần (bảng tổng hợp + chi tiết) theo `[[devlog-summary-table-rule]]`.
