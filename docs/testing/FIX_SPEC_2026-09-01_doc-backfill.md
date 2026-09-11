# Fix Spec — 2026-09-01: Dọn dẹp & backfill tài liệu (thuộc phạm vi Antigravity theo GEMINI.md mục 10.1)

**Từ:** Claude (Architect/QA)
**Gửi:** Antigravity (Implementer)
**Bối cảnh:** GEMINI.md mục 10 vừa được cập nhật (commit `94bf336`) để quy định rõ vai trò viết tài liệu của mỗi bên — đọc lại mục 10.1–10.5 trước khi làm spec này. Đây là phần việc dọn dẹp/backfill cụ thể cho các tài liệu thuộc quyền sở hữu của AG (`DEVELOPMENT_LOG.md`, Blueprint, `features/`, `USER_MANUAL_DRAFT.md`) — tôi (Claude) chỉ phát hiện và mô tả chính xác vấn đề, không tự sửa nội dung các file này (đúng nguyên tắc mục 10.1/10.5).

---

## VIỆC 1 [P1] — Sửa 4 chỗ dữ liệu bị hỏng trong `docs/DEVELOPMENT_LOG.md` và `docs/architecture/ATS_3.0_UI_Modernization_Blueprint.md`

Nguyên nhân chung (đã xác định, xem GEMINI.md mục 10.4): một thao tác ghi/append qua PowerShell (`>`, `>>`, `Out-File`) không chỉ định `-Encoding utf8` đã ghi nhầm UTF-16LE vào file UTF-8.

**1a. Ký tự control `\x0b` (dòng ~987):** Ngay trước "3.0-RC75-QA" trong dòng `* **[SNAP-20260831-QA]** ... - \x0b3.0-RC75-QA`. Cần xoá ký tự lạ này, chỉ giữ lại "3.0-RC75-QA".

**1b. Ký tự control `\x07` thế chỗ chữ "a" (dòng ~991-992):** 2 chỗ:
- `"Server Actions (\x07ctions.js)"` → phải là `"Server Actions (actions.js)"`.
- `"bảng \x07ctivity."` → phải là `"bảng activity."`.

**1c. Một đoạn dữ liệu bị hỏng nặng, KHÔNG thể khôi phục nguyên trạng (~2400 byte, ngay sau dòng "Snapshot lưu tại: .backups/20260831_v3.0_QA_fixes/."):** Dòng tiêu đề vẫn đọc được: `### Snapshot SNAP-20260831-DB2 (31/08/2026 11:46) - 3.0-RC76-DB`. Nhưng toàn bộ nội dung phía sau tiêu đề này (mục tiêu, file tác động, v.v. — cho tới ngay trước mục `* **[SNAP-20260831-BIZ]**` kế tiếp) đã bị mất dữ liệu thật (không chỉ là lỗi encoding có thể giải mã lại — có nhiều byte đã bị thay bằng ký tự thay thế U+FFFD, tức dữ liệu gốc đã mất, không phục hồi được bằng cách decode lại).

  **Cách xử lý:** AG là người trực tiếp biết nội dung công việc đã làm lúc 31/08 11:46 (SNAP-20260831-DB2, liên quan `3.0-RC76-DB`) — nếu còn nhớ hoặc có log/lịch sử khác (chat history, commit message quanh thời điểm đó) thì viết lại đúng nội dung. Nếu không chắc chắn, thay đoạn hỏng bằng 1 dòng ghi chú trung thực, ví dụ:
  ```
  ### Snapshot SNAP-20260831-DB2 (31/08/2026 11:46) - 3.0-RC76-DB
  > ⚠️ Nội dung mục này bị mất do lỗi encoding (ghi đè UTF-16LE vào file UTF-8) — không khôi phục được nguyên văn. Xem `git log` quanh thời điểm 31/08/2026 11:00-12:00 để tham khảo các thay đổi code liên quan nếu cần.
  ```
  Không tự bịa nội dung để "điền cho đầy".

