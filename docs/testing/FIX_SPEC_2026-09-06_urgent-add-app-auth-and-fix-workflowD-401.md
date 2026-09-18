# FIX SPEC (URGENT) — 2026-09-06 (v2 — đã đổi Phần 1 sang Google OAuth) — Thêm xác thực ứng dụng cho production + fix lỗi 401 Workflow D

**Mức độ ưu tiên: KHẨN CẤP — làm trước khi có người dùng thật vào app ngày mai (07/09/2026).**

**Lịch sử bản spec**: bản đầu tiên (gửi tối 06/09) dùng phương án "1 trang login + 1 mật khẩu dùng chung". Sau khi trao đổi thêm, User quyết định đổi sang **Google OAuth ("Đăng nhập bằng Google") + allowlist email** — miễn phí, chuyên nghiệp hơn, phù hợp với ATS chỉ có vài người dùng nội bộ. **Đây là bản v2 — làm theo Phần 1 bên dưới, KHÔNG làm theo mô tả "mật khẩu dùng chung" nếu bạn thấy ở đâu đó nhắc lại.**

**Người phát hiện lỗ hổng:** User, qua một phiên trình duyệt ẩn danh (incognito) truy cập thẳng `https://crm-ats-web-hazel.vercel.app/` và điều khiển được toàn bộ app **không cần đăng nhập**.

**QA đã xác nhận (Claude, đọc code, không đoán):**
- `find . -iname "middleware*"` trong repo → **không có file middleware/proxy nào**.
- `grep` toàn bộ `src/` cho `next-auth`, `getServerSession`, `requireAuth`, `isAuthenticated`, `withAuth`, `iron-session` → **0 kết quả**.
- `package.json` → **không có bất kỳ thư viện auth nào**.
- Dữ liệu đang bị lộ: **3381+ hồ sơ ứng viên thật (PII)**, 310 jobs, 189 clients, và quan trọng nhất — **quyền điều khiển 2 tài khoản Facebook thật** (trigger đăng bài, warming, join group) qua Server Actions không hề có kiểm tra danh tính người gọi.
- Đã kiểm tra thêm 3 route `src/app/api/biz-test`, `db-test`, `qa-test` (chạy INSERT/UPDATE/DELETE thật để tự test) — **AN TOÀN, không cần sửa**: cả 3 đều gọi `isTestRouteAllowed()` (`src/lib/testRouteGuard.js`), hàm này trả `false` khi `NODE_ENV === 'production'` (Vercel tự set biến này), nên đã tự động bị khoá trên production rồi.

**QA cũng đã kiểm tra (trấn an một phần):** đọc log thực thi n8n từ ngay sau khi deploy cho cả 3 workflow A/C/D → **không thấy execution nào có `mode: webhook`** (chưa có dấu hiệu ai đó bên ngoài bấm nút trong UI để kích hoạt đăng bài/warming thật qua webhook lạ). **Không phải bằng chứng tuyệt đối là chưa ai xem được dữ liệu ứng viên** (xem trang UI không để lại log ở n8n), nhưng ít nhất chưa có dấu hiệu ai đã lợi dụng để đăng bài Facebook thật.

---

## PHẦN 1 (v2) — Google OAuth ("Đăng nhập bằng Google") + allowlist email, dùng Auth.js

**Lý do chọn phương án này:** miễn phí hoàn toàn (Auth.js là thư viện mã nguồn mở, tự host trong chính app Next.js, không tốn phí license/dịch vụ ngoài); SSO doanh nghiệp thật (SAML qua WorkOS/Auth0/Okta) không phù hợp vì tốn phí (ví dụ WorkOS ~$125/tháng/connection) và không cần thiết cho quy mô vài người dùng nội bộ. Repo là dự án JavaScript thuần (không có `tsconfig.json`) → **dùng đuôi file `.js`**, không dùng `.ts`.

