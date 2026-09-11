# QA REPORT — Xác Nhận Vá Đầy Đủ Execution 478 (Backfill + Callback UUID + Xác Thực RunId)

**Từ:** Claude (Architect/QA)
**Ngày:** 2026-09-05
**Đối chiếu với:** `docs/testing/QA_2026-09-05_campaign-fb-autopost_execution478-untracked-real-joins.md`
**Commit AG:** `2e64732` — DEVLOG ghi tại `SNAP-20260905-87` (lưu ý: DEVLOG ghi nhầm hash `f6cf1e4`, xem Mục 4)

---

## Kết quả: ✅ PASS — cả 3 phần (A/B/C) đều đúng, đã verify lại bằng dữ liệu thật trong `sandbox` + đọc trực tiếp code + n8n workflow definition

## 1. Phần A — Backfill dữ liệu execution 478: ĐÚNG 100%, khớp chính xác từng ID

Query lại `sandbox` xác nhận:
- Cả 4 nhóm (`01a07018-9aab-99ee-...`, `...caac-...`, `...ec2e-...`, `...4220-...`) đều đã `join_status = 'Joined'`, với `last_posted_account_id` khớp đúng tài khoản đã join thật (`acc_02` cho 2 nhóm đầu, `acc_01` cho 2 nhóm sau) — đúng 1-1 với bảng trong report gốc.
- `sandbox.fb_account_groups` hiện có đủ 6 dòng: 2 dòng cũ (backfill `SNAP-83`, `joined_at` 07:34:29) + 4 dòng mới (execution 478, `joined_at` 15:14:11) — không thiếu, không thừa, không trùng.
- `sandbox.fb_accounts.last_warmed_at` của cả `acc_01` và `acc_02` đã cập nhật đúng `2026-09-05 15:14:11Z` — đúng mốc thời gian VPS Bridge hoàn tất ở execution 478.
- `sandbox.warm_join_runs` hiện 0 dòng (không có run nào — kể cả các run test trước đó, có thể đã bị dọn hoặc chưa từng ghi) — xác nhận **không có run nào đang kẹt ở trạng thái `Running`**, nên guard `already_running` sẽ không chặn nhầm lượt cron 08:30 sáng mai.

## 2. Phần B — Callback route (`warm-join-run-callback/route.js`): ĐÚNG, xử lý đúng cả 2 lớp rủi ro đã nêu

Đọc trực tiếp diff `8684486..2e64732`:
- Thêm `UUID_REGEX` + `isValidUUID()`, validate `runId` trước khi dùng.
- Khi `runId` không hợp lệ (kể cả không có), thay vì UPDATE (dẫn tới lỗi cú pháp UUID như execution 478), code giờ luôn **tạo mới 1 dòng `warm_join_runs` hợp lệ** để nhận toàn bộ dữ liệu — khác một chút so với đề xuất ban đầu của Claude (tách rời 2 luồng ghi nhận) nhưng đạt đúng mục tiêu: không còn khả năng mất dữ liệu do lỗi cú pháp UUID.
- `fbAccountId`/`socialGroupId` của từng item cũng được validate UUID riêng trước khi dùng trong `INSERT`/`UPDATE` — loại trừ khả năng 1 item lỗi làm hỏng cả transaction.
- Đổi `ON CONFLICT DO NOTHING` → `ON CONFLICT (fb_account_id, social_group_id) DO UPDATE SET joined_at = EXCLUDED.joined_at` cho `fb_account_groups` — hợp lý hơn (cập nhật lại thời điểm join gần nhất thay vì bỏ qua).
- `fb_accounts.last_warmed_at` cập nhật qua `touchedAccountIds`, không phụ thuộc `runId` — đúng như mong muốn.

## 3. Phần C — Xác thực `runId` tại `warm-join-data/route.js` + n8n: ĐÚNG, đóng đúng lỗ hổng thiết kế đã nêu

