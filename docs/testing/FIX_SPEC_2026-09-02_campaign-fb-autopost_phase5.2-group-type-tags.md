# FIX SPEC — PHẦN 5.2: Group Type Đa Tag (Multi-Tag) — Filter, Bulk-Add Vào Campaign, Tự Quản Lý Tag

**Từ:** Claude (Architect/QA)
**Gửi:** Antigravity (Implementer)
**Ngày:** 2026-09-02
**Bối cảnh:** User bổ sung yêu cầu mới, tham chiếu hành vi cột `Group Type` (multi-select) trong bản ATS Notion cũ: filter theo 1 hoặc nhiều tag `Group Type` cùng lúc, sau đó "Select All" trên kết quả đã lọc để thêm nhanh vào campaign — thay vì tick từng nhóm một. User cũng muốn tự thêm/bớt các giá trị tag này (ví dụ thêm tag mới "Tech", "IT"...) mà KHÔNG cần nhờ Claude/AG chỉnh code mỗi lần.

**Khảo sát đã xác nhận (Claude tự kiểm tra trực tiếp qua Supabase, AG không cần điều tra lại):**
- Cột `social_group_urls.group_type` **đã là kiểu `text[]`** (mảng chuỗi) sẵn trên cả 2 schema `sandbox` và `public` — **KHÔNG cần migration DB nào cho spec này**, cơ chế đa tag đã sẵn có ở tầng dữ liệu.
- Dữ liệu thật (`public`) hiện có các tag: `Nontech` (275), `Nurse` (98), `Video Editor` (68), `Cosmetic` (58), `Marketing` (51) — người dùng có thể gõ thêm tag mới tuỳ ý (ví dụ `Tech`, `IT`, `Remote`, `Accounting` như trong Notion cũ), không có enum/whitelist nào giới hạn giá trị.
- Tổng số dòng active: `public` 455, `sandbox` 141 — đều nằm trong giới hạn `limit: 500` mà `getSocialGroups` đang tải 1 lần ở client, nên filter tag có thể làm hoàn toàn ở client (không cần thêm round-trip server), giữ đơn giản theo mục 1.4 GEMINI.md.
- **Lỗi hiển thị hiện tại cần vá luôn trong spec này:** `src/app/campaigns/page.js` dòng ~717 đang render trực tiếp `{g.group_type || "General"}` — vì `group_type` là mảng, JSX sẽ in ra dạng nối chuỗi bằng dấu phẩy (ví dụ `Nontech,Accounting`), không phải badge đẹp như Notion.

---

## 0. Phạm vi

✅ Trong phạm vi:
1. `src/app/campaign_actions.js`: thêm 1 hàm mới `updateSocialGroupTags(socialGroupId, tags)`.
2. `src/app/campaigns/page.js`: khu vực bảng "Target Social Groups" trong tab Overview & Groups của Campaign Detail (quanh dòng 650-750 hiện tại).
3. File component mới `src/app/components/GroupTypeTagEditor.js` (badge hiển thị tag + popover chỉnh sửa, dùng chung được cho cả cột hiển thị lẫn phần filter).

❌ NGOÀI phạm vi:
- KHÔNG tạo bảng master cho tag (KHÔNG cần `group_type_tags` table riêng) — giữ nguyên `text[]` tự do, đúng tinh thần "tự thêm/bớt tuỳ thích không cần dev".
- KHÔNG đổi schema DB.
- KHÔNG động vào logic Smart Dispatcher / `computeCampaignDispatchPreview` / `triggerCampaignRun`.
- KHÔNG tạo trang quản lý Social Group URL riêng (ngoài phạm vi này) — chỉ nâng cấp đúng bảng chọn Target Groups hiện có trong Campaign Detail.

Nếu thấy cần sửa gì khác ngoài danh sách trên, dừng lại hỏi Claude trước, theo mục 10 GEMINI.md.

---

## 1. Server Action mới: `updateSocialGroupTags`

Thêm vào `campaign_actions.js`, theo đúng pattern của `updateSocialGroupJoinAnswer` đã có (cùng file, gần đó):

```js
/**
 * Update the group_type tags array for a single social group (self-service tagging).
 * @param {string} socialGroupId
 * @param {string[]} tags - Free-form tag strings, no whitelist/enum.
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function updateSocialGroupTags(socialGroupId, tags = []) {
  try {
    // Sanitize: trim, drop empty, dedupe (case-sensitive giữ nguyên như user gõ)
    const cleanTags = [...new Set(tags.map(t => (t || '').trim()).filter(Boolean))];

    await sql`
      UPDATE social_group_urls
      SET group_type = ${cleanTags}
      WHERE id = ${socialGroupId}
    `;

    return { success: true };
  } catch (error) {
    console.error('[updateSocialGroupTags] Error:', error);
    return { success: false, error: error.message };
  }
}
```
(Điều chỉnh cú pháp UPDATE `text[]` cho đúng với thư viện `postgres.js` đang dùng trong file — tham khảo cách các hàm update khác trong cùng file đang set giá trị mảng/JSON nếu có sự khác biệt cú pháp.)

---

## 2. Component mới `GroupTypeTagEditor.js`

Component dùng chung 2 nơi: (a) hiển thị + sửa tag cho 1 dòng trong bảng Target Groups, (b) danh sách tag để làm filter phía trên bảng.

