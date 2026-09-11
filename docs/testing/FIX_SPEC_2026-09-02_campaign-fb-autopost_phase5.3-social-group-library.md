# FIX SPEC — PHẦN 5.3: Sub-Tab "Social Group URLs" — Thư Viện Quản Lý Độc Lập Trong Tab Campaigns

**Từ:** Claude (Architect/QA)
**Gửi:** Antigravity (Implementer)
**Ngày:** 2026-09-02
**Bối cảnh:** Nối tiếp PHẦN 5.2 (filter/tag đã có trong bảng chọn Target Groups của 1 campaign cụ thể), User yêu cầu thêm 1 nơi quản lý ĐỘC LẬP toàn bộ Social Group URL — không gắn với bối cảnh 1 campaign nào — giống như trang "Social Group URL" riêng trong bản Notion cũ. Đây là sub-tab thứ 3 trong tab Campaigns, ngang hàng với "Campaigns" và "FB Accounts & Warm/Join" hiện có (đúng logic: Social Group là tài nguyên dùng chung xuyên suốt nhiều campaign, giống FB Accounts).

**Khảo sát đã xác nhận (Claude tự kiểm tra qua Supabase, AG không cần điều tra lại):**
- `social_group_urls` đầy đủ cột: `id, notion_id, name, url, group_type(text[]), created_time, is_active, join_status, admin_questions, custom_join_answer, question_screenshot_url, last_posted_account_id`.
- Quan hệ nhiều-nhiều với campaign qua bảng `campaign_social_groups (campaign_id, social_group_id)`.
- Quan hệ nhiều-nhiều với FB account qua bảng `fb_account_groups (fb_account_id, social_group_id, joined_at)`.
- Lịch sử đăng bài thật nằm ở `campaign_run_items (social_group_id, status, posted_at, ...)` — dùng `MAX(posted_at) WHERE status = 'Sent'` để tính "Last Posted" chính xác hơn cột `last_posted_account_id` (chỉ biết account, không biết thời điểm).
- Tổng ~596 dòng (455 `public` + 141 `sandbox`) — tải hết 1 lần ở client vẫn ổn, giữ pattern giống `getSocialGroups` hiện có.

---

## 0. Phạm vi

✅ Trong phạm vi:
1. `src/app/campaign_actions.js`: 3 hàm mới — `getSocialGroupsLibrary(filters)`, `createSocialGroup(data)`, `updateSocialGroupDetails(id, data)`, `toggleSocialGroupActive(id, isActive)`.
2. `src/app/campaigns/page.js`: thêm sub-tab thứ 3 "Social Group URLs" (state `activeTab` hiện có 2 giá trị `"campaigns"`/`"fb_accounts"`, mở rộng thêm `"social_groups"`).
3. Component mới `src/app/components/SocialGroupCreateModal.js`.

❌ NGOÀI phạm vi:
- **KHÔNG có nút Delete/xoá cứng** — chỉ có toggle Active/Inactive (soft state, đã có sẵn cột `is_active`). Đây là chủ đích, tuân thủ mục C.9 GEMINI.md (cấm bulk delete không xin phép) — trang này không được phép xoá bản ghi dưới bất kỳ hình thức nào.
- KHÔNG thêm chức năng dọn dẹp trùng lặp URL trong `public.social_group_urls` (vẫn là việc riêng, chờ User cấp phép rõ ràng như đã ghi nhận từ PHẦN 1).
- KHÔNG có checkbox chọn hàng loạt để add vào campaign ở đây — chức năng đó đã có sẵn đúng chỗ của nó (bảng Target Groups bên trong từng Campaign Detail, PHẦN 5.2). Trang này thuần về xem/quản lý thông tin group.
- KHÔNG động vào `computeCampaignDispatchPreview`/`triggerCampaignRun`/logic Smart Dispatcher.

Nếu thấy cần sửa gì khác ngoài danh sách trên, dừng lại hỏi Claude trước, theo mục 10 GEMINI.md.

