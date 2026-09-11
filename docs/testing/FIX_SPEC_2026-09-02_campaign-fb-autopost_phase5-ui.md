# FIX SPEC — PHẦN 5: UI Campaigns & FB Accounts

**Từ:** Claude (Architect/QA)
**Gửi:** Antigravity (Implementer)
**Ngày:** 2026-09-02
**Bắt buộc đọc trước:** `docs/architecture/PLAN_2026-09-02_campaign-fb-autopost-integration.md` mục 7 (Thiết Kế UI gốc), mục 8 (Notification Center), mục 11.6 (quyết định bỏ Telegram, dùng in-app modal). Spec này thay thế/làm rõ mục 7 ở 2 điểm quan trọng (nêu ở mục 0.1 dưới đây) và bổ sung chi tiết implement để AG code thẳng, không cần suy đoán thêm.

Nguyên tắc bắt buộc xuyên suốt: mục 1.4 GEMINI.md — MVC, ưu tiên chức năng, KHÔNG thêm animation/hiệu ứng màu mè mới, tái dùng tối đa component/pattern đã có, ưu tiên dễ tuỳ chỉnh hơn "đẹp nhưng cứng".

---

## 0. Phạm vi

✅ Trong phạm vi:
1. Sửa `src/app/NavbarTabs.js` — thêm tab thứ 5 "Campaigns".
2. File mới `src/app/campaigns/page.js` (Server Component, đọc data qua `campaign_actions.js` đã có sẵn từ PHẦN 3) + các Client Component con cần thiết trong `src/app/campaigns/` hoặc `src/app/components/` (theo đúng convention thư mục hiện có — kiểm tra `src/app/jobs/` để theo đúng pattern chia Server/Client Component nếu chưa chắc).
3. Modal "Preview & Dispatch Breakdown" (mục 3 dưới đây).
4. Cột `Join Status` badge trên bảng chọn Target Groups (trong Campaign Overview) — KHÔNG bắt buộc phải sửa Search Menu (`/search`) trong spec này, để dành nếu User yêu cầu riêng sau.

❌ NGOÀI phạm vi:
- Không sửa `campaign_actions.js`/webhook routes (đã xong ở PHẦN 3/3.1) — nếu UI cần thêm 1 Server Action nhỏ chưa có (ví dụ 1 hàm đọc phụ), dừng lại hỏi Claude trước thay vì tự thêm.
- Không động vào `src/components/ActivityLogPanel.js` (xem lý do ở mục 0.1).
- Không làm PHẦN 4a/4b (VPS bridge, workflow n8n).

### 0.1. Hai điểm mục 7 Plan gốc cần điều chỉnh (đã xác nhận qua khảo sát code thật, không phải suy đoán)

**(a) Vị trí tab "Campaigns":** Mục 7 Plan gốc viết "Tab điều hướng mới Campaigns trong Action Menu" — nhưng sau khi thảo luận trực tiếp với User (đã chốt), Campaigns sẽ là **tab ngang hàng cấp cao nhất** trong `NavbarTabs.js` (như Candidates/Jobs & Clients/Search Menu), route riêng `/campaigns`, KHÔNG nằm lồng trong Action Menu (`/`). Xem mục 1 dưới đây.

