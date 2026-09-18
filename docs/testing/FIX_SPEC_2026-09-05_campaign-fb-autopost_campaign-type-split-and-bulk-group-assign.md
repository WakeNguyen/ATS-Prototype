---
title: FIX_SPEC 2026-09-05 — Thêm loại Campaign (Job Posting/Warming), gộp Run Warm & Join vào Campaign, Bulk gán Social Group vào nhiều Campaign
role: Claude = Architect/QA (viết spec này, KHÔNG tự code/chạy SQL) → AG = Implementer (thực thi toàn bộ bên dưới)
---

## 0. Bối cảnh — ĐỌC TRƯỚC KHI LÀM

User nhận ra: "Nuôi nick & Auto-Join" (Warm & Join) về bản chất cũng là 1 loại **action campaign**, chỉ khác script Playwright chạy phía sau (`warm-and-join.js` thay vì `run-batch.js`) so với "Đăng bài" (Job Posting, dùng `post-to-group.js`/`run-batch.js`). Nhưng hiện tại 2 luồng này đang bị tách rời hoàn toàn về mặt dữ liệu và UI:

- **Job Posting** đã có đầy đủ mô hình Campaign: 1 `campaign_id` sở hữu 1 pool account (`campaign_fb_accounts`), 1 danh sách group mục tiêu (`campaign_social_groups`), và lịch sử chạy riêng (`campaign_runs`/`campaign_run_items`).
- **Warm & Join** hiện là 1 hệ thống **toàn cục, không gắn với campaign nào**: `warm_join_runs` không có `campaign_id`; nút bấm "Run Warm & Join" nằm ở sub-tab "FB Accounts & Warm/Join"; tài khoản mục tiêu chọn qua tham số `accountIds` rời rạc mỗi lần bấm; **nhóm mục tiêu để join hiện KHÔNG được truyền vào `triggerWarmJoinRun` ở bất kỳ đâu** (hàm này chỉ resolve account, không đọc group nào cả — xem PHẦN 3 mục 3.1 để hiểu rõ đây là 1 khoảng trống cần lấp, không phải bug).

User yêu cầu 3 việc, cả 3 đều nằm trong spec này:

1. Thêm property `campaign_type` (single-select: `Job Posting` | `Warming`) lên bảng `campaigns` để phân biệt 2 loại action.
2. Tách lại vai trò 2 sub-tab: **"FB Accounts & Warm/Join"** đổi thành chỉ còn **"FB Accounts"** (thuần quản lý danh sách tài khoản FB: CRUD, proxy/2FA, trạng thái, quota, thông tin Warming Health/Last Warmed để tham khảo) — **không còn nút chạy hành động nào ở đây nữa**. Sub-tab **"Campaigns"** quản lý cả 2 loại action (Job Posting và Warming) như 2 loại Campaign khác nhau, mỗi Warming Campaign có nút "Run Warm & Join" và lịch sử chạy riêng của chính nó.
3. Cơ chế **bulk-gán nhiều Social Group URL vào 1 hoặc nhiều Campaign cùng lúc**, sau khi đã filter theo Tag và/hoặc khoảng số lượng thành viên (2 filter này đã có sẵn từ PHẦN 3/5.8) — đúng như UX cũ bên Notion ATS: chọn nhiều dòng Social Group → mở 1 danh sách Campaign để multi-select → gán hàng loạt. (User có gửi kèm ảnh chụp UI Notion cũ minh hoạ — mô tả lại bằng lời vì AG không xem được ảnh: khi tick chọn nhiều dòng Social Group URL, có 1 ô "Link or create a page..." cho search + hiển thị danh sách Campaign để multi-select, mỗi Campaign hiển thị kèm số job/nhóm đã gắn.)

**Dữ liệu hiện tại (đã xác nhận qua Supabase MCP, read-only):** `campaigns` = 0 dòng, `warm_join_runs` = 0 dòng ở **cả 2 schema** `public` và `sandbox` — không có rủi ro backfill sai khi thêm cột NOT NULL.

