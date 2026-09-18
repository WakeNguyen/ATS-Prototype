# FIX SPEC — 2026-09-06 — Bảo mật trước khi kết nối GitHub + Vercel Git Integration

**Mức độ ưu tiên: CAO — bắt buộc hoàn thành Phần 1 TRƯỚC KHI chạy `git push` bất kỳ lệnh nào lên GitHub. Không được bỏ qua thứ tự.**

**Bối cảnh:** Hiện repo local (`D:\Users\trith\ats-web`) chưa từng có `git remote`, chưa từng push lên đâu cả — Vercel đang deploy bằng `npx vercel --prod` (CLI nén trực tiếp từ máy). Kế hoạch: tạo GitHub repo, push code lên, rồi connect Vercel → GitHub để auto-deploy mỗi khi push. Đây là hướng đi đúng và nên làm — nhưng phải xử lý 1 vấn đề bảo mật tồn đọng TRƯỚC, vì nó sẽ đi thẳng vào lịch sử GitHub nếu push nguyên trạng.

---

## Phần 1 — BẮT BUỘC: Xoay vòng (rotate) secret đã bị lộ plaintext trước khi push

**Đã xác nhận (grep trực tiếp, không đoán):** giá trị thật của `INTERNAL_WEBHOOK_SECRET` — chuỗi `ats3_internal_webhook_secret_2026_token!` — đang nằm dạng plaintext, đã commit vào git, ở:
- `docs/DEVELOPMENT_LOG.md` — 3 chỗ
- `docs/testing/QA_2026-09-05_campaign-fb-autopost_warmjoin-cron-lock-and-secret-hotfix-review.md` — 1 chỗ

Vấn đề: những commit này đã nằm trong lịch sử git local. Nếu push nguyên trạng lên GitHub — **kể cả repo Private** — secret thật này sẽ vĩnh viễn nằm trong lịch sử repo, và bất kỳ ai từng có quyền truy cập repo (kể cả sau này bị revoke) đã từng nhìn thấy được giá trị thật.

**Các bước bắt buộc, theo đúng thứ tự:**

1. Sinh 1 giá trị secret mới, ngẫu nhiên:
   ```bash
   openssl rand -hex 32
   ```
2. Cập nhật giá trị mới này ở **đúng 2 nơi** để chúng khớp nhau (code không hardcode secret, chỉ đọc từ env/credential nên không cần sửa code):
   - Vercel Project → Settings → Environment Variables → `INTERNAL_WEBHOOK_SECRET` (cập nhật cho Production; cập nhật luôn cho Preview nếu có dùng).
   - n8n credential `Je1dHcRXyZhrXODl` ("ATS 3.0 Internal Webhook Secret") — giá trị header `x-internal-secret`.
3. Redeploy app (đổi env var bắt buộc phải redeploy mới có hiệu lực).
4. Kiểm tra lại: gọi thử 1 trong 4 webhook route (hoặc chạy lại n8n Workflow D) và xác nhận **không có lỗi 401** — dùng đúng cách kiểm tra đã làm lần trước (nhìn execution log n8n, xác nhận status "success", không phải "error").
5. Sau khi xác nhận rotate thành công và hệ thống chạy bình thường: giá trị CŨ (`ats3_internal_webhook_secret_2026_token!`) coi như đã "chết" — dù còn nằm trong lịch sử git, nó không còn dùng được để gọi webhook thật nữa. Việc này là đủ để đảm bảo an toàn, **không bắt buộc phải viết lại lịch sử git.**

**Tuỳ chọn (không bắt buộc):** nếu quen dùng `git filter-repo` hoặc BFG Repo-Cleaner, có thể dọn luôn chuỗi secret cũ khỏi lịch sử git — thời điểm này là lý tưởng nhất để làm (chưa push lên remote nào cả). Nếu không quen, **bỏ qua bước này, chỉ cần rotate là đủ.**

**Không được sang Phần 2 khi chưa xác nhận rotate xong và hệ thống chạy ổn (webhook 200, n8n Workflow D execute thành công).**

---

## Phần 2 — Tạo GitHub repo an toàn

