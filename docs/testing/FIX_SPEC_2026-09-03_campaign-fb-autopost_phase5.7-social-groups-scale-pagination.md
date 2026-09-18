# Fix Spec (PHẦN 5.7) — Social Groups: Server-side Pagination + Search cho quy mô 1500+ URL — 2026-09-03

**Từ:** Claude (Architect/QA)
**Cho:** AG (Implementer)
**Điều kiện tiên quyết:** Không phụ thuộc spec nào khác — độc lập với PHẦN 2 (migrate Notion) và các PHẦN R (Responsive Tablet).

**Bối cảnh:** User cho biết `social_group_urls` đã vượt 1500 dòng (và sẽ tiếp tục tăng khi PHẦN 2 migrate 455 dòng Notion thật vào `public`). Claude (Architect) đã đọc trực tiếp `src/app/campaign_actions.js` và `src/app/campaigns/page.js`, xác nhận 2 vấn đề — 1 bug thật đang xảy ra và 1 rủi ro hiệu năng sẽ xấu dần:

1. `getSocialGroups({ limit: 500 })` (dùng để nạp danh sách group cho ô "Target Groups Selector" khi sửa 1 campaign) có `LIMIT` cứng = 500, và FE gọi hàm này **không truyền `search`** — bất kỳ group nào xếp sau vị trí 500 theo `ORDER BY name ASC` **hiện không thể được chọn gán vào campaign**. Đây là bug đang xảy ra ngay bây giờ, không phải rủi ro tương lai.
2. `getSocialGroupsLibrary()` (dùng cho tab quản lý "Social Group URLs") **không có giới hạn nào cả** — mỗi lần tải lại đều `SELECT ... GROUP BY` + 2 phép tổng hợp (`COUNT DISTINCT campaign_id`, `ARRAY_AGG campaign_names`, subquery `MAX(posted_at)`) trên toàn bộ bảng, trả hết dữ liệu về rồi lọc bằng `useMemo` phía client. Sẽ chậm dần khi bảng tiếp tục tăng.

**Quyết định đã chốt cùng User trước khi viết spec này (không cần bàn lại):**
- Áp dụng lại đúng pattern server-side pagination + debounced search đã PASS QA ở `/search` (`src/app/search/page.js`) — debounce input → gọi server action `{searchTerm/tagFilters, page, pageSize}` → SQL `WHERE ... LIMIT/OFFSET` → trả kèm tổng số để hiện phân trang.
- **KHÔNG đổi kiểu cột `admin_questions`/`custom_join_answer` sang `jsonb`** — trường hợp 1 group có nhiều câu hỏi xét duyệt riêng biệt là hiếm, không đáng đánh đổi (migrate dữ liệu cũ + sửa lại ~6 chỗ code đang đọc/ghi 2 cột này + rủi ro regression PHẦN 5.3 đã PASS QA). Giữ nguyên `text` như hiện tại.
- **KHÔNG loại `admin_questions`/`custom_join_answer` khỏi query danh sách** — ban đầu có cân nhắc loại 2 cột này ra khỏi query để nhẹ payload, nhưng vì cả 2 đã dùng trực tiếp trong `<JoinStatusBadge customAnswer={g.custom_join_answer} adminQuestions={g.admin_questions} />` ở CẢ 2 bảng (dòng ~1035 và ~1423 hiện tại), và vì phân trang đã tự giới hạn số dòng mỗi lần tải (không còn 1500+ dòng cùng lúc), giữ nguyên 2 cột này trong SELECT là hợp lý — không cần đổi UI/props gì của `JoinStatusBadge`.

**Nguyên tắc UI (nhắc lại theo GEMINI.md 1.4):** MVC, function-first, không animation màu mè, tái dùng tối đa. AG PHẢI copy đúng cơ chế debounce (`debounceTimerRef` + `setTimeout`) và khối UI phân trang (nút Previous/Next, "Page X of Y") đã có sẵn trong `src/app/search/page.js` — không viết lại logic mới từ đầu.

