# QA — 2026-09-07 — Kiểm Tra Tổng Thể Lần Cuối Trước Khi Dùng Thật (Final Production Readiness Review)

**Bối cảnh:** User yêu cầu rà soát kỹ toàn bộ ATS 3.0 trước khi chính thức đưa vào sử dụng thật cho công việc hàng ngày (07/09/2026). Đây là review độc lập của Claude (Architect/QA) — không dựa vào note/memory cũ (đã xác nhận có lag so với thực tế), mà tự tra trực tiếp: `git log`, n8n MCP (`get_workflow_details`), Supabase MCP (SQL trực tiếp, `get_advisors`), Vercel MCP (`list_deployments`, `get_project_deployment_protection`), và test thật qua HTTP (WebFetch, có cache-bust) vào domain production.

**Kết luận ngắn gọn: Hệ thống đủ an toàn để bắt đầu dùng thật hôm nay.** Có đúng 2 việc nhỏ nên xử lý sớm (không chặn dùng ngay) — xem PHẦN 2. Chi tiết verify từng mục ở PHẦN 1.

---

## PHẦN 1 — Các hạng mục đã verify TRỰC TIẾP (không chỉ đọc log cũ)

### 1.1. Xác thực (Auth) — ✅ PASS, verify độc lập lại lần nữa
- Code `src/proxy.js` + `auth.js`: logic redirect đúng — chưa đăng nhập → redirect `/login`; đã đăng nhập mà vào `/login` → redirect về `/`; allowlist qua `ALLOWED_EMAILS` trong callback `signIn`.
- Test thật bằng HTTP request ẩn danh (không cookie) vào 3 URL production, dùng cache-bust query để tránh cache cũ:
  - `/` → redirect đúng về trang "ATS 3.0 — Sign In".
  - `/candidates` → redirect đúng về trang Sign In.
  - `/search` → redirect đúng về trang Sign In.
  - `/login` → hiển thị đúng nút "Sign in with Google", không lộ dữ liệu.
- **Lưu ý kỹ thuật (không phải lỗ hổng):** Lần fetch đầu tiên (không cache-bust) vào `/` và `/candidates` trả về shell trang (nav "Candidates/Jobs & Clients/Campaigns", không có dữ liệu thật, "0 total applications") — nghi ngờ ban đầu là lỗ hổng bypass auth. Đã retest ngay với query cache-bust (`?nocache=...`) và nhận đúng trang Sign In — kết luận: đây là cache cũ (nhiều khả năng cache 15 phút của chính tool WebFetch, hoặc cache CDN từ 1 lần fetch ẩn danh trước đó), không phải lỗi thật. Khuyến nghị: nếu tự test lại bằng WebFetch/công cụ không chạy JS, luôn thêm query string ngẫu nhiên để tránh nhầm lẫn tương tự.

### 1.2. GitHub repo & Vercel Git Integration — ✅ PASS
- Repo `WakeNguyen/ats-web` xác nhận **Private** qua 2 nguồn độc lập: GitHub API trả 404 (không lộ tồn tại repo cho người ẩn danh) + metadata Vercel deployment (`githubRepoVisibility: "private"`).
- `git log --all --oneline -- .env .env.local .env.production` → rỗng, xác nhận chưa từng có file `.env*` thật nào bị commit nhầm.
- Deployment mới nhất (commit `3b4d188`) đang `READY`, production domain `crm-ats-web-hazel.vercel.app`, region `sin1`. 2 deployment cũ hơn trong ngày ở trạng thái `BLOCKED` (do giới hạn concurrent build của Vercel, không phải lỗi code) — không ảnh hưởng vì deployment mới nhất đã READY.

