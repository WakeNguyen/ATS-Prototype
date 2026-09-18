**Từ:** Claude (Architect/QA)

# QA Security Audit — 2026-09-13 — Env Vars, Secrets/Tokens & Rủi Ro Dự Án

Audit toàn diện theo yêu cầu của Thức (PO), phạm vi: (1) biến môi trường & DATABASE_URL,
(2) tokens/passwords, (3) các rủi ro khác liên quan dự án `ats-web`. Đây là audit
**thuần đọc** — không sửa code, không rotate secret nào. Mọi phát hiện đều kèm bằng
chứng trực tiếp (lệnh đã chạy + output thật), không suy đoán chung chung.

---

## 🔴 RỦI RO CAO (đã xử lý)

### 1. ✅ ĐÃ ROTATE — `BRIDGE_INTERNAL_SECRET` thật bị commit vào file "example" trong lịch sử Git

- **Bằng chứng:** `git log --all --full-history -- "docs/secrets/**"` cho 0 kết quả (an
  toàn), nhưng `git log --all --full-history --oneline -- "*.env*"` cho ra 1 kết quả:
  commit `def02cb` (02/09/2026, "feat(vps): implement Phase 4a HTTP bridge server")
  thêm file `scripts/.env.bridge.example` chứa:
  ```
  BRIDGE_PORT=5680
  BRIDGE_INTERNAL_SECRET=ats3_vps_bridge_secret_2026_secure_token!
  BRIDGE_TIMEOUT_MS=3300000
  ```
- **Xác nhận đây là secret THẬT, không phải placeholder:** `scripts/bridge-server.js`
  dòng 41 đọc `process.env.BRIDGE_INTERNAL_SECRET` và dòng 288 dùng nó để xác thực mọi
  request từ n8n gửi tới VPS bridge server (`reqSecret !== SECRET` → reject). Giá trị
  `ats3_vps_bridge_secret_2026_secure_token!` đúng văn phong các secret thật khác trong
  dự án (vd `APP_ENCRYPTION_SECRET=ats3_secret_encryption_key_2026_aes256_secure!`) —
  rất khó là placeholder ngẫu nhiên.
- **File này vẫn còn y nguyên trên disk hiện tại** (đã đọc lại, không đổi) và **vẫn nằm
  trong lịch sử Git** kể từ 02/09/2026 tới nay.
- **Mức độ rủi ro thực tế:** Repo là **private** (`githubRepoVisibility: "private"`,
  xác nhận qua Vercel API) nên chỉ người có quyền truy cập repo GitHub mới thấy được —
  không phải rủi ro "public internet" ngay lập tức. Nhưng đây vẫn là secret thật đang
  bảo vệ 1 server thật (VPS bridge điều khiển Playwright/Facebook), nằm trong lịch sử
  Git vĩnh viễn (xoá file hiện tại không xoá được khỏi history cũ).
- **Đã xử lý (13/09/2026):**
  1. `scripts/.env.bridge.example` đã sửa thành placeholder (commit `bb7c898`, đã merge
     vào `development` + `master`).
  2. Secret thật trên VPS đã được Antigravity rotate qua bridge (theo uỷ quyền trực
     tiếp của Thức), verify bằng bằng chứng thật: `pm2 status` → `fb-bridge online`;
     curl với secret sai → `401`; curl với secret mới → `200`.
  3. n8n Credential "ATS 3.0 VPS Bridge Secret" đã được Thức tự cập nhật giá trị mới
     qua n8n UI (n8n không có API cho phép sửa giá trị Credential qua công cụ tự động).
  4. Chưa có lần chạy campaign thật nào kể từ sau khi rotate để xác nhận end-to-end
     100% — sẽ tự kiểm tra execution history của workflow "A: FB Group Auto-Post" ở
     lần chạy thật tiếp theo.
  - `git filter-repo`/BFG để xoá secret cũ khỏi lịch sử Git vĩnh viễn: chưa làm (rủi ro
    viết lại lịch sử git), để ngỏ cho Thức quyết định sau nếu muốn triệt để hơn — không
    khẩn cấp vì secret cũ đã bị vô hiệu hoá và repo là private.

### 2. `AUTH_SECRET` dùng chung cho mọi Environment trên Vercel

- **Bằng chứng:** Thức tự kiểm tra Vercel Dashboard xác nhận `AUTH_SECRET` có badge
  "Needs Attention", scope "All Environments" (1 giá trị cho cả Production/Preview/
  Development trên Vercel).
- **Điểm tích cực đã xác minh:** giá trị này (`2db8b9a1...`) **khác hoàn toàn** với
  `AUTH_SECRET` trong `.env.local` local (`96f8c858...`) — dev local không vô tình dùng
  chung secret với Vercel.