---

## PHẦN A — Backend: 3 server action trong `src/app/campaign_actions.js`

### A.1 — Sửa `getSocialGroupsLibrary()` (tab quản lý "Social Group URLs")

Vị trí hiện tại: dòng ~1427-1453. Đổi chữ ký và query:

```js
/**
 * Fetch paginated + searched social groups for the Library management tab.
 * @param {Object} [filters]
 * @param {boolean} [filters.includeInactive=false]
 * @param {string} [filters.search='']
 * @param {string[]} [filters.tagFilters=[]]
 * @param {number} [filters.page=1]
 * @param {number} [filters.pageSize=50]
 * @returns {Promise<{success: boolean, data?: Array, totalCount?: number, inactiveTotalCount?: number, error?: string}>}
 */
export async function getSocialGroupsLibrary(filters = {}) {
  try {
    const {
      includeInactive = false,
      search = '',
      tagFilters = [],
      page = 1,
      pageSize = 50,
    } = filters;
    const term = search.trim() ? `%${search.trim()}%` : null;
    const hasTagFilter = Array.isArray(tagFilters) && tagFilters.length > 0;
    const offset = (Math.max(1, page) - 1) * pageSize;

    // 1. Trang dữ liệu (giữ nguyên GROUP BY + aggregation hiện có, chỉ thêm WHERE + LIMIT/OFFSET)
    const groups = await sql`
      SELECT
        sgu.id, sgu.name, sgu.url, sgu.group_type, sgu.is_active,
        sgu.join_status, sgu.admin_questions, sgu.custom_join_answer, sgu.created_time,
        COUNT(DISTINCT csg.campaign_id) AS campaign_count,
        COALESCE(
          ARRAY_AGG(DISTINCT c.campaign_name) FILTER (WHERE c.campaign_name IS NOT NULL),
          '{}'
        ) AS campaign_names,
        (
          SELECT MAX(cri.posted_at)
          FROM campaign_run_items cri
          WHERE cri.social_group_id = sgu.id AND cri.status = 'Sent'
        ) AS last_posted_at
      FROM social_group_urls sgu
      LEFT JOIN campaign_social_groups csg ON csg.social_group_id = sgu.id
      LEFT JOIN campaigns c ON c.id = csg.campaign_id
      WHERE (${includeInactive} = true OR sgu.is_active = true)
        AND (${term}::text IS NULL OR sgu.name ILIKE ${term} OR sgu.url ILIKE ${term})
        AND (${hasTagFilter} = false OR sgu.group_type && ${tagFilters}::text[])
      GROUP BY sgu.id
      ORDER BY sgu.created_time DESC NULLS LAST
      LIMIT ${pageSize} OFFSET ${offset}
    `;

    // 2. Tổng số dòng khớp filter hiện tại (KHÔNG join, để tránh nhân bản dòng do LEFT JOIN campaign) +
    //    tổng số dòng inactive toàn bảng (độc lập với filter, phục vụ nhãn "Show Inactive (N)")
    const [counts] = await sql`
      SELECT
        COUNT(*) FILTER (
          WHERE (${includeInactive} = true OR is_active = true)
            AND (${term}::text IS NULL OR name ILIKE ${term} OR url ILIKE ${term})
            AND (${hasTagFilter} = false OR group_type && ${tagFilters}::text[])
        ) AS matching_count,
        COUNT(*) FILTER (WHERE NOT is_active) AS inactive_total
      FROM social_group_urls
    `;

    return {
      success: true,
      data: groups,
      totalCount: Number(counts?.matching_count || 0),
      inactiveTotalCount: Number(counts?.inactive_total || 0),
    };
  } catch (error) {
    console.error('[getSocialGroupsLibrary] Error:', error);
    return { success: false, error: error.message };
  }
}
```