- Tạo repo ở chế độ **Private** (tuyệt đối không Public) — đây là ATS nội bộ, lịch sử docs có chứa dữ liệu/config nhạy cảm.
- Tên gợi ý: `ats-web` (hoặc theo ý bạn/AG).
- Trước khi push lần đầu, double-check `.gitignore` đã có đủ các dòng sau (đã xác nhận có sẵn, chỉ cần đảm bảo không bị xoá nhầm): `.env`, `.env.local`, `.env*.local`, `.vercel`, `docs/secrets/`, `docs/testing/test data/`.
- Chạy kiểm tra nhanh để chắc chắn chưa từng có file `.env*` thật nào bị commit nhầm trong quá khứ:
  ```bash
  git log --all --oneline -- .env .env.local .env.production
  ```
  Nếu lệnh này ra kết quả (có commit) → DỪNG LẠI, báo cáo lại trước khi push — đây sẽ là vấn đề nghiêm trọng hơn, cần xử lý lịch sử git riêng, không tự ý xử lý.
- Sau khi Phần 1 xong và kiểm tra trên OK:
  ```bash
  git remote add origin https://github.com/<github-username>/ats-web.git
  git branch -M master
  git push -u origin master
  ```

---

## Phần 3 — Kết nối Vercel với GitHub

- Vercel Dashboard → project `crm-ats-web` → Settings → Git → Connect tới repo GitHub vừa tạo.
- Từ giờ mỗi lần `git push` lên `master` sẽ tự động deploy Production — không cần gõ `npx vercel --prod` tay nữa (nhưng lệnh này vẫn dùng được nếu cần deploy thủ công).

**Lưu ý quan trọng về Preview Deployments:** Vercel Git integration sẽ tự động deploy MỌI branch/PR khác thành 1 URL Preview riêng (`*.vercel.app`, domain khác mỗi lần). Hiện Google OAuth (Auth.js) chỉ đăng ký Authorized redirect URI cho domain Production. Hệ quả:
- Các URL Preview sẽ **không đăng nhập Google được** (lỗi redirect URI mismatch) — đây là hành vi ĐÚNG như thiết kế, không phải bug bảo mật; nghĩa là app trên Preview URL sẽ không truy cập được cho tới khi domain đó được thêm vào Google Console.
- **Không tự ý thêm wildcard redirect URI** để "cho chạy được" trên mọi Preview — làm vậy sẽ làm yếu cấu hình OAuth. Nếu thật sự cần test trên 1 Preview URL cụ thể, thêm đúng URL callback đó vào Google Cloud Console tạm thời, rồi gỡ ra sau khi test xong.
- Khuyến nghị: tạm thời không dùng Preview deployment để test — tiếp tục dùng local dev + Production như đã làm trong đợt rollout OAuth vừa rồi.
- Xác nhận lại toàn bộ env var cần thiết (`AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`, `AUTH_SECRET`, `ALLOWED_EMAILS`, `INTERNAL_WEBHOOK_SECRET` — giá trị MỚI sau khi rotate ở Phần 1, `DB_SCHEMA`, các biến kết nối DB...) đã được set đúng cho environment **Production** trong Vercel Dashboard (deploy qua Git integration đọc env var từ dashboard giống hệt CLI, nên về lý thuyết đã sẵn có — chỉ cần xác nhận lại, không giả định).

---

## Test bắt buộc trước khi báo hoàn thành

- Push 1 commit nhỏ (ví dụ sửa khoảng trắng) sau khi connect GitHub↔Vercel, xác nhận Vercel tự động build & deploy mà không cần chạy `vercel --prod` tay.
- Đăng nhập lại bằng tài khoản được allowlist — xác nhận vẫn hoạt động bình thường sau lần redeploy này (lặp lại checklist 7 bước đã dùng cho đợt OAuth trước).
- Xác nhận n8n Workflow D vẫn chạy thành công (không lỗi 401) với secret mới.

**Báo cáo lại:** ghi vào `docs/DEVELOPMENT_LOG.md` như thường lệ, nêu rõ: đã rotate secret lúc nào, repo GitHub tên gì (private), đã connect Vercel chưa, kết quả test.