**Quyết định kiến trúc của Claude (Architect) — đọc kỹ trước khi code, đừng tự đổi:**

- Giữ **unique index toàn cục** `one_running_warm_join_run` (`status = 'Running'`) **KHÔNG đổi**. Nghĩa là tại 1 thời điểm, toàn hệ thống chỉ được chạy 1 lượt Warm & Join, bất kể thuộc Warming Campaign nào — giống hệt hành vi hiện tại. Cho phép nhiều Warming Campaign chạy song song là 1 thay đổi kiến trúc lớn hơn nhiều (cần thêm cơ chế chống 2 Campaign tranh cùng 1 FB account), **KHÔNG làm trong spec này**.
- `campaign_type` bị **khoá không cho đổi sau khi Campaign đã có ít nhất 1 lượt chạy** (`campaign_runs` hoặc `warm_join_runs`) — tránh lịch sử chạy bị lẫn lộn giữa 2 loại action. Enforce ở tầng Server Action (không cần CHECK constraint DB phức tạp).
- **Cập nhật 2026-09-05 (sau khi trao đổi lại với User): AG CÓ quyền chỉnh sửa n8n, nên PHẦN 5 bên dưới (cập nhật Workflow C) nằm trong phạm vi AG, không phải việc riêng của Claude như ghi chú cũ.** Đây là điểm khác với thông lệ trước đây của dự án (các lần sửa n8n trước đều do Claude làm trực tiếp) — nếu AG thấy mình thực sự không có quyền/không thấy MCP n8n, phải báo lại ngay cho User thay vì bỏ qua PHẦN 5.

---

## PHẦN 1 — DB Schema (Claude đã viết sẵn SQL, AG chỉ chạy, KHÔNG tự viết lại)

File đính kèm: **`DDL_2026-09-05_campaign-type-and-warmjoin-campaign-link.sql`** (gửi kèm cùng spec này).

**QUAN TRỌNG: phải chạy trên CẢ 2 schema `public` và `sandbox`** — file đã viết sẵn đủ 2 khối lệnh riêng cho từng schema, chạy nguyên văn 1 lần, không tự rút gọn hay chỉ chạy 1 schema.

Nội dung chính:
1. `campaigns.campaign_type text NOT NULL DEFAULT 'Job Posting' CHECK (campaign_type IN ('Job Posting','Warming'))`.
2. `warm_join_runs.campaign_id uuid NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE` + index `(campaign_id, started_at DESC)`.
3. Chạy đủ các câu SELECT verify ở cuối file, đối chiếu đúng kết quả mô tả trong comment (đặc biệt: `is_nullable = 'NO'` cho `campaign_id`, FK trỏ đúng `campaigns`).
4. Sau khi chạy xong, cập nhật `docs/DEVELOPMENT_LOG.md` (cả bảng tổng hợp lẫn phần chi tiết — xem [[devlog-summary-table-rule]]).

---

## PHẦN 2 — Áp dụng `campaign_type` vào Server Actions + UI Campaigns

### 2.1 Backend (`src/app/campaign_actions.js`)
- `createCampaign(data)`: nhận thêm `campaign_type` (bắt buộc, chỉ nhận `'Job Posting'`/`'Warming'`, mặc định `'Job Posting'` nếu thiếu để an toàn ngược); validate giá trị hợp lệ trước khi INSERT, trả lỗi rõ ràng nếu sai.
- `updateCampaign(id, data)`: nếu `data.campaign_type` được truyền và khác giá trị hiện tại trong DB, **kiểm tra trước** xem campaign đã có `campaign_runs` hoặc `warm_join_runs` nào chưa (2 câu `SELECT EXISTS(...)`); nếu có ít nhất 1 run → từ chối đổi, trả `{success:false, error:'Không thể đổi loại Campaign sau khi đã có lượt chạy.'}`; nếu chưa có run nào → cho đổi bình thường.
- `getCampaigns(filters = {})`: thêm `c.campaign_type` vào SELECT; thêm filter `campaign_type` (giá trị `'ALL'`/`'Job Posting'`/`'Warming'`), pattern y hệt filter `status` đã có.
- `getCampaignDetail(id)`: đảm bảo trả về `campaign_type` trong object campaign.
- `triggerCampaignRun(campaignId, ...)`: thêm guard đầu hàm — query `campaign_type` của campaign, nếu khác `'Job Posting'` thì trả về lỗi ngay (`'Campaign này không phải loại Job Posting.'`), không cho chạy tiếp.

