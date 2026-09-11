# QA_2026-09-06 — Thẩm định độc lập Phase 5 (Quota Selector/Accounts Joined UX) & Phase 6 (Workflow D Auto-Sync Engine)

**Người QA**: Claude (Architect/QA).
**Phạm vi thẩm định**: Commit `aa87f47` (+ `fff40bd` cập nhật doc), Workflow n8n `L8QdckqW7FDwanRq` (C) và `EMAUfa5HCgyf6yPO` (D).
**Phương pháp**: Đọc trực tiếp diff code (`git diff`), query trực tiếp Supabase MCP (schema thật + row count thật), đọc trực tiếp n8n MCP (`get_workflow_details` — cả bản draft LẪN bản active), đọc script test tự động của AG (`scripts/archive/test-phase6-webhooks.mjs`) — không dựa vào báo cáo tóm tắt của AG.

---

## KẾT LUẬN NGẮN GỌN

- **Phase 6 (Workflow D)**: ✅ **PASS**. Code khớp sát đặc tả FIX_SPEC, đã áp dụng đúng schema (`public` + `sandbox`), 4/4 test tự động PASS, Workflow D đúng như thiết kế và đang `active: false` (đúng quy trình — sẵn sàng để User bấm Publish sau khi đọc QA này). Không phát hiện lỗi chặn.
- **Phase 5 (Quota Selector / Accounts Joined UX)**: ⚠️ **PASS CÓ ĐIỀU KIỆN — 1 PHÁT HIỆN CHẶN (BLOCKING)**. Toàn bộ code (backend + UI) đã đúng, nhưng **workflow n8n C đang chạy production (`active: true`, cron 08:30/12:30/20:30) chưa được Publish lại sau khi AG sửa** — bản ĐANG CHẠY THẬT vẫn là code CŨ, hoàn toàn bỏ qua tính năng Max Groups Quota Selector. Xem mục 2.1 bên dưới — cần User tự Publish trong n8n UI thì tính năng mới thực sự có hiệu lực.

---

## 1. PHASE 6 — WORKFLOW D (Per-Account Mutex Lock + Dynamic Jitter Scheduler)

### 1.1. Migration DB — xác nhận qua Supabase MCP (`information_schema.columns`, `pg_tables`)
- ✅ `warm_join_runs.account_ids` (uuid[]) đã tồn tại trên `public`.
- ✅ Bảng `group_membership_sync_runs`, `group_membership_sync_schedule` đã tồn tại trên `public`, đúng cấu trúc cột như FIX_SPEC.
- ✅ RLS đã bật (`rowsecurity = true`) trên cả 2 bảng mới VÀ 4 bảng CRITICAL đã báo trước đó (`notifications`, `pending_cv_imports`, `cv_import_batches`, `cv_import_batch_items`) — AG đã tự giác xử lý luôn phát hiện RLS ngoài phạm vi yêu cầu, đã verify REVOKE + ENABLE ROW LEVEL SECURITY đúng qua script `scripts/archive/apply-phase6-migrations.mjs`. Vì app luôn kết nối bằng role `postgres` (superuser, bypass RLS) nên REVOKE trên `anon`/`authenticated` không ảnh hưởng hành vi ứng dụng — an toàn.
- ⚠️ **Nitpick không chặn**: 2 bảng mới dùng `id uuid DEFAULT gen_random_uuid()` thay vì `uuid_generate_v7()` như 100% các bảng còn lại của dự án (quy ước đã ghi trong Blueprint mục 3: "100% Primary Keys id... sử dụng chuẩn UUIDv7"). Không gây lỗi chức năng, chỉ lệch quy ước (id không sort theo thời gian tạo). Có thể sửa sau nếu muốn đồng bộ, không khẩn cấp.

### 1.2. Code — `_getBusyFbAccountIds`, 4 route webhook
- ✅ `_getBusyFbAccountIds` (`campaign_actions.js` dòng 1406) khớp đúng thiết kế FIX_SPEC — UNION đúng 3 nguồn (Job Posting qua `campaign_fb_accounts JOIN campaign_runs`, Warming qua `account_ids`, chính Workflow D qua `account_ids`), export đúng để route `group-membership-sync-data` import dùng được.
- ✅ `_acquireWarmJoinRunLock` đã ghi `account_ids` vào `warm_join_runs` — áp dụng cho CẢ đường UI trigger lẫn cron (dùng chung 1 hàm) — không có lỗ hổng bỏ sót đường cron.
- ✅ 4 route (`schedule-roll`, `claim-schedule`, `data`, `callback`) khớp gần như nguyên văn code mẫu trong FIX_SPEC, kể cả đã tự sửa đúng lỗi `checkpoint` regex mà bản nháp gốc của Claude viết sai (Claude tự phát hiện và đã sửa trước khi giao spec — AG implement đúng bản đã sửa).
- ✅ `normalizeSocialGroupUrl` tách ra `src/lib/url_utils.js` (thay vì export thẳng từ `campaign_actions.js` như spec gợi ý) — lựa chọn kiến trúc TỐT HƠN đề xuất gốc của Claude (tách đúng Data Access Layer), giữ 1 nguồn duy nhất, `campaign_actions.js` giữ 1 hàm `async` mỏng gọi lại để không phá vỡ chỗ gọi cũ (`bulkImportSocialGroups`). Không có logic trùng lặp.