**(b) `ActivityLogPanel` không phù hợp cho Run History:** Đã đọc trực tiếp `src/components/ActivityLogPanel.js` — component này được thiết kế riêng cho luồng ghi chú phỏng vấn của Candidate/Application (props `applicationId`, `currentStage`, `logs: {action_type, note, action_date, result, reason_failed}`, có sẵn form Add/Edit/Delete note). Dữ liệu `campaign_runs`/`campaign_run_items` và `warm_join_runs`/`warm_join_run_items` có shape hoàn toàn khác (`status`, `stats` jsonb, `summary`, danh sách item với `group_name`/`fb_account_id`/`status`) và đây là **báo cáo chỉ đọc** (read-only report), không phải activity log có thể sửa/xoá ghi chú. Ép dùng chung `ActivityLogPanel` sẽ phải map méo dữ liệu qua props sai ngữ nghĩa — vi phạm đúng tinh thần "dễ tuỳ chỉnh hơn đẹp nhưng cứng" của mục 1.4 GEMINI.md. Thay vào đó: viết 1 bảng expandable-row **mới, nhỏ, đơn giản** (mục 4 dưới đây) — chỉ tái dùng các class Tailwind/badge màu đã có trong `ActivityLogPanel.js` (ví dụ style badge Pass/Fail → áp dụng tương tự cho Sent/Failed/Checkpoint) để giữ đồng bộ hình ảnh, không tái dùng component.

---

## 1. `src/app/NavbarTabs.js` — Thêm Tab "Campaigns"

Thêm 1 `<Link href="/campaigns">` thứ 5, đúng khuôn 4 tab hiện có (copy nguyên cấu trúc `className` động theo `isActive`, chỉ đổi icon và label). Icon: `Megaphone` (import thêm từ `lucide-react`). Label: "Campaigns". Active state: `pathname.startsWith("/campaigns")`.

---

## 2. `src/app/campaigns/page.js` — Layout Tổng Thể

Trang có 2 tab con cấp cao nhất (dùng lại pattern tab nội bộ đã có ở `/jobs` nếu có, hoặc 1 hàng nút đơn giản kiểu `NavbarTabs` thu nhỏ — không viết control tab mới nếu `/jobs` đã có sẵn 1 cái, kiểm tra trước khi viết):
- **Tab "Campaigns"** (mặc định) — mục 2.1.
- **Tab "FB Accounts"** — mục 2.2.

### 2.1. Sub-tab "Campaigns"

**Bảng Master** (dùng lại bố cục bảng có Fixed Header + scroll đã dùng ở `/jobs`/`/candidates`, không viết bảng từ đầu): cột **Campaign Name**, **Channel**, **Job** (liên kết, click mở `/jobs?job_id=...`), **Status** (badge — map màu: `Draft`=slate, `Ready`=sky, `Running`=amber (có thể thêm icon xoay nhỏ `Loader2 animate-spin` cỡ 12px cạnh badge, đây KHÔNG phải animation trang trí mới mà là chỉ báo trạng thái thực — được phép theo đúng tinh thần mục 1.4 chỉ cấm hiệu ứng không phục vụ mục đích), `Paused`=zinc), **Target Groups** (đếm số dòng `campaign_social_groups`), **Last Run** (badge trạng thái run gần nhất + thời gian tương đối kiểu "2h ago" — dùng lại hàm format thời gian tương đối nếu đã có trong `src/lib/utils.js`, không viết hàm mới), **Total Sent** (rollup `SUM` từ `campaign_run_items` status=Sent, tính trong `getCampaigns()` đã có ở PHẦN 3 — nếu hàm hiện tại chưa trả field này, đây là 1 trong số ít trường hợp UI cần Claude bổ sung nhỏ vào Server Action, hỏi Claude trước khi tự sửa).

Nút **"Run Campaign"** trên mỗi dòng (hoặc trong Detail Panel) — **disable khi `status === 'Running'`**. Bấm vào → **KHÔNG gọi `triggerCampaignRun` trực tiếp** — mở Modal Preview & Dispatch Breakdown (mục 3).