### 2.2 UI (`src/app/campaigns/page.js`, `src/app/components/CampaignEditModal.js`)
- **CampaignEditModal.js**: thêm field "Loại Campaign" (single-select, 2 lựa chọn `Job Posting`/`Warming`) làm field ĐẦU TIÊN trong form. Khi tạo mới: cho chọn tự do. Khi sửa Campaign đã tồn tại VÀ đã có ít nhất 1 run (BE đã chặn ở 2.1, nhưng FE cũng nên disable field + hiển thị tooltip giải thích lý do, tránh User bấm rồi mới nhận lỗi).
  - Khi `campaign_type === 'Job Posting'`: hiển thị đầy đủ các field hiện có (Job liên kết, Content, Ảnh, Ngôn ngữ, Auto-spin content, Max posts/run, Target FB Accounts pool, Target Social Groups).
  - Khi `campaign_type === 'Warming'`: ẨN các field Content/Ảnh/Ngôn ngữ/Auto-spin/Max posts/run/Job liên kết (không áp dụng cho warming), CHỈ giữ: Tên Campaign, Ngày bắt đầu/kết thúc (tuỳ chọn), Target FB Accounts pool (accounts cần nuôi/join), Target Social Groups (nhóm cần join) — tái dùng nguyên 2 picker component đã có (không viết mới).
- **campaigns/page.js, sub-tab "Campaigns"**: 
  - Thêm cột "Loại" trong Master Table, hiển thị badge 2 màu khác nhau rõ ràng (vd xanh dương = Job Posting, cam = Warming).
  - Thêm bộ lọc theo Loại (Tất cả/Job Posting/Warming) trên toolbar, tái dùng đúng pattern UI của filter Status đã có sẵn.

---

## PHẦN 3 — Chuyển "Run Warm & Join" từ tab FB Accounts vào bên trong 1 Warming Campaign

### 3.1 Backend (`src/app/campaign_actions.js`)
- `triggerWarmJoinRun(campaignId, params = {})`: đổi chữ ký hàm, **`campaignId` là tham số bắt buộc đầu tiên**.
  1. Query campaign theo `campaignId`, validate tồn tại VÀ `campaign_type === 'Warming'` (nếu không → lỗi rõ ràng, không cho chạy tiếp).
  2. Resolve `targetAccounts`: đổi nguồn từ tham số rời rạc `params.accountIds` sang query bảng `campaign_fb_accounts WHERE campaign_id = campaignId` (nếu rỗng → fallback lấy toàn bộ account `status = 'Active'`, giữ đúng hành vi mặc định hiện tại — pattern y hệt cách `computeCampaignDispatchPreview` đang xử lý cho Job Posting).
  3. **Mới**: resolve thêm `targetGroups` từ bảng `campaign_social_groups WHERE campaign_id = campaignId` (JOIN `social_group_urls` lấy `id, name, url, admin_questions, custom_join_answer`) — đây là phần dữ liệu HIỆN TẠI CHƯA TỪNG được đọc ở đâu trong hàm này, cần bổ sung mới hoàn toàn.
  4. Khi INSERT vào `warm_join_runs`, thêm cột `campaign_id`.
  5. Payload gửi sang webhook `warm-join-trigger`: **giữ nguyên `accountIds` như cũ** (không phá luồng hiện tại), **bổ sung thêm** `campaignId` và `targetGroups` (mảng object `{id, name, url, admin_questions, custom_join_answer}`) vào payload — Workflow C phải được cập nhật để thực sự dùng 2 field mới này, xem PHẦN 5 bên dưới.
