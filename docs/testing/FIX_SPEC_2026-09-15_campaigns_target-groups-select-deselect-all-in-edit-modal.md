**Từ:** Claude (Architect/QA)

# FIX_SPEC_2026-09-15 — Thêm "Select All / Deselect All" cho Target Social Groups trong Campaign Edit Modal

## Bối cảnh

PO yêu cầu: thêm cơ chế bỏ chọn (và nên có cả chọn) tất cả các group trong campaign. Rà soát toàn bộ 3 nơi trong dự án có multi-select group cho campaign:

1. `src/app/campaigns/page.js` — tab "Overview & Groups" của Campaign Details (quản lý `targetGroupIds`) — **ĐÃ CÓ** `handleSelectAllFiltered`/`handleDeselectAllFiltered` (dòng 736-776), hoạt động qua server action `getSocialGroupIdsMatchingFilter`, áp dụng đúng theo search/tag filter hiện tại, trên TOÀN BỘ trang (không chỉ trang đang hiển thị).
2. `src/app/components/CampaignDispatchPreviewModal.js` — modal xem trước khi Run — **ĐÃ CÓ** nút toggle "Select All"/"Deselect All" (dòng 94-101, 255-261).
3. `src/app/components/CampaignEditModal.js` — modal Tạo/Sửa Campaign, mục "Target Social Groups" (dòng 900-953) — **THIẾU HOÀN TOÀN**, chỉ có click từng dòng qua `toggleGroup` (dòng 299-306).

→ Đây chính là chỗ trống cần vá, đúng tinh thần GEMINI.md Phần B mục 1.4 (tái dùng pattern có sẵn, không tự chế mới) — copy lại đúng cách làm ở mục 1 (`campaigns/page.js`), vì đây là 2 nơi có cùng đặc điểm: danh sách group được search/phân trang (`"Showing {availableGroups.length} of {groupTotalCount} matching groups"`), nên "Select All"/"Deselect All" phải áp dụng theo TOÀN BỘ kết quả khớp search (không chỉ nhóm đang hiển thị trên màn hình) — nếu chỉ chọn/bỏ chọn phần visible sẽ gây hiểu nhầm khi search trả về nhiều hơn số đang load.

## Phạm vi (1 file)

`src/app/components/CampaignEditModal.js`

## Việc cần làm

### 1. Thêm import (dòng 20-28, khối import từ `../campaign_actions`)

Thêm `getSocialGroupIdsMatchingFilter` vào danh sách đang import (đã export sẵn ở `campaign_actions.js` dòng 2273 — không cần sửa file đó):
```js
import { 
  createCampaign, 
  updateCampaign, 
  getCampaignDetail, 
  setCampaignTargetGroups,
  setCampaignAssignedAccounts,
  getSocialGroups,
  getSocialGroupIdsMatchingFilter,
  getFbAccounts
} from "../campaign_actions";
```

### 2. Thêm 2 hàm xử lý (đặt ngay sau `toggleGroup`, dòng ~306)

Copy đúng logic từ `campaigns/page.js` dòng 736-776 (bỏ phần `tagFilters` vì modal này không có bộ lọc tag, chỉ có `groupSearch`):
```js
const handleSelectAllFilteredGroups = async () => {
  try {
    const res = await getSocialGroupIdsMatchingFilter({ search: groupSearch });
    if (res.success && res.ids) {
      setSelectedGroupIds((prev) => {
        const next = new Set(prev);
        for (const id of res.ids) next.add(id);
        return next;
      });
    }
  } catch (err) {
    console.error("Failed to select all filtered groups:", err);
  }
};

const handleDeselectAllFilteredGroups = async () => {
  try {
    const res = await getSocialGroupIdsMatchingFilter({ search: groupSearch });
    if (res.success && res.ids) {
      setSelectedGroupIds((prev) => {
        const next = new Set(prev);
        for (const id of res.ids) next.delete(id);
        return next;
      });
    }
  } catch (err) {
    console.error("Failed to deselect all filtered groups:", err);
  }
};
```

### 3. Thêm 2 nút vào UI (dòng 900-918, khu vực header "Target Social Groups")

