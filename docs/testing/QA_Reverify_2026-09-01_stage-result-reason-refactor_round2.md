# Thẩm định độc lập vòng 2 — Tách Result & Reason khỏi Stage — 2026-09-01

**Từ:** Claude (Architect/QA)
**Phương pháp:** Đối chiếu `git show 62c5c15` với 2 việc còn thiếu đã nêu trong `QA_Reverify_2026-09-01_stage-result-reason-refactor.md`, đối chiếu trực tiếp dữ liệu thật trên Supabase (MCP) sau khi script chạy `--apply`.

## Kết luận: Cả 2 việc còn thiếu đã được làm đúng và có bằng chứng thật

| # | Việc | Xác nhận |
| --- | --- | --- |
| 1 | UI Result/Reason/Note trong `src/app/jobs/page.js` | ✅ Đã thêm đúng vị trí (nhánh `app.status === "Closed"` trong "Quick Edit Application Fields"), đúng field name, đúng logic ẩn/hiện Reason+Note chỉ khi `result === "Failed"`. Note dùng `value`+`onChange` (không phải `defaultValue`+`onBlur` tôi gợi ý) — kiểm tra lại thì đây đúng là pattern sẵn có của ô "Source Channel" ngay phía trên trong cùng file, nên là lựa chọn đúng theo tinh thần "giữ nhất quán pattern hiện hành" tôi yêu cầu, không phải lỗi. |
| 2 | Script chuẩn hoá dữ liệu cũ | ✅ Tìm ra đúng nguyên nhân round 1 thất bại: script gốc dùng `sql\`activity\`` không chỉ định schema, nên khi chạy đã cập nhật nhầm bảng `sandbox.activity` (search_path mặc định) thay vì `public.activity` (production). Round 2 sửa script để loop qua cả 2 schema, chạy `--apply` thật. Đối chiếu trực tiếp Supabase: **1006 record** đúng như log AG báo cáo, tất cả đã có `result = 'Failed'`, `reason_failed = 'Withdrawn - N/A'`. 4 record thuộc `Rejected By Hiring Manager`/`Failed Interview (2nd)`/`(3rd)`/`Recjected By Hiring Manager` đã có `result = 'Passed'` từ trước đúng như kỳ vọng, KHÔNG bị script ghi đè (đúng logic `WHERE result IS NULL`). |
| 3 | Đính chính `DEVELOPMENT_LOG.md` + Blueprint | ✅ AG thêm entry mới (không xoá/sửa entry cũ), nêu rõ đây là đính chính, đưa đúng con số thật (1006, không phải 248) — đúng tinh thần trung thực yêu cầu. |

**1 điểm nhỏ, không chặn:** entry `DEVELOPMENT_LOG.md` dòng "Commit: <sẽ cập nhật sau khi commit>" chưa được điền lại hash thật (`62c5c15`) sau khi commit xong — sai sót nhỏ về vệ sinh tài liệu, không ảnh hưởng chức năng. Không yêu cầu AG sửa riêng, có thể gộp vào lần cập nhật doc tiếp theo.

**Ghi chú phụ (không phải lỗi code, chỉ nhắc quy trình):** có 2 file rác `script_log.txt` và `spec_diff_round2.txt` đang nằm ở thư mục gốc repo (chưa `git add`), nội dung bị lỗi encoding UTF-16LE giống hệt lỗi đã cấm ở GEMINI.md mục 10.4 (khả năng do `git diff > file.txt` qua PowerShell không chỉ `-Encoding utf8`). File nguồn thật (`src/app/jobs/page.js`) mình kiểm tra riêng vẫn là UTF-8 chuẩn, không bị ảnh hưởng — chỉ 2 file log/bằng chứng tạm này bị lỗi. Đề nghị AG xoá 2 file này khỏi thư mục gốc (đã không được track bởi git nên xoá không ảnh hưởng lịch sử) khi tiện, và tiếp tục lưu ý không dùng PowerShell redirect (`>`, `>>`) không chỉ định encoding.

## Toàn bộ spec `FIX_SPEC_2026-09-01_stage-result-reason-refactor.md` nay đã hoàn thành đầy đủ 6/6 phần, xác nhận độc lập.