**1d. [MỚI phát hiện 01/09/2026 — audit định kỳ mục 10.5] Cùng lỗi `\x07` cũng tồn tại trong `docs/architecture/ATS_3.0_UI_Modernization_Blueprint.md` (dòng ~303-304):** Y hệt lỗi 1b — 2 chỗ chữ "a" bị thay bằng ký tự control `\x07`:
- `"Server Actions (\x07ctions.js)"` → phải là `"Server Actions (actions.js)"`.
- `"bảng \x07ctivity."` → phải là `"bảng activity."`.
(Nhiều khả năng đoạn text này từng được copy giữa 2 file nên mang theo lỗi giống nhau — sửa luôn cả 2 nơi trong cùng lượt.)

**Sau khi sửa cả 4 chỗ (1a-1d):** chạy kiểm tra nhanh (đúng theo GEMINI.md mục 10.4) để xác nhận hết ký tự lạ trước khi lưu — ví dụ mở file bằng công cụ hỗ trợ tìm ký tự không in được, hoặc dùng script kiểm `\x00`, `\x0b`, `\x07` không còn xuất hiện.

---

## VIỆC 2 [P1] — Backfill 2 mục nhật ký còn thiếu vào `docs/DEVELOPMENT_LOG.md`

Theo template bắt buộc ở GEMINI.md mục 10.3, thêm 2 mục sau (đặt theo đúng thứ tự thời gian, sau các mục ngày 31/08 hiện có):

```
### [2026-09-01 05:15] Sửa race condition display_number (SEQUENCE), dedup reuse, bọc transaction cho client-branch
- Viết bởi: Antigravity (Implementer)
- Commit: 7f8854dc9c722be164842a14164ded64dd80c9ea
- Files: src/app/actions.js, scripts/archive/data-mutating-oneoffs/2026-09-01_fix-sequences_display-number.mjs
- Nội dung: Thay COALESCE(MAX(display_number)+1) bằng PostgreSQL SEQUENCE (DEFAULT nextval(...)) cho 4 bảng x 2 schema để tránh trùng display_number khi tạo đồng thời (DB-11/12). checkCandidateContactDuplicate dùng lại đúng cho dedup LinkedIn (DB-18). Bọc sql.begin cho addClientBranch/updateClientBranch để FOR UPDATE có tác dụng thật (DB-10).
- Verify: /api/qa-test DB-11/12 PASS, /api/db-test DB-18 PASS (3/3 lần), DB-10 PASS (3/3 lần liên tiếp).
```

```
### [2026-09-01 13:05] Thêm validate Job title trống (UI-14), validate phone hợp lệ (UI-15), chuẩn hoá định dạng ngày/giờ, component DateInputField dùng chung
- Viết bởi: Antigravity (Implementer)
- Commit: ef85998a7ae3fd0a11396687eaf42143777a9015
- Files: src/app/actions.js, src/app/candidates/page.js, src/app/jobs/page.js, src/app/page.js, src/lib/utils.js, src/components/DateInputField.js (mới), src/components/ui/calendar.jsx (mới), src/components/ui/popover.jsx (mới), package.json, package-lock.json
- Nội dung: createJobForClient chặn job_title rỗng ở server; normalizeContactValue thêm kiểm tra số chữ số thật (8-12) trước khi chấp nhận phone, chặn chuỗi rác kiểu "abc-not-a-phone" bị biến thành "+84" giả. Thêm formatDateVN/formatDateTimeVN (dạng "31 - Aug - 2026 21:52:55") thay cho .toLocaleString() rải rác. Thêm component DateInputField dùng chung (Popover + Calendar từ shadcn/ui base-nova, react-day-picker + date-fns) cho Planning Date và Date of Birth, thay 3 input[type=date] gốc.
- Verify: /api/qa-test 5/5 PASS, /api/db-test 19/20 PASS (1 FAIL là lỗi assertion cũ đã biết, không phải bug), /api/biz-test 22/22 PASS. Xem chi tiết đối chiếu độc lập tại docs/testing/QA_Reverify_2026-09-01_FIX1-4_round4.md.
```

(Sau khi làm xong round 5 — FIX_SPEC_2026-09-01_round5_hydration-and-ui14.md — nhớ backfill thêm 1 mục nữa cho commit đó, cùng lúc, không để dồn tiếp.)

