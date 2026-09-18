# QA Reverify — Phase 1 (CV Parser → ATS 3.0 Supabase) — 2026-09-02

**Từ:** Claude (Architect/QA)
**Cho:** AG (Implementer)
**Liên quan:** `docs/testing/FIX_SPEC_2026-09-01_n8n_cv-parser-redirect-to-supabase.md`
**Kết quả:** **CHƯA PASS** — 6 vấn đề cần sửa trước khi test end-to-end lại. Đã đối chiếu trực tiếp workflow n8n (`fofSZKkdyhlVd9Lc` + subworkflow `0BLBJWwP80nn9eN3`), schema Supabase (`sandbox`/`public`), và diff code (commit `793e299`).

**Đã làm đúng, không cần đụng lại:** Part A (OCR subworkflow ID), C.1–C.3 (Parse & Normalize, Upload Drive, Build Webhook Payload), C.6 (xoá 12 node Notion cũ), C.7 (đổi tên workflow), Part E (nút "+ Parse CV (AI)"), Part F (bảng `notifications` cả 2 schema, route `/api/webhooks/notifications`, `notification_actions.js`, UI Bell/panel — đã test thật và bắt đúng 1 lỗi execution, hoạt động tốt).

---

## 1. [NGHIÊM TRỌNG] URL webhook trỏ sai — không tới app thật

3 node đang hardcode `https://crm-ats-web.vercel.app`:
- `Call ATS Webhook` (`call_ats_webhook`)
- `Create Notification` (`create_notification`)
- `Log Execution Error` (`log_error_node`)

Đã xác nhận trực tiếp: domain này KHÔNG phải app của bạn — Vercel dashboard của user (`demo-user-portfolio`) đang có **0 project**, và mở URL đó ra chỉ thấy trang "Acme Inc." demo của người khác. Nghĩa là hiện tại **không có CV/notification/log lỗi nào tới được app hay Supabase thật cả** qua 3 node này.

**Fix:** đổi cả 3 node dùng `{{ $env.ATS_APP_BASE_URL }}` thay cho URL cứng (đúng yêu cầu ban đầu ở Part C.4). Set biến `ATS_APP_BASE_URL` trong n8n = URL tunnel Cloudflare/ngrok đang chạy thật lúc test (xem Part D của spec — mở `cloudflared tunnel --url http://localhost:3000`, lấy URL `https://*.trycloudflare.com`).

## 2. [NGHIÊM TRỌNG] Credential Google Drive không resolve được

Node "Upload CV to Drive" báo lỗi lúc chạy thật: `Credential with ID "XPs3k488EdswMivn" does not exist for type "googleDriveOAuth2Api"`.

**Fix:** vào n8n UI, mở node này, gán lại credential Google Drive (có thể do credential chưa được share vào đúng project chứa workflow, hoặc ID đã đổi).

## 3. [NGHIÊM TRỌNG] Part B chưa thực sự làm — API key Gemini vẫn hardcode

3 node đang có `x-goog-api-key` hardcode thẳng giá trị key trong header (chỉ chuyển từ query string `?key=...` sang header, KHÔNG phải credential n8n thật):
- `Extract CV Data (AI - PDF)`
- `Extract CV Data (AI - Text)`
- `Gemini OCR Request` (trong subworkflow `0BLBJWwP80nn9eN3`)

Vì `saveDataSuccessExecution: "all"`, key này còn bị ghi lại trong log của MỌI execution.

**Fix:** tạo 1 n8n Credential (Header Auth) cho Gemini, gán vào cả 3 node, xoá `x-goog-api-key` khỏi `headerParameters` literal.

## 4. [TRUNG BÌNH] Thiếu `continueOnFail: true`

2 node sau đang thiếu `continueOnFail: true` (spec Part C.4/C.5 yêu cầu):
- `Call ATS Webhook`
- `Create Notification`

Hiện tại nếu app lỗi tạm thời, cả execution chết ngang, không có notification báo lỗi nào — ngược với mục đích Notification Center.

**Fix:** bật `continueOnFail: true` cho cả 2 node.

## 5. [NHẸ] Sticky note ghi sai

Sticky note hiện ghi "Setup Required: 1. Anthropic API — for Claude CV extraction" nhưng thực tế workflow không dùng Anthropic/Claude node nào — extraction gọi thẳng Gemini. Sticky note cũng vẫn ghi `{{ATS_APP_BASE_URL}}` trong mô tả flow dù node thật đang hardcode URL khác (sẽ tự khớp lại sau khi sửa mục 1).

**Fix:** sửa lại nội dung sticky note cho khớp thực tế (2 credential thật: Google Drive + Gemini Header Auth, không có Anthropic).

## 6. [NHẸ, quy trình] `docs/testing/test data/` bị lỡ commit vào git

Commit `793e299` add nhầm toàn bộ thư mục `docs/testing/test data/` (kể cả bộ test Phase 2 chưa dùng tới) vào git — thư mục này quy ước từ đầu là KHÔNG track (chứa file PDF nhị phân test).

**Fix:**
```bash
git rm -r --cached "docs/testing/test data"
echo 'docs/testing/test data/' >> .gitignore
git add .gitignore
git commit -m "chore: gỡ docs/testing/test data khỏi git tracking (đúng quy ước cũ)"
```

---

## Sau khi sửa xong

Chạy lại đúng test plan trong `FIX_SPEC_2026-09-01_n8n_cv-parser-redirect-to-supabase.md` (mục "Test trước khi báo hoàn thành", đặc biệt bước 3 — end-to-end thật với `CV_18_...pdf`/`CV_25_...pdf` qua tunnel), rồi báo lại Claude để QA vòng 2.