- `getActiveWarmJoinRun(campaignId)`: thêm điều kiện `AND campaign_id = ${campaignId}` vào query — chỉ kiểm tra run đang chạy CỦA CAMPAIGN ĐÓ (lưu ý: unique index vẫn khoá toàn cục ở tầng DB theo mục 0, hàm này chỉ phục vụ hiển thị đúng trạng thái nút bấm cho đúng Campaign đang xem).
- `getWarmJoinRuns(campaignId, limit = 20)`: thêm điều kiện `WHERE campaign_id = ${campaignId}`.

### 3.2 UI (`src/app/campaigns/page.js`)
- Sub-tab **"FB Accounts"** (đổi tên từ "FB Accounts & Warm/Join"): **XOÁ HẲN** nút "Run Warm & Join", modal "Run Warm & Join Session", và khối UI lịch sử Warm & Join Run History khỏi khu vực này. GIỮ NGUYÊN cột "Warming Health" và "Last Warmed" trong bảng FB Accounts (vẫn là thông tin hữu ích để tham khảo nhanh trạng thái từng account, chỉ là bỏ hành động trigger khỏi tab này).
- Sub-tab **"Campaigns"**, trong Detail Panel của 1 Campaign có `campaign_type === 'Warming'`:
  - Thêm nút "Run Warm & Join" (tái dùng UI/modal xác nhận cũ, chỉ đổi chỗ gọi để truyền kèm `campaignId` hiện tại).
  - Thêm khối Run History cho Warming Campaign, tái dùng component `RunHistoryTable` đã có — nếu cấu trúc cột không khớp (item của Warming dùng field `action` thay vì `status`, giá trị enum khác hẳn Posting), có thể thêm 1 prop kiểu `variant="warmjoin"` vào `RunHistoryTable` để đổi cách hiển thị cột cho phù hợp, KHÔNG viết 1 component bảng lịch sử hoàn toàn mới (tái dùng tối đa, theo [[ui-design-principle-mvc]]).
  - Detail Panel của Campaign `campaign_type === 'Job Posting'` giữ nguyên 100% như hiện tại, không đổi gì.

---

## PHẦN 4 — Bulk gán Social Group URL vào 1 hoặc nhiều Campaign

Vị trí: sub-tab "Social Group URLs" trong `campaigns/page.js`, tái dùng cơ chế chọn hàng loạt + filter Tag/Member Count đã có sẵn từ PHẦN 5.7 và PHẦN 3 (2026-09-05).

### 4.1 Backend
Server Action mới trong `campaign_actions.js`:

```js
export async function bulkAssignSocialGroupsToCampaigns(socialGroupIds = [], campaignIds = []) {
  // Validate: cả 2 mảng không rỗng.
  // Insert cross-product (socialGroupIds x campaignIds) vào campaign_social_groups
  // trong 1 transaction, dùng ON CONFLICT (campaign_id, social_group_id) DO NOTHING.
  // Đếm số dòng thực sự insert được (vd dùng RETURNING id rồi đếm length) để phân biệt
  // với số dòng đã tồn tại từ trước.
  // Trả về: { success: true, insertedCount, alreadyLinkedCount }
}
```

Nếu số lượng `socialGroupIds x campaignIds` quá lớn (vd >5000 cặp), làm theo batch giống cách `bulkImportSocialGroups` đã xử lý batch insert ở PHẦN 4 hôm trước — tái dùng đúng pattern đó, không viết cách mới.

### 4.2 UI
1. Trong sub-tab "Social Group URLs": khi có ≥1 dòng đang được chọn (checkbox, kể cả qua "Select All (Filtered)" đã có), hiện thêm 1 nút toolbar mới **"Thêm vào Campaign..."** cạnh các nút hành động hàng loạt khác (nếu chưa có khu vực hành động hàng loạt, thêm 1 thanh nhỏ hiện ra khi có selection, giống pattern quen thuộc "N selected" trong ảnh Notion User gửi).
2. Bấm nút → mở modal mới `AssignGroupsToCampaignsModal.js`:
   - Hiển thị số lượng group đang được chọn (vd "Đang chọn 50 nhóm").
   - Danh sách toàn bộ Campaign hiện có (gọi `getCampaigns({})` không lọc status), mỗi dòng là 1 checkbox kèm tên Campaign + badge Loại (Job Posting/Warming).
   - Có 2 cách lọc nhanh danh sách Campaign trong modal: ô search theo tên, và tab/segment lọc theo Loại (Tất cả/Job Posting/Warming) — giúp User dễ tìm đúng Warming Campaign cần nuôi nick hoặc đúng Job Posting Campaign cần đăng bài.
   - Nút "Gán vào N Campaign đã chọn" gọi `bulkAssignSocialGroupsToCampaigns(selectedGroupIds, selectedCampaignIds)`.
