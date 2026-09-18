# FIX SPEC — 2026-09-07 — Cấu Hình Vercel Firewall: Giới Hạn `/api/webhooks/*` Chỉ Nhận Từ IP VPS n8n

**Mức độ ưu tiên: Trung bình — không khẩn cấp (không có khai thác thật đang xảy ra), nhưng nên làm sớm vì đây là lớp phòng thủ bổ sung cho đúng nhóm endpoint từng liên quan tới sự cố secret plaintext tuần này.**
**Thực hiện trên:** Vercel Dashboard (project `crm-ats-web`) → **Settings → Firewall**. Đây KHÔNG phải thay đổi code app hay n8n workflow — chỉ là cấu hình hạ tầng trên Vercel.
**Bối cảnh:** IP tĩnh của VPS n8n đã được AG xác nhận: `127.0.0.1` (domain `n8n.example.com`) — Claude đã verify độc lập lại bằng DNS lookup, khớp chính xác.

---

## ⚠️ Lưu ý sửa lại 1 điểm so với đề xuất ban đầu của AG

AG đề xuất tạo 1 rule duy nhất: IP = `127.0.0.1` → action **Bypass**. Rule này ĐÚNG và nên giữ, nhưng **tự nó KHÔNG tạo ra giới hạn truy cập nào cả** — nó chỉ đảm bảo n8n không bao giờ bị các lớp bảo vệ khác (ví dụ Attack Challenge Mode nếu bật sau này) làm phiền. Muốn thật sự **chặn các IP khác gọi vào `/api/webhooks/*`** (đây mới là mục tiêu bảo mật chính), cần thêm 1 rule thứ 2 riêng để DENY. Thiếu rule thứ 2 này thì webhook vẫn mở cho toàn bộ Internet y như hiện tại, chỉ khác là n8n được ưu tiên không bị chặn nhầm.

**Chỉ áp dụng IP-restriction cho đúng `/api/webhooks/*`. KHÔNG áp dụng cho `/api/auth/*` hay các trang app (`/`, `/candidates`, `/jobs`, `/campaigns`, `/search`)** — vì Google OAuth callback (`/api/auth/*`) cần nhận request từ IP của Google, và User cần truy cập các trang app từ IP nhà/công ty của chính mình (IP động, không cố định) — nếu áp dụng nhầm IP-restriction vào 2 nhóm này, User sẽ tự khoá mình khỏi hệ thống.

---

## Việc cần làm — tạo đúng 2 rule, theo đúng thứ tự ưu tiên

### Rule 1 — "Allow n8n VPS" (giữ nguyên đề xuất của AG, tạo trước)
- **Name:** `Allow n8n VPS`
- **If:** `IP Address` `equals` `127.0.0.1`
- **Then:** `Bypass`
- Mục đích: đảm bảo n8n luôn thông suốt, không bị ảnh hưởng bởi bất kỳ rule/managed protection nào khác (kể cả nếu sau này bật thêm Attack Challenge Mode).

### Rule 2 — "Block Non-n8n on Webhooks" (rule mới, quan trọng nhất, tạo sau Rule 1)
- **Name:** `Block Non-n8n on Webhooks`
- **If (cả 2 điều kiện, nối bằng AND):**
  - `Path` `starts with` `/api/webhooks/`
  - `IP Address` `not equals` `127.0.0.1`
- **Then:** `Deny`
- Mục đích: đây mới là rule thật sự chặn — chỉ IP của VPS n8n mới gọi được các endpoint `/api/webhooks/*` (cv-batch, cv-batch-item, cv-import, cv-upload-proxy, notifications, warm-join-run-progress, warm-join-run-callback, warm-join-data, warm-join-cron-register, campaign-run-progress, campaign-run-callback), mọi IP khác bị từ chối thẳng ở tầng Firewall — trước cả khi chạm tới code kiểm tra secret header.

**Thứ tự rule quan trọng:** đảm bảo Rule 1 (Bypass cho IP n8n) được đánh giá TRƯỚC Rule 2 (Deny), để traffic từ n8n luôn được bypass toàn bộ trước khi rule Deny có cơ hội áp dụng.

### (Không bắt buộc) Attack Challenge Mode
- Giữ nguyên **Off** như AG đề xuất — không cần thiết cho quy mô 1 user nội bộ hiện tại, và tính năng này thực ra không có sẵn ở gói Hobby (cần Pro). Không có gì cần làm ở bước này.

---

## Test bắt buộc sau khi tạo xong 2 rule

1. **Test n8n vẫn hoạt động bình thường:** Chạy 1 lần CV upload thật hoặc trigger 1 workflow (A/C/D bất kỳ) từ n8n → xác nhận webhook vẫn nhận thành công (status 200 như trước), không bị Vercel Firewall chặn.
2. **Test rule Deny hoạt động đúng:** Từ 1 nguồn KHÔNG phải IP n8n (ví dụ dùng `curl` hoặc Postman từ máy tính cá nhân, hoặc nhờ Claude test qua công cụ web bên ngoài), gọi thử `POST https://crm-ats-web-hazel.vercel.app/api/webhooks/notifications` — phải nhận về bị Vercel Firewall chặn (không phải lỗi 401 từ code app như trước, mà bị chặn ngay ở tầng Firewall).
3. **Test không ảnh hưởng đăng nhập:** Đăng xuất rồi đăng nhập lại bằng tài khoản Google đã allowlist — xác nhận luồng OAuth (`/api/auth/*`) vẫn hoạt động bình thường, không bị chặn nhầm.
4. Ghi kết quả vào `docs/DEVELOPMENT_LOG.md` theo đúng quy tắc (cả bảng tổng hợp lẫn phần chi tiết) — nêu rõ đã tạo 2 rule nào, kết quả test, và người trực tiếp bấm cấu hình (User hay AG, vì đây là thao tác trên Vercel Dashboard).