**Click 1 dòng → Detail Panel mở bên dưới** (tái dùng đúng cơ chế Action Timeline / expand panel đã dùng ở `/candidates` hoặc `/jobs` — kiểm tra file đó trước khi viết để copy đúng pattern show/hide + style), có 2 tab con:
- **Overview**: hiển thị `content` (textarea readonly hoặc input tuỳ form edit), `target_criteria`, `start_date`/`end_date`, và **danh sách Social Groups mục tiêu** dạng bảng có checkbox chọn/bỏ chọn — copy nguyên style checkbox từ `PendingCVClientWrapper.js` dòng ~482-486: `className="w-3.5 h-3.5 rounded border-slate-700 bg-slate-900 text-emerald-500 focus:ring-0 focus:ring-offset-0 cursor-pointer"`, gọi `setCampaignTargetGroups(campaignId, groupIds[])` khi lưu. Mỗi dòng group hiển thị thêm badge `Join Status` (mục 5).
- **Run History**: bảng expandable-row mới (mục 4), data từ `getCampaignRunDetail`/`getCampaignDetail` (đã có ở PHẦN 3).

### 2.2. Sub-tab "FB Accounts"

Cũng có 2 tab con cấp 2:
- **Accounts**: bảng CRUD — cột Tên, `account_ref`, `fb_profile_url` (link), Proxy (hiển thị `maskProxyUrl()` kết quả từ `getFbAccounts()` — đã che sẵn ở PHẦN 3, UI chỉ hiển thị nguyên giá trị trả về, KHÔNG tự ý giải mã/unmask thêm ở client), Quota, **Status** — dùng `Select` component copy nguyên từ `PendingCVClientWrapper.js` (import `Select, SelectContent, SelectItem, SelectTrigger, SelectValue` từ `src/components/ui/select`, xem ví dụ dòng ~529-538), đúng 5 option: `Active`, `Cooldown`, `Restricted`, `Checkpoint`, `Inactive`. Click 1 dòng mở form sửa (modal hoặc panel — chọn 1 trong 2 theo pattern đã dùng cho Client/Job edit, không tạo pattern thứ 3) gọi `getFbAccountDetail(id)` để lấy giá trị đã giải mã đầy đủ (proxy_url/notes) CHỈ trong form sửa này, không hiển thị ở bảng danh sách. Gán groups đã join: checkbox multi-select, style giống mục 2.1.
- **Warm & Join History**: bảng expandable-row mới, cùng loại component với Run History ở mục 2.1 nhưng bind data từ `getWarmJoinRuns()`/`getWarmJoinRunDetail()` — style/behavior giống hệt, chỉ khác cột dữ liệu (`warm_join_run_items` có `action`: `Warmed/JoinRequested/AutoAnswered/Joined/Failed/Checkpoint` thay vì `status`).

---

## 3. Modal "Preview & Dispatch Breakdown" (thay Telegram, theo mục 11.6 Plan)

Component mới, ví dụ `src/app/components/CampaignDispatchPreviewModal.js`. Luồng:
1. User bấm "Run Campaign" → gọi `computeCampaignDispatchPreview(campaignId)` (đã có PHẦN 3) → mở modal hiển thị kết quả.
2. Nội dung modal: nội dung bài viết + ảnh (`content`/`post_image_url` của campaign, chỉ đọc), bảng dispatch: mỗi dòng = 1 group + tên account FB được gán (`dispatch[]` trả về từ `computeCampaignDispatchPreview`), có checkbox tích/bỏ tích từng dòng (mặc định tất cả được tích) — copy style checkbox mục 2.1. Hiển thị `stats` (bao nhiêu group được dispatch, bao nhiêu bị skip và lý do — `skippedRecentlyCount`/`skippedNoUrlCount`/`skippedNoAccountAvailable`) ở đầu modal dạng text đơn giản, không cần biểu đồ.
3. Nút **"🚀 Confirm & Start Posting"**: lấy danh sách các dòng còn được tích, gọi `triggerCampaignRun(campaignId, confirmedDispatch)` (đã có PHẦN 3.1, tự re-validate lại phía server nên không cần validate gì thêm ở client). Loading state trong lúc chờ (nút disable + spinner nhỏ), đóng modal khi thành công, hiển thị lỗi inline nếu `triggerCampaignRun` trả `success: false` (ví dụ trường hợp toàn bộ dispatch bị invalidate — xem PHẦN 3.1).
4. Nút **"✕ Cancel"**: đóng modal, không gọi gì.
5. KHÔNG thêm animation mở/đóng modal cầu kỳ — dùng đúng pattern modal đơn giản đã có trong app (kiểm tra modal Client/Job hiện có để copy style overlay + đóng khi click ngoài).