### 1.3. n8n Workflow D (`EMAUfa5HCgyf6yPO`) — đọc trực tiếp qua n8n MCP
- ✅ Đúng cấu trúc 2 nhánh độc lập: "Daily Schedule (00:05)" → roll 2 mốc giờ → `POST schedule-roll`; và "Poll Schedule (Every 5 mins)" → `POST claim-schedule` → IF claimed → `GET sync-data` → IF có account → gọi VPS Bridge `facebook-sync-joins` → `POST callback`.
- ✅ Toàn bộ HTTP node dùng đúng credential đã có sẵn (`Je1dHcRXyZhrXODl`, `wQ16G6l04h4gP5wF`), đúng hostname `ats-local.thucnguyen8n.space` (không dùng hostname lỗi thời).
- ✅ Nhánh IF false (chưa đến giờ / không có account rảnh) không nối node nào tiếp theo → tự kết thúc êm, KHÔNG gọi callback rỗng — đúng khuyến nghị PHẦN 5 của spec.
- ✅ `active: false` — ĐÚNG quy trình, chưa bị publish nhầm.
- ✅ Script Playwright `scripts/sync-group-memberships.js` (mới) + route bridge `/api/facebook-sync-joins` (`bridge-server.js`) khớp đúng field `joinedGroupUrls` mà route callback kỳ vọng. Có xử lý Checkpoint detection, cleanup browser trong `finally`, lưu lại `storageState` sau khi quét — nhất quán pattern với `warm-and-join.js` đã có.

### 1.4. Test tự động của AG (`scripts/archive/test-phase6-webhooks.mjs`) — đọc trực tiếp source, đối chiếu devlog
- Chạy trên schema `sandbox`, có dọn dữ liệu test sau khi xong (đúng Rule 10.8).
- 4 test khớp đúng 4 kịch bản PHẦN 5 của FIX_SPEC: (1) Schedule Roll idempotent, (2) Claim Schedule atomic (`FOR UPDATE SKIP LOCKED`), (3) Sync Data mutex lock (gọi lần 2 bị `already_running`), (4) Callback idempotent + xử lý URL không khớp đúng (`unmatchedCount`).
- Devlog `SNAP-20260906-96` xác nhận "4/4 webhook tests PASS, build 26/26 routes PASS 100%" — khớp với những gì đọc được trong code, không có dấu hiệu báo cáo sai lệch.

**Còn thiếu (không chặn, nhưng cần lưu ý)**: Bảng `fb_accounts`/`group_membership_sync_runs`/`group_membership_sync_schedule` trên `public` hiện đang 0 dòng (môi trường sạch) — nghĩa là CHƯA có lượt chạy Workflow D thật nào với dữ liệu/tài khoản thật. Đề nghị giám sát chặt lượt chạy cron/manual đầu tiên sau khi Publish, giống cách đã làm với Workflow A.

---

## 2. PHASE 5 — QUOTA SELECTOR, ACCOUNTS JOINED UX, RUN HISTORY COLORS

### 2.1. 🔴 PHÁT HIỆN CHẶN: n8n Workflow C chưa Publish lại — tính năng Quota Selector CHƯA có hiệu lực thật

Đọc `get_workflow_details` cho Workflow C (`L8QdckqW7FDwanRq`, đang `active: true`, cron thật `30 8,12,20 * * *`) trả về **2 phiên bản khác nhau**:

- **Bản DRAFT** (chưa publish): node "Validate Internal Secret" đã đọc `maxGroupsPerAccount` từ payload; node "Smart Group Allocator & Dispatcher" đã sửa đúng thành vòng lặp phân bổ ĐỘC LẬP theo từng account (`for (const candGroup of eligibleGroups) { if (assignedForThisAcc.length >= maxGroupsPerAccount) break; ... }`) — khớp đúng ví dụ Nick A/B trong Blueprint Trụ cột 7.
- **Bản ACTIVE** (đang thực sự chạy cron thật ngay lúc này): node "Validate Internal Secret" **KHÔNG có** `maxGroupsPerAccount`; node Allocator vẫn dùng logic CŨ — 1 con trỏ (`groupCursor`) DÙNG CHUNG cho mọi account, luôn giới hạn cứng 2 nhóm/account, và vẫn lọc theo `g.join_status !== 'Joined'` (cột đơn, không đúng cho multi-account nữa).

**Hệ quả thực tế**: Modal "Max Groups Per Account" trên UI (dù code React đúng, gửi đúng `maxGroupsPerAccount` xuống Server Action) **hoàn toàn không có tác dụng** cho tới khi ai đó bấm Publish bản draft trong n8n UI — vì n8n luôn thực thi bản ACTIVE khi có webhook/cron gọi tới, không phải bản draft đang sửa. Đây là lỗi "quên publish" giống hệt kiểu sự cố Claude từng nhắc AG kiểm tra trước đây (verify qua `get_workflow_details`, không chỉ tin đã sửa xong).

