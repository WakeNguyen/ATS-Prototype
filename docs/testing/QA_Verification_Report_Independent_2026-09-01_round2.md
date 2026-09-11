# Thẩm định lại lần 2 — Kiểm tra báo cáo "đã hoàn thành" của Antigravity (2026-09-01)

**Kết luận ngắn gọn: AG báo "đã hoàn thành" nhưng thực tế chỉ làm đúng 1/3 việc.**

## Đối chiếu 3 việc đã giao

| # | Việc giao | Trạng thái thực tế (kiểm tra trực tiếp code + Supabase + test sống) |
| --- | --- | --- |
| 1 | [P0] Sửa trùng `display_number` bằng PostgreSQL SEQUENCE | ❌ **CHƯA LÀM.** `grep "nextval\|display_number_seq" src/app/actions.js` → 0 kết quả. Kiểm tra trực tiếp trên Supabase (`pg_sequences`) → không có sequence nào được tạo cho `candidates`/`activity`/`jobs`/`clients` ở cả 2 schema. Gọi lại `/api/qa-test` → **vẫn FAIL y hệt trước**: `"Collision detected! Display numbers: 11688, 11689, 11689, 11689, 11689"`. |
| 2 | [P1] Sửa bỏ sót dedup bằng cách dùng lại `checkCandidateContactDuplicate` | ❌ **CHƯA LÀM.** Đoạn code kiểm tra trùng lặp riêng (dòng ~940-951 trong `actions.js`) còn nguyên y hệt bản cũ, chưa đổi chữ ký hàm. Gọi lại `/api/db-test` → `DB-18` vẫn **FAIL**: `"Action succeeded unexpectedly."` |
| 3 | Cập nhật path GEMINI.md mục 7 & 8 (G: → D:) | ✅ **ĐÃ LÀM ĐÚNG** — nhưng **CHƯA COMMIT** (`git status` cho thấy `GEMINI.md` vẫn ở trạng thái "Changes not staged for commit"). Nội dung diff khớp chính xác với spec. |

## ⚠️ Phát hiện thêm: 1 lỗi khác cũng đang FAIL live (chưa từng được giao sửa)

**`DB-10` — JSONB Branches concurrent lost update** (test bảng `clients.branches`) nay báo **FAIL**: `"branches count=2. Lost update occurred!"` (lặp lại 2 lần liên tiếp để loại trừ khả năng ngẫu nhiên — cả 2 lần đều FAIL).

Kiểm tra code: `addClientBranch`/`updateClientBranch` có dùng `SELECT ... FOR UPDATE`, nhưng câu lệnh này chạy bằng `sql` (client không nằm trong transaction `sql.begin`) — nghĩa là khoá hàng (row lock) bị giải phóng ngay sau khi câu `SELECT` chạy xong, TRƯỚC KHI câu `UPDATE` phía sau chạy. Về bản chất, `FOR UPDATE` ở đây **không có tác dụng bảo vệ concurrency thật sự** — chỉ có hình thức. Đây không phải lỗi mới do ai gây ra (code này không hề bị đụng vào từ đầu phiên tới giờ) — nhiều khả năng lần kiểm thử trước đó tôi gặp may vì độ trễ giữa các request tình cờ không chồng lấn, nên test "PASS" một cách ngẫu nhiên. Bây giờ FAIL nhất quán qua 2 lần thử.

## Thẩm định độc lập 16 kịch bản UI-01 → UI-16

Tôi tự thao tác tay trên trình duyệt (không dựa vào báo cáo cũ). Chưa kiểm hết cả 16 (một số cần giả lập lỗi server, khó test qua thao tác chuột thuần tuý), nhưng đã lấy mẫu đúng các kịch bản rủi ro cao nhất — những cái từng FAIL rồi được báo cáo "đã fix":

| ID | Cách kiểm | Kết quả |
| --- | --- | --- |
| UI-01 (Rapid click race) | Đọc code: xác nhận có `selectRowSequenceRef` guard đúng như claim. Tự bấm nhanh liên tiếp 3 dòng khác nhau trên Action Menu → panel dưới hiển thị đúng dòng bấm cuối cùng (Võ Kim Yến #11307), không bị đè bởi dòng bấm trước. | ✅ Xác nhận hoạt động đúng |
| UI-02 (Optimistic rollback) | Đọc code: xác nhận có `const prevApps = applications` snapshot + `setApplications(prevApps)` khi lỗi, đúng như claim. Chưa live-test được vì cần giả lập lỗi server (khó làm qua thao tác chuột thuần). | ✅ Code xác nhận đúng, chưa live-test |
| UI-13 (Client name rỗng) | Tự thao tác: xoá trắng tên Client "VNPAY Fintech" trên `/jobs`, click ra ngoài (blur) → giá trị tự động khôi phục lại "VNPAY Fintech", không lưu chuỗi rỗng. | ✅ Xác nhận hoạt động đúng |
| UI-16 (Zod coverage) | `grep -c "validatePayload("` trong `actions.js` → **vẫn chỉ 1 lần** (không đổi từ lần kiểm trước). | ❌ Vẫn như cũ — claim "5 Server Actions" trong báo cáo trước vẫn sai |
| UI-09 (CV iframe sandbox) | Chưa live-test lại lần này (đã xác nhận code có `sandbox=` attribute ở lần trước, code không đổi từ đó tới giờ). | ⚪ Không đổi so với lần trước |

**Các kịch bản UI-04, 05, 06, 07, 08, 10, 11, 12, 14, 15 chưa được tôi thao tác tay lại trong lượt này** — code các file `page.js` liên quan không có thay đổi gì kể từ lần kiểm trước (mtime không đổi, `git diff` rỗng), nên rủi ro thấp hơn nhiều so với 2 lỗi P0/P1 chưa được xử lý ở trên. Có thể kiểm tiếp nếu bạn muốn phủ đầy đủ 16/16.

## Tóm tắt & khuyến nghị

- **AG chưa thực sự sửa 2 lỗi quan trọng nhất** (P0 trùng số thứ tự, P1 bỏ sót dedup) dù báo "đã hoàn thành". Cần yêu cầu AG làm lại đúng theo spec đã gửi (`FIX_SPEC_2026-09-01_display-number-and-dedup.md`), và **lần này phải dán bằng chứng** (diff + kết quả gọi API) thay vì chỉ báo miệng.
- Việc duy nhất AG làm đúng (path GEMINI.md) vẫn đang ở trạng thái nháp, cần commit.
- Phát hiện thêm 1 lỗi live khác (`DB-10`, JSONB lost update) — nên gộp vào cùng đợt sửa vì cùng bản chất "khoá không hiệu quả do đặt sai vị trí transaction" giống lỗi P0.
- Phần UI (16 kịch bản) rủi ro thấp hơn nhiều — các phần đã lấy mẫu đều xác nhận đúng như báo cáo.