**Cập nhật 01/09/2026 (sau khi GEMINI.md mục 10.6 được thêm):** 2 mẫu trên đã có dòng `- Viết bởi: Antigravity (Implementer)` theo quy tắc mới — dùng nguyên mẫu, không cần sửa thêm. Đồng thời nhớ chạy 1 lần (nếu chưa làm): `git config --local user.name "Antigravity (Implementer)"` và `git config --local user.email "antigravity.implementer@ats-web.local"` trong thư mục repo, để các commit tới của AG tự động đứng tên đúng (lớp 2 của mục 10.6), không cần làm lại mỗi phiên.

---

## VIỆC 3 [P2] — Cập nhật Blueprint đã cũ (`docs/architecture/ATS_3.0_UI_Modernization_Blueprint.md`)

Phát hiện các chỗ lỗi thời:
1. **Dòng 7:** `> **Vị trí lưu trữ:** \`g:\My Drive\AI project\My Porfolio\blue print\ATS_3.0_UI_Modernization_Blueprint.md\`` — đường dẫn G: cũ, dự án đã chuyển hẳn sang `D:\Users\trith\ats-web\docs\architecture\ATS_3.0_UI_Modernization_Blueprint.md` từ 01/09/2026 (đã sửa tương ứng trong GEMINI.md mục 1, commit `94bf336`). Cần sửa lại dòng này cho khớp.
2. **Dòng 5, 25, 52 (và có thể còn chỗ khác — nên `grep -n "Next.js 15"` toàn file để tìm hết):** Ghi "Next.js 15" nhưng `package.json` thực tế đang là `next: "16.3.0"`. Cần cập nhật đúng phiên bản.
3. **Dòng 4 (`Phiên bản: v3.0-RC77`) và mục Changelog (~dòng 280):** Đã có nhiều thay đổi từ sau RC77 (các fix ngày 01/09: display_number sequence, dedup, client-branch transaction, UI-14/15, date format, DateInputField). AG tự quyết định số hiệu version mới phù hợp với quy ước đang dùng và thêm entry changelog mô tả các thay đổi này (tham khảo nội dung Việc 2 ở trên).

---

## VIỆC 4 [P2] — Rà soát `docs/features/*.md` và `docs/USER_MANUAL_DRAFT.md` xem có lỗi thời không

Cả 5 file này đều có mtime từ 30/08 (`action-menu.md`, `candidates-hub.md`, `jobs-clients-workbench.md`, `search-menu.md`, `USER_MANUAL_DRAFT.md`) — chưa được cập nhật qua các thay đổi ngày 01/09 (UI-14/15, định dạng ngày/giờ mới, DateInputField cho Planning Date & Date of Birth). Đề nghị AG đọc lại và cập nhật các phần liên quan tới:
- Cách hiển thị Planning Date (Action Menu, Jobs Workbench) và Date of Birth (Candidates Hub) — nay dùng date picker, hiển thị dạng "dd - MMM - yyyy" thay vì input ngày trần.
- Cách hiển thị timestamp (Action Note, Activity Log) — nay dùng "31 - Aug - 2026 21:52:55" thay vì `.toLocaleString()` mặc định.
- Hành vi khi tạo Job Order với tên trống (nay có thông báo, sau khi Fix A ở round 5 hoàn tất).
- Hành vi validate số điện thoại (nay từ chối chuỗi không đủ 8-12 chữ số thật).

Không cần làm gấp — có thể gộp chung 1 lượt cập nhật sau khi round 5 xong, miễn là không để quá lâu (đúng tinh thần GEMINI.md mục 10.2).

---

## Yêu cầu báo cáo

Sau khi làm xong (ít nhất Việc 1 + 2, là P1), dán lại NGUYÊN VĂN:
1. `git diff` đầy đủ của `docs/DEVELOPMENT_LOG.md` VÀ `docs/architecture/ATS_3.0_UI_Modernization_Blueprint.md` (vì Việc 1d nằm trong file Blueprint).
2. Xác nhận đã kiểm tra hết ký tự lạ (`\x00`, `\x0b`, `\x07`) trong cả 2 file sau khi sửa.
3. Nếu có làm Việc 3/4 trong cùng lượt, dán thêm diff tương ứng.

Không tự kết luận "hoàn thành" — chỉ đưa bằng chứng thô, tôi sẽ tự xác nhận độc lập.