3. Sau khi gán xong: hiện toast/thông báo kết quả rõ ràng (vd: "Đã thêm 45 liên kết mới, 5 liên kết đã tồn tại từ trước — không đổi gì"), tự động reload lại Library để cột "Campaigns" (đã có sẵn `campaign_count`/`campaign_names` từ PHẦN 5.3) cập nhật đúng số liệu mới, đóng modal, bỏ chọn toàn bộ checkbox.

---

## PHẦN 5 — Cập nhật n8n Workflow C (`L8QdckqW7FDwanRq`) để dùng đúng `targetGroups` theo Campaign

**Bối cảnh riêng cho PHẦN này:** hiện tại (trước spec này) `triggerWarmJoinRun` chỉ gửi `{runId, accountIds}` sang webhook `warm-join-trigger` — Workflow C KHÔNG hề nhận danh sách group nào cả, nghĩa là việc chọn "join nhóm nào" hiện đang do 1 logic khác quyết định (có thể là: engine `warm-and-join.js` trên VPS tự query nhóm theo `fb_account_groups`/`join_status` độc lập, hoặc theo assignment cũ qua `setFbAccountGroups` ở FbAccountEditModal). **AG phải tự đọc lại Workflow C hiện tại (`get_workflow_details`) VÀ đọc code `warm-and-join.js` đang chạy trên VPS (nếu truy cập được, hoặc bản mirror trong repo/Google Drive như các lần trước) để xác định chính xác cơ chế chọn group hiện tại trước khi sửa** — không suy đoán, không tự tin là mình đã hiểu đúng luồng cũ.

Việc cần làm:
1. Xác định rõ (viết lại trong báo cáo QA) hiện Workflow C / engine đang lấy danh sách "nhóm cần join cho account X" từ đâu.
2. Sửa Workflow C để khi trigger có kèm `targetGroups` (mảng group của Warming Campaign đang chạy), **danh sách này trở thành nguồn DUY NHẤT quyết định nhóm cần thử join trong lượt chạy đó** — thay thế hoàn toàn cơ chế cũ đã xác định ở bước 1 cho các lượt chạy xuất phát từ nút "Run Warm & Join" trong ATS UI (nếu Workflow C còn được trigger từ nơi khác không qua ATS UI, giữ nguyên hành vi cũ cho đường đó, chỉ đổi nhánh nhận `targetGroups`).
3. Với mỗi cặp (account, group) trong `targetGroups`: bỏ qua nếu account đó đã có trong `fb_account_groups` cho group đó (đã join rồi, không thử lại); các cặp còn lại gửi cho engine `warm-and-join.js` xử lý (warming trước, rồi request join, rồi auto-answer câu hỏi xét duyệt nếu `admin_questions`/`custom_join_answer` có dữ liệu — theo đúng logic auto-answer đã có).
4. Kết quả từng cặp (account, group) phải được ghi vào `warm_join_run_items` (`run_id`, `fb_account_id`, `social_group_id`, `action` thuộc `Warmed`/`JoinRequested`/`AutoAnswered`/`Joined`/`Failed`/`Checkpoint`, `error_message`) qua đúng webhook callback đã có sẵn cho `warm_join_runs` — **đây là phần dữ liệu Run History ở PHẦN 3.2 phụ thuộc vào, nếu Workflow C không ghi đủ `social_group_id` cho từng item, bảng Run History trong Campaign detail sẽ trống/sai**.
5. Khi join thành công, đồng thời upsert `fb_account_groups (fb_account_id, social_group_id)` (để lần sau không thử lại) — kiểm tra xem cơ chế này đã tồn tại sẵn chưa trước khi thêm, tránh trùng lặp logic.

