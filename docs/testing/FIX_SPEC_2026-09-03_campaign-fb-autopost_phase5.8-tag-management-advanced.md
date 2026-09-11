# Fix Spec (PHẦN 5.8) — Tag Management nâng cao: Rename + Bulk Remove + Ràng buộc đặt tên — 2026-09-03

**Từ:** Claude (Architect/QA)
**Cho:** AG (Implementer)
**Điều kiện tiên quyết:** Không phụ thuộc PHẦN 5.7 (Social Groups pagination), có thể làm song song — nhưng cả 2 spec cùng sửa `src/app/campaign_actions.js` và khu vực Social Groups trong `src/app/campaigns/page.js`, nên **nếu làm đồng thời, kéo/merge code cẩn thận để tránh conflict**, ưu tiên hoàn thành PHẦN 5.7 trước nếu chỉ làm được 1 việc 1 lúc (5.7 đang vá 1 bug thật, ưu tiên cao hơn).

**Bối cảnh:** Sau khi bàn xong PHẦN 5.7, User hỏi tiếp về quản lý tag: hiện KHÔNG có cách tháo 1 tag khỏi nhiều group cùng lúc (`updateSocialGroupTags` chỉ sửa 1 group/lần), và `deleteTagFromRegistry` (PHẦN 5.5) cố tình từ chối xoá nếu tag còn ≥1 group dùng, bắt user tháo tay từng group một. User muốn thêm: (1) tháo tag hàng loạt, (2) đổi tên tag kể cả khi đang gắn nhiều group. Bàn tiếp về rủi ro trùng tên khi đổi tên → chốt: **không phân biệt hoa/thường khi check trùng, nếu trùng thì CHẶN đổi tên (không tự gộp)**, và thêm yêu cầu mới: **chặn ký tự có dấu trong tên tag**.

Claude đã verify trực tiếp qua Supabase MCP (project `ATS 3.0`, 2026-09-03) trên CẢ 2 schema `sandbox` và `public`:
- Không có tag nào trùng nhau nếu bỏ qua hoa/thường (`GROUP BY lower(name) HAVING count(*) > 1` → rỗng cả 2 schema).
- Không có tag nào chứa dấu/ký tự ngoài `A-Za-z0-9 _-` (`WHERE name ~ '[^A-Za-z0-9 _-]'` → rỗng cả 2 schema).

→ Cả 2 migration bên dưới **an toàn để chạy ngay, không cần bước dọn dữ liệu cũ trước**.

---

## PHẦN D — Migration: ràng buộc mới trên `social_group_tags`

Chạy trên **cả 2 schema** `sandbox` và `public` (đúng quy ước dự án — 2 schema cùng cấu trúc):

```sql
-- D.1: Unique không phân biệt hoa/thường (giữ nguyên UNIQUE(name) cũ, KHÔNG xoá — chỉ thêm index mới)
CREATE UNIQUE INDEX social_group_tags_name_lower_key ON sandbox.social_group_tags (lower(name));
CREATE UNIQUE INDEX social_group_tags_name_lower_key ON public.social_group_tags (lower(name));

-- D.2: Chỉ cho phép chữ cái không dấu, số, khoảng trắng, gạch ngang/gạch dưới
ALTER TABLE sandbox.social_group_tags
  ADD CONSTRAINT social_group_tags_name_charset_check
  CHECK (name ~ '^[A-Za-z0-9 _-]+$');
ALTER TABLE public.social_group_tags
  ADD CONSTRAINT social_group_tags_name_charset_check
  CHECK (name ~ '^[A-Za-z0-9 _-]+$');
```

**Lưu ý AG:** giữ nguyên constraint `UNIQUE(name)` cũ (case-sensitive) — không cần xoá, không xung đột gì với index `lower(name)` mới, chỉ là lớp bảo vệ kép. Việc `ON CONFLICT` trong code (PHẦN E.1) phải trỏ đúng expression index mới (`ON CONFLICT ((lower(name)))`), không trỏ vào constraint cũ.

---

## PHẦN E — Backend: `src/app/campaign_actions.js`

### E.1 — Thêm helper validate + sửa `updateSocialGroupTags` để khớp charset/case-insensitive

```js
/**
 * Validate a tag name against the project's naming policy: no diacritics/special
 * characters, only [A-Za-z0-9 _-]. Applied uniformly to every tag string, whether
 * brand-new or already existing, so behavior stays consistent everywhere.
 * @param {string} name
 * @returns {boolean}
 */
function isValidTagName(name) {
  return /^[A-Za-z0-9 _-]+$/.test((name || '').trim());
}
```

