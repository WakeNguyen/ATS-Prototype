# FIX SPEC — PHẦN 5.4: Sửa Lỗi "Xoá Tag Khỏi 1 Nhóm = Xoá Tag Khỏi Cả Hệ Thống" (Persistent Tag Registry)

**Từ:** Claude (Architect/QA)
**Gửi:** Antigravity (Implementer)
**Ngày:** 2026-09-02
**Bối cảnh:** User phát hiện lỗi nghiêm trọng qua ảnh chụp thực tế: khi bỏ tag `X` ra khỏi 1 group cụ thể (thao tác "remove tag khỏi group"), nếu đó là group CUỐI CÙNG còn mang tag `X`, thì tag `X` biến mất hoàn toàn khỏi filter bar VÀ khỏi gợi ý autocomplete trên toàn hệ thống — không còn cách nào chọn lại tag `X` cho bất kỳ group nào khác (chỉ có thể gõ lại y hệt tên cũ theo trí nhớ, dễ gõ sai/không nhất quán). Nguyên nhân gốc: PHẦN 5.2 cố tình không tạo bảng master cho tag (đúng tinh thần tối giản), nhưng hệ quả là "tag có tồn tại hay không" bị suy ra hoàn toàn từ việc NÓ CÓ ĐANG GẮN VỚI ÍT NHẤT 1 GROUP HAY KHÔNG — tức "tháo tag khỏi 1 group" (remove/detach) và "xoá tag khỏi toàn hệ thống" (delete) bị lẫn làm một, đúng như User chỉ ra: *"Nên phân biệt rõ giữa remove tag và delete tag"*.

**Đã xử lý trực tiếp (Claude tự làm, không cần AG lặp lại):**
- Tạo bảng mới `social_group_tags (id uuid PK, name text UNIQUE NOT NULL, created_time timestamptz)` trên cả 2 schema `sandbox`/`public`, RLS bật trên `public` (khớp pattern các bảng khác), REVOKE ALL từ `anon`/`authenticated` cả 2 schema.
- Backfill toàn bộ tag đang thực sự gắn với ít nhất 1 group ngay tại thời điểm chạy migration vào bảng mới này (không mất tag nào đang tồn tại hiện tại). Kết quả xác nhận: `public` có 5 tag (`Cosmetic`, `Marketing`, `Nontech`, `Nurse`, `Video Editor`), `sandbox` có 2 tag (`Facebook Group`, `Tech Community`).
- **Lưu ý quan trọng:** 2 tag mà User báo đã "biến mất" (bị xoá khỏi group cuối cùng TRƯỚC KHI Claude chạy backfill) KHÔNG được khôi phục tự động vì đã mất dấu vết tên chính xác trước khi bảng registry tồn tại — Claude đang hỏi lại User tên chính xác 2 tag đó để chèn tay bổ sung, không thuộc phạm vi AG xử lý.

---

## 0. Phạm vi

✅ Trong phạm vi:
1. `src/app/campaign_actions.js`: thêm `getAllTagOptions()`; sửa `updateSocialGroupTags()` để đăng ký tag mới vào `social_group_tags` (không đổi hành vi update `group_type` trên group).
2. `src/app/campaigns/page.js`: thay `allKnownTags`/`libraryAllKnownTags` (hiện tính bằng `useMemo` quét từ dữ liệu group đang tải) bằng 1 state chung `allTagOptions` lấy từ `getAllTagOptions()`.

❌ NGOÀI phạm vi:
- KHÔNG thêm UI "Delete Tag" (xoá vĩnh viễn 1 tag khỏi registry) trong spec này — User chỉ yêu cầu KHÔNG bị mất tag ngoài ý muốn khi remove khỏi 1 group, chưa yêu cầu công cụ xoá tag chủ động. Nếu sau này cần, sẽ là spec riêng (và phải cân nhắc kỹ theo mục C.9 GEMINI.md vì đây là hành động phá huỷ).
- KHÔNG đổi `GroupTypeTagEditor.js` (component này chỉ nhận `allKnownTags` như 1 prop — chỉ đổi NGUỒN dữ liệu truyền vào từ trang cha, không đổi logic bên trong component).
- KHÔNG đổi schema `social_group_urls.group_type` (vẫn giữ `text[]` gắn trực tiếp trên từng group).

Nếu thấy cần sửa gì khác ngoài danh sách trên, dừng lại hỏi Claude trước, theo mục 10 GEMINI.md.

---

## 1. Server Actions — `campaign_actions.js`

### 1.1. Hàm mới `getAllTagOptions()`
```js
/**
 * Fetch the full, persistent list of all tag names ever registered — independent
 * of which groups currently carry them. This is the canonical source for filter
 * bars and autocomplete suggestions (fixes: removing a tag from the last group
 * that had it used to make the tag vanish system-wide).
 * @returns {Promise<{success: boolean, data?: string[], error?: string}>}
 */
export async function getAllTagOptions() {
  try {
    const rows = await sql`SELECT name FROM social_group_tags ORDER BY name ASC`;
    return { success: true, data: rows.map(r => r.name) };
  } catch (error) {
    console.error('[getAllTagOptions] Error:', error);
    return { success: false, error: error.message };
  }
}
```

