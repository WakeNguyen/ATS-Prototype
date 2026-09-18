# FIX SPEC — PHẦN 5.5: Thêm Chức Năng "Delete Tag" Khỏi Registry (Chỉ Khi Không Còn Group Nào Dùng)

**Từ:** Claude (Architect/QA)
**Gửi:** Antigravity (Implementer)
**Ngày:** 2026-09-02
**Bối cảnh:** PHẦN 5.4 cố tình để ngoài phạm vi việc "Delete Tag" (xoá hẳn 1 tag khỏi `social_group_tags`, khác với "remove tag khỏi 1 group") vì đây là hành động phá huỷ, cần cân nhắc kỹ theo mục 9 Phần C GEMINI.md (cấm xoá/sửa dữ liệu hàng loạt không kiểm soát). User yêu cầu bổ sung UI để xoá tag. Claude đã trình bày 2 phương án cho User:
- (A) Chỉ cho xoá khi tag KHÔNG còn gắn ở group nào — an toàn tuyệt đối, chỉ DELETE 1 dòng, không đụng bảng khác.
- (B) Cho xoá kể cả khi đang dùng ở nhiều group, hệ thống tự gỡ tag khỏi tất cả group liên quan trước — tiện hơn nhưng là UPDATE nhiều dòng cùng lúc.

**User đã chọn phương án (A).** Spec này CHỈ triển khai đúng phương án (A).

---

## 0. Phạm vi (CHỈ sửa đúng phần này)

✅ Trong phạm vi:
1. `src/app/campaign_actions.js`: thêm server action mới `deleteTagFromRegistry(tagName)`.
2. `src/app/components/GroupTypeTagEditor.js`: mở rộng **mode="filter"** với 2 prop mới tuỳ chọn `allowDelete` (boolean, mặc định `false`) và `onTagDeleted` (callback `(tagName) => void`, gọi khi xoá thành công) — khi `allowDelete=true`, mỗi tag pill (trừ pill "All") có thêm icon nhỏ để xoá tag đó khỏi registry.
3. `src/app/campaigns/page.js`: CHỈ bật `allowDelete={true}` cho thanh filter tag ở sub-tab **"Social Group URLs"** (Library, dòng ~1240 hiện tại) — đây là nơi tự nhiên để quản lý tag ở tầm hệ thống. **KHÔNG bật** ở thanh filter tag trong Target Groups picker (dòng ~906, dùng lúc chọn nhóm cho campaign) — giữ màn hình đó tập trung vào chọn nhóm, tránh xoá nhầm khi đang thao tác việc khác.

❌ NGOÀI phạm vi:
- KHÔNG triển khai phương án (B) (auto-gỡ tag khỏi nhiều group rồi xoá) — User đã chọn (A), không cần code dự phòng cho (B).
- KHÔNG thêm usage-count hiển thị sẵn trên từng pill (ví dụ "Tag X (12 groups)") để làm mờ/disable nút xoá trước — quá phức tạp so với nhu cầu thật. Thay vào đó: BẤT KỲ tag nào cũng có nút xoá hiển thị, server tự chặn và trả lỗi rõ ràng (kèm số lượng group đang dùng) nếu chưa đủ điều kiện xoá — đúng tinh thần "function-first, đơn giản" ở mục 1.4 GEMINI.md.
- KHÔNG đổi `mode="badge"` của `GroupTypeTagEditor.js` (popover sửa tag trên từng group) — giữ nguyên 100%.
- KHÔNG đổi schema DB (không cần migration mới, bảng `social_group_tags` đã có từ PHẦN 5.4).

Nếu thấy cần sửa gì khác ngoài 3 file trên, dừng lại hỏi Claude trước, theo mục 10 GEMINI.md.

---

## 1. Server Action — `campaign_actions.js`

### 1.1. Hàm mới `deleteTagFromRegistry(tagName)`

Đặt ngay sau hàm `getAllTagOptions()` hiện có. Dùng 1 câu `DELETE ... WHERE NOT EXISTS (...)` để việc "kiểm tra còn dùng hay không" và "xoá" diễn ra ATOMIC trong cùng 1 câu lệnh — tránh race condition (ví dụ: giữa lúc kiểm tra và lúc xoá, 1 request khác vừa gắn tag này vào 1 group khác).