- **Rủi ro còn lại:** Nếu 1 Preview deployment (branch nhánh task nào đó) từng bị lộ
  URL hoặc bị truy cập trái phép, kẻ tấn công có session hợp lệ ở đó **cũng dùng được**
  để giả mạo trên Production, vì cùng 1 `AUTH_SECRET`. Đây chính là lý do Vercel tự gắn
  cảnh báo "Needs Attention" kèm gợi ý "Separate Production Secret Values".
- **Khuyến nghị:** Tách `AUTH_SECRET` riêng cho Production trên Vercel (Thức tự quyết
  định thời điểm — không khẩn cấp vì SSO Protection của Vercel đã có 1 lớp chặn nữa,
  xem mục 5 bên dưới).

---

## 🟡 RỦI RO TRUNG BÌNH

### 3. ✅ ĐÃ XÁC NHẬN — Vercel SSO Protection không thực sự chặn domain production chính

- **Bằng chứng:** `get_project_deployment_protection` trả về `ssoProtection.enabled:
  true`, `deploymentType: "all_except_custom_domains"`. Dự án không có custom domain.
- **Test thật (13/09/2026):** Thức tự mở `crm-ats-web-hazel.vercel.app` trong tab ẩn
  danh (chưa đăng nhập Vercel) → đi thẳng vào màn hình "ATS 3.0 — Sign In" của app,
  KHÔNG có màn hình chặn của Vercel SSO trước đó. Xác nhận: SSO Protection không bảo
  vệ domain này trên thực tế, dù dashboard hiển thị "All Environments" — khả năng cao
  domain "production alias" bị Vercel loại trừ mặc định.
- **Đánh giá rủi ro:** Không nghiêm trọng — lớp bảo vệ chính (Google OAuth +
  `ALLOWED_EMAILS` chỉ 1 email được phép) vẫn hoạt động, chặn đúng người lạ. Chỉ thiếu
  lớp phòng thủ thứ 2 (defense-in-depth).
- **Khuyến nghị:** Không khẩn cấp (Thức xác nhận). Có thể cân nhắc bật thêm Vercel
  Password Protection sau nếu muốn thêm 1 lớp, tuỳ quyết định UX/bảo mật của Thức.

### 4. ✅ ĐÃ SỬA — `execSync` với string interpolation trong `scripts/run-batch.js`

- **Bằng chứng gốc:** dòng 133 & 240: `execSync(\`node -e "setTimeout(() => {}, ${waitMs})"\`)`
  — nối biến số (`waitMs`, tính từ cooldown timer + `Math.random()`) trực tiếp vào chuỗi
  lệnh shell. Hiện tại KHÔNG khai thác được vì `waitMs` luôn là số nội bộ (không phải
  input từ bên ngoài) — chỉ là anti-pattern, không phải lỗ hổng đang bị khai thác.
- **Đã xử lý (13/09/2026):** Antigravity thay cả 2 vị trí bằng
  `await new Promise(resolve => setTimeout(resolve, ...))` (commit `bb7c898`, đã merge
  vào `development` + `master`) — xác nhận context đã nằm sẵn trong async IIFE trước
  khi đổi, `node --check` PASS.

---

## 🟢 ĐÃ KIỂM TRA — AN TOÀN (không cần hành động)