**Đề xuất**: Sau khi User xem qua bản draft (nội dung draft đọc được ở trên là ĐÚNG, không cần sửa gì thêm) và thấy ổn, User tự bấm Publish version mới nhất của Workflow C trong n8n UI. Không có rủi ro dữ liệu khi publish — cron tiếp theo (nếu trúng giờ) sẽ dùng logic mới đúng như Phase 5 mô tả. Vì Workflow C đang chạy cron thật, đề nghị User publish vào lúc không cận giờ cron (tránh publish giữa lúc 1 execution khác đang chạy).

### 2.2. Backend `getSocialGroupsLibrary` — Accounts Joined ratio
✅ **Đúng và đúng khuyến nghị chéo Claude đã đưa**: query mới lấy `joined_account_count`, `joined_accounts_list`, `total_active_accounts` từ `fb_account_groups JOIN fb_accounts (status='Active')` — KHÔNG dùng cột đơn `social_group_urls.join_status` làm nguồn tỷ lệ. Đúng thiết kế đa tài khoản.

### 2.3. UI — `JoinStatusBadge.js`, `campaigns/page.js`, `RunHistoryTable.js`
✅ Popover "Accounts Joined" hiển thị danh sách account + ngày join, badge màu theo tỷ lệ (emerald/amber/slate) — đúng tinh thần Trụ cột 8. Quota Selector modal có đủ nút 1/2/3/4/5/Custom + risk badge động — đúng cấu trúc chọn lựa trong Blueprint.

⚠️ **2 điểm lệch nhẹ so với con số đã duyệt trong Blueprint (không chặn, chỉ là sai lệch UX/label so với tài liệu đã ký duyệt)**:
1. Ngưỡng risk badge trong code (`≤2` Safe, `=3` Moderate, `4–5` "Aggressive"/amber, `>5` "High Risk"/rose) KHÔNG khớp bảng đã duyệt trong Blueprint Trụ cột 7 (`1–2` Safe, `3–4` Moderate, `5–10` High Risk, `>10` Critical) — thiếu hẳn mức "Critical" (>10) dù ô Custom cho phép nhập tới 50. Nên thống nhất lại 1 trong 2 (sửa code theo đúng bảng đã duyệt, hoặc cập nhật Blueprint theo code thực tế) để 2 tài liệu không lệch nhau.
2. Ô Custom Input giới hạn cứng `max="50"`, trong khi Blueprint ghi rõ "Tối đa = Tổng số nhóm của Campaign" — hiện tại không có cơ chế lấy đúng tổng số nhóm của campaign để áp trần động. Không gây lỗi (Allocator vẫn tự nhiên bị chặn bởi số nhóm còn thiếu thực tế), chỉ là UI cho phép nhập số lớn hơn ý nghĩa thực.
3. `RunHistoryTable.js`: "Join Requested" và "Needs Answer" đều dùng tông màu amber (chỉ khác độ đậm nhạt bg `amber-500/10` vs `amber-500/20`), trong khi Blueprint mô tả 2 màu tách bạch rõ (Amber-400 riêng cho Join Requested, Cam/Orange riêng cho Needs Answer) — về mặt hình ảnh 2 trạng thái hơi khó phân biệt nhanh bằng mắt.

Không mục nào ở 2.3 chặn việc sử dụng — đây là ghi nhận để AG/User cân nhắc tinh chỉnh nếu muốn khớp đúng 100% tài liệu đã duyệt.

---

## 3. VIỆC CẦN LÀM TIẾP (theo thứ tự ưu tiên)

1. **User tự Publish lại Workflow C** trong n8n UI (mục 2.1) — bắt buộc để Phase 5 thực sự có hiệu lực trên production. Không cần code gì thêm.
2. **User tự Publish Workflow D** trong n8n UI khi sẵn sàng bật cron thật (`EMAUfa5HCgyf6yPO`) — QA đã PASS, không có việc chặn.
3. Theo dõi sát lượt chạy thật đầu tiên của cả Workflow C (bản mới) và Workflow D sau khi publish — mở tab Executions trong n8n ngay lúc chạy, đúng bài học đã rút ra từ Workflow A.
4. (Không khẩn cấp) Cân nhắc đồng bộ lại 2 điểm lệch nhỏ ở mục 2.3, và đổi `gen_random_uuid()` → `uuid_generate_v7()` cho 2 bảng mới nếu muốn giữ đúng 100% quy ước UUIDv7 của dự án.

---

## Tài liệu liên quan
- `docs/testing/FIX_SPEC_2026-09-06_fb-warming_workflow-d-lock-and-scheduler.md`
- `docs/architecture/HANDOVER_2026-09-06_fb-warming-workflow-d-architect-request.md`
- `docs/architecture/BLUEPRINT_2026-09-04_fb-account-warming-and-rotation-strategy.md` — Trụ cột 7, 8, 9.
- Commit `aa87f47`, `fff40bd`. n8n Workflow `L8QdckqW7FDwanRq` (C), `EMAUfa5HCgyf6yPO` (D).

_Viết bởi: Claude (Architect/QA) — 2026-09-06_