```js
/**
 * Delete a tag from the persistent registry — ONLY when it is not currently
 * attached to any social group. This is a deliberate, irreversible action
 * (different from removing a tag off a single group). Uses an atomic
 * DELETE ... WHERE NOT EXISTS so the "still in use?" check and the delete
 * happen in a single statement (no race window).
 * @param {string} tagName
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function deleteTagFromRegistry(tagName) {
  try {
    const clean = (tagName || '').trim();
    if (!clean) {
      return { success: false, error: 'Tag name is required' };
    }

    const deleted = await sql`
      DELETE FROM social_group_tags
      WHERE name = ${clean}
        AND NOT EXISTS (
          SELECT 1 FROM social_group_urls WHERE ${clean} = ANY(group_type)
        )
      RETURNING id
    `;

    if (deleted.length > 0) {
      revalidatePath('/campaigns');
      return { success: true };
    }

    // Not deleted -- figure out why, to return an accurate message.
    const [existsRow] = await sql`SELECT 1 FROM social_group_tags WHERE name = ${clean}`;
    if (!existsRow) {
      return { success: false, error: `Tag "${clean}" không tồn tại trong registry.` };
    }

    const [{ count }] = await sql`
      SELECT COUNT(*)::int as count FROM social_group_urls WHERE ${clean} = ANY(group_type)
    `;
    return {
      success: false,
      error: `Không thể xoá — tag "${clean}" vẫn đang được gắn ở ${count} nhóm. Hãy gỡ tag khỏi tất cả nhóm đó trước (qua popover "Edit Group Tags" của từng nhóm), rồi thử lại.`
    };
  } catch (error) {
    console.error('[deleteTagFromRegistry] Error:', error);
    return { success: false, error: error.message };
  }
}
```

---

## 2. UI — `GroupTypeTagEditor.js` (mode="filter")

### 2.1. Thêm 2 prop mới vào chữ ký hàm component
```js
export default function GroupTypeTagEditor({
  mode = "badge",
  tags = [],
  socialGroupId = null,
  allKnownTags = [],
  onTagsUpdated = null,
  selectedTags = new Set(),
  onToggleTag = null,
  onClearAll = null,
  // NEW (PHẦN 5.5) — filter mode only:
  allowDelete = false,
  onTagDeleted = null
}) {
```

### 2.2. Import thêm action mới
```js
import { updateSocialGroupTags, deleteTagFromRegistry } from "../campaign_actions";
```

### 2.3. State cho trạng thái đang xoá (tránh double-click / disable đúng pill đang xử lý)
```js
const [deletingTag, setDeletingTag] = useState(null); // tagName đang xoá, hoặc null
```

### 2.4. Handler xoá tag
```js
const handleDeleteTag = async (e, tagName) => {
  e.stopPropagation();
  if (deletingTag) return; // đang xử lý 1 tag khác, chặn double-click

  const confirmed = window.confirm(
    `Xoá vĩnh viễn tag "${tagName}" khỏi hệ thống?\n\n` +
    `Hành động này chỉ thực hiện được khi KHÔNG còn nhóm nào đang dùng tag này. ` +
    `Nếu vẫn còn nhóm dùng, thao tác sẽ bị từ chối và không có gì thay đổi.`
  );
  if (!confirmed) return;

  setDeletingTag(tagName);
  try {
    const res = await deleteTagFromRegistry(tagName);
    if (res.success) {
      if (onTagDeleted) onTagDeleted(tagName);
    } else {
      alert(res.error || "Không thể xoá tag.");
    }
  } catch (err) {
    alert(err.message || "Không thể xoá tag.");
  } finally {
    setDeletingTag(null);
  }
};
```

### 2.5. Render nút xoá trên mỗi pill (mode="filter", KHÔNG áp dụng cho pill "All")
Sửa khối render pill hiện tại (bên trong `{allKnownTags.map((tagName) => { ... })}`) — thêm icon xoá ngay sau `<span>{tagName}</span>`, chỉ hiện khi `allowDelete === true`:

```jsx
{allKnownTags.map((tagName) => {
  const isSelected = selectedTags.has(tagName);
  const palette = getTagColor(tagName);
  const isDeleting = deletingTag === tagName;

  return (
    <span
      key={tagName}
      className={`inline-flex items-center gap-1 rounded-full text-[11px] font-medium border transition-all ${
        isSelected
          ? `${palette.activeBg} shadow-xs font-bold`
          : `${palette.bg} ${palette.text} ${palette.border} opacity-70 hover:opacity-100 hover:border-slate-600`
      } ${allowDelete ? 'pl-2.5 pr-1 py-0.5' : 'px-2.5 py-0.5'}`}
    >
      <button
        type="button"
        onClick={() => onToggleTag && onToggleTag(tagName)}
        className="cursor-pointer flex items-center gap-1"
      >
        <span>{tagName}</span>
        {isSelected && <Check size={10} className="stroke-[3]" />}
      </button>
      {allowDelete && (
        <button
          type="button"
          onClick={(e) => handleDeleteTag(e, tagName)}
          disabled={isDeleting}
          title={`Delete tag "${tagName}" (chỉ xoá được nếu không còn nhóm nào dùng)`}
          className="p-0.5 rounded-full hover:bg-rose-500/20 hover:text-rose-400 disabled:opacity-40 transition-colors"
        >
          {isDeleting ? <Loader2 size={9} className="animate-spin" /> : <X size={9} />}
        </button>
      )}
    </span>
  );
})}
```

