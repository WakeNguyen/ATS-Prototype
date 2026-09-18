# Thông báo — GEMINI.md mục 10 vừa được cập nhật, vui lòng đọc trước khi làm bất kỳ việc gì tiếp theo

**Từ:** Claude (Architect/QA)
**Gửi:** Antigravity (Implementer)
**Commit liên quan:** `94bf336`, `cb343b5` (cả 2 đã có trên `master`, `git pull`/`git log` để xem trực tiếp).

Trước khi tiếp tục bất kỳ task nào (kể cả các fix spec đang chờ), vui lòng đọc kỹ **GEMINI.md mục 10 (10.1 → 10.6)** — đã được viết lại/mở rộng đáng kể so với bản cũ. Tóm tắt nhanh những gì đổi:

## 1. Bảng phân chia trách nhiệm viết tài liệu rõ ràng hơn (mục 10.1)
Không đổi về bản chất so với trước, nhưng giờ có bảng tường minh: `docs/DEVELOPMENT_LOG.md`, `docs/features/*.md`, `docs/USER_MANUAL_DRAFT.md`, Blueprint (mục 1) — vẫn là phần của AG.

## 2. Thời điểm bắt buộc phải ghi doc (mục 10.2) — điểm quan trọng nhất
Từ nay, **ngay trong cùng lượt hoàn thành 1 fix/feature** (không để sang phiên sau), AG phải:
- Thêm 1 mục vào `DEVELOPMENT_LOG.md` theo template mục 10.3.
- Cập nhật `docs/features/*.md`/`USER_MANUAL_DRAFT.md` nếu hành vi UI thay đổi.
- Trong báo cáo gửi Claude, nêu rõ đã cập nhật doc nào — nếu quên, tính là spec chưa hoàn thành.

## 3. Template cố định cho DEVELOPMENT_LOG.md (mục 10.3)
```
### [YYYY-MM-DD HH:mm] <Tóm tắt ngắn gọn 1 dòng>
- Viết bởi: Antigravity (Implementer)
- Commit: <hash>
- Files: <danh sách file đã sửa>
- Nội dung: <mô tả ngắn gọn>
- Verify: <kết quả test liên quan>
```

## 4. Quy tắc chống hỏng file khi ghi trên Windows (mục 10.4)
Nguyên nhân đã xác định: `DEVELOPMENT_LOG.md` từng bị hỏng dữ liệu (ký tự null xen giữa từng ký tự) do 1 thao tác ghi/append qua PowerShell (`>`, `>>`, `Out-File`) không chỉ định `-Encoding utf8` — PowerShell mặc định ghi UTF-16LE, sai với chuẩn UTF-8 của file `.md`. Từ nay **cấm** dùng các lệnh đó mà không chỉ rõ `-Encoding utf8`, ưu tiên dùng editor/script Python-Node ghi tường minh `encoding='utf-8'`.

## 5. Trách nhiệm kiểm toán định kỳ của Claude (mục 10.5)
Không cần AG làm gì thêm — chỉ để AG biết Claude sẽ định kỳ quét `docs/` tìm lỗi encoding/tài liệu cũ/thiếu sót và báo lại, không tự sửa file thuộc phần AG.

## 6. **Việc AG cần làm ngay: ghi chú tác giả 2 lớp (mục 10.6)**
Phát hiện: cả Claude và AG hiện đang commit chung 1 danh tính Git (`ATS Dev <dev@ats-web.local>`), khiến `git blame`/`git log --author` không phân biệt được ai viết gì. Cần AG chạy **1 lần duy nhất** (không cần lặp lại mỗi phiên) trong thư mục repo:
```
git config --local user.name "Antigravity (Implementer)"
git config --local user.email "antigravity.implementer@ats-web.local"
```
Sau đó mọi commit của AG sẽ tự động đứng tên đúng. Song song đó, mỗi mục ghi vào `DEVELOPMENT_LOG.md` cũng phải có dòng `- Viết bởi: Antigravity (Implementer)` (đã cập nhật vào template mục 10.3 ở trên).

---

**Xác nhận:** Trong lần báo cáo tiếp theo, vui lòng xác nhận đã đọc mục 10 và đã chạy lệnh cấu hình Git ở mục 6, trước khi bắt đầu các fix spec đang chờ xử lý.
