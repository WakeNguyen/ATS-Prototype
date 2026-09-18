# FIX SPEC — 2026-09-06 — Dọn rác: xoá record rác + dọn git trước khi push GitHub

**Mức độ ưu tiên: Trung bình — không khẩn cấp, nhưng nên làm TRƯỚC khi push repo lên GitHub (xem thêm FIX_SPEC bảo mật GitHub/Vercel — làm song song hoặc trước bước push đều được, không phụ thuộc nhau).**

**Người phát hiện:** User, khi duyệt trang Candidates thấy 1 record tên "Unknown".

---

## Task A — Xoá record ứng viên rác "Unknown" (#3415)

**Đã điều tra kỹ, xác nhận an toàn để xoá (không đoán):**

Query trực tiếp Supabase (`public.candidates`) xác nhận:
- `id`: `bda64980-f832-4344-8cb7-1957a4fa1821`
- `display_number`: `3415`
- `full_name`: `"Unknown"` (chuỗi literal, không phải null)
- `created_time`: `2026-08-31 08:59:03.550372+00`

Kiểm tra các bảng liên quan cho id này — **tất cả đều rỗng**:
- `contact_points`: 0 dòng
- `activity`: 0 dòng
- `cv_url`, `notes` trên chính record: null / rỗng

→ Đây là record hoàn toàn trống, không có dữ liệu thật nào gắn vào, an toàn để xoá.

**Việc cần làm:**
1. Trước khi xoá, kiểm tra schema xem có bảng nào khác (ngoài `contact_points`, `activity` đã check) có foreign key trỏ tới `candidates.id` không — nếu có, xử lý/xoá theo đúng thứ tự để tránh lỗi FK constraint.
2. Xoá record:
   ```sql
   DELETE FROM public.candidates WHERE id = 'bda64980-f832-4344-8cb7-1957a4fa1821';
   ```
3. Xác nhận lại: record #3415 không còn hiển thị trên trang Candidates ở production, và query lại Supabase để chắc chắn đã xoá.

---

## Task B — Dọn git trước khi push lên GitHub lần đầu

**Bối cảnh:** repo local sắp được push lên GitHub lần đầu tiên (xem FIX_SPEC bảo mật riêng). Trước khi làm vậy, nên dọn sạch các file rác/chưa track để lịch sử git từ đầu đã sạch sẽ.

Hiện trạng đã kiểm tra (`git status --short --untracked-files=all`):

1. `docs/testing/FIX_SPEC_2026-09-06_action-menu_closed-action-not-filtered-out.md`
   → Đây là 1 FIX_SPEC thật (không phải rác), đã gửi trước đó, mô tả 1 bug UI cần sửa (Action Menu không tự lọc action vừa đóng khỏi view). **Cần `git add` + commit file này** (nội dung giữ nguyên, không sửa), không xoá.

2. `scripts/check_cv_configs.mjs`, `scripts/check_cv_wf.mjs`
   → 2 script chưa từng được track. Kiểm tra xem còn dùng không:
   - Nếu chỉ là script debug/kiểm tra tạm thời, không còn cần nữa → xoá hẳn.
   - Nếu vẫn còn hữu ích (ví dụ dùng để kiểm tra config CV/workflow định kỳ) → commit chính thức, thêm 1 dòng comment đầu file ghi rõ mục đích dùng để làm gì.
   - Không để ở trạng thái "untracked" mãi — chọn 1 trong 2 hướng trên.

3. Rà lại các file/thư mục cũ từng được ghi nhận là chưa xử lý dứt điểm (nếu vẫn còn tồn tại):
   - `HANDOVER_2026-09-06_fb-warming-workflow-d-architect-request.md`
   - `Claude outputs/`
   - `scripts/social-group-titles/`

   Với mỗi cái: quyết định commit chính thức (nếu còn giá trị tham khảo) hoặc thêm vào `.gitignore` một cách tường minh (nếu là output tạm/không cần track) — mục tiêu là `git status` sạch trước khi push, không còn file "lơ lửng" untracked.

4. `.gitignore` hiện có 2 dòng bị lặp: `.vercel` và `.env*` mỗi dòng xuất hiện 2 lần (không gây lỗi gì, nhưng nên dọn cho gọn — xoá dòng lặp, giữ lại 1 dòng mỗi entry, không đổi hành vi).

---

## Test bắt buộc trước khi báo hoàn thành

- Record #3415 "Unknown" không còn trong Supabase và không còn hiển thị trên UI production.
- `git status --short` sau khi dọn: sạch, hoặc chỉ còn đúng những thay đổi có chủ đích (đã commit hết những gì cần commit).
- `.gitignore` không còn dòng lặp.
- Không có file `.env*` nào từng bị track nhầm (double-check nhanh bằng `git log --all --oneline -- .env .env.local` — nếu ra kết quả, dừng lại và báo cáo trước, đây sẽ là vấn đề nghiêm trọng hơn cần xử lý riêng).

**Báo cáo lại:** ghi vào `docs/DEVELOPMENT_LOG.md` như thường lệ, liệt kê rõ những gì đã xoá/giữ/commit.