**Lưu ý kỹ thuật quan trọng:** pill hiện tại là 1 `<button>` bọc ngoài cùng (`onClick={() => onToggleTag(...)}`). Vì giờ cần 2 vùng bấm độc lập (toggle filter vs xoá tag) trong cùng 1 pill, PHẢI đổi phần tử ngoài cùng từ `<button>` thành `<span>` rồi đặt 2 `<button>` con riêng biệt bên trong như code mẫu trên — không được lồng `<button>` trong `<button>` (invalid HTML, React sẽ warning và hành vi click có thể sai).

---

## 3. UI — `campaigns/page.js`

### 3.1. Chỉ bật `allowDelete` ở thanh filter Library (dòng ~1240 hiện tại)
```jsx
<GroupTypeTagEditor
  mode="filter"
  allKnownTags={allTagOptions}
  selectedTags={librarySelectedTagFilters}
  onToggleTag={toggleLibraryTagFilter}
  onClearAll={clearAllLibraryTagFilters}
  allowDelete={true}
  onTagDeleted={handleTagDeleted}
/>
```

Thanh filter ở Target Groups picker (dòng ~906) **giữ nguyên, KHÔNG thêm 2 prop mới** (mặc định `allowDelete=false` nên không cần sửa gì thêm ở đó).

### 3.2. Handler `handleTagDeleted` mới (đặt gần các handler tag khác, ví dụ gần `toggleLibraryTagFilter`)
```js
const handleTagDeleted = (tagName) => {
  setAllTagOptions((prev) => prev.filter((t) => t !== tagName));
  // Dọn luôn nếu tag vừa xoá đang được chọn làm filter (tránh filter "ma" trỏ tới tag không còn tồn tại)
  setLibrarySelectedTagFilters((prev) => {
    if (!prev.has(tagName)) return prev;
    const next = new Set(prev);
    next.delete(tagName);
    return next;
  });
  setSelectedTagFilters((prev) => {
    if (!prev.has(tagName)) return prev;
    const next = new Set(prev);
    next.delete(tagName);
    return next;
  });
};
```
(Tên state `selectedTagFilters`/`setSelectedTagFilters` và `librarySelectedTagFilters`/`setLibrarySelectedTagFilters` — dùng ĐÚNG tên state đã có sẵn trong file, kiểm tra lại tên biến thật trước khi paste nếu khác với đoạn trên.)

---

## 4. Yêu cầu QA/test trước khi báo PASS

1. Test cô lập trên schema sandbox (theo mục 10.8 GEMINI.md — tự tạo tag test, KHÔNG dùng tag đang thật sự gắn ở group thật):
   - Tạo 1 tag mới trên 1 group test → thử xoá ngay (còn đang gắn) → xác nhận bị từ chối, message hiển thị đúng số lượng nhóm, KHÔNG có gì bị xoá (kiểm tra lại `social_group_tags` vẫn còn dòng đó).
   - Gỡ tag khỏi group test đó (dùng UI "Edit Group Tags" có sẵn) → thử xoá lại → xác nhận xoá thành công, tag biến mất khỏi filter bar Library NGAY LẬP TỨC (không cần reload trang), và biến mất luôn khỏi autocomplete suggestion ở mode="badge" (vì đọc chung `allTagOptions`/`getAllTagOptions()`).
   - Xác nhận thanh filter ở Target Groups picker (Campaign detail) KHÔNG có nút xoá trên tag pill nào.
2. Test race condition (mô phỏng, không cần chạy đồng thời thật — đọc kỹ code để xác nhận logic `DELETE ... WHERE NOT EXISTS` đúng atomic, không có khoảng hở giữa check và xoá).
3. `npm run build` PASS, không lỗi lint, không warning "button trong button" trong console khi test UI thật.
4. Cập nhật `docs/DEVELOPMENT_LOG.md`: **BẮT BUỘC cập nhật CẢ 2 phần** — bảng tổng hợp đầu file VÀ chi tiết từng snapshot phía dưới (theo đúng quy tắc đã nhắc nhiều lần, tránh lặp lại lỗi bỏ sót bảng tổng hợp trước đây).

Nếu có bất kỳ điểm nào trong spec này không rõ hoặc phát sinh xung đột với code thực tế (ví dụ tên state khác với dự đoán ở mục 3.2), dừng lại hỏi Claude trước khi tự quyết, theo mục 10 GEMINI.md.