**Lưu ý cho AG:** cú pháp bind mảng `${tagFilters}::text[]` cho toán tử `&&` cần tự kiểm chứng chạy đúng với thư viện `postgres` (npm package `postgres`, không phải `pg`) đang dùng trong dự án — nếu cú pháp trên không nhận, tham khảo cách file này đã dùng `ANY(${array})` ở nhiều chỗ khác (ví dụ dòng ~530 `WHERE social_group_id = ANY(${targetGroups.map(g => g.id)})`) để tìm đúng cú pháp bind mảng tương thích.

### A.2 — Sửa `getSocialGroups()` (ô chọn Target Groups khi sửa campaign)

Vị trí hiện tại: dòng ~1294-1315.

```js
/**
 * Fetch paginated + searched ACTIVE social groups for the campaign Target Groups picker.
 * @param {Object} [filters]
 * @param {string} [filters.search='']
 * @param {string[]} [filters.tagFilters=[]]
 * @param {number} [filters.page=1]
 * @param {number} [filters.pageSize=50]
 * @returns {Promise<{success: boolean, data?: Array, totalCount?: number, error?: string}>}
 */
export async function getSocialGroups(filters = {}) {
  try {
    const { search = '', tagFilters = [], page = 1, pageSize = 50 } = filters;
    const term = search.trim() ? `%${search.trim()}%` : null;
    const hasTagFilter = Array.isArray(tagFilters) && tagFilters.length > 0;
    const offset = (Math.max(1, page) - 1) * pageSize;

    const groups = await sql`
      SELECT id, name, url, group_type, join_status, is_active, admin_questions, custom_join_answer
      FROM social_group_urls
      WHERE is_active = true
        AND (${term}::text IS NULL OR name ILIKE ${term} OR url ILIKE ${term})
        AND (${hasTagFilter} = false OR group_type && ${tagFilters}::text[])
      ORDER BY name ASC
      LIMIT ${pageSize} OFFSET ${offset}
    `;

    const [{ total }] = await sql`
      SELECT COUNT(*) AS total
      FROM social_group_urls
      WHERE is_active = true
        AND (${term}::text IS NULL OR name ILIKE ${term} OR url ILIKE ${term})
        AND (${hasTagFilter} = false OR group_type && ${tagFilters}::text[])
    `;

    return { success: true, data: groups, totalCount: Number(total || 0) };
  } catch (error) {
    console.error('[getSocialGroups] Error:', error);
    return { success: false, error: error.message };
  }
}
```

**Breaking change có chủ đích:** chữ ký cũ `getSocialGroups({ limit: 500 })` không còn hợp lệ (tham số `limit` đổi thành `pageSize`, mặc định 50). Grep toàn bộ codebase (`grep -rn "getSocialGroups(" src/`) để cập nhật MỌI nơi đang gọi hàm này, không chỉ `campaigns/page.js` — đã thấy tối thiểu 1 chỗ khác dùng cột tương tự trong `src/app/api/webhooks/warm-join-data/route.js` (khác hàm, nhưng kiểm tra chéo cho chắc không có chỗ nào khác gọi `getSocialGroups` với `{limit: 500}` bị bỏ sót).

### A.3 — Hàm mới `getSocialGroupIdsMatchingFilter()` — phục vụ "Select All (Filtered)" / "Deselect All (Filtered)"

```js
/**
 * Return ONLY the ids of active social groups matching search + tag filter — no pagination limit.
 * Used exclusively by the "Select All (Filtered)" / "Deselect All (Filtered)" actions in the
 * campaign Target Groups picker, so bulk-select stays correct across all pages, not just the
 * currently loaded page.
 * @param {Object} [filters]
 * @param {string} [filters.search='']
 * @param {string[]} [filters.tagFilters=[]]
 * @returns {Promise<{success: boolean, ids?: string[], error?: string}>}
 */
export async function getSocialGroupIdsMatchingFilter(filters = {}) {
  try {
    const { search = '', tagFilters = [] } = filters;
    const term = search.trim() ? `%${search.trim()}%` : null;
    const hasTagFilter = Array.isArray(tagFilters) && tagFilters.length > 0;

    const rows = await sql`
      SELECT id
      FROM social_group_urls
      WHERE is_active = true
        AND (${term}::text IS NULL OR name ILIKE ${term} OR url ILIKE ${term})
        AND (${hasTagFilter} = false OR group_type && ${tagFilters}::text[])
    `;

    return { success: true, ids: rows.map((r) => r.id) };
  } catch (error) {
    console.error('[getSocialGroupIdsMatchingFilter] Error:', error);
    return { success: false, error: error.message };
  }
}
```