Hiện tại:
```jsx
<div className="flex flex-col gap-1">
  <div className="flex items-center justify-between">
    <label className="text-[11px] font-semibold text-slate-300">
      Target Social Groups ({selectedGroupIds.size} selected)
    </label>
    <input
      type="text"
      value={groupSearch}
      onChange={(e) => setGroupSearch(e.target.value)}
      placeholder="Search groups..."
      className="px-2.5 py-1 rounded bg-slate-950 border border-slate-800 text-slate-200 text-[11px] w-48 focus:outline-none focus:border-emerald-500"
    />
  </div>
  <span className="text-[10px] text-slate-500">
    Showing {availableGroups.length} of {groupTotalCount} matching groups — type to search for more.
  </span>
</div>
```
Đổi thành (thêm 2 nút giữa label và ô search, dùng đúng style đã có ở `campaigns/page.js` dòng 1640-1661):
```jsx
<div className="flex flex-col gap-1">
  <div className="flex items-center justify-between gap-2">
    <label className="text-[11px] font-semibold text-slate-300 shrink-0">
      Target Social Groups ({selectedGroupIds.size} selected)
    </label>
    <div className="flex items-center gap-1.5 shrink-0">
      <button
        type="button"
        onClick={handleSelectAllFilteredGroups}
        className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-[10px] font-semibold transition-colors cursor-pointer"
        title="Select all groups matching current search"
      >
        Select All ({groupTotalCount})
      </button>
      <button
        type="button"
        onClick={handleDeselectAllFilteredGroups}
        className="px-2 py-0.5 rounded bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-slate-200 text-[10px] border border-slate-800 transition-colors cursor-pointer"
        title="Deselect all groups matching current search"
      >
        Deselect All
      </button>
    </div>
    <input
      type="text"
      value={groupSearch}
      onChange={(e) => setGroupSearch(e.target.value)}
      placeholder="Search groups..."
      className="px-2.5 py-1 rounded bg-slate-950 border border-slate-800 text-slate-200 text-[11px] w-40 focus:outline-none focus:border-emerald-500 shrink-0"
    />
  </div>
  <span className="text-[10px] text-slate-500">
    Showing {availableGroups.length} of {groupTotalCount} matching groups — type to search for more.
  </span>
</div>
```
(Thu nhỏ ô search từ `w-48` xuống `w-40` để vẫn vừa 1 hàng khi thêm 2 nút — AG được quyền tinh chỉnh spacing/wrap nếu test thật cho thấy bị chật, miễn giữ đúng 3 thành phần: label, 2 nút, ô search trên cùng 1 hàng ở màn hình chuẩn, cho phép wrap xuống dòng ở màn hình hẹp nếu cần.)

## Việc KHÔNG được làm

- Không sửa `getSocialGroupIdsMatchingFilter` hay bất kỳ hàm nào trong `campaign_actions.js` — hàm đã đúng, tái dùng nguyên trạng.
- Không đụng `campaigns/page.js` hay `CampaignDispatchPreviewModal.js` — 2 nơi đó đã có sẵn tính năng này, không cần sửa.
- Không đổi hành vi `toggleGroup` (chọn/bỏ từng dòng) hiện có.

## Verify bắt buộc

1. `node --check src/app/components/CampaignEditModal.js` → PASS.
2. `git diff --stat` → chỉ file trên (+ doc).
3. Test thật qua `npm run dev`, mở "New Campaign" hoặc "Edit" 1 campaign có sẵn:
   - Gõ vào ô search groups (ví dụ tìm 1 từ khớp nhiều group hơn số đang hiển thị) → bấm "Select All (N)" → xác nhận TOÀN BỘ N group khớp search được chọn (không chỉ nhóm đang hiển thị), số "(N selected)" ở label cập nhật đúng.
   - Bấm "Deselect All" → xác nhận toàn bộ group khớp search hiện tại bị bỏ chọn, group KHÔNG khớp search hiện tại (đã chọn từ trước, đang bị ẩn do search) vẫn giữ nguyên trạng thái chọn (không bị ảnh hưởng ngoài phạm vi search).
   - Xóa search, thử lại "Select All"/"Deselect All" khi không có search term (áp dụng cho toàn bộ group trong hệ thống) → hoạt động đúng.
   - Lưu campaign (Create hoặc Save) → xác nhận `targetGroupIds` lưu đúng số lượng đã chọn.
4. `npm run build` → PASS 100% routes.

## Yêu cầu tài liệu

Thêm mục mới vào `docs/DEVELOPMENT_LOG.md` theo template mục 10.3 GEMINI.md.

Báo cáo hoàn thành kèm `git status`, `git diff --stat`, `npm run build`.

## Quy ước xử lý khi phát hiện lệch spec hoặc không rõ ràng

- Lệch nhỏ (UI/trình bày) → tự sửa, ghi chú, KHÔNG dừng.
- Đụng database/API/quyết định sản phẩm ngoài phạm vi → DỪNG NGAY, in `ESCALATE: <mô tả>`.
- Chỉ cần hỏi 1 chi tiết kỹ thuật nhỏ → in `QUESTION: <câu hỏi>` rồi dừng.
