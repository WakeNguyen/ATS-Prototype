# Fix Spec (PHẦN 5.9) — Mở rộng Search + Bỏ Cap Cứng cho 2 Group Picker còn sót trong Modal — 2026-09-04

**Từ:** Claude (Architect/QA)
**Cho:** AG (Implementer)
**Điều kiện tiên quyết:** Không phụ thuộc PHẦN nào khác, độc lập hoàn toàn với PHẦN 5.7/5.8 (đã PASS QA). **KHÔNG cần sửa gì ở backend/DB** — tái dùng nguyên vẹn `getSocialGroups(filters)` đã có sẵn từ PHẦN 5.7 (hỗ trợ `search`, `tagFilters`, `page`, `pageSize`, trả về `totalCount`).

**Bối cảnh:** Lúc QA PHẦN 5.7, Claude phát hiện sót 2 nơi khác cũng gọi `getSocialGroups()` với cap cứng, không có search — cùng bản chất bug với PHẦN 5.7 gốc, chỉ khác con số cap:
- `src/app/components/CampaignEditModal.js` (modal Sửa/Tạo Campaign) — `getSocialGroups({ pageSize: 400 })`, load 1 lần lúc mở modal, lọc lại bằng `Array.filter()` phía client theo `groupSearch`.
- `src/app/components/FbAccountEditModal.js` (modal Sửa/Tạo FB Account) — `getSocialGroups({ pageSize: 300 })`, cấu trúc y hệt.

Schema `public` hiện đã có **455 group active thật** — vượt quá CẢ 2 cap 400 và 300. Nghĩa là: (1) group nào xếp sau vị trí 400/300 theo `ORDER BY name ASC` **không thể được chọn mới**; (2) nghiêm trọng hơn — nếu 1 campaign/account **ĐÃ được gán** 1 group nằm ngoài cap đó từ trước (dữ liệu Notion cũ migrate qua PHẦN 2, hoặc gán qua nơi khác), group đó vẫn được chọn đúng trong `selectedGroupIds` (không mất dữ liệu khi Save vì `selectedGroupIds` là Set độc lập) nhưng **KHÔNG hiển thị trong danh sách** — user mở modal ra không thấy nó đâu để xem lại/bỏ chọn, dễ hiểu lầm là dữ liệu bị mất.

**Quyết định thiết kế:** đây là modal nhỏ (picker gọn, không phải bảng lớn) — KHÔNG áp full pattern "Page X of Y" như PHẦN 5.7, mà áp bản gọn hơn: search server-side debounce (bỏ cap cứng theo nghĩa "tìm là ra"), + đảm bảo group **đã được gán từ trước luôn hiển thị** trong danh sách bất kể có nằm trong batch tải mặc định hay không (tránh hiểu lầm mất dữ liệu).

---

## PHẦN H — `src/app/components/CampaignEditModal.js`

### H.1 — Thêm state debounce + tổng số (gần state hiện có dòng ~62-64)

```js
const [availableGroups, setAvailableGroups] = useState([]);
const [selectedGroupIds, setSelectedGroupIds] = useState(new Set());
const [groupSearch, setGroupSearch] = useState("");
const [groupTotalCount, setGroupTotalCount] = useState(0);
const groupDebounceRef = useRef(null);
const knownGroupsRef = useRef(new Map()); // id -> full group object, tích luỹ mọi group đã từng thấy (tải mặc định + search + đã gán sẵn)
```

(`useRef` đã có sẵn import từ `react` — nếu chưa, thêm vào dòng import đầu file.)

### H.2 — Sửa `loadInitialData` (dòng ~81-118): tải mặc định pageSize vừa phải + merge nhóm đã gán sẵn

Đổi lời gọi `getSocialGroups({ pageSize: 400 })` → `getSocialGroups({ pageSize: 100 })` (không cần cap cao vì đã có search + cơ chế merge bên dưới bù lại phần còn thiếu). Thêm helper merge dùng chung:

```js
// Union theo id: giữ object mới nhất nếu trùng, luôn giữ mọi id đã biết trước đó.
function mergeKnownGroups(newBatch) {
  (newBatch || []).forEach((g) => knownGroupsRef.current.set(g.id, g));
  return Array.from(knownGroupsRef.current.values());
}
```

Trong `loadInitialData`, sau khi có `groupsRes`:
```js
if (groupsRes?.success && groupsRes.data) {
  setAvailableGroups(mergeKnownGroups(groupsRes.data));
  setGroupTotalCount(groupsRes.totalCount || groupsRes.data.length);
}
```

Sau khi có `detailRes` (bước "2. If edit mode, load campaign detail", ngay sau `setSelectedGroupIds(targetIds)`), thêm merge để đảm bảo MỌI group đã gán sẵn cho campaign này luôn có mặt trong danh sách hiển thị dù có nằm trong 100 group tải mặc định hay không:

```js
const targetIds = new Set((c.targetGroups || []).map((g) => g.id));
setSelectedGroupIds(targetIds);
setAvailableGroups(mergeKnownGroups(c.targetGroups || [])); // đảm bảo nhóm đã gán sẵn luôn hiện, kể cả ngoài top 100
```

