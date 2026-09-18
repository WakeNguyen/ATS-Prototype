# QA REPORT — Xác Nhận Fix DateInputField Cho Campaign Start/End Date & New Candidate DOB

**Từ:** Claude (Architect/QA)
**Ngày:** 2026-09-05
**Đối chiếu với:** `docs/testing/FIX_SPEC_2026-09-05_campaign-fb-autopost_start-end-date-missing-datepicker.md`
**Commit AG:** `716bbd5` — DEVLOG ghi tại mục "Đồng Bộ DateInputField..." (lưu ý sai hash, xem Mục 3)

---

## Kết quả: ✅ PASS — cả 2 file đều sửa đúng, khớp chính xác FIX_SPEC, không còn chỗ nào dùng `type="date"`

## 1. `CampaignEditModal.js`

Đọc trực tiếp diff `2e64732..716bbd5`: thêm đúng `import DateInputField from "src/components/DateInputField";`, thay cả 2 field Start Date/End Date bằng `<DateInputField value={...} onChange={(newVal) => set...(newVal)} placeholder="..." className="..." />`. Giữ nguyên className cũ (không đổi style bao ngoài), giữ nguyên logic submit (`new Date(startDate).toISOString()`) — đúng như FIX_SPEC đề xuất, không đổi state/API/DB.

## 2. `NewCandidateModal.js`

Thay đúng field Date of Birth bằng `DateInputField`, import dùng đường dẫn tương đối `"./DateInputField"` (file này nằm cùng cấp `src/components/`, resolve đúng tới `DateInputField.js`) — hợp lệ, khác cách viết với `CampaignEditModal.js` (dùng alias `"src/components/..."` qua `jsconfig.json` `paths: {"src/*": ["./src/*"]}`) nhưng cả 2 đều đúng, không xung đột.

Grep lại toàn bộ `src/app` và `src/components`: **0 chỗ còn dùng `type="date"`** — khớp đúng tuyên bố của AG trong DEVLOG.

## 3. [Lặp lại lần 3, nên xử lý ở gốc] DEVLOG tiếp tục ghi sai/ghi hash không tồn tại

Chi tiết mục "Đồng Bộ DateInputField..." ghi `Commit: aa0e21f` — hash này **không tồn tại** trong `git log --all --oneline`. Hash thật của commit này là `716bbd5`. Đây là lần thứ 3 trong phiên làm việc hôm nay xảy ra hiện tượng ghi nhầm/ghi placeholder commit hash trong DEVLOG (trước đó là `7c7dcf4` cho `SNAP-83`/`SNAP-84`, và `f6cf1e4` cho `SNAP-87`). Ngoài ra, lần này còn thiếu luôn **dòng tóm tắt trong bảng Snapshot** (chỉ có phần chi tiết `###`, không có row `| **SNAP-...** |` tương ứng) — khác với quy ước mọi thay đổi khác trong file.

Vì đây là vấn đề lặp lại có hệ thống (không phải lỗi ngẫu nhiên), đề xuất AG rà lại quy trình ghi DEVLOG: chạy `git log --oneline -1` **sau khi** đã commit thật (không gõ tay/không dùng giá trị từ lần chạy trước) trước khi điền vào mục "Commit:", và luôn thêm đủ 1 dòng row bảng tổng hợp + 1 mục chi tiết cho mỗi thay đổi để không bị thiếu như lần này.

## Kết luận

Chức năng đã đúng 100% theo FIX_SPEC, không có rủi ro nào về mặt code. Chỉ còn vấn đề ghi chép (hash sai + thiếu row bảng) — Claude sẽ tự bổ sung row bảng còn thiếu và sửa hash trong lượt cập nhật DEVLOG kế tiếp.

**Verify:** đọc trực tiếp `git diff 2e64732 716bbd5` cho cả 2 file, grep toàn bộ `src/` xác nhận 0 chỗ còn `type="date"`, đối chiếu `jsconfig.json` xác nhận đường dẫn import hợp lệ — không chạy code/DDL/DML nào.