Chỉ trả về mảng `id` (uuid) — kể cả khớp toàn bộ 1500+ dòng thì payload cũng chỉ vài chục KB, không cần LIMIT.

---

## PHẦN B — Frontend: `src/app/campaigns/page.js`

### B.1 — Tab "Social Group URLs" (Library) — vùng state dòng ~131-135 và loader dòng ~207-217

Thêm state phân trang + search debounce, theo đúng khuôn `src/app/search/page.js`:

```js
const [libraryPage, setLibraryPage] = useState(1);
const [libraryPageSize] = useState(50);
const [libraryTotalCount, setLibraryTotalCount] = useState(0);
const [libraryInactiveTotalCount, setLibraryInactiveTotalCount] = useState(0);
const libraryDebounceRef = useRef(null);
```

`loadSocialGroupsLibrary` đổi thành nhận `page`/`search`/`tagFilters` hiện tại, gọi action mới, set cả `socialGroupsLibrary`, `libraryTotalCount`, `libraryInactiveTotalCount`. Thêm 1 `useEffect` debounce y hệt cơ chế ở `search/page.js` (dòng ~115-123): mỗi khi `librarySearch`/`librarySelectedTagFilters` đổi → `setLibraryPage(1)` + đặt lại debounce timer ~300-400ms rồi mới gọi `loadSocialGroupsLibrary`. Khi `libraryPage` đổi (bấm Previous/Next) → gọi ngay, không debounce.

**Xoá bỏ** phần lọc client-side hiện có cho tab này nếu có (tab Library hiện đã không có `useMemo` filter riêng — filter đang nằm ở đâu thì AG tự xác nhận lại và gỡ, không để tồn tại 2 lớp lọc chồng nhau).

**Sửa nhãn "Show Inactive (N)"** (dòng ~1281, hiện đọc `socialGroupsLibrary.filter((g) => !g.is_active).length`) → đổi sang đọc `libraryInactiveTotalCount` (đã đúng tổng toàn bảng, không phụ thuộc trang/filter hiện tại).

**Thêm khối phân trang** (Previous/Next + "Page X of Y") dưới bảng, copy nguyên UI pattern từ `search/page.js` (dòng ~860-920), nối vào `libraryPage`/`libraryTotalCount`/`libraryPageSize`.

### B.2 — Ô chọn "Target Groups" trong Campaign Overview — vùng state dòng ~100-104, loader dòng ~227-243, filter dòng ~288-345

Thêm state tương tự:

```js
const [groupPage, setGroupPage] = useState(1);
const [groupPageSize] = useState(30); // hộp hiển thị cố định max-h-64, ít dòng hơn Library cho vừa mắt
const [groupTotalCount, setGroupTotalCount] = useState(0);
const groupDebounceRef = useRef(null);
```

`loadCampaignDetailData` (dòng ~227): đổi lời gọi `getSocialGroups({ limit: 500 })` thành `getSocialGroups({ search: groupSearchTerm, tagFilters: Array.from(selectedTagFilters), page: groupPage, pageSize: groupPageSize })`, set thêm `groupTotalCount` từ response. Thêm debounce y hệt B.1 cho `groupSearchTerm`/`selectedTagFilters` (reset `groupPage` về 1 khi đổi filter).

