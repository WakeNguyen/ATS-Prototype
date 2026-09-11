# scripts/archive/ — Script rời đã dọn khỏi thư mục gốc (2026-09-01)

Các script trong đây **không được app (`src/`) hay `package.json` gọi tới** — đã xác nhận trước khi di chuyển. Giữ lại để tham khảo/audit, không xóa, nhưng gom ra khỏi thư mục gốc cho gọn và giảm rủi ro bấm nhầm chạy lại.

## ⚠️ `data-mutating-oneoffs/` — CẨN TRỌNG ĐẶC BIỆT
Các script trong thư mục này **từng ghi/sửa/xóa dữ liệu thật trực tiếp trên Supabase** (dedup, merge, cleanup, seed dummy data...). Đây là script một lần, không phải công cụ dùng lại định kỳ.

**Không chạy lại bất kỳ script nào trong thư mục này nếu chưa đọc kỹ nội dung và xác nhận với Product Owner** — nhiều script chứa lệnh `DELETE`/`UPDATE` hàng loạt, có thể gây mất dữ liệu nếu chạy nhầm schema hoặc chạy lại trên dữ liệu đã thay đổi từ lúc viết script.

## `notion-migration/`
Script phục vụ đợt di chuyển dữ liệu từ Notion sang Postgres — công việc đã hoàn tất, chỉ giữ để tham khảo lịch sử.

## `db-diagnostics/`
Script kiểm tra/đối soát dữ liệu, chỉ đọc (SELECT), không ghi. An toàn hơn nhóm trên nhưng vẫn là script một lần, không phải công cụ chính thức.

## `code-fixups/`
Script sửa code/tài liệu một lần, đã áp dụng xong vào lúc đó.

## `doc-generators/`
Script từng dùng để tự động cập nhật một số file tài liệu — chưa rõ có còn cần dùng tiếp không, giữ lại tham khảo.

---
*Không có script nào trong `scripts/archive/` được import hay gọi bởi ứng dụng — đã xác nhận qua `grep` trước khi di chuyển (2026-09-01).*
