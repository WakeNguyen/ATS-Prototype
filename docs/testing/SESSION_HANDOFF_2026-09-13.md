**Từ:** Claude (Architect/QA)

# Session Handoff — 2026-09-13

Tài liệu này viết cho session Claude Code SAU đọc lại, không có ký ức về phiên làm việc hôm nay.
Đọc file này trước khi bắt đầu bất kỳ việc gì liên quan tới các mục nêu dưới — không cần điều tra
lại root cause từ đầu, mọi thứ đã có bằng chứng trực tiếp trong `docs/testing/` và
`docs/DEVELOPMENT_LOG.md`.

## 1. Trạng thái hiện tại

> **Cập nhật 2026-09-13 (cuối phiên, sau khi file này được viết lần đầu):** phiên làm việc còn kéo
> dài thêm 1 chặng nữa SAU lần deploy đầu (`d666ebd`) — xem mục 1b, 2b, 3b, 6 (mới) bên dưới. Đọc
> HẾT file này, không chỉ đọc tới mục 1.

Toàn bộ công việc trong phiên này đã **commit → merge vào `master` → deploy production thành công**,
verify bằng Vercel API thật (`state: READY`), KHÔNG chỉ dừng ở code/QA local. **Lần deploy CUỐI CÙNG
và MỚI NHẤT** (thay thế lần deploy đầu `d666ebd` nêu bên dưới — đọc mục 1b để biết lý do có deploy
thứ 2):
- Commit merge: `e8d7b606643a8c5e470eeccf01ee44e01637459f` trên `master`.
- Deployment: `dpl_7sQ5USMij7GbMAMMXsxkwRejXZKd`, alias `crm-ats-web-hazel.vercel.app`, `state: READY`.

(Lần deploy đầu trong ngày, để tham khảo lịch sử: commit `d666ebd91d2afa070eece8153912132a21ef92dd`,
deployment `dpl_EVrgwGtz9fzy78YiMJMJwaBbctop` — đã bị deployment mới ở trên thay thế.)

Không có việc gì "đang dở dang chưa deploy" từ phiên này — nếu bạn thấy code trên `master`/production
khác với mô tả dưới đây, ưu tiên tin những gì đọc được trực tiếp từ code/DB thật, không tin file này.

### 1b. Vì sao có lần deploy thứ 2 trong cùng 1 ngày — tóm tắt cực ngắn

Sau lần deploy đầu (`d666ebd`), phiên tiếp tục thêm 1 chuỗi việc: (1) build tính năng "Edit & Delete
CV version cụ thể" trên Candidate 360 → (2) User test thật, phát hiện lỗ hổng thiết kế (gắn nhầm CV
của ứng viên khác vào hồ sơ không hề bị chặn) → (3) quyết định **BỎ HẲN Add/Edit, chỉ giữ Delete** →
(4) trong lúc làm việc đó, phát hiện thêm 1 sự cố bảo mật (secret bị lộ qua Git) và xử lý luôn. Xem
chi tiết đầy đủ ở các mục 2b, 3b, 6 bên dưới. Kết quả CUỐI CÙNG trên production hiện tại: Candidate
360 KHÔNG còn nút "Add Version" hay "Edit" nào — đây là **quyết định thiết kế cố ý**, không phải bug
sót lại nếu bạn thấy thiếu 2 nút đó.

## 2. Đã hoàn thành trong phiên (tóm tắt, xem chi tiết đầy đủ trong `docs/DEVELOPMENT_LOG.md` các
mục ngày 2026-09-13, và các file `docs/testing/QA_*2026-09-13*.md`)

- **Environment-separation cho n8n callbacks**: tách write vào `sandbox` vs `public` khi request có
  nguồn gốc từ dev. 2 cơ chế song song, KHÔNG dùng lẫn:
  - `environment` field + client `sqlSandbox` (`src/lib/db.js`) — dùng cho Google Contacts Sync,
    Workflow A (FB Group Auto-Post), Workflow C nhánh Webhook (Auto-Warm).
  - `baseUrl`/Cloudflare Tunnel (`ats-dev.thucnguyen8n.space`) — dùng cho CV Parser và CV Re-parse
    (vì đây là nhóm "CV parsing", đi theo baseUrl để tận dụng cơ chế đã có sẵn trong
    `WfSingle00000001`).
  - Cố tình KHÔNG đụng Workflow D (đang disable) và E (job nền, luôn phải production thật).