Trong `updateSocialGroupTags(socialGroupId, tags)` (vị trí hiện tại ~1389-1416): SAU bước `cleanTags` (trim + dedupe), thêm validate TOÀN BỘ mảng trước khi ghi bất cứ gì — nếu có bất kỳ tag nào không hợp lệ, **từ chối toàn bộ update** (all-or-nothing, không âm thầm bỏ qua tag lỗi để tránh user tưởng đã lưu mà thực ra bị rớt 1 phần):

```js
const invalidTags = cleanTags.filter(t => !isValidTagName(t));
if (invalidTags.length > 0) {
  return {
    success: false,
    error: `Tên tag không hợp lệ: ${invalidTags.join(', ')}. Chỉ chấp nhận chữ không dấu, số, khoảng trắng, "-", "_".`
  };
}
```

Đổi câu INSERT registry từ `ON CONFLICT (name) DO NOTHING` → `ON CONFLICT ((lower(name))) DO NOTHING` (khớp đúng expression index D.1, để tạo tag mới qua đường gắn tag cho 1 group cũng tự động không phân biệt hoa/thường, nhất quán với rename ở E.2).

### E.2 — Hàm mới `renameTagInRegistry(oldName, newName)`

```js
/**
 * Rename a tag across the registry AND every group currently carrying it, atomically.
 * Refuses (does not merge) if the new name already exists (case-insensitive) or
 * violates the naming charset policy.
 * @param {string} oldName
 * @param {string} newName
 * @returns {Promise<{success: boolean, affectedGroups?: number, error?: string}>}
 */
export async function renameTagInRegistry(oldName, newName) {
  try {
    const cleanOld = (oldName || '').trim();
    const cleanNew = (newName || '').trim();

    if (!cleanOld || !cleanNew) {
      return { success: false, error: 'Tên tag không được để trống.' };
    }
    if (!isValidTagName(cleanNew)) {
      return { success: false, error: `Tên tag không hợp lệ: "${cleanNew}". Chỉ chấp nhận chữ không dấu, số, khoảng trắng, "-", "_".` };
    }
    if (cleanOld.toLowerCase() === cleanNew.toLowerCase()) {
      return { success: false, error: 'Tên mới trùng với tên cũ (không phân biệt hoa/thường).' };
    }

    let affectedGroups = 0;
    await sql.begin(async (tx) => {
      await tx`UPDATE social_group_tags SET name = ${cleanNew} WHERE name = ${cleanOld}`;
      const updated = await tx`
        UPDATE social_group_urls
        SET group_type = array_replace(group_type, ${cleanOld}, ${cleanNew})
        WHERE ${cleanOld} = ANY(group_type)
        RETURNING id
      `;
      affectedGroups = updated.length;
    });

    revalidatePath('/campaigns');
    return { success: true, affectedGroups };
  } catch (error) {
    // 23505 = unique_violation -- catches the lower(name) index from PHẦN D.1,
    // meaning newName already exists as another tag (case-insensitive collision).
    if (error.code === '23505') {
      return { success: false, error: `Tag "${newName}" đã tồn tại (không phân biệt hoa/thường) — không thể đổi tên trùng. Hãy chọn tên khác.` };
    }
    console.error('[renameTagInRegistry] Error:', error);
    return { success: false, error: error.message };
  }
}
```

**Quan trọng:** đây là **CHẶN, không phải GỘP** — nếu trùng tên (bắt bằng lỗi `23505` từ chính DB constraint, không chỉ dựa vào 1 câu SELECT check trước vì có thể có race condition), trả lỗi rõ ràng, KHÔNG tự động merge 2 tag làm 1 dưới bất kỳ hình thức nào. Đây là quyết định User đã chốt rõ, không tự ý làm khác.

### E.3 — Hàm mới `bulkRemoveTagFromGroups(tagName)`

```js
/**
 * Detach a tag from every social group currently carrying it — does NOT delete
 * the tag from the registry (that remains a separate, deliberate action via
 * deleteTagFromRegistry, called afterward if desired).
 * @param {string} tagName
 * @returns {Promise<{success: boolean, removedCount?: number, error?: string}>}
 */
export async function bulkRemoveTagFromGroups(tagName) {
  try {
    const clean = (tagName || '').trim();
    if (!clean) {
      return { success: false, error: 'Tag name is required' };
    }

    const removed = await sql`
      UPDATE social_group_urls
      SET group_type = array_remove(group_type, ${clean})
      WHERE ${clean} = ANY(group_type)
      RETURNING id
    `;

    revalidatePath('/campaigns');
    return { success: true, removedCount: removed.length };
  } catch (error) {
    console.error('[bulkRemoveTagFromGroups] Error:', error);
    return { success: false, error: error.message };
  }
}
```