### 1.3. Secret `INTERNAL_WEBHOOK_SECRET` — ✅ PASS (đã rotate đúng quy trình)
- Xác nhận đã sinh giá trị mới (32-byte hex), đồng bộ Vercel Production + n8n credential `Je1dHcRXyZhrXODl` (SNAP-20260907-119). Giá trị CŨ vẫn còn dạng plaintext ở 2 chỗ lịch sử trong `docs/DEVELOPMENT_LOG.md` — chấp nhận được vì đã "chết" (không dùng gọi webhook thật được nữa), đúng như FIX_SPEC gốc đã chốt. Không bắt buộc viết lại lịch sử git.

### 1.4. Vercel Deployment Protection — ℹ️ Đã kiểm tra, không chặn việc dùng thật
- `ssoProtection.enabled = true`, phạm vi `all_except_custom_domains` — đã verify thực tế domain production hiện tại (`crm-ats-web-hazel.vercel.app`) KHÔNG bị lớp này chặn (test HTTP ẩn danh vẫn vào được app, chỉ bị chặn bởi lớp Auth.js của chính app như thiết kế). Lưu ý cho tương lai: nếu sau này thêm domain phụ hoặc dùng Preview deployment để test, lớp bảo vệ này có thể áp dụng khác — không phải việc cần làm ngay.

### 1.5. n8n Workflows — ✅ Tất cả các workflow chính đều `active: true`
`A: FB Group Auto-Post` (`9W588GooZeZhiSKm`), `C: FB Auto-Warm & Group Auto-Joiner` (`L8QdckqW7FDwanRq`), `D: FB Group Membership Auto-Sync` (`EMAUfa5HCgyf6yPO`), `CV Parser → ATS 3.0 (Supabase) Dedup` (`fofSZKkdyhlVd9Lc`) — đã publish, đang live.

### 1.6. Dữ liệu production (Supabase, schema `public`) — ✅ Cơ bản sạch
- 3381 candidates, RLS bật trên toàn bộ bảng ở cả 2 schema (`public`, `sandbox`). `get_advisors` chỉ báo mức `INFO` "RLS enabled, no policy" — đã đánh giá từ trước và xác nhận lại: không phải lỗ hổng trong kiến trúc hiện tại vì backend (`src/lib/db.js`) kết nối Postgres trực tiếp bằng connection string riêng, không đi qua PostgREST/Supabase public API bằng anon key — nên việc thiếu policy không mở lối cho client-side truy cập trực tiếp.
- Record test mutation "blacklist" cũ (`5e06d076-...`) nêu trong note trước — kiểm tra lại: **không còn tồn tại** trong `public.candidates` (đã bị dọn ở lần nào đó trước cutover, hoặc chưa từng được đưa vào `public`). Không cần xử lý.
- `pending_cv_imports`: 0 dòng — sạch, không có batch nào bị kẹt.

---

## PHẦN 2 — Phát hiện MỚI trong lần review này (cần xử lý)