| Hạng mục | Bằng chứng |
|---|---|
| **`.gitignore` che đúng toàn bộ file env** | `.env`, `.env.local`, `.env*.local`, `.env*`, `docs/secrets/` đều có trong `.gitignore`. `git log --all --full-history` xác nhận **0 lần** các file `.env`/`.env.local`/`.env.development` thật hay `docs/secrets/**` từng bị commit. |
| **18/18 webhook routes (`src/app/api/webhooks/*/route.js`) đều xác thực `INTERNAL_WEBHOOK_SECRET`** | Grep pattern `secret !== process.env.INTERNAL_WEBHOOK_SECRET` khớp đúng 18/18 file, đúng bằng số lượng route trong thư mục — không route nào bị bỏ sót. Pattern fail-closed: `if (!secret \|\| secret !== process.env.INTERNAL_WEBHOOK_SECRET) return 401`. |
| **`cv-upload-proxy` dùng NextAuth session thay vì shared secret (khác pattern nhưng vẫn an toàn)** | Route này được gọi TỪ frontend đã đăng nhập, verify bằng `await auth()` trước khi forward sang n8n — không phải lỗ hổng, chỉ là pattern khác các webhook nhận từ n8n. |
| **`BRIDGE_INTERNAL_SECRET` check trong `bridge-server.js` fail-closed đúng chuẩn** | Dòng 288: `if (!SECRET \|\| !reqSecret \|\| reqSecret !== SECRET)` — không có trường hợp secret rỗng/undefined lại vô tình pass. |
| **`bridge-server.js` spawn process an toàn** | Dùng `spawn(process.execPath, [scriptFullPath, tempFilePath], ...)` — dạng mảng argument, KHÔNG qua shell string — không có injection risk. |
| **Không có XSS/injection pattern nguy hiểm trong `src/`** | Grep `dangerouslySetInnerHTML\|eval(\|sql.unsafe\|execSync\|child_process` trên toàn bộ `src/` → 0 kết quả. |
| **Không lộ Supabase anon key/client SDK ở phía client** | Grep `NEXT_PUBLIC_SUPABASE\|SUPABASE_ANON\|supabase-js` trên `src/` → 0 kết quả. App chỉ kết nối DB qua connection string phía server (`src/lib/db.js`), không có kênh PostgREST/anon nào lộ ra frontend. |
| **RLS "enabled nhưng không có policy" trên 43 bảng (`public` + `sandbox`)** | Supabase advisor mức **INFO** (không phải WARN/ERROR) — đây thực chất là mặc định AN TOÀN: RLS bật + không có policy = deny-all qua PostgREST/anon API. Vì app không dùng kênh đó (xác nhận ở trên), đây không phải lỗ hổng — chỉ là Supabase thông báo "các bảng này không truy cập được qua REST API", đúng như thiết kế. |
| **Không có hardcoded API key dạng chuẩn (AWS/OpenAI/GitHub/Slack) trong source** | Grep pattern chữ ký các loại key phổ biến (`AKIA...`, `sk-...`, `ghp_...`, `xox[b-s]-...`, PEM private key block) trên toàn repo (trừ `node_modules`) → 0 kết quả. |
| **`.claude/settings.local.json` (worktree bridge) không auto-approve lệnh nguy hiểm** | Chỉ allow đúng 2 script cụ thể theo path tuyệt đối (`run_demo.sh`, `fix_demo.sh`) — không có wildcard hay lệnh rủi ro nào được pre-approve. |
| **GitHub repo private** | `githubRepoVisibility: "private"` xác nhận qua Vercel API. |
| **Database sandbox isolation cho bridge Claude↔Antigravity hoạt động đúng** | Đã verify trực tiếp trong phiên này: `ag_dev_role` chỉ có quyền trên schema `sandbox`, không có `USAGE` trên `public`/`extensions` cho tới khi được cấp thủ công (xem phần trước của phiên làm việc); `.env.local` (dev) và Vercel `AUTH_SECRET` là 2 giá trị khác nhau hoàn toàn. |

---

## ⚪ THÔNG TIN THÊM (không phải rủi ro, chỉ ghi nhận)

- **`docs/secrets/` chứa nhiều credential thật ở dạng plaintext** (Google OAuth client
  secret, Supabase management token 90 ngày, ghi chú Vercel/GitHub) — thư mục này đã
  gitignore đúng và chưa từng bị commit. Đây là kho lưu trữ cục bộ hợp lý cho 1 người
  dùng, nhưng lưu ý: các giá trị này đã hiển thị trong transcript của phiên chat Claude
  Code này (Google client_secret, DB password, `ag_dev_role` password, `AUTH_SECRET`
  local) khi Claude đọc để phục vụ việc setup/QA trong phiên — nếu Thức lo ngại về việc
  log hội thoại AI lưu trữ các giá trị này, có thể cân nhắc rotate các secret đã hiển
  thị, dù đây không phải rò rỉ ra bên thứ ba nào.
- **`VERCEL_OIDC_TOKEN` trong `.env.local` là JWT ngắn hạn** (có `exp` claim), rủi ro
  thấp nếu lộ do tự hết hạn.

---

## Tổng Kết Ưu Tiên Hành Động — CẬP NHẬT 13/09/2026 (đã đóng vòng)

1. ✅ **Đã xử lý:** Rotate `BRIDGE_INTERNAL_SECRET` (mục 1) — code repo dọn xong
  (`bb7c898`), secret thật trên VPS đã rotate qua Antigravity (uỷ quyền trực tiếp của
  Thức), n8n Credential đã cập nhật thủ công. Còn thiếu: xác nhận end-to-end qua 1 lần
  chạy campaign thật (Claude sẽ tự kiểm tra execution history ở lần chạy tiếp theo).
2. ✅ **Đã xử lý:** Thay `execSync` bằng `await new Promise(setTimeout)` trong
  `run-batch.js` (mục 4) — cùng commit `bb7c898`.
3. ✅ **Đã xác nhận, không hành động thêm:** Vercel SSO Protection không chặn domain
  production chính (mục 3) — rủi ro thấp, Thức xác nhận không gấp.
4. ⏳ **Còn để ngỏ, không khẩn (Thức xác nhận):** Tách `AUTH_SECRET` riêng cho
  Production trên Vercel (mục 2) — quyết định tuỳ thời điểm của Thức.
5. **Không cần hành động:** Toàn bộ các mục còn lại đã kiểm tra và xác nhận an toàn.

Tất cả thay đổi code (mục 1 phần repo, mục 4) đã qua đúng quy trình Antigravity
(Implementer) → Claude QA & merge `development`/`master`. Thay đổi hạ tầng thật (VPS,
n8n Credential) đều có uỷ quyền trực tiếp, từng lần của Thức trước khi thực hiện, theo
đúng CLAUDE.md mục 2.
