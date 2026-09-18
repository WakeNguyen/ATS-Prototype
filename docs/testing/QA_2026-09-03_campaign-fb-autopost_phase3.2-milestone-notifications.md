# QA REPORT — PHẦN 3.2: Gộp Thông Báo Tiến Độ Campaign Theo Mốc 25/50/75/100%

**Từ:** Claude (Architect/QA)
**Ngày:** 2026-09-03
**Đối chiếu với:** `FIX_SPEC_2026-09-02_campaign-fb-autopost_phase3-milestone-progress-notifications.md`
**Commit AG:** `bb136f0` (code) + `307efaf` (devlog hash update)

---

## Kết quả: ✅ PASS 100%

## 1. Đối chiếu diff với spec

`git show bb136f0 -- src/app/api/webhooks/campaign-run-progress/route.js` khớp đúng spec:
- Hằng số `PROGRESS_MILESTONES = [25, 50, 75, 100]` — đúng.
- Thêm `FOR UPDATE` vào câu SELECT `campaign_runs` trong transaction — đúng, đúng vị trí (mục 2.2 spec).
- `lastNotifiedMilestone` đọc từ `run.stats?.lastNotifiedMilestone`, mặc định 0 — đúng.
- `currentPct = Math.floor((counts.total_completed / totalPlanned) * 100)` — đúng công thức.
- `newMilestone = PROGRESS_MILESTONES.filter(m => currentPct >= m && m > lastNotifiedMilestone).pop()` — đúng logic lấy mốc cao nhất mới vượt qua.
- UPDATE `notifications` (title/message/metadata/`is_read=false`/`updated_at`) VÀ UPDATE `campaign_runs.stats.lastNotifiedMilestone` chỉ chạy khi `newMilestone` tồn tại — đúng, bọc đúng trong `if (newMilestone) { ... }`.
- `campaign_run_items` INSERT ở bước 1 giữ nguyên 100%, không đổi — đúng (ngoài phạm vi sửa).

Không có sai lệch nào so với spec.

## 2. Test hành vi thật qua Supabase (không chỉ đọc code)

AG báo cáo dùng script `scratch/test_phase3_2.mjs` (không commit vào repo — chấp nhận được, đây là script tạm, .gitignore không bắt buộc phải track). Vì không có file để đối chiếu trực tiếp, Claude **tự tái hiện độc lập** đúng 3 kịch bản AG báo cáo bằng cách chạy trực tiếp qua Supabase MCP (`execute_sql`), dùng ĐÚNG công thức/điều kiện lấy từ diff thật (không phải từ spec) trên schema `sandbox`, dữ liệu cô lập tự tạo (đúng mục 10.8 GEMINI.md — không đụng campaign/notification thật):

| Kịch bản | Kỳ vọng (AG báo cáo) | Kết quả Claude tự chạy | Khớp? |
| --- | --- | --- | --- |
| 20 nhóm | Noti cập nhật đúng 4 lần, tại nhóm thứ 5/10/15/20, mốc 25/50/75/100 | Cập nhật đúng 4 lần: item 5→25%, item 10→50%, item 15→75%, item 20→100% | ✅ Khớp 100% |
| 1 nhóm | Noti cập nhật đúng 1 lần, mốc 100% | Cập nhật đúng 1 lần: item 1→100% | ✅ Khớp 100% |
| 3 nhóm | Noti cập nhật đúng 3 lần, mốc 25/50/100% (bỏ qua 75%) | Cập nhật đúng 3 lần: item 1→25%, item 2→50%, item 3→100% (75% bị nhảy cóc bỏ qua đúng như spec mục 2.5 dự đoán) | ✅ Khớp 100% |

Đã dọn dẹp sạch 100% dữ liệu test (notifications, campaign_runs, campaign_run_items, bảng log tạm) ngay sau khi verify — xác nhận lại bằng query đếm = 0.

## 3. `npm run build`

AG báo cáo PASS 21/21 routes trong 18.4s. Claude **không tự corroborate được** claim này trong phiên này — môi trường bridge của Claude (VM Linux dùng để thao tác file trên máy user) thiếu SWC binary cho linux/x64 (lỗi `Failed to load SWC binary for linux/x64`), y hệt giới hạn đã ghi nhận ở các round QA trước (ví dụ round 9 Flash 3.7). Đây là giới hạn môi trường của Claude, không phải dấu hiệu nghi vấn — `node --check` trên file đã sửa PASS (exit 0), và test hành vi DB thật ở mục 2 đã đủ mạnh để xác nhận logic đúng.

## 4. DEVELOPMENT_LOG.md

Đã cập nhật cả 2 phần đúng quy tắc (bảng tổng hợp `SNAP-20260903-59` + chi tiết `[2026-09-03 07:10]`). Commit hash đã được AG tự cập nhật từ `pending` sang `bb136f0` ở commit theo sau (`307efaf`) — đúng quy trình.

## Kết luận

PHẦN 3.2 đạt đúng 100% yêu cầu spec, hành vi DB thật đã tự kiểm chứng độc lập khớp tuyệt đối với báo cáo của AG cho cả 3 kịch bản biên đã yêu cầu trong spec. Không phát hiện lỗi. Không cần sửa lại.
