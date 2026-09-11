# PLAN: Cutover DB_SCHEMA sandbox → public để Deploy Thật (06/09/2026, cần xong trước 07/09/2026)

## 0. Bối cảnh
User cần dùng ATS 3.0 thật vào ngày mai, dùng nick Facebook THẬT để chạy workflow. Yêu cầu: chuyển app từ `DB_SCHEMA=sandbox` sang `DB_SCHEMA=public`, migrate dữ liệu campaign (đã tạo/test bằng tài khoản thật) từ `sandbox` sang `public`.

## 1. Khảo sát thật (Claude đã verify trực tiếp qua Supabase MCP, 06/09/2026)

### 1.1. Cơ chế chọn schema — CHỈ 1 ĐIỂM DUY NHẤT
`src/lib/db.js` đọc `process.env.DB_SCHEMA` (mặc định `sandbox`), set `search_path` cho toàn bộ kết nối Postgres dùng chung (`postgres` package) — áp dụng cho MỌI Server Action + webhook route của Next.js. Đã grep xác nhận:
- `scripts/bridge-server.js` và các script Playwright trên VPS (`sync-group-memberships.js`, `warm-and-join.js`) **KHÔNG đụng DB trực tiếp** — chỉ nhận lệnh CLI, không cần sửa gì bên VPS.
- `campaign_actions.js` và các webhook route không hard-code `sandbox` (trừ 1 chỗ fallback UNIQUE index ở `import-social-groups/route.js`, đã có cảnh báo an toàn khi chạy trên `public`).

→ **Chỉ cần đổi `DB_SCHEMA=public` trong `.env.local` + restart Next.js process là toàn bộ app (kể cả campaign) chuyển hẳn sang `public`.**

### 1.2. Số liệu hiện tại (query trực tiếp, 06/09/2026 14:25 UTC)

| Bảng | `public` | `sandbox` | Ghi chú |
|---|---:|---:|---|
| candidates | 3381 | 1710 | `public` là dữ liệu thật gốc (Notion cũ), KHÔNG đụng vào |
| jobs | 310 | — | như trên |
| clients | 189 | — | như trên |
| social_group_urls | 1028 | 1028 | **URL trùng 100% (1028/1028) nhưng ID KHÁC HOÀN TOÀN (0/1028 match)** — không migrate lại bảng này, nhưng bảng khác tham chiếu tới nó (`fb_account_groups`) PHẢI remap theo URL, không copy thẳng ID |
| campaigns | 0 | 3 | "Test 2", "Test Warming Campaign", "Test Job posting" — dùng tài khoản FB thật |
| campaign_runs | 0 | 6 | |
| campaign_run_items | 0 | 6 | |
| fb_accounts | 0 | 2 | 2 account thật ("Nick Chính", "Nick Phụ Nguyễn Thuý") |
| fb_account_groups | — | 49 | |
| warm_join_runs | 0 | 10 | |
| warm_join_run_items | 0 | 59 | |
| notifications | — | 47 | có thể lẫn notification dev/test không liên quan campaign |
| group_membership_sync_runs | 0 | 0 | Workflow D chưa chạy lần nào — bỏ qua |

### 1.3. RLS — hạ mức cảnh báo so với ghi chú cũ trong memory
Advisor Supabase báo TẤT CẢ bảng ở cả 2 schema đều `rls_enabled_no_policy` (RLS **đã bật**, chỉ thiếu policy) — không phải "RLS tắt" như ghi chú CRITICAL trước đó. App kết nối bằng `DATABASE_URL` (Postgres role trực tiếp, không qua PostgREST/anon key) nên **bypass RLS theo thiết kế** — không tìm thấy biến `NEXT_PUBLIC_SUPABASE_*` nào trong `.env.local`, nghĩa là không có client nào dùng anon key để bị chặn/lọt qua RLS. **Kết luận: không phải blocker khẩn cấp cho việc deploy ngày mai** (khác với đánh giá CRITICAL ghi trước đó trong memory — sẽ sửa lại).

## 2. Việc cần làm, theo đúng thứ tự (Claude = Architect/QA, viết SQL/spec, chờ User duyệt trước khi chạy lên data thật)