**Xoá bỏ hoàn toàn** `filteredSocialGroups` (`useMemo` dòng ~288-307) — `allSocialGroups` giờ đã LÀ đúng trang đang khớp filter (server trả về sẵn), không cần lọc lại lần 2 ở client. Mọi chỗ đang dùng `filteredSocialGroups` trong JSX (dòng ~947, ~993, ~1000) đổi thành dùng thẳng `allSocialGroups`.

**Đổi `handleSelectAllFiltered`/`handleDeselectAllFiltered`** (dòng ~320-345): gọi `getSocialGroupIdsMatchingFilter({ search: groupSearchTerm, tagFilters: Array.from(selectedTagFilters) })`, rồi union (Select All) hoặc subtract (Deselect All) toàn bộ `ids` trả về vào `targetGroupIds` — thay vì lặp qua `filteredSocialGroups` (chỉ có tối đa 1 trang) như hiện tại.

**Nhãn nút "Select All (N)"** (dòng ~944-951): đổi `filteredSocialGroups.length` thành `groupTotalCount` — vì `groupTotalCount` đã phản ánh đúng tổng số khớp filter hiện tại (lấy free từ response phân trang, không cần gọi thêm), trong khi trước đây con số này vô tình đã sai (chỉ đếm tối đa 500 dòng đã tải).

**Thêm khối phân trang nhỏ** dưới bảng target-groups (Previous/Next), copy cùng pattern B.1, gắn `groupPage`/`groupTotalCount`/`groupPageSize`. Nút **"Save (N)"** (dòng ~966, đọc `targetGroupIds.size`) giữ nguyên không đổi — nó vốn đã đúng vì độc lập với phân trang.

### B.3 — Việc tuỳ chọn (làm nếu còn thời gian, KHÔNG bắt buộc để PASS)

`loadCampaignDetailData` hiện tải danh sách group ngay khi chọn 1 campaign, kể cả khi user chưa mở tới phần "Target Groups Selector". Có thể trì hoãn gọi `getSocialGroups` tới khi user thực sự cuộn tới/mở khu vực đó — không bắt buộc, chỉ là tối ưu thêm, không ảnh hưởng tính đúng của spec này.

---

## PHẦN C — Test & Verify (AG tự làm trước khi báo cáo)

1. Tạo/seed tạm >50 social group test (hoặc dùng data sandbox hiện có nếu đã đủ) để tự thấy 2 chỗ phân trang thật sự hoạt động, không chỉ code chạy không lỗi.
2. Verify bug gốc đã hết: tạo 1 group tên bắt đầu bằng ký tự cuối bảng chữ cái (ví dụ "Zzz Test Group"), gán được vào 1 campaign dù DB có >500 group active — trước đây group này sẽ không hiện ra được.
3. Verify "Select All (Filtered)" chọn đúng TOÀN BỘ group khớp filter, không chỉ trang đang xem — test bằng cách filter ra >`groupPageSize` kết quả, bấm Select All, xác nhận `targetGroupIds.size` sau đó = đúng số khớp filter (đối chiếu trực tiếp bằng SQL `SELECT COUNT(*) FROM social_group_urls WHERE ...` qua Supabase).
4. Verify "Show Inactive (N)" ở tab Library hiển thị đúng tổng inactive toàn bảng, không đổi theo search/tag filter đang gõ.
5. Verify không có 2 lớp lọc chồng nhau còn sót (client-side filter cũ phải bị xoá hẳn, không chạy song song với filter server mới).
6. Cập nhật `docs/DEVELOPMENT_LOG.md` — **CẢ 2 phần**: bảng tổng hợp Snapshots đầu file VÀ mục chi tiết phía dưới (xem quy tắc đã ghi nhớ, tránh lặp lại lỗi lệch giữa 2 phần đã xảy ra đầu tháng 9).
7. Trong báo cáo hoàn thành gửi Claude, nêu rõ output `git log --oneline -1` + `git status` để Claude đối chiếu độc lập, đúng quy trình 2-agent hiện tại.
