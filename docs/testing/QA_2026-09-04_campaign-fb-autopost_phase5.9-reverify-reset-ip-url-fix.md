# QA Reverify (PHẦN 5.9 — Fix `reset_ip_url`) — 2026-09-04

**Người review:** Claude (Architect/QA) — độc lập với AG (Implementer)
**Đối tượng review:** Commit `1a3e30b` (fix) + `bf28baf` (devlog fixup), tiếp theo sau `6c55213`/`551140d` đã QA ở vòng trước (`docs/testing/QA_2026-09-04_campaign-fb-autopost_phase5.9-modal-group-pickers-scale.md`, verdict CHƯA PASS).

**Kết luận: ✅ PASS trọn gói PHẦN 5.9** (bao gồm cả phần search/pagination gốc đã PASS ở vòng trước + fix `reset_ip_url` lần này).

---

## PHẦN 1 — Đối chiếu diff fix với yêu cầu đã gửi AG

Yêu cầu: xoá dòng `reset_ip_url: ""` khỏi `payload` trong `handleSave` của `FbAccountEditModal.js`, không thêm/sửa gì khác.

`git show 1a3e30b -- src/app/components/FbAccountEditModal.js`: diff **chỉ đúng 1 dòng bị xoá**, đúng dòng `reset_ip_url: ""`, không đụng gì khác trong payload hay phần còn lại của file — khớp 100% yêu cầu, không có thay đổi ngoài phạm vi.

Grep lại toàn file xác nhận không còn bất kỳ chỗ nào khác gán `reset_ip_url` trong `FbAccountEditModal.js`.

## PHẦN 2 — Xác minh độc lập bằng SQL trên Supabase (không dựa vào script/claim test của AG)

Tự tái tạo đúng câu lệnh `UPDATE` thật của `updateFbAccount()` (đọc trực tiếp từ `campaign_actions.js` dòng ~1121-1132) với `reset_ip_url` bị **omit khỏi payload** (đúng hành vi mới sau fix, tương đương `reset_ip_url === undefined` trong JS):

1. Insert 1 dòng test `sandbox.fb_accounts` với `reset_ip_url = 'http://1.2.3.4:9999/qa-reset-test'`.
2. Chạy đúng câu `UPDATE ... SET account_name = COALESCE(...), daily_quota = COALESCE(...), reset_ip_url = CASE WHEN false THEN NULL ELSE reset_ip_url END ...` (điều kiện `false` mô phỏng đúng `reset_ip_url !== undefined` khi field không được gửi lên) — đổi `account_name` và `daily_quota` cùng lúc.
3. Kết quả trả về: `account_name` và `daily_quota` đổi đúng theo giá trị mới, **`reset_ip_url` giữ nguyên `http://1.2.3.4:9999/qa-reset-test`, không bị NULL hoá**.
4. Dọn dẹp: xoá dòng test, xác nhận cả `sandbox.fb_accounts` và `public.fb_accounts` quay về đúng baseline **0 dòng**.

Kết quả khớp chính xác với hành vi mong đợi sau fix — không chỉ tin vào claim của AG mà tự chạy lại đúng logic SQL production trên dữ liệu thật.

## PHẦN 3 — `docs/DEVELOPMENT_LOG.md`

`git show 1a3e30b -- docs/DEVELOPMENT_LOG.md`: cả bảng tổng hợp (`SNAP-20260904-69`, cập nhật mô tả thêm "kèm Fix nhanh reset_ip_url") và mục chi tiết phía dưới đều được cập nhật đầy đủ, mô tả đúng bản chất bug + cách fix + kịch bản test đã chạy (kịch bản 5: set giá trị test, đổi `daily_quota`, xác nhận `reset_ip_url` không đổi — đúng khớp với cách Claude tự verify độc lập ở PHẦN 2). Commit `bf28baf` fix đúng commit hash từ `pending` → `1a3e30b`.

---

## Kết luận cuối cùng

| Hạng mục | Kết quả |
|---|---|
| Search/pagination/merge-known-groups đúng phạm vi spec 5.9 (cả 2 modal) | ✅ PASS (đã QA vòng trước) |
| Fix ngoài phạm vi (campaign_name/account_name/targetGroups load đúng) | ✅ Đã xác minh đúng ở vòng trước |
| Fix `reset_ip_url` — chỉ xoá đúng 1 dòng theo yêu cầu | ✅ Đúng, không có thay đổi ngoài phạm vi |
| Xác minh độc lập qua SQL thật (không dựa claim AG) — `reset_ip_url` được bảo toàn | ✅ Khớp chính xác |
| DEVELOPMENT_LOG.md (bảng tổng hợp + chi tiết + commit hash) | ✅ Đầy đủ, chính xác |
| **Verdict PHẦN 5.9 (trọn gói)** | **✅ PASS** |

## Ghi chú thêm — 1 quan sát ngoài phạm vi QA này (không chặn PASS)

Lúc kiểm tra `git status`, thấy có 1 file untracked mới: `docs/architecture/BLUEPRINT_2026-09-04_fb-account-warming-and-rotation-strategy.md`. Claude chưa đọc nội dung file này — không thuộc phạm vi QA PHẦN 5.9. Lưu ý để User biết: đây có khả năng liên quan đến item 2 ("nuôi nick") mà Claude đã chủ động dừng thiết kế phần hành vi (xem `docs/architecture/HANDOVER_2026-09-04_campaign-fb-autopost_warm-join-account-strategy.md`) — nếu file BLUEPRINT này do AG hoặc ai đó khác tự soạn phần thiết kế hành vi cụ thể, Claude vẫn có thể QA lỗi thuần kỹ thuật cho phần code triển khai sau này (đúng ranh giới đã thống nhất), nhưng sẽ không tự ý đọc/đánh giá nội dung thiết kế hành vi trong blueprint đó trừ khi User yêu cầu.