### H.3 — Thêm debounce search server-side (đặt gần khai báo `filteredGroups` cũ, dòng ~211)

**Xoá bỏ** `filteredGroups` client-side filter cũ (`availableGroups.filter(g => g.name...includes(groupSearch)...)`). Thay bằng `useEffect` debounce gọi lại `getSocialGroups`, MERGE kết quả mới vào `knownGroupsRef` (không thay thế toàn bộ — để nhóm đã gán sẵn / đã thấy trước đó không biến mất khỏi danh sách một cách khó hiểu):

```js
useEffect(() => {
  if (!isOpen) return;
  if (groupDebounceRef.current) clearTimeout(groupDebounceRef.current);
  groupDebounceRef.current = setTimeout(async () => {
    const res = await getSocialGroups({ search: groupSearch, pageSize: 100 });
    if (res?.success) {
      setAvailableGroups(mergeKnownGroups(res.data));
      setGroupTotalCount(res.totalCount || 0);
    }
  }, 300);
  return () => clearTimeout(groupDebounceRef.current);
}, [groupSearch, isOpen]);
```

Danh sách hiển thị trong JSX (chỗ đang dùng `filteredGroups.map(...)`, dòng ~420) đổi thành dùng thẳng `availableGroups` — KHÔNG lọc lại lần 2 phía client (server đã lọc đúng theo `search`, và `knownGroupsRef` đã đảm bảo nhóm đã chọn sẵn luôn có mặt).

**Lưu ý quan trọng:** vì không lọc lại bằng `groupSearch` phía client nữa, danh sách hiển thị lúc này = (kết quả search server mới nhất) ∪ (mọi nhóm đã từng biết trước đó, gồm nhóm đã gán sẵn cho campaign). Khi user gõ tìm 1 từ khoá không liên quan, nhóm đã chọn trước đó nhưng không khớp từ khoá **vẫn tiếp tục hiển thị** (không biến mất) — đây là hành vi CHỦ ĐÍCH mới, tốt hơn bản gốc (tránh hiểu lầm mất dữ liệu), không phải bug.

### H.4 — Thêm dòng chữ nhỏ hiển thị tổng số (dưới ô search, hoặc cạnh label "Target Social Groups")

```jsx
<span className="text-[10px] text-slate-500">
  Đang hiện {availableGroups.length} / tổng {groupTotalCount} nhóm khớp tìm kiếm — gõ để tìm thêm nếu không thấy nhóm cần chọn.
</span>
```

---

## PHẦN I — `src/app/components/FbAccountEditModal.js` (áp dụng ĐÚNG pattern H, đổi tên biến tương ứng)

Cấu trúc file này gần như giống hệt `CampaignEditModal.js` — áp dụng lại nguyên vẹn H.1 → H.4, chỉ đổi các định danh sau:

| Trong `CampaignEditModal.js` | Tương ứng trong `FbAccountEditModal.js` |
|---|---|
| `getSocialGroups({ pageSize: 400 })` (dòng ~85) | `getSocialGroups({ pageSize: 300 })` (dòng ~76) — đổi thành `pageSize: 100` như H.2 |
| `detailRes` từ `getCampaignDetail(campaignId)` | `detailRes` từ `getFbAccountDetail(accountId)` |
| `c.targetGroups` | `acc.joinedGroups` |
| `targetIds` | `joinedIds` |
| Label "Target Social Groups (N selected)" | Label "Joined Facebook Groups (N selected)" — giữ nguyên text, chỉ thêm dòng chữ tổng số như H.4 |

Toàn bộ phần debounce (H.3), `knownGroupsRef`/`mergeKnownGroups` (H.1/H.2), xoá `filteredGroups` client-filter cũ — làm y hệt.

---

## PHẦN J — Test & Verify (AG tự làm trước khi báo cáo)

1. Ở CẢ 2 modal: mở modal Sửa 1 campaign/account **đã có sẵn ≥1 group được gán mà group đó xếp SAU vị trí 100 theo alphabet** (tạo test data tạm nếu sandbox chưa đủ groups để mô phỏng) → xác nhận group đó **hiển thị đúng, đã tick sẵn** trong danh sách ngay khi mở modal (không cần gõ tìm).
2. Gõ search 1 từ khoá tìm ra 1 group nằm ngoài top 100 mặc định → group đó xuất hiện trong danh sách, tick chọn được, Save thành công → verify qua Supabase (`campaign_social_groups`/`fb_account... joined groups` bảng tương ứng) group đó đã được gán đúng.
3. Xoá search, xác nhận nhóm đã chọn từ bước 2 (dù không nằm trong batch mặc định) vẫn tiếp tục hiển thị + vẫn tick — không bị "biến mất" khỏi danh sách sau khi xoá ô tìm kiếm.
4. Không có nhóm nào bị double-render (trùng `key`) trong danh sách — kiểm tra console không có warning "duplicate key".
5. `npm run build` PASS, không lỗi ESLint biến chưa dùng (do xoá `filteredGroups` cũ).
6. Cập nhật `docs/DEVELOPMENT_LOG.md` — CẢ 2 phần (bảng tổng hợp + chi tiết).
7. Báo cáo hoàn thành kèm `git log --oneline -1` + `git status`.
