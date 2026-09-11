# FIX SPEC — 2026-09-09 — "CV Link" Chỉ Chứa 1 URL Duy Nhất, Không Có Cách Nào Thêm Phiên Bản CV Mới Qua UI (Cơ Chế Multiple-CV Ở Tầng Dữ Liệu Tồn Tại Nhưng Không Ai Thật Sự Chạm Tới Được) — ĐÃ ĐÍNH CHÍNH

**Mức độ ưu tiên: CAO (theo yêu cầu ưu tiên của Thức) — bổ sung tính năng/UX, không phải mất dữ liệu.**

**Người phát hiện:** Claude (Architect/QA). Bản đầu (cùng ngày) đánh giá quá lạc quan là "chỉ thiếu 1 nút bấm" — Thức chỉ đúng ra rằng trên UI thật, trường "CV Link" chỉ chứa được 1 giá trị, và "Embedded CV Viewer" không có cách chuyển qua CV khác — đã đọc lại code UI + server action để xác nhận chính xác mức độ nghiêm trọng.

**Nguồn:** Google Doc, mục 10: "Không có cơ chế để lưu trữ multiple CV." và mục 14: "Update CV nhưng không chạy lên hệ thống."

---

## Đính chính: cơ chế multiple-CV ở tầng dữ liệu tồn tại nhưng KHÔNG BAO GIỜ được kích hoạt qua luồng sử dụng thực tế

Xác nhận lại qua code (`src/app/candidates/page.js`, `src/app/actions.js`):

- Trường **"CV Link (Google Drive / PDF)"** trên Candidate 360 là 1 Ô TEXT INPUT ĐƠN, bind thẳng vào `formData.cv_url`. Khi bấm "Save Profile", server action `updateCandidateProfile()` (`src/app/actions.js` dòng ~608-624) chỉ làm đúng 1 việc: `UPDATE candidates SET cv_url = ${cv_url}, ...` — **hoàn toàn không đụng tới cột `cv_urls`**. Nghĩa là: dán 1 link CV mới vào ô này rồi Save sẽ GHI ĐÈ `cv_url` ngay lập tức, không hề được thêm vào lịch sử phiên bản, và tệ hơn — nếu candidate đó từng có `cv_urls` (từ luồng HITL merge), giờ nó sẽ LỆCH với `cv_url` mới (không đồng bộ).
- Placeholder hướng dẫn ngay trên UI (tab "Embedded CV Viewer" khi chưa có CV) còn ghi rõ: *"Paste a Google Drive share link into the 'CV Link' field on the left form and click Save."* — tức UI đang CHỦ ĐỘNG hướng dẫn user dùng đúng con đường không lưu lịch sử này.
- Dropdown chọn phiên bản CV (`allCvUrls`, dòng ~1748 `candidates/page.js`) **có tồn tại trong code**, nhưng chỉ render khi `allCvUrls.length > 1` — mà cách DUY NHẤT khiến `cv_urls` có >1 phần tử là đi qua toàn bộ pipeline Upload CV → n8n AI parsing → phát hiện trùng → màn hình HITL duyệt tay chọn strategy APPEND (xem `hitl_actions.js`). Vì luồng "sửa trực tiếp CV Link + Save" (con đường mà UI đang hướng dẫn) không bao giờ tạo ra phần tử thứ 2, trên thực tế dropdown này gần như KHÔNG BAO GIỜ xuất hiện với cách dùng thông thường — đúng như Thức quan sát.

**Kết luận:** đây không đơn thuần là "thiếu 1 nút", mà là 2 lỗi cộng lại: (1) con đường update CV chính mà UI hướng dẫn dùng (sửa CV Link + Save) không hề lưu lịch sử, và (2) cơ chế lưu lịch sử duy nhất đang có lại bị khoá sau cả 1 pipeline nặng (upload → AI parse → HITL) mà không có lối tắt nào.

---

## Giải pháp đề xuất (đã bổ sung so với bản trước)

1. **Thêm Server Action mới** `appendCvVersion({candidateId, cvUrl, originalFilename})` trong `src/app/actions.js`:
   - Đọc `display_number`, `cv_urls` hiện tại — tái dùng đúng logic đặt tên tuần tự `CV_<display_number>_<seq>.<ext>` và cách nối mảng đã có trong `hitl_actions.js` (bước 3 của MERGE action).
   - `UPDATE candidates SET cv_url = <url mới>, cv_urls = <mảng đã nối>, last_updated = NOW() WHERE id = candidateId`.
2. **Thêm UI** — nút "+ Tải CV mới" ngay cạnh trường "CV Link" (không phải chỉ ở tab Viewer) để rõ ràng đây là hành động THÊM phiên bản, khác với việc sửa tay ô "CV Link" (vẫn giữ ô này để sửa link thủ công khi cần, nhưng cân nhắc thêm dòng chú thích nhỏ: "Sửa trực tiếp ô này sẽ không lưu lại phiên bản cũ — dùng nút 'Tải CV mới' nếu muốn giữ lịch sử").
3. **Sửa `updateCandidateProfile()`** (`src/app/actions.js` ~dòng 608): khi giá trị `cv_url` gửi lên KHÁC với giá trị `cv_url` hiện tại trong DB (tức user đã sửa tay ô CV Link), tự động đẩy giá trị CŨ vào `cv_urls` trước khi ghi đè (coi như 1 lần "append" ngầm) — thay vì âm thầm làm mất dấu vết. Cách này vá luôn cả lỗi mất đồng bộ hiện tại mà không cần user phải nhớ dùng đúng nút mới.
4. Dropdown `allCvUrls` giữ nguyên, sẽ tự nhiên xuất hiện khi có >1 phiên bản qua 1 trong 2 con đường trên.

## Lưu ý khi implement
- Đây là bổ sung tính năng + vá 1 lỗ hổng mất đồng bộ dữ liệu, không cần migration cho dữ liệu cũ.
- Dropdown "Appended CV N" phải tự refresh ngay sau khi thêm, không cần F5.
- Giữ nguyên toàn bộ luồng CV Upload batch + HITL hiện tại.

## Test bắt buộc trước khi báo hoàn thành
1. Sửa trực tiếp ô "CV Link" của 1 candidate đã có sẵn CV, bấm Save → xác nhận `cv_urls` tự động có thêm bản ghi CV cũ (không bị mất), dropdown "Appended CV" xuất hiện.
2. Bấm nút "+ Tải CV mới" (mới thêm), upload 1 file test → xác nhận `cv_urls` có thêm đúng 1 entry, `cv_url` trỏ đúng bản mới nhất.
3. Kiểm tra Supabase trực tiếp — mảng `cv_urls` không mất entry cũ nào qua cả 2 test trên.
4. Xác nhận luồng Upload CV qua n8n (batch, dedup, HITL merge) KHÔNG bị ảnh hưởng.

## Báo cáo lại
Ghi vào `docs/DEVELOPMENT_LOG.md`, kèm candidate ID dùng để test.