Không cần sửa gì `deleteTagFromRegistry` hiện có (giữ nguyên logic atomic `DELETE ... WHERE NOT EXISTS` đã PASS QA ở PHẦN 5.5) — sau khi `bulkRemoveTagFromGroups` chạy xong (0 group còn dùng), gọi `deleteTagFromRegistry` lại sẽ tự thành công vì điều kiện `NOT EXISTS` đã thoả. UI ghép 2 lời gọi này thành 1 luồng liền mạch cho user (xem PHẦN F.2).

---

## PHẦN F — Frontend: `src/app/components/GroupTypeTagEditor.js` (mode `"filter"`)

### F.1 — Thêm nút Rename cạnh nút Delete hiện có

Vị trí: khu vực render mỗi tag pill trong mode `"filter"` (dòng ~186-213), nơi nút Delete (`allowDelete`/`handleDeleteTag`) đang nằm. Thêm 1 nút Edit2 icon (đã import sẵn `Edit2` từ `lucide-react`, hiện chỉ dùng ở mode badge — tái dùng icon này cho nhất quán) mở 1 popover/inline input nhỏ để nhập tên mới, gọi `renameTagInRegistry(tagName, newValue)` khi submit. Hiển thị lỗi trả về (`res.error`) ngay tại popover, theo đúng pattern `errorMsg` đã có ở mode badge — không dùng `alert()`/`window.confirm()` cho lỗi validate (chỉ dùng `window.confirm()` cho xác nhận hành động phá huỷ, giống `handleDeleteTag` đang làm).

Sau khi rename thành công, gọi lại `onTagsUpdated`/refresh tương đương `handleTagDeleted` đang làm ở component cha (`campaigns/page.js`) để cập nhật `allTagOptions` và các group đang hiển thị tag đó — AG tự thêm callback `onTagRenamed` theo đúng khuôn `onTagDeleted` đã có (props, gọi từ `campaigns/page.js`).

### F.2 — Sửa luồng khi Delete bị chặn vì còn group đang dùng

Hiện `handleDeleteTag` khi thất bại chỉ `alert(res.error)` rồi dừng. Đổi thành: parse trong `res.error` (hoặc đổi `deleteTagFromRegistry` trả thêm field `inUseCount` số group đang dùng thay vì chỉ nhét vào message — **AG nên sửa `deleteTagFromRegistry` trả thêm `{ success:false, inUseCount: N, error }`** để FE không phải parse chuỗi lỗi bằng regex, an toàn hơn) → nếu `inUseCount > 0`, hiện `window.confirm()` mới: `"Tag đang dùng ở N nhóm. Tháo khỏi tất cả N nhóm rồi xoá luôn?"` → nếu đồng ý: gọi `bulkRemoveTagFromGroups(tagName)` → sau đó gọi lại `deleteTagFromRegistry(tagName)` (giờ chắc chắn thành công vì 0 group còn dùng) → refresh UI.

---

## PHẦN G — Test & Verify (AG tự làm trước khi báo cáo)

1. Tạo 2 tag test khác nhau hoàn toàn (ví dụ "Test A", "Test B"), thử đổi tên "Test A" thành "test b" (chỉ khác hoa/thường so với "Test B") → phải bị CHẶN với lỗi rõ ràng, KHÔNG được tự gộp — verify bằng SQL trực tiếp sau đó: `social_group_tags` vẫn còn đủ 2 dòng riêng biệt, không có dòng nào mất.
2. Thử tạo tag mới hoặc đổi tên thành có dấu tiếng Việt (ví dụ "Bán hàng") → phải bị chặn validate, cả ở đường tạo tag qua popover gắn tag 1 group LẪN đường rename.
3. Đổi tên 1 tag đang gắn ở ≥3 group sang tên hợp lệ, chưa tồn tại → verify SAU khi đổi: registry chỉ còn tên mới, VÀ cả 3 group đó trong `group_type` đã đổi đúng sang tên mới (không group nào bị sót tên cũ hoặc mất tag).
4. Test bulk remove: 1 tag đang gắn ở N group, bấm Delete → xác nhận flow tháo khỏi N group rồi xoá tag → verify registry đã hết tag đó VÀ toàn bộ N group đã mất đúng tag đó khỏi `group_type` (không ảnh hưởng các tag khác của cùng group đó).
5. Verify 2 migration D.1/D.2 áp đúng cả `sandbox` lẫn `public` (không chỉ 1 schema).
6. Cập nhật `docs/DEVELOPMENT_LOG.md` — CẢ 2 phần (bảng tổng hợp + chi tiết).
7. Báo cáo hoàn thành kèm `git log --oneline -1` + `git status`.