### 2.1. 🔴 1 hồ sơ ứng viên TEST lọt vào dữ liệu thật — (đây là câu hỏi User đặt ra khi thấy trên UI)
- **Candidate #3416 "Hoang Minh Phase2 New01"** (`id: 01a077cf-9b7d-a1ed-afb9-b38344ea4cd1`), email `phase2.new01@fake-test.local`, phone `+84900000101`, LinkedIn `linkedin.com/in/phase2-new-01` — **root cause đã xác nhận chính xác qua Supabase (không phải suy đoán ban đầu)**: đây KHÔNG phải rác từ cutover `sandbox`→`public` cũ, mà là candidate mới tạo lúc **06/09 17:41 UTC (00:41 giờ VN, 07/09)** — đúng lúc AG tự chạy test E2E để verify fix "CV Upload gọi nhầm domain dev" (SNAP-20260907-122), bằng cách upload file `QA_Test_CV_Verification.pdf` (batch `520d21fb-563f-48cf-8fec-abefc4ebece6`, nguồn `n8n_form_upload`) thẳng vào webhook **production thật** (đúng theo mục đích spec — cần test domain production thật) nhưng KHÔNG dọn dẹp record test sau khi verify xong.
- Đã quét toàn bộ `public.candidates` bằng nhiều pattern (`%test%`, `%fake%`, `%phase%`, `%conflict%`, `%ambiguous%`, số điện thoại dạng chuỗi test `+8490000XXXX`, domain `.local`/`fake-test`) — **xác nhận đây là bản ghi rác DUY NHẤT còn sót**, không có bản ghi test nào khác. (Các kết quả khác khớp từ khoá "test" đều là dữ liệu THẬT của ứng viên có nghề nghiệp Tester/QA/Automation Test — không phải dữ liệu giả.)
- Đã kiểm tra phụ thuộc — an toàn để xoá: `activity`=0, `onboarding_history`=0, `reach_sourcing`=0 dòng thật; chỉ có 1 dòng `cv_import_batch_items` (chính batch test đó) và 3 dòng `contact_points` (của chính candidate này) — xoá theo đúng thứ tự FK sẽ không ảnh hưởng gì đến dữ liệu ứng viên/khách hàng thật khác.
- **Theo đúng ranh giới vai trò, Claude không tự chạy DELETE** — xem `FIX_SPEC_2026-09-07_pre-launch-cleanup.md` để giao AG (việc rất nhỏ, cùng dạng đã làm với record #3415 ở SNAP-119).

### 2.2. 🟡 Node "Upload CV to Drive" (n8n CV Parser) vẫn trỏ vào Temp folder, chưa đổi sang folder Candidate thật
- Đọc trực tiếp `get_workflow_details` workflow `fofSZKkdyhlVd9Lc`: node `Upload CV to Drive` có `folderId` = `1sXNrOHRswKzy_hyXZE2wi2nEfg2WFS_d`, `cachedResultName: "Temp Candidate Folder (for testing)"`.
- Đây là việc đã được ghi nhận từ trước (n8n-cv-parser-status, "việc vận hành còn lại trước khi dùng thật") nhưng đến giờ vẫn CHƯA được đổi.
- **Không phải lỗi chức năng** — candidate vẫn được tạo đúng trong Supabase dù file CV nằm ở Temp — nhưng về lâu dài, mọi file CV upload qua app từ hôm nay sẽ nằm trong 1 folder "Temp" thay vì folder Candidate chính thức, gây khó quản lý file trên Google Drive khi số lượng tăng lên.
- Khuyến nghị: quyết định sớm — nếu muốn tách hẳn ngay bây giờ, cần AG đổi `folderId` trong node này sang ID folder Candidate thật rồi publish lại; nếu chấp nhận dùng Temp folder tạm thời (rồi dọn sau), cũng được nhưng nên ghi rõ quyết định vào devlog để không quên.

---

## PHẦN 3 — Việc còn treo khác (không chặn dùng ngay, đã biết từ trước, nêu lại để đầy đủ bức tranh)
1. `.env.local` (máy dev local của User) đang set `DB_SCHEMA=public` — tức nếu chạy `npm run dev` cục bộ để test/dev tiếp, mọi thao tác sẽ ghi thẳng vào dữ liệu SẢN XUẤT thật, không phải sandbox. Nên cân nhắc đổi lại `sandbox` khi cần dev/test cục bộ, chỉ đổi về `public` lúc thật sự deploy/verify production.
2. Workflow (B) "Import Social Group URL" — quyết định có cần làm tiếp hay không vẫn đang chờ User.
3. "Trụ cột 6" trong blueprint kiến trúc — vẫn thiếu nội dung, chờ User quyết định (không khẩn).
4. n8n Docker cũ → VPS n8n — chỉ dừng ở mức khảo sát khả thi, chưa migrate (đã chốt: không ưu tiên).

---

## Tổng kết
Không phát hiện lỗ hổng bảo mật mới nào đang mở. Auth, git hygiene, secret rotation đều đã verify PASS bằng bằng chứng trực tiếp (không chỉ tin log cũ). 2 việc ở PHẦN 2 nên xử lý trong vài ngày tới nhưng không cần chặn việc bắt đầu dùng thật từ hôm nay.