---

## 1. Server Actions mới trong `campaign_actions.js`

### 1.1. `getSocialGroupsLibrary(filters = {})`
```js
/**
 * Fetch all social groups with cross-campaign usage stats for the standalone library view.
 * @param {Object} [filters]
 * @param {boolean} [filters.includeInactive=false]
 * @returns {Promise<{success: boolean, data?: Array, error?: string}>}
 */
export async function getSocialGroupsLibrary(filters = {}) {
  try {
    const { includeInactive = false } = filters;
    const groups = await sql`
      SELECT
        sgu.id, sgu.name, sgu.url, sgu.group_type, sgu.is_active,
        sgu.join_status, sgu.created_time,
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
      GROUP BY sgu.id
      ORDER BY sgu.created_time DESC NULLS LAST
    `;
    return { success: true, data: groups };
  } catch (error) {
    console.error('[getSocialGroupsLibrary] Error:', error);
    return { success: false, error: error.message };
  }
}
```
(Điều chỉnh cú pháp `${includeInactive} = true OR ...` cho đúng chuẩn `postgres.js` đang dùng trong file nếu cách viết boolean-param khác với pattern hiện có.)

### 1.2. `createSocialGroup(data)`
```js
/**
 * Manually create a new Social Group URL record (self-service, no n8n import needed).
 * @param {Object} data - { name, url, group_type }
 * @returns {Promise<{success: boolean, id?: string, error?: string}>}
 */
export async function createSocialGroup(data) {
  try {
    const { name, url = '', group_type = [] } = data;
    if (!name || !name.trim()) {
      return { success: false, error: 'Group name is required.' };
    }
    const cleanTags = [...new Set((group_type || []).map(t => (t || '').trim()).filter(Boolean))];

    const [row] = await sql`
      INSERT INTO social_group_urls (name, url, group_type, is_active, join_status)
      VALUES (${name.trim()}, ${url.trim()}, ${cleanTags}, true, 'Not Joined')
      RETURNING id
    `;
    revalidatePath('/campaigns');
    return { success: true, id: row.id };
  } catch (error) {
    console.error('[createSocialGroup] Error:', error);
    return { success: false, error: error.message };
  }
}
```

### 1.3. `updateSocialGroupDetails(id, data)`
```js
/**
 * Update name/url of an existing social group (tags handled separately via updateSocialGroupTags).
 * @param {string} id
 * @param {Object} data - { name, url }
 */
export async function updateSocialGroupDetails(id, data) {
  try {
    const { name, url } = data;
    if (!name || !name.trim()) {
      return { success: false, error: 'Group name is required.' };
    }
    await sql`
      UPDATE social_group_urls
      SET name = ${name.trim()}, url = ${(url || '').trim()}
      WHERE id = ${id}
    `;
    revalidatePath('/campaigns');
    return { success: true };
  } catch (error) {
    console.error('[updateSocialGroupDetails] Error:', error);
    return { success: false, error: error.message };
  }
}
```

### 1.4. `toggleSocialGroupActive(id, isActive)`
```js
/**
 * Soft activate/deactivate a social group. NEVER hard-deletes (Rule C.9 GEMINI.md).
 * @param {string} id
 * @param {boolean} isActive
 */
export async function toggleSocialGroupActive(id, isActive) {
  try {
    await sql`UPDATE social_group_urls SET is_active = ${!!isActive} WHERE id = ${id}`;
    revalidatePath('/campaigns');
    return { success: true };
  } catch (error) {
    console.error('[toggleSocialGroupActive] Error:', error);
    return { success: false, error: error.message };
  }
}
```

---

## 2. UI — Sub-Tab "Social Group URLs" trong `campaigns/page.js`