### 1.2. Sửa `updateSocialGroupTags()` — đăng ký tag mới vào registry
Thêm ĐÚNG 1 bước mới trước khi return, KHÔNG đổi phần update `group_type` hiện có:
```js
export async function updateSocialGroupTags(socialGroupId, tags = []) {
  try {
    const cleanTags = [...new Set((tags || []).map(t => (t || '').trim()).filter(Boolean))];

    // NEW: Register any brand-new tag names into the persistent registry.
    // This does NOT affect which groups the tag is attached to — it only
    // ensures the tag name stays selectable system-wide even if later
    // removed from every group. Detaching a tag from a group (this UPDATE
    // below) is intentionally NEVER allowed to delete it from the registry.
    if (cleanTags.length > 0) {
      await sql`
        INSERT INTO social_group_tags (name)
        SELECT DISTINCT unnest(${cleanTags}::text[])
        ON CONFLICT (name) DO NOTHING
      `;
    }

    await sql`
      UPDATE social_group_urls
      SET group_type = ${cleanTags}
      WHERE id = ${socialGroupId}
    `;

    revalidatePath('/campaigns');
    return { success: true, data: { id: socialGroupId, group_type: cleanTags } };
  } catch (error) {
    console.error('[updateSocialGroupTags] Error:', error);
    return { success: false, error: error.message };
  }
}
```
(Điều chỉnh cú pháp `unnest(${cleanTags}::text[])` nếu cần cho khớp cách `postgres.js` xử lý cast trong file — đã xác nhận qua AG rằng tham số mảng non-empty bind bình thường không cần cast, chỉ cần đảm bảo `unnest()` nhận đúng kiểu `text[]`.)

---

## 2. UI — `campaigns/page.js`

1. Thêm state mới `const [allTagOptions, setAllTagOptions] = useState([])`.
2. Tải 1 lần khi trang mount (đặt cạnh các lệnh tải dữ liệu ban đầu khác, ví dụ trong `useEffect` load ban đầu hoặc hàm riêng `loadAllTagOptions()` gọi `getAllTagOptions()`).
3. Xoá 2 khối `useMemo` hiện có (`allKnownTags` tính từ `allSocialGroups`, `libraryAllKnownTags` tính từ `socialGroupsLibrary`) — thay TẤT CẢ các chỗ đang dùng 2 biến này (cả trong bảng Target Groups của Campaign Detail lẫn sub-tab Social Group URLs Library) bằng chung 1 biến `allTagOptions`.
4. Sau khi `handleGroupTagsUpdated`/`handleLibraryTagUpdated` chạy thành công (tag mới được lưu), gọi lại `loadAllTagOptions()` (hoặc cách rẻ hơn: hợp state cục bộ — thêm trực tiếp các tag mới vào `allTagOptions` nếu chưa có, tránh round-trip thừa) để tag mới xuất hiện NGAY LẬP TỨC trong filter bar/gợi ý ở CẢ 2 nơi (Target Groups picker và Social Group Library) mà không cần tải lại trang.

---

## 3. Yêu cầu test bắt buộc trước khi báo hoàn thành

1. **Test tái hiện đúng lỗi User báo rồi xác nhận đã hết:** Tạo 1 group test cô lập, gắn 1 tag hoàn toàn mới (ví dụ `CLAUDE_QA_TAG_TEMP`), Save. Xoá tag đó khỏi CHÍNH group này (group duy nhất đang mang tag) qua popover, Save. Mở lại filter bar / popover tag của MỘT group KHÁC — xác nhận tag `CLAUDE_QA_TAG_TEMP` **VẪN CÒN** xuất hiện trong danh sách gợi ý/filter (dù không group nào đang thực sự mang tag đó) — đây là điểm cốt lõi cần vá.
2. Gắn tag `CLAUDE_QA_TAG_TEMP` đó cho group thứ 2 → xác nhận gắn lại được bình thường không cần gõ tay lại (chọn từ gợi ý).
3. Xác nhận filter bar ở CẢ 2 nơi (Target Groups trong Campaign Detail, VÀ sub-tab Social Group URLs Library) đều hiển thị đồng bộ cùng 1 danh sách tag từ `getAllTagOptions()`.
4. Dọn dẹp: xoá tag test khỏi group test, xoá row `social_group_tags` tên `CLAUDE_QA_TAG_TEMP` bằng SQL trực tiếp sau khi test xong (bảng mới này chưa có UI xoá, dọn thủ công qua DB), xoá luôn group test — đúng mục 10.8 GEMINI.md.
5. Chạy lại `npm run build` xác nhận không lỗi biên dịch.

## 4. Báo cáo hoàn thành

Bắt buộc mở đầu bằng đúng 1 trong 2 dòng: "⚠️ Sai lệch so với spec: ..." hoặc "✅ Không có sai lệch so với spec" (mục 10.7 GEMINI.md).