---

## 4. Bảng Expandable-Row Mới Cho Run History (dùng chung layout cho cả Campaign Run History và Warm & Join History)

Component nhỏ, ví dụ `src/app/components/RunHistoryTable.js`, nhận props tổng quát để dùng được cho cả 2 nơi:
- `runs` (array — `campaign_runs[]` hoặc `warm_join_runs[]`)
- `statusField` (tên field trạng thái: `'status'` cho cả 2 loại — giữ đơn giản)
- `getItemsForRun(runId)` (async function trả về `campaign_run_items[]` hoặc `warm_join_run_items[]` khi user bấm mở rộng 1 dòng — lazy-load, không tải hết items của mọi run cùng lúc)

Mỗi dòng hiển thị: `started_at`/`completed_at` (định dạng giờ VN, dùng hàm format có sẵn), badge `status` (`Running`=amber+`Loader2 animate-spin`, `Completed`=emerald, `Failed`=rose, `PartialSuccess`=amber — copy cách style badge Pass/Fail trong `ActivityLogPanel.js` làm mẫu màu, không import component đó), `summary` rút gọn (truncate, hiện đầy đủ khi hover title). Bấm vào dòng → mở rộng hiện bảng con `items` (group/account/status mỗi dòng), và nếu `run.stats.droppedItems` có dữ liệu (từ PHẦN 3.1) thì hiện thêm 1 khối nhỏ "⚠️ N nhóm bị loại khi xác nhận" liệt kê lý do (`group_removed_or_inactive`/`cooldown_24h`/`account_not_active`/`quota_exceeded`) — đây chính là báo cáo debug mà User đã yêu cầu ngay từ đầu ("lưu trữ báo cáo lượt chạy để tiện fix bug trong tương lai").

---

## 5. Badge `Join Status`

Dùng ở 2 chỗ: bảng chọn Target Groups (mục 2.1 Overview) và bảng Accounts groups-joined (mục 2.2). 5 màu cố định, tái dùng inline (không cần tách hàm riêng nếu chỉ dùng object map đơn giản):
- `Not Joined` → slate
- `Pending Approval` → sky
- `Joined` → emerald
- `Needs Custom Answer` → **amber, đậm hơn các badge khác, có icon `AlertTriangle` nhỏ** (đây là loại cần User chú ý ngay, đúng yêu cầu mục 7 Plan gốc)
- `Manual Join Only` → zinc

Nếu `join_status === 'Needs Custom Answer'`, badge có thể click để mở nhanh 1 input nhỏ điền `custom_join_answer` (gọi `updateSocialGroupJoinAnswer` đã có PHẦN 3) — không bắt buộc phải là modal riêng, 1 popover nhỏ là đủ.

---

## 6. Yêu cầu bắt buộc khác

- Toàn bộ text UI bằng tiếng Anh (đúng Rule 5 đã có trong `GEMINI.md`/devlog trước — kiểm tra style hiện có của `/jobs`/`/candidates` để đồng bộ).
- Không hardcode màu badge trùng lặp rải rác nhiều nơi — nếu cần, gom vào 1 object map ở đầu file page hoặc file constants đã có (`src/constants/enums.js` nếu phù hợp), không tạo file constants mới riêng cho campaign nếu chưa thật cần thiết.
- Test dữ liệu cô lập theo mục 10.8 GEMINI.md (test trên `sandbox`, dùng campaign/account giả).

## 7. Báo cáo hoàn thành
Bắt buộc mở đầu bằng đúng 1 trong 2 dòng: "⚠️ Sai lệch so với spec: ..." hoặc "✅ Không có sai lệch so với spec" (mục 10.7 GEMINI.md).