### 2.1. Badge hiển thị (dùng ở cột "Group Type" của bảng)
- Props: `tags` (mảng string hiện tại của 1 group), `socialGroupId`, `onTagsUpdated` (callback sau khi lưu).
- Hiển thị mỗi tag dạng pill nhỏ, màu xác định DETERMINISTIC theo tên tag (không cần lưu màu vào DB) — dùng 1 hàm hash đơn giản (ví dụ tổng mã ký tự % độ dài bảng màu) để chọn 1 trong ~8 bộ màu cố định đã có sẵn trong app (tái dùng token màu quen thuộc: `emerald`, `sky`, `amber`, `rose`, `violet`, `cyan`, `fuchsia`, `slate`). Cùng 1 tên tag luôn ra cùng 1 màu trong toàn app.
- Click vào cụm badge (hoặc icon bút chì nhỏ cạnh đó) → mở popover chỉnh sửa, TÁI DÙNG đúng pattern popover đã có ở `JoinStatusBadge.js` (absolute positioned, `animate-in fade-in zoom-in-95`, nút Cancel/Save, `stopPropagation` để không kích hoạt việc chọn/bỏ chọn dòng trong bảng cha).
- Trong popover: input dạng "tag input" đơn giản — danh sách tag hiện có của group (mỗi tag có nút X để xoá), + 1 ô text để gõ tag mới rồi Enter/nút "+" để thêm vào danh sách tạm (chưa lưu), + gợi ý autocomplete từ danh sách tag đã tồn tại toàn hệ thống (truyền vào qua prop `allKnownTags`, tính từ `allSocialGroups` đã tải sẵn ở page cha — không cần gọi server riêng). Nút "Save" gọi `updateSocialGroupTags(socialGroupId, tagsTạm)`, cập nhật lại `allSocialGroups` ở page cha qua `onTagsUpdated`.

### 2.2. Filter bar (dùng phía trên bảng, cạnh ô Search hiện có)
- Hiển thị toàn bộ tag đang tồn tại trong `allSocialGroups` (tính bằng cách gộp `flatMap` toàn bộ `group_type` của tất cả group đã tải, dedupe, sort) dưới dạng các pill có thể click để bật/tắt (giống style checkbox-pill quen thuộc trong app, dùng lại token active/inactive tương tự pattern nút tab hiện có: active có `border` + màu nền đậm hơn, inactive mờ).
- Semantics filter: **OR (chứa ít nhất 1 trong các tag đã chọn)** — vì mục đích chính là "lọc ra 1 nhóm tag rồi bulk-add", OR phù hợp hơn AND cho việc này. Nếu sau này User thấy cần AND, sẽ có spec riêng.
- Không chọn tag nào = không lọc theo tag (hiển thị tất cả, như hiện tại).

---

## 3. Cập nhật `src/app/campaigns/page.js`

1. Thêm state mới: `selectedTagFilters` (Set<string>, mặc định rỗng).
2. Tính `allKnownTags` bằng `useMemo` từ `allSocialGroups` (dedupe + sort mọi giá trị trong `group_type` của mọi group).
3. Đặt `GroupTypeTagEditor` (chế độ filter bar, mục 2.2) ngay cạnh ô search hiện có (dòng ~656-663).
4. Sửa logic `.filter(...)` hiện tại (dòng ~698-702) để kết hợp CẢ search term LẪN tag filter: 1 dòng được hiển thị khi khớp search term **VÀ** (không có tag filter nào được chọn HOẶC `group_type` của dòng đó overlap với `selectedTagFilters`).
5. Thêm nút **"Select All (Filtered)"** / **"Deselect All (Filtered)"** cạnh nút "Save Target Groups" hiện có — hành vi: thêm/bớt TẤT CẢ id của các dòng đang hiển thị SAU KHI đã áp cả search + tag filter (không đụng tới các dòng đã chọn từ trước nằm ngoài view đang lọc — nghĩa là selection cộng dồn, không reset toàn bộ `targetGroupIds` khi bấm nút này, chỉ union/subtract đúng phần đang hiển thị).
6. Sửa cột "Group Type" (dòng ~717, hiện đang `{g.group_type || "General"}`) để dùng `GroupTypeTagEditor` (chế độ badge hiển thị + edit, mục 2.1) thay cho text thô.

---

## 4. Yêu cầu test bắt buộc trước khi báo hoàn thành

1. Chọn 2 tag filter (ví dụ `Nontech` + `Marketing`) → xác nhận bảng chỉ hiển thị các nhóm có ÍT NHẤT 1 trong 2 tag đó (OR, không phải AND).
2. Bấm "Select All (Filtered)" khi đang lọc → xác nhận CHỈ các dòng đang hiển thị được thêm vào `targetGroupIds`, các dòng đã chọn trước đó (nếu có, nằm ngoài filter hiện tại) vẫn được giữ nguyên, không bị mất.
3. Bấm "Deselect All (Filtered)" → chỉ bỏ chọn đúng các dòng đang hiển thị.
4. Mở popover sửa tag của 1 nhóm, xoá 1 tag cũ + gõ thêm 1 tag hoàn toàn mới (ví dụ `Tech`) chưa từng tồn tại → Save → xác nhận DB cập nhật đúng (`group_type` mới không còn tag đã xoá, có thêm tag mới), và tag mới `Tech` xuất hiện ngay trong danh sách filter bar (không cần reload trang, không cần dev can thiệp).
5. Xác nhận cột Group Type hiển thị badge màu, KHÔNG còn hiện chuỗi nối dấu phẩy thô.
6. Dữ liệu test cô lập theo mục 10.8 GEMINI.md (test trên vài dòng `sandbox`, không sửa tag hàng loạt trên `public` khi test).
7. Chạy lại `npm run build` xác nhận không lỗi biên dịch.

## 5. Báo cáo hoàn thành

Bắt buộc mở đầu bằng đúng 1 trong 2 dòng: "⚠️ Sai lệch so với spec: ..." hoặc "✅ Không có sai lệch so với spec" (mục 10.7 GEMINI.md).