- **Google Contacts Sync** (đơn + hàng loạt) từ Candidate 360 và Search Menu.
- **CV Re-parse qua HITL** (mục #14 trong list "Những lỗi cần cải thiện"): sửa CV → tự động parse
  lại → qua đúng màn hình duyệt `pending_cv_imports` sẵn có, kèm notification báo thành công/thất
  bại. Workflow n8n mới: `A5: CV Re-parse (Existing Candidate)` (id `8sdwRFG354PTL8Oj`).
- **Chuẩn hoá Source Channel**: 11 giá trị chuẩn mới trong `src/constants/enums.js`
  (`SOURCE_CHANNELS_LIST`), đã chuẩn hoá dữ liệu thật trên production khớp danh sách.
- **Toàn bộ 15 mục trong Google Doc "Những lỗi cần cải thiện"** đã xử lý — chi tiết từng mục xem
  `docs/testing/QA_Verification_2026-09-13_bug-list-batch1-*.md`,
  `QA_Verification_2026-09-13_bug8-*.md`, `QA_Verification_2026-09-13_bug14-*.md`.

### 2b. Chuỗi việc SAU deploy đầu — quản lý CV version trên Candidate 360 (quan trọng, đọc kỹ)

1. **Build "Edit & Delete CV version"**: thêm `updateCvVersion`/`deleteCvVersion`, nút Edit/Delete
   cạnh dropdown chọn version trong "Embedded CV Viewer". Đã QA PASS, merge, deploy — RỒI SAU ĐÓ BỊ
   THAY THẾ bởi bước 3 dưới đây (Edit đã bị xoá lại ngay sau khi build xong, cùng ngày).
2. **User test thật scenario "gắn nhầm CV của ứng viên khác"** (qua Playwright + session sandbox, xem
   `docs/testing/` nếu có báo cáo riêng, hoặc tra `orchestration_log.md`/log lịch sử phiên): xác nhận
   "Add Version"/sửa trực tiếp ô "CV Link" cho phép ghi `cv_url`/`cv_urls` NGAY LẬP TỨC, KHÔNG có bước
   xác nhận nào — nếu dán nhầm link CV của người khác, hệ thống lưu luôn, không cảnh báo. Trong khi đó
   luồng "CV Parser (AI)" chính (nút **"+ Parse CV (AI)"**, đã có từ trước, mở `CVUploadModal`) đi qua
   `pending_cv_imports` + `resolvePendingCVImport(id, 'MERGE', { targetCandidateId, ... })` — nơi con
   người BẮT BUỘC tự chọn đúng `targetCandidateId` trước khi bất kỳ `cv_url` nào bị ghi. Đây là lớp an
   toàn "Add Version" đang thiếu.
3. **Quyết định cuối cùng của PO (Phương án B trong 3 phương án A/B/C đã đề xuất):** bỏ HẲN Add/Edit
   CV trực tiếp trên Candidate 360. Từ nay CV mới (cho candidate mới hay đã tồn tại) CHỈ nạp qua
   "+ Parse CV (AI)". Candidate 360 chỉ còn giữ quyền **Delete** 1 version cụ thể (dọn version gắn
   nhầm/không cần nữa).
   - `src/app/actions.js`: đã XOÁ HẲN `appendCvVersion`, `updateCvVersion`, `triggerCvReparse` (không
     còn nơi nào trong `src/` gọi tới — xác nhận qua `git grep`). Giữ nguyên `deleteCvVersion`.
   - `src/app/candidates/page.js`: đã xoá nút "Add Version" (2 vị trí) + nút "Edit" + modal Add/Edit
     CV Version. Ô "CV Link" giờ `readOnly` + `disabled` (đã verify qua Playwright đọc DOM thật, có
     `readonly=""` `disabled=""`). Chỉ còn nút "Delete" trong Embedded CV Viewer toolbar.
   - **Hệ quả:** tính năng #14 "Tự động re-parse CV khi cập nhật" (build sáng cùng ngày, SNAP-161) đã
     TRỞ THÀNH DEAD CODE và bị xoá theo — vì 2 nơi từng gọi `triggerCvReparse` (Add Version, sửa CV
     Link trực tiếp) đều không còn tồn tại. Workflow n8n **"A5: CV Re-parse (Existing Candidate)"**
     (id `8sdwRFG354PTL8Oj`) đã được User tự tay **deactivate** trên n8n (không xoá, có thể bật lại
     nếu sau này đổi hướng) — KHÔNG còn nơi nào trong app gọi webhook này nữa.
   - Commit liên quan: `e0db676` (build Edit/Delete) → `4237724`/`207fdf4` (xoá Add/Edit, chỉ giữ
     Delete) → merge `a46057b`, `e8d7b60` vào `development` → merge fast-forward vào `master`
     (`e8d7b60`, deploy READY nêu ở mục 1).

## 3. Hạ tầng đã thay đổi — CẦN BIẾT trước khi đụng vào các bảng/role liên quan

- **RLS policies mới cho `ag_dev_role`** (role dùng khi dev server local chạy `DB_SCHEMA=sandbox`)
  trên các bảng trước đây thiếu policy (RLS enabled + no policy = deny-all cho role này):
  `sandbox.notifications`, `sandbox.campaigns`, `sandbox.campaign_runs`, `sandbox.campaign_run_items`,
  `sandbox.fb_accounts`, `sandbox.warm_join_runs`, `sandbox.warm_join_run_items`, `sandbox.clients`,
  `sandbox.jobs`. Nếu gặp lỗi "system không cho lưu" khi test 1 tính năng MỚI từ dev server, nhiều
  khả năng đây là CÙNG 1 lớp lỗi (bảng liên quan chưa có policy) — kiểm tra
  `pg_policies WHERE schemaname='sandbox'` trước khi nghi ngờ code.
- **Windows Service "Cloudflared"** trên máy User đã bị `Stop-Service` + `Set-Service -StartupType
  Disabled` (do xung đột với tunnel User tự chạy tay, gây lỗi 404 ngẫu nhiên ~50%). Nếu tunnel lại
  lỗi 404 chập chờn, kiểm tra `Get-Process cloudflared` xem có bị chạy đè 2 tiến trình không.
- **`auth.js`**: đã thêm `trustHost: true` — cần thiết để login qua domain khác localhost (tunnel/
  preview) hoạt động đúng redirect_uri ở BƯỚC 1 (redirect sang Google). Bước 2 (đổi code lấy token)
  VẪN CÓ HẠN CHẾ THẬT của thư viện Auth.js khi chạy `next dev` sau reverse proxy — xem mục 4.

### 3b. Sự cố bảo mật `BRIDGE_INTERNAL_SECRET` + hạ tầng "AI Collab History" (đọc kỹ nếu đụng bridge)

- **`BRIDGE_INTERNAL_SECRET`** (dùng bởi VPS `fb-bridge` cho Facebook auto-posting) đã **rotate 2 LẦN
  trong cùng ngày hôm nay**: lần 1 lúc 13:50 UTC (khắc phục lộ secret cũ từ 02/09), lần 2 lúc ~13:50
  UTC+7 sau đó (vì chính giá trị vừa rotate lần 1 lại bị lộ tiếp — xem gạch đầu dòng dưới). **Giá trị
  ĐANG DÙNG hiện tại chỉ tồn tại trên VPS (`/opt/n8n/facebook auto posting 2.0/.env`) và trong n8n
  Credential "ATS 3.0 VPS Bridge Secret"** — KHÔNG nằm trong bất kỳ file nào của repo này, kể cả file
  local (đã dọn). Nếu cần giá trị thật, hỏi PO trực tiếp hoặc SSH VPS đọc `.env`, không tìm trong Git.
- **Nguyên nhân lộ lần 2:** Claude tạo 1 folder git-tracked tên **"AI Collab History"** bên trong repo
  để làm tài liệu tham khảo, và copy nguyên văn `orchestration_log.md` (chứa plaintext secret vừa
  rotate lần 1) vào đó rồi commit + push lên `master` (`d1a69ff`). Đã khắc phục: rotate lại secret lần
  2 (vô hiệu hoá giá trị lộ), xoá hẳn file + folder khỏi Git (commit `50edb8b`), thêm dòng
  `AI Collab History/` vào `.gitignore` gốc làm hàng rào kỹ thuật (`73d81fa`), và sửa lại
  `bridge/HUONG_DAN.md` (đoạn hướng dẫn cũ từng gợi ý "copy vào repo rồi commit" — SAI, đã xoá).
- **Quy tắc BẮT BUỘC từ nay:** thư mục "AI Collab History" (log trao đổi Claude↔Antigravity) CHỈ được
  phép tồn tại CỤC BỘ, NGOÀI mọi working tree của repo Git (`D:\Users\Orchestrator\AI Collab History\`
  hoặc `D:\Users\trith\AI Collab History\` tuỳ worktree — do chính `bridge/run_demo.sh`/`fix_demo.sh`
  tự động ghi ra thư mục CHA của worktree, đã đúng thiết kế từ đầu, KHÔNG bị ảnh hưởng bởi sự cố này).
  KHÔNG bao giờ tự tay copy bất kỳ file nào từ đó vào trong repo rồi commit, dưới bất kỳ lý do gì
  (kể cả "chỉ để tham khảo"). Chi tiết đầy đủ + bài học: memory
  `ats_web_scan_before_committing_aggregate_files` (nếu đọc được qua hệ thống memory của Claude Code).
- Workflow n8n **"A5: CV Re-parse (Existing Candidate)"** (`8sdwRFG354PTL8Oj`) đã bị User deactivate
  thủ công (xem mục 2b) — không liên quan tới `BRIDGE_INTERNAL_SECRET`, đây là workflow riêng dùng
  webhook + credential riêng ("ATS 3.0 Internal Webhook Secret", id `Je1dHcRXyZhrXODl` — đây là ID
  credential nội bộ n8n, KHÔNG phải giá trị secret thật, an toàn khi thấy trong docs/log).

## 4. Việc CÒN MỞ, CHƯA làm — đọc kỹ trước khi User hỏi lại

### 4.1. Login UI qua Cloudflare Tunnel — đã GÁC LẠI, không phải bug cần fix ngay
Chi tiết đầy đủ: `docs/testing/QA_Finding_2026-09-13_oauth-login-via-cloudflare-tunnel-blocked.md`.
Tóm tắt: đăng nhập Google qua `ats-dev.thucnguyen8n.space` bị lỗi ở bước đổi token
(`redirect_uri_mismatch`) do hạn chế thật của `next-auth`/`@auth/core` khi chạy `next dev` sau
reverse proxy (`request.url` nội bộ Next.js không phản ánh đúng domain thật dù header đúng). Hướng
fix khả dĩ (`redirectProxyUrl`) cần đồng bộ `AUTH_SECRET` giữa dev/production — đánh đổi lại đúng lớp
an toàn đang cố tình giữ khác nhau (xem memory `ats_web_auth_secret_separation`). KHÔNG liên quan
tới CV Parser/CV Re-parse (2 tính năng đó dùng server-to-server qua tunnel, không qua OAuth, không
bị ảnh hưởng).

### 4.2. Warming Campaign — lỗ hổng thiết kế logic, User đang chờ chọn hướng
Chi tiết đầy đủ trong memory: `ats_web_warming_campaign_design_gap.md` (đọc qua memory system, hoặc
hỏi User xin lại nếu không truy cập được). Tóm tắt: cron warming (`_acquireWarmJoinRunLock` trong
`campaign_actions.js`) luôn chọn campaign Warming CŨ NHẤT còn active — chạy vô hạn, không có khái
niệm hoàn thành, và các campaign Warming tạo sau không bao giờ được cron tự động chạy. 3 hướng đã đề
xuất (A: thêm target/completion check; B: round-robin nhiều campaign; C: giữ nguyên + cảnh báo rõ
ràng) — **CHƯA chọn hướng nào, chưa code gì**.

### 4.3. Không có cơ chế xoá/disable campaign
User nêu cùng lúc với mục 4.2, nói sẽ hỏi ý kiến SAU. Chưa điều tra sâu, chưa có đề xuất cụ thể.

### 4.4. Data hygiene nhỏ, không khẩn
17 bản ghi notification cũ (từ lúc tạo schema sandbox ban đầu, ngày 02-06/09) vẫn còn lẫn giữa
`public` và `sandbox` — không gây lỗi đang sống, chỉ là dữ liệu trùng lặp lịch sử. User đồng ý để
sau.

## 5. Ghi chú vận hành bridge Claude↔Antigravity (nếu tiếp tục dùng)

- Toàn bộ spec dispatch hôm nay dùng `run_demo.sh` (task mới) qua `spec.md` — mẫu spec chi tiết, chỉ
  rõ từng đoạn code CŨ/MỚI, luôn có mục "Việc KHÔNG được làm" + "Verify bắt buộc" → tỉ lệ AG làm
  đúng 100% ngay lần đầu rất cao (chỉ 1 sai lệch nhỏ trong cả phiên — do spec quên ràng buộc
  `'use server'` không cho export hàm sync, AG tự phát hiện và xử lý đúng, ghi log rõ ràng theo mục
  10.7). Nên tiếp tục theo đúng format spec chi tiết này.
- `orchestration_log.md`, `agy_run.log`, `agy_fix.log`, `spec.md`, `run_demo.sh`, `fix_demo.sh`,
  `fix_instruction.md`, `orchestration_round.txt`, `.claude/` — đều là file tạm của bridge, KHÔNG
  commit vào git (đã cố tình loại trừ khi commit hôm nay).
- **Riêng "AI Collab History"** (log tổng hợp lâu dài, khác với `orchestration_log.md` tạm thời của
  1 task): xem mục 3b — tuyệt đối không commit thư mục này vào git dưới bất kỳ hình thức nào, kể cả
  1 file "để tham khảo". Cơ chế tự động của `run_demo.sh`/`fix_demo.sh` đã tự ghi đúng ra ngoài repo
  từ đầu, không cần và không được can thiệp thêm bằng tay.