### Bước 0 — Tạo Google OAuth Client (làm thủ công trên Google Cloud Console, không phải code)
1. Vào [Google Cloud Console](https://console.cloud.google.com/) → tạo project mới (hoặc dùng project có sẵn) bằng tài khoản Google của User.
2. APIs & Services → **OAuth consent screen**:
   - User Type: **External** (vì dùng Gmail cá nhân, không phải Google Workspace).
   - Publishing status: để ở **Testing** (KHÔNG bấm "Publish App") — ở chế độ Testing, Google không bắt verify app và không hiện cảnh báo "unverified app" đáng sợ cho người dùng, miễn là user đó nằm trong danh sách Test users. Testing mode cho phép tối đa 100 test user — quá đủ cho ATS nội bộ.
   - Thêm **Test users**: nhập chính xác các địa chỉ Gmail của những người được phép dùng ATS (bao gồm `demo@ats-prototype.local` và bất kỳ ai khác User chỉ định).
3. APIs & Services → **Credentials** → Create Credentials → **OAuth client ID** → Application type: **Web application**.
   - Authorized redirect URI: `https://crm-ats-web-hazel.vercel.app/api/auth/callback/google`
   - (Không cần thêm URI cho `localhost` trừ khi User muốn test Google login trên bản `next dev` local — có thể bỏ qua nếu chỉ cần production.)
4. Lưu lại **Client ID** và **Client Secret** — đây là giá trị sẽ set vào Vercel env var ở Bước 3.

### Bước 1 — Cài Auth.js
```bash
npm install next-auth@beta
```
(Auth.js v5 hiện vẫn publish dưới tag `next-auth@beta` — đây là bản khuyến nghị chính thức cho Next.js App Router. Nếu lúc AG làm mà tài liệu chính thức tại authjs.dev đã đổi khác, ưu tiên làm theo hướng dẫn mới nhất trên trang đó thay vì spec này, vì thư viện này cập nhật khá thường xuyên.)

### Bước 2 — Tạo `auth.js` ở root repo (cùng cấp `next.config.js`)
```js
import NextAuth from "next-auth"
import Google from "next-auth/providers/google"

const allowedEmails = (process.env.ALLOWED_EMAILS || "")
  .split(",")
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean)

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [Google],
  callbacks: {
    async signIn({ profile }) {
      const email = profile?.email?.toLowerCase()
      return !!email && allowedEmails.includes(email)
    },
    authorized: async ({ auth }) => !!auth,
  },
  pages: {
    signIn: "/login",
  },
})
```
Lưu ý: `Google` provider mặc định tự đọc `AUTH_GOOGLE_ID`/`AUTH_GOOGLE_SECRET` từ env — không cần truyền tay clientId/clientSecret vào code (xem Bước 4 tên biến chính xác).

### Bước 3 — Tạo API route handler
`src/app/api/auth/[...nextauth]/route.js`:
```js
import { handlers } from "@/auth"
export const { GET, POST } = handlers
```
(Nếu repo không dùng alias `@/`, đổi thành đường dẫn tương đối `../../../../auth.js` tương ứng.)

### Bước 4 — Thêm biến môi trường mới trên Vercel
- `AUTH_SECRET` — chuỗi ngẫu nhiên (chạy `npx auth secret` để tự sinh và note lại giá trị, hoặc `openssl rand -hex 32`).
- `AUTH_GOOGLE_ID` — Client ID lấy ở Bước 0.
- `AUTH_GOOGLE_SECRET` — Client Secret lấy ở Bước 0.
- `ALLOWED_EMAILS` — danh sách email được phép, cách nhau bằng dấu phẩy, ví dụ: `demo@ats-prototype.local,nguoikhac@gmail.com`.
- Set qua `vercel env add <TÊN_BIẾN> production` cho từng biến, sau đó `vercel --prod` để deploy lại.

### Bước 5 — Tạo trang `/login`
`src/app/login/page.js`:
```jsx
import { signIn } from "@/auth"

export default async function LoginPage({ searchParams }) {
  const params = await searchParams
  const denied = params?.error === "AccessDenied"
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "100vh", gap: 16 }}>
      <h1>ATS 3.0 — Đăng nhập</h1>
      {denied && <p style={{ color: "red" }}>Tài khoản Google này không có quyền truy cập.</p>}
      <form
        action={async () => {
          "use server"
          await signIn("google", { redirectTo: "/" })
        }}
      >
        <button type="submit">Đăng nhập bằng Google</button>
      </form>
    </div>
  )
}
```
(Giao diện chỉ cần đủ dùng, không cần đẹp — có thể tinh chỉnh style sau. Khi `signIn` callback trong `auth.js` trả `false` do email không nằm trong allowlist, Auth.js tự redirect về `/login?error=AccessDenied`.)

### Bước 6 — Tạo `proxy.js` ở root repo để chặn route (Next.js 16 đổi tên `middleware` → `proxy`)
**Quan trọng: Next.js 16 (repo đang dùng 16.3.0) đã đổi tên file convention từ `middleware.js` sang `proxy.js`** (xem https://nextjs.org/docs/messages/middleware-to-proxy) — dùng đúng tên `proxy.js`, không phải `middleware.js`.

`proxy.js`:
```js
import { auth } from "@/auth"

export const proxy = auth((req) => {
  if (!req.auth) {
    const loginUrl = new URL("/login", req.nextUrl.origin)
    return Response.redirect(loginUrl)
  }
})

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
}
```
Matcher này loại trừ TOÀN BỘ `/api/*` (bao gồm `/api/webhooks/*` — đã tự có `INTERNAL_WEBHOOK_SECRET` riêng, và `/api/auth/*` — cần public để luồng đăng nhập Google hoạt động) và static assets. Trang `/login` và mọi trang khác (kể cả Server Actions, vì chúng POST vào chính URL trang) đều được bảo vệ.

**Lưu ý AG kiểm tra kỹ**: hiện `/api/` chỉ có 4 thư mục con: `webhooks/*` (đã có secret riêng), `biz-test`, `db-test`, `qa-test` (đã tự khoá bằng `NODE_ENV==='production'`, xem phần đầu file). Nếu sau này có thêm route `/api/...` mới không phải webhook, cần tự bổ sung kiểm tra auth riêng cho route đó (vì matcher này loại trừ toàn bộ `/api/*` khỏi lớp `proxy`).

### Bước 7 — Test bắt buộc trước khi báo hoàn thành
- Mở trình duyệt ẩn danh, vào thẳng `https://crm-ats-web-hazel.vercel.app/` (và `/candidates`, `/campaigns`) → **phải bị redirect về `/login`**.
- Bấm "Đăng nhập bằng Google", đăng nhập bằng 1 tài khoản Gmail **KHÔNG** có trong `ALLOWED_EMAILS` → phải bị từ chối, thấy thông báo lỗi ở `/login`, KHÔNG vào được app.
- Đăng nhập bằng 1 tài khoản Gmail **CÓ** trong `ALLOWED_EMAILS` → vào app bình thường, dữ liệu hiển thị đúng.
- Gọi thử 1 webhook bằng đúng `INTERNAL_WEBHOOK_SECRET` (vd. `curl -X POST .../api/webhooks/campaign-run-progress -H "Authorization: ..."`) → **vẫn phải hoạt động bình thường, KHÔNG bị chặn bởi `proxy.js`**.
- Kiểm tra n8n: để 1 chu kỳ cron chạy (5-10 phút) và xác nhận Workflow A/C/D KHÔNG bị lỗi mới do proxy chặn nhầm webhook route.

---

## PHẦN 2 — Fix lỗi mới phát hiện: Workflow D lỗi 401 100% từ lúc cutover

**QA phát hiện qua đọc log n8n (`get_workflow_execution`, execution id 670/672/673/674/676, workflow D `EMAUfa5HCgyf6yPO`):** Node **"POST Claim Schedule"** gọi `https://crm-ats-web-hazel.vercel.app/api/webhooks/group-membership-sync-claim-schedule` bị **401 Unauthorized** — **100% các lần chạy** kể từ ~15:30 UTC hôm nay (ngay sau khi cutover Vercel), cứ mỗi 5 phút lại lỗi 1 lần.

Node dùng credential tên **"ATS 3.0 Internal Webhook Secret"** (httpHeaderAuth) — response trả về `{"error":"Unauthorized"}`. Nhiều khả năng: giá trị `INTERNAL_WEBHOOK_SECRET` set trên Vercel (env var mới, có thể do AG tạo mới lúc deploy) **không khớp** với giá trị đang lưu trong credential n8n đó (giá trị cũ, dùng cho server local qua tunnel).

**Yêu cầu AG:**
1. Lấy đúng giá trị `INTERNAL_WEBHOOK_SECRET` hiện đang set trên Vercel production (`vercel env pull` hoặc xem trong dashboard Vercel → Settings → Environment Variables).
2. So sánh với giá trị đang lưu trong n8n credential **"ATS 3.0 Internal Webhook Secret"** (không thể xem trực tiếp giá trị cũ trong n8n vì bị ẩn, nhưng có thể **ghi đè bằng giá trị đúng lấy từ Vercel** để đảm bảo khớp).
3. Cập nhật lại giá trị trong n8n credential đó cho khớp với Vercel.
4. Chờ 1 chu kỳ cron (5 phút) và xác nhận Workflow D chạy **success**, không còn lỗi 401.
5. Lưu ý: kiểm tra luôn xem các credential httpHeaderAuth khác dùng cho Workflow A/C có bị tình trạng tương tự không (dù log hiện tại chưa cho thấy A/C bị lỗi, nhưng cứ rà soát cho chắc vì cả 3 workflow đều được đổi URL cùng lúc).

---

## PHẦN 3 — Rà soát 4 webhook route KHÔNG có kiểm tra `INTERNAL_WEBHOOK_SECRET`

QA grep `INTERNAL_WEBHOOK_SECRET` trong `src/app/api/webhooks/**` → 13/17 route có enforce, nhưng **4 route sau đây KHÔNG xuất hiện trong kết quả grep** (cần AG xác nhận đây là chủ đích — vd. webhook nhận từ nguồn ngoài không thể gửi secret — hay là thiếu sót cần bổ sung):
- `src/app/api/webhooks/cv-batch/route.js`
- `src/app/api/webhooks/cv-batch-item/route.js`
- `src/app/api/webhooks/cv-import/route.js`
- `src/app/api/webhooks/notifications/route.js`

Nếu các route này nhận dữ liệu ghi vào DB (không phải chỉ đọc), và không có lý do đặc biệt để public, nên bổ sung cùng cơ chế `INTERNAL_WEBHOOK_SECRET` như 13 route còn lại.

---

## Báo cáo lại

Sau khi hoàn tất, ghi log vào `docs/DEVELOPMENT_LOG.md` như các lần trước, và báo lại cho Claude các mục:
- Kết quả test Phần 1 Bước 7 (đăng nhập Google, chặn ẩn danh, chặn email không trong allowlist, webhook không bị chặn nhầm).
- Danh sách email cuối cùng đã đưa vào `ALLOWED_EMAILS`.
- Giá trị cũ/mới của `INTERNAL_WEBHOOK_SECRET` có khớp không (không cần gửi giá trị thật, chỉ cần xác nhận đã đồng bộ).
- Kết luận về 4 route ở Phần 3: giữ nguyên (nêu lý do) hay đã bổ sung secret check.