1. Mở rộng thanh sub-tab hiện có (2 tab: "Campaigns" | "FB Accounts & Warm/Join") thành 3 tab, thêm **"Social Group URLs"** (icon gợi ý: `Link2` hoặc `Globe` từ lucide-react).
2. Nội dung tab mới, tải dữ liệu qua `getSocialGroupsLibrary({ includeInactive: showInactive })`:
   - Thanh công cụ trên cùng: ô Search (theo `name`/`url`, client-side như pattern hiện có) + Tag Filter Bar (TÁI DÙNG `GroupTypeTagEditor mode="filter"`, tính `allKnownTags` local cho tab này) + checkbox "Show Inactive" + nút **"+ New Group URL"** (mở `SocialGroupCreateModal`).
   - Bảng danh sách, mỗi dòng: Tên (double-click hoặc icon bút để sửa inline tên/URL qua `updateSocialGroupDetails`), URL (link mở tab mới), Group Type Tags (TÁI DÙNG `GroupTypeTagEditor mode="badge"`), Campaigns (badge nhỏ `{campaign_count} campaigns`, dùng thuộc tính HTML `title` liệt kê `campaign_names.join(', ')` làm tooltip — không cần xây popover riêng, giữ đơn giản), Join Status (TÁI DÙNG `JoinStatusBadge`), Last Posted (dùng lại hàm `formatRelativeTime` đã có sẵn trong `page.js`, hiện "Never" nếu `null`), cột cuối: toggle switch Active/Inactive gọi `toggleSocialGroupActive` (dòng bị Inactive hiển thị mờ đi, tương tự pattern `opacity-50` đã dùng ở bảng Target Groups).
   - KHÔNG có checkbox chọn dòng, KHÔNG có nút Delete.

### 2.1. Component mới `SocialGroupCreateModal.js`
Modal đơn giản: input Tên (bắt buộc), input URL (tuỳ chọn), nút "Create" gọi `createSocialGroup`, sau khi tạo xong đóng modal + reload danh sách + (tuỳ chọn) tự mở popover tag editor cho record vừa tạo để User gắn tag ngay. KHÔNG cần ô nhập tag tại bước tạo — tag sẽ gắn sau bằng `GroupTypeTagEditor` đã có (giữ modal tạo mới tối giản, tránh trùng lặp logic tag input đã có sẵn).

---

## 3. Yêu cầu test bắt buộc trước khi báo hoàn thành

1. Mở sub-tab mới, xác nhận hiển thị đúng tổng số group (mặc định chỉ Active, bật "Show Inactive" thấy thêm các dòng Inactive mờ đi).
2. Tạo mới 1 group test (dữ liệu cô lập, tên có prefix rõ ràng ví dụ `CLAUDE_QA_TEST_...`) → xác nhận xuất hiện ngay trong danh sách, gắn được tag ngay sau đó.
3. Sửa tên/URL của group vừa tạo → xác nhận lưu đúng.
4. Toggle Inactive group vừa tạo → xác nhận `is_active=false`, biến mất khỏi view mặc định (chưa bật Show Inactive), toggle lại Active → hiện lại.
5. Xoá SẠCH group test vừa tạo khỏi DB bằng `execute_sql`/SQL trực tiếp sau khi test xong (vì trang này không có nút Delete, dọn dữ liệu test phải làm thủ công qua DB, đúng tinh thần dữ liệu test cô lập mục 10.8 GEMINI.md — không được để lại rác trong `social_group_urls` thật).
6. Xác nhận cột "Campaigns" hiện đúng số lượng + tooltip tên campaign khi hover (test với 1 group đã có sẵn đang được gán cho ít nhất 1 campaign thật, ví dụ dùng để xem, KHÔNG sửa gì trên group thật đó).
7. Chạy lại `npm run build` xác nhận không lỗi biên dịch.

## 4. Báo cáo hoàn thành

Bắt buộc mở đầu bằng đúng 1 trong 2 dòng: "⚠️ Sai lệch so với spec: ..." hoặc "✅ Không có sai lệch so với spec" (mục 10.7 GEMINI.md — đã nhắc nhiều lần, đề nghị AG áp dụng đúng từ lần báo cáo này).