⚠️ Không đổi hành vi của bất kỳ workflow nào khác (Workflow A FB Group Auto-Post, hay các workflow không liên quan) — chỉ sửa đúng Workflow C.

---

## Test bắt buộc trước khi báo PASS (cho cả 5 PHẦN)

- Tạo 1 Campaign loại Job Posting và 1 Campaign loại Warming qua UI → xác nhận đúng field ẩn/hiện theo loại, lưu đúng `campaign_type` trong DB (kiểm cả 2 schema nếu test ở `public`).
- Thử đổi `campaign_type` của 1 Campaign CHƯA có run nào → PASS. Tạo 1 run test cô lập (theo Rule 10.8, dữ liệu tự tạo/tự dọn) cho Campaign đó rồi thử đổi lại → PHẢI bị chặn với thông báo lỗi rõ ràng, cả ở BE lẫn UI.
- Với 1 Warming Campaign có sẵn Target FB Accounts + Target Social Groups: bấm "Run Warm & Join" → xác nhận `warm_join_runs` mới có đúng `campaign_id`, resolve đúng account từ `campaign_fb_accounts` (không phải toàn bộ Active nếu pool không rỗng), payload gửi n8n có đủ field `campaignId`/`targetGroups` (log lại payload thực tế để Claude đối chiếu khi QA, không cần chờ n8n xử lý đúng).
- Thử bấm nút chạy Job Posting trên 1 Warming Campaign (giả lập gọi thẳng `triggerCampaignRun` với id của Warming Campaign) → phải bị chặn bởi guard ở PHẦN 2.1.
- Filter Social Group Library theo Tag + khoảng Member Count → chọn hàng loạt (bao gồm thử "Select All (Filtered)") → bấm "Thêm vào Campaign..." → chọn 2-3 Campaign (trộn cả Job Posting và Warming) → xác nhận `campaign_social_groups` có đủ toàn bộ cặp mới, không tạo trùng nếu 1 vài cặp đã tồn tại sẵn từ trước (test lại 2 lần liên tiếp cùng 1 lựa chọn — lần 2 phải báo `insertedCount = 0`, `alreadyLinkedCount = full`).
- `npm run build` PASS toàn bộ routes, console sạch 0 lỗi khi thao tác qua Chrome DevTools MCP trên dev server thật.
- **Test riêng cho PHẦN 5 (bắt buộc, dùng dữ liệu cô lập theo Rule 10.8):** tạo 1 Warming Campaign test với 2-3 account + 2-3 group cô lập (chưa từng join) → bấm "Run Warm & Join" → theo dõi tới khi Workflow C chạy xong → xác nhận `warm_join_run_items` có đủ dòng cho từng cặp (account, group) đã gửi trong `targetGroups`, đúng `social_group_id`, action hợp lý; xác nhận account/group đã join KHÔNG bị thử lại nếu chạy thêm 1 lượt nữa cho đúng Campaign đó; dọn sạch dữ liệu test sau khi xong.

---

## Ghi chú chung

- PHẦN 1 là SQL thuần theo file đính kèm, AG chỉ cần chạy đúng nguyên văn trên CẢ 2 schema — không tự viết lại hay "tối ưu" câu lệnh.
- PHẦN 2-5 là code (application `src/` VÀ workflow n8n ở PHẦN 5) → đúng quy trình 2-agent: AG code + tự QA theo checklist trên, Claude review độc lập sau khi AG báo cáo xong ([[claude-role-boundary]]). PHẦN 5 nằm trong phạm vi AG (đã xác nhận lại với User AG có quyền n8n).
- Không đụng tới nhánh code khác đang chạy song song (Responsive Tablet đã đóng, Social Groups Phase 1-4 đã xong) — an toàn làm độc lập.