Đọc trực tiếp diff + `get_workflow_details` (full) xác nhận:
- Route giờ bắt buộc query param `?runId=`, validate UUID (400 nếu thiếu/sai định dạng), tra `warm_join_runs` (404 nếu không tồn tại, 409 nếu không ở trạng thái `Running`) — chỉ trả dữ liệu tài khoản/nhóm khi xác minh được run thật đang chạy.
- Node n8n `Fetch Warm Data from ATS 3.0` đã được cập nhật `sendQuery: true` với `queryParameters: [{name: "runId", value: "={{ $json.runId }}"}]` (xác nhận qua `get_workflow_details`, `updatedAt` mới nhất khớp thời điểm commit).
- **Đã trace toàn bộ luồng để đảm bảo không phá vỡ 2 nhánh hợp lệ:**
  - Nhánh cron: `warm-join-cron-register` gọi `_acquireWarmJoinRunLock()` → tạo `warm_join_runs` với `status = 'Running'` NGAY LẬP TỨC (đọc trực tiếp code, dòng INSERT có literal `'Running'`) → trả `runId` thật → `Prepare Cron Context` truyền đúng `runId` này → `Fetch Warm Data` gọi với `runId` hợp lệ, đang `Running` → **200 OK, không bị chặn nhầm.**
  - Nhánh UI (`triggerWarmJoinRun`): cũng gọi `_acquireWarmJoinRunLock()` trước khi dispatch webhook, cùng cơ chế tạo run `'Running'` — **cùng kết luận, không bị chặn nhầm.**
  - Nhánh "gọi tay webhook với `runId` giả" (kịch bản gây ra execution 478): giờ sẽ nhận **400 (nếu không phải UUID) hoặc 404 (nếu là UUID nhưng không tồn tại)** ngay tại bước `Fetch Warm Data`, dừng lại TRƯỚC KHI chạm VPS Bridge — không còn khả năng kích hoạt hành động thật trên tài khoản Facebook thật bằng cách này nữa.
- Kết luận: lỗ hổng thiết kế đã được đóng đúng, không có tác dụng phụ lên 2 luồng vận hành thật.

## 4. [Nhỏ, không khẩn] Vẫn còn thói quen ghi sai/ghi placeholder commit hash trong DEVLOG

- `SNAP-20260905-87` ghi `Git \`f6cf1e4\`` — hash này **không tồn tại** trong lịch sử git (`git log --all --oneline` không có). Hash thật của commit này là `2e64732`.
- Đây là lần thứ 2 xảy ra hiện tượng này trong phiên làm việc hôm nay (lần trước là `7c7dcf4` cho cả `SNAP-83` và `SNAP-84`, Claude đã tự sửa lại đúng ở lượt QA trước). Ngoài ra vẫn còn 2 dòng "- Commit: 7c7dcf4" cũ trong phần chi tiết (`### [2026-09-05 23:00]` và `### [2026-09-05 23:20]`) chưa được cập nhật — không ảnh hưởng chức năng, chỉ ảnh hưởng tính chính xác lịch sử. Đề xuất AG dùng `git log --oneline -1` thật để lấy hash trước khi ghi log, thay vì gõ tay/dùng placeholder.

## Kết luận chung

Cả Phần A, B, C đều đã được xử lý đúng và đầy đủ theo đúng khuyến nghị. Không còn rủi ro dữ liệu hay bảo mật nào tồn đọng từ phát hiện execution 478. An toàn để lượt cron 08:30 sáng mai chạy bình thường.

**Verify:** đọc trực tiếp `git diff 8684486 2e64732` cho cả 2 route, `mcp__n8n__get_workflow_details` (full) đối chiếu node `Fetch Warm Data from ATS 3.0`, đọc trực tiếp `_acquireWarmJoinRunLock`/`triggerWarmJoinRun`/`warm-join-cron-register` để trace toàn bộ luồng runId, Supabase MCP (query read-only đối chiếu đủ 4 nhóm + 6 dòng `fb_account_groups` + `last_warmed_at` + 0 dòng `warm_join_runs` đang kẹt) — không chạy code/DDL/DML nào.
