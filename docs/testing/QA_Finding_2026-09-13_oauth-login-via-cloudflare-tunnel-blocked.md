**Từ:** Claude (Architect/QA)

# QA Finding: Đăng nhập Google OAuth qua Cloudflare Tunnel (dev) bị chặn — hạn chế của Auth.js, đã gác lại

**Ngày:** 2026-09-13
**Trạng thái:** ⏳ Gác lại (không chặn công việc ưu tiên hiện tại — environment-separation cho n8n).
**Liên quan:** Kế hoạch "Environment-aware routing" (`docs/architecture/` — xem plan `glittery-nibbling-swing.md` đã lưu tại `C:\Users\trith\.claude\plans\`), phần "CV Parser dùng tunnel `ats-dev.thucnguyen8n.space`".

## Bối cảnh

Trong lúc verify hướng "dùng Cloudflare Tunnel để n8n gọi được về dev server" cho CV Parser,
User thử luôn việc đăng nhập vào UI ATS 3.0 (Google OAuth) qua domain tunnel
`https://ats-dev.thucnguyen8n.space` bằng trình duyệt thật — mục tiêu phụ, không phải yêu cầu gốc
của kế hoạch, nhưng phát sinh tự nhiên khi test tunnel.

## Diễn biến điều tra (đã verify bằng bằng chứng trực tiếp, không đoán)

1. **Lỗi 1 — 404 chập chờn (ĐÃ FIX):** Phát hiện 2 tiến trình `cloudflared.exe` chạy song song
   (1 Windows Service tên "Cloudflared" cài từ lần setup cũ, 1 tiến trình User tự chạy tay) cùng
   tranh nhau làm connector cho cùng 1 tunnel → Cloudflare load-balance ngẫu nhiên, ~50% request
   trúng connector cấu hình sai → 404. Verify bằng 6-8 lần gọi liên tiếp cùng 1 request qua tunnel
   so với qua `localhost:3000` (localhost luôn 100% pass, tunnel chỉ ~50%). Fix: User tự dừng +
   disable Windows Service qua PowerShell Admin (`Stop-Service`/`Set-Service -StartupType Disabled`).
   Sau fix: verify lại 8/8 lần pass.

2. **Lỗi 2 — thiếu `trustHost` (ĐÃ FIX):** `auth.js` (root, NextAuth v5 config) không có
   `trustHost: true` → Auth.js không tin Host header khác `localhost:3000`, tạo `redirect_uri`
   sai domain khi build link đăng nhập gửi Google. Claude tự sửa thêm 1 dòng
   `trustHost: true` (User uỷ quyền trực tiếp, đã hỏi trước theo đúng quy trình). Verify bằng
   Playwright: `redirect_uri` gửi Google sau fix đã đúng
   `https://ats-dev.thucnguyen8n.space/api/auth/callback/google`.

3. **Lỗi 3 — `redirect_uri_mismatch` ở bước đổi token (CHƯA FIX, đã gác lại):** Dù bước 1 (redirect
   sang Google) đã đúng domain, bước 2 (Next.js server đổi `code` lấy token với Google) vẫn báo lỗi
   `redirect_uri_mismatch` từ chính Google trả về (`dev_server.log`: `"error": "redirect_uri_mismatch"`).
   Root cause xác nhận bằng cách tạo 1 API route debug tạm thời (`/api/qadebugheaders`, đã xoá ngay
   sau khi lấy bằng chứng) để so sánh headers Next.js nhận được qua tunnel:
   - `host`, `x-forwarded-host`, `x-forwarded-proto` đều ĐÚNG (`ats-dev.thucnguyen8n.space` / `https`).
   - NHƯNG `request.url` (Next.js tự dựng) vẫn báo `https://localhost:3000/...` — sai.

   Auth.js dùng header (đúng) để build `redirect_uri` cho bước 1 (redirect user sang Google), nhưng
   có vẻ dùng `request.url` (sai, do Next.js dev server không tự sửa origin theo header forwarded)
   cho bước 2 (đổi token) → 2 `redirect_uri` không khớp nhau → Google từ chối. Đã loại trừ khả năng
   do cookie cũ: test lại bằng cửa sổ Ẩn danh (không cookie cũ) vẫn lỗi y hệt → xác nhận đây là hạn
   chế/inconsistency thật của thư viện `@auth/core`/`next-auth` v5 beta khi chạy `next dev` sau
   reverse proxy, không phải lỗi cấu hình.

## Hướng fix khả dĩ đã research nhưng CHƯA áp dụng

Auth.js có option chính thức cho đúng tình huống này: `redirectProxyUrl` (hoặc env
`AUTH_REDIRECT_PROXY_URL`) — thiết kế cho case "OAuth trên preview URL không biết trước domain"
(theo docs chính thức, dùng cho Vercel preview deployments). Cách hoạt động: trỏ `redirect_uri` cố
định về 1 domain ổn định (relay), domain đó ký `state` rồi forward kết quả về đúng domain thật đang
chạy. **Điều kiện:** domain relay (khả năng phải là production) và domain thật (dev) phải dùng
CHUNG `AUTH_SECRET` để xác minh chữ ký `state` — nhưng dự án đang **cố tình** để `AUTH_SECRET` local
khác Vercel (xem memory `ats_web_auth_secret_separation`) làm điều kiện an toàn cho việc test session-
injection cục bộ. Áp dụng `redirectProxyUrl` sẽ đánh đổi lại đúng lớp an toàn đó — cần thiết kế lại
cẩn thận, không phải 1 dòng config đơn giản như 2 lỗi trước.

## Quyết định (User đã đồng ý 2026-09-13)

**Gác lại, không fix ngay** — vì mục tiêu gốc của tunnel (cho CV Parser gọi webhook từ n8n VPS về
dev server) là giao tiếp **server-to-server, không đi qua OAuth/trình duyệt** — hoàn toàn không bị
ảnh hưởng bởi lỗi này. Việc đăng nhập UI qua tunnel chỉ là nhu cầu phụ phát sinh, không phải yêu cầu
của kế hoạch environment-separation đang ưu tiên.

## Việc cần làm khi quay lại xử lý (sau này)

Nếu sau này User thực sự cần dùng toàn bộ UI ATS 3.0 từ xa qua tunnel (không chỉ riêng CV Parser
webhook), cần thiết kế riêng 1 spec cho việc này, cân nhắc kỹ trade-off `redirectProxyUrl` nêu trên
(đặc biệt là tác động tới `AUTH_SECRET` separation) trước khi áp dụng — không tự ý làm nếu chưa có
phương án giữ nguyên lớp an toàn hiện tại.