1. **Backup trước khi động vào bất cứ gì** — Claude đề xuất chạy `pg_dump` (hoặc Supabase snapshot) cho cả 2 schema `sandbox` + `public` trước bước 2. *(cần User xác nhận cách backup phù hợp.)*
2. **Sửa 3 dòng data sai còn sót từ execution 515** trong `sandbox` (đã ghi id cụ thể trong `campaign-fb-autopost-status.md`) — sửa TRƯỚC khi migrate để không mang lỗi cũ sang `public`.
3. **Viết migration script (SQL, chạy 1 lần)**:
   - `fb_accounts`: copy 2 dòng nguyên trạng (giữ nguyên `id`, `public.fb_accounts` đang rỗng nên không đụng độ).
   - `campaigns`, `campaign_runs`, `campaign_run_items`: copy nguyên trạng (giữ nguyên `id`, `public` đang rỗng cả 3 bảng).
   - `fb_account_groups` (49 dòng): **BẮT BUỘC remap `social_group_url_id`** bằng JOIN theo `lower(trim(url))` giữa `sandbox.social_group_urls` và `public.social_group_urls` (vì ID không khớp) — `fb_account_id` giữ nguyên (vì `fb_accounts` copy y hệt id ở bước trên).
   - `warm_join_runs`, `warm_join_run_items` (10 + 59 dòng): copy nguyên trạng, remap group reference tương tự nếu bảng có tham chiếu `social_group_urls`.
   - `notifications` (47 dòng): **cần User quyết định** — migrate toàn bộ hay lọc chỉ phần liên quan campaign.
4. **Chạy migration** qua Supabase MCP (Claude thực hiện trực tiếp, đúng phân công PHẦN 1-2 trong `PLAN_2026-09-02` — nhưng sẽ trình SQL cụ thể cho User duyệt trước khi chạy, đúng bài học sau sự kiện 05/09).
5. **Đổi `DB_SCHEMA=public`** trong `.env.local`, restart Next.js.
6. **Smoke test ngay sau khi đổi**: mở lại UI, kiểm tra 3 campaign đã migrate hiển thị đúng Run History/FB Accounts/Social Groups, kiểm tra `/candidates`, `/jobs` vẫn hoạt động bình thường với dữ liệu thật gốc (3381 candidates) không bị ảnh hưởng.
7. Cân nhắc chuyển `npm run dev` → `npm run build && npm run start` (production build) nếu định dùng hàng ngày — *cần User xác nhận có muốn làm trước hạn ngày mai không, và host trên máy cá nhân hay VPS (máy tắt = app tắt nếu chạy local).*

## 3. Rủi ro CHƯA xử lý — cần User quyết định có chấp nhận đi kèm hay chặn lại trước khi cutover

- **Race condition 3 chiều** (Job Posting / Warming / Workflow D không kiểm tra nhau trước khi dispatch, xem `campaign-fb-autopost-status.md`) — VẪN CÒN NGUYÊN dù chuyển sang `public`. User đã biết và chọn giữ Workflow D chạy — nhưng đó là quyết định lúc còn ở `sandbox` (dữ liệu test). Cutover sang `public` = dùng dữ liệu/account thật hàng ngày → rủi ro race condition giờ áp lên vận hành thật, không còn là test nữa. **Cần User xác nhận lại có OK không, hay muốn AG fix gấp trước khi cutover.**
- Git hygiene: `docs/secrets/` chưa có trong `.gitignore`, file Handover chứa secret plaintext nghi vấn chưa redact — nên dọn trước khi bất kỳ ai khác có quyền truy cập repo.

## 4. Câu hỏi cần User trả lời để Claude viết SQL migration cụ thể và tiến hành

1. Cách backup trước khi migrate: Claude tự `pg_dump` qua MCP, hay User đã có cơ chế backup riêng của Supabase?
2. 3 dòng data sai (execution 515): Claude tự sửa được không, hay để dành AG?
3. `notifications` (47 dòng): migrate hết hay lọc riêng phần liên quan campaign?
4. Có build production (`next build && next start`) trước khi dùng thật không, hay giữ `next dev` tạm thời?
5. Race condition 3 chiều (Workflow D) — chấp nhận rủi ro tiếp tục, hay chặn cutover lại chờ AG fix trước?
