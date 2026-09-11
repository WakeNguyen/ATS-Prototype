---
title: FIX_SPEC 2026-09-05 — HOTFIX KHẨN: Cron bypass advisory lock, hardcoded secret & đính chính DEVLOG (Hệ thống Nuôi Nick FB)
role: Claude = Architect/QA (viết spec này, KHÔNG tự code/chạy SQL/sửa n8n) → AG = Implementer
---

## 0. Bối cảnh & mức độ ưu tiên

Xem đầy đủ bằng chứng tại `docs/testing/QA_2026-09-05_campaign-fb-autopost_warming-system-independent-review.md` (QA độc lập của Claude trên hệ thống Warming Phases 1-4, commit `29b574c`). Tóm tắt 3 vấn đề cần vá:

1. **[Nghiêm trọng]** Nhánh Cron (Schedule Trigger 08:30/12:30/20:30 giờ VN) của Workflow C (`L8QdckqW7FDwanRq`) hoàn toàn bỏ qua cơ chế advisory lock + active-run-check mà `triggerWarmJoinRun()` áp dụng cho đường UI — không có gì ngăn cron và UI chạy trùng lên cùng 1 tập FB account thật.
2. **[Bảo mật]** 3 secret (`x-internal-secret` dùng cho `warm-join-data` và `warm-join-run-callback`, secret riêng cho VPS bridge `facebook-warm-join`) bị hardcode dạng plaintext trực tiếp trong tham số node n8n thay vì lưu qua n8n Credential.
3. **[Ghi chép]** `SNAP-20260905-76` trong `DEVELOPMENT_LOG.md` tuyên bố "gọi thông suốt qua Cloudflare Tunnel, cập nhật trạng thái Supabase" nhưng lịch sử execution thật (qua n8n MCP) cho thấy cả 3 execution từng có đều lỗi — cần đính chính.

**MỨC ĐỘ CẤP BÁCH:** `SNAP-20260905-77` vừa nạp **2 tài khoản Facebook thật kèm session cookie thật** (`acc_01`, `acc_02`, `status: Active`) vào `sandbox.fb_accounts`. Lượt cron 08:30/12:30/20:30 tiếp theo sẽ là lần đầu tiên chạm vào tài khoản thật, trong khi lỗ hổng #1 chưa được vá. **Vì vậy FIX_SPEC này cần làm TRƯỚC hoặc ưu tiên hơn PHẦN 2-5 của `FIX_SPEC_2026-09-05_campaign-fb-autopost_campaign-type-split-and-bulk-group-assign.md`** (spec kia cũng có PHẦN 5 đụng vào cùng Workflow C — làm hotfix này xong rồi mới làm PHẦN 5 kia để tránh sửa chồng chéo cùng lúc trên 1 workflow).

**Ngoài phạm vi**: FIX_SPEC này KHÔNG đụng gì tới `campaign_type`, bulk-assign group, hay bất kỳ nội dung nào của FIX_SPEC `campaign-type-split-and-bulk-group-assign`. Hai spec độc lập, chỉ cần làm hotfix này trước về mặt thứ tự thời gian.

## 1. VIỆC LÀM NGAY LẬP TỨC (trước khi đọc tiếp các phần bên dưới) — Tắt Cron tạm thời

Dùng n8n MCP (`get_workflow_details` để lấy node id của "Schedule Trigger (08:30, 12:30, 20:30)", sau đó `update_workflow` để set `disabled: true` riêng cho node đó — **không tắt cả workflow**, vì Webhook Manual Trigger vẫn cần hoạt động bình thường cho nhu cầu vận hành thủ công trong lúc chờ vá). Xác nhận lại bằng `get_workflow_details` rằng node Schedule Trigger đã `disabled: true` và Webhook Manual Trigger vẫn active. Việc này làm xong trong vài phút, không phụ thuộc các phần code bên dưới — làm trước tiên để loại bỏ rủi ro chạy trùng lên tài khoản thật ngay lập tức.

Chỉ bật lại Schedule Trigger sau khi hoàn tất và test xong PHẦN 2 + PHẦN 3 bên dưới.

## 2. Backend — Endpoint đăng ký run cho nhánh Cron

Tạo route mới `src/app/api/webhooks/warm-join-cron-register/route.js` (POST), theo đúng pattern bảo mật hiện có của các webhook nội bộ khác (validate header `x-internal-secret` so với `process.env.INTERNAL_WEBHOOK_SECRET`).

Logic bên trong: **tái sử dụng chính xác đoạn logic đăng ký run đã có trong `triggerWarmJoinRun()`** (advisory lock `pg_advisory_xact_lock(hashtext('warm_join_run_lock'))`, kiểm tra có run `status='Running'` trong 2 giờ gần nhất hay chưa, nếu chưa thì resolve `targetAccounts` = tất cả account `status='Active'` (đường cron không nhận `accountIds` cụ thể — giữ đúng hành vi hiện tại là quét toàn bộ Active accounts), tạo dòng `warm_join_runs` mới với `trigger_source: 'cron'`, `status: 'Running'`). Nên refactor phần logic dùng chung này ra 1 hàm nội bộ (ví dụ `_acquireWarmJoinRunLock({ accountIds, triggerSource })`) để cả `triggerWarmJoinRun()` (đường UI) và route mới này (đường cron) gọi chung, tránh 2 nơi viết lặp cùng 1 logic khoá — đây là điểm mấu chốt để đảm bảo 2 đường THỰC SỰ dùng chung 1 cơ chế khoá, không phải chỉ trông giống nhau.

Response:
- Nếu acquire lock thành công: `{ success: true, runId, accountIds: [...] }`.
- Nếu đã có run khác đang chạy: `{ success: false, error: 'already_running' }` (HTTP 200, không phải lỗi — đây là kết quả hợp lệ, n8n cần đọc field này để quyết định dừng).

## 3. n8n Workflow C — Route cron qua endpoint đăng ký, dọn dẹp validate node

**Trước khi sửa**: gọi `get_workflow_details` (detailLevel đầy đủ) để lấy lại đúng cấu trúc/id node hiện tại — không giả định, vì workflow có thể đã đổi khác kể từ lần Claude đọc gần nhất.

Thay đổi cần làm:
1. Node `Validate Internal Secret`: xoá bỏ hoàn toàn nhánh "nếu là cron thì bỏ qua validate và đi thẳng" hiện có. Cả 2 nguồn trigger (cron và webhook) đều phải xử lý nhất quán ở bước tiếp theo.
2. Thêm 1 node HTTP Request mới ngay sau `Validate Internal Secret` (đặt tên ví dụ `Register Warm Join Run`), gọi `POST` tới endpoint mới ở PHẦN 2, dùng cho **cả 2** nhánh trigger:
   - Với nhánh webhook (`triggerSource: 'ats_ui'`): request body đã có sẵn `runId` từ app (app đã tự đăng ký run trước khi gọi webhook n8n) — node này có thể bỏ qua/pass-through nếu `runId` đã tồn tại trong payload, KHÔNG gọi lại endpoint đăng ký (tránh đăng ký 2 lần cho cùng 1 run). Dùng 1 node IF để rẽ nhánh: nếu `runId` đã có sẵn trong body → đi thẳng tới `Fetch Warm Data`; nếu không có `runId` (tức nhánh cron) → gọi `Register Warm Join Run`.
   - Với nhánh cron: gọi endpoint, nhận về `runId` mới hoặc `success: false`.
3. Thêm 1 node IF sau `Register Warm Join Run`: nếu `success: false` (`already_running`) → dừng workflow tại đây, không gọi `Fetch Warm Data` / VPS Bridge (không cần thông báo lỗi ồn ào, chỉ cần dừng sạch — có thể ghi 1 dòng log nhẹ nếu n8n hỗ trợ, không bắt buộc). Nếu `success: true` → tiếp tục luồng như cũ, dùng `runId` vừa nhận cho các bước sau (`Fetch Warm Data`, `Call VPS Bridge`, `POST warm-join-run-callback` — tất cả các bước này vốn đã cần `runId`/`accountIds`, chỉ cần đảm bảo giờ chúng nhận đúng giá trị từ nhánh cron mới thay vì rỗng).

**Ràng buộc quan trọng**: không đổi bất kỳ hành vi nào của nhánh webhook ngoài việc thêm bước kiểm tra "đã có runId thì bỏ qua đăng ký lại" — luồng UI hiện tại đang đúng, không được phá vỡ.

## 4. n8n Workflow C — Chuyển 3 secret sang Credential

Tạo 1 credential kiểu `httpHeaderAuth` trong n8n (ví dụ đặt tên `ATS 3.0 Internal Webhook Secret`) chứa header `x-internal-secret` với giá trị hiện đang hardcode. Áp dụng credential này cho tất cả các HTTP Request node đang có secret hardcode: `Fetch Warm Data from ATS 3.0`, node mới `Register Warm Join Run` (PHẦN 3), `POST warm-join-run-callback`.

Với secret riêng của VPS bridge (`Call VPS Bridge: facebook-warm-join`, giá trị khác 2 secret kia) — tạo thêm 1 credential `httpHeaderAuth` thứ 2 riêng (ví dụ `ATS 3.0 VPS Bridge Secret`) và áp dụng cho đúng node này.

Sau khi áp dụng xong, `get_workflow_details` không được còn thấy bất kỳ giá trị secret dạng literal nào trong tham số node — chỉ còn tham chiếu credential.

## 5. Đính chính DEVELOPMENT_LOG.md

**KHÔNG sửa/xoá nội dung gốc của `SNAP-20260905-76`** (giữ nguyên lịch sử). Thay vào đó, thêm 1 dòng đính chính ngắn ngay trong mục Chi Tiết của `SNAP-20260905-76` (phần `### [2026-09-05 14:45] ...`), dạng:

> **Đính chính (2026-09-05, sau QA `SNAP-20260905-78`)**: mô tả "gọi thông suốt qua Cloudflare Tunnel... cập nhật trạng thái Supabase" ở Phase 4 không chính xác — lịch sử execution n8n thực tế cho thấy cả 3 lần chạy thử đều lỗi trước khi tới bước cập nhật Supabase. Xem `docs/testing/QA_2026-09-05_campaign-fb-autopost_warming-system-independent-review.md`.

Không cần sửa gì thêm ở bảng tổng hợp phía trên (entry `SNAP-20260905-78` đã ghi nhận việc này rồi).

## 6. Checklist test bắt buộc

- [ ] Xác nhận Schedule Trigger đã bị `disabled: true` TRƯỚC khi bắt đầu code (PHẦN 1).
- [ ] `_acquireWarmJoinRunLock` (hoặc tên tương đương) được dùng chung bởi cả `triggerWarmJoinRun()` và route `warm-join-cron-register` — không phải 2 đoạn code riêng biệt trông giống nhau.
- [ ] Test race condition bằng dữ liệu cô lập (Rule 10.8 — dùng account test giả lập trong sandbox, KHÔNG dùng `acc_01`/`acc_02` thật cho bước test lock): gọi `triggerWarmJoinRun` tạo 1 run `Running`, sau đó gọi route `warm-join-cron-register` ngay khi run đó còn đang `Running` → phải nhận `{success:false, error:'already_running'}`, không tạo thêm dòng `warm_join_runs` nào khác.
- [ ] Trong n8n: dùng `execute_workflow`/`test_workflow` (không phải cron thật) để giả lập nhánh cron trong lúc có 1 run `Running` giả lập sẵn trong DB → xác nhận workflow dừng đúng tại IF node, không gọi tới `Fetch Warm Data`/VPS Bridge.
- [ ] `get_workflow_details` sau khi sửa: xác nhận không còn secret dạng plaintext ở bất kỳ node nào (PHẦN 4).
- [ ] Chỉ sau khi 2 test trên PASS: bật lại Schedule Trigger (`disabled: false`), rồi thực hiện đúng 1 lần chạy thật end-to-end (có thể đợi tới lượt cron tự nhiên tiếp theo, hoặc trigger thủ công qua webhook với `accountIds` thật của `acc_01`/`acc_02` nếu User đồng ý) — xác nhận có dòng `warm_join_runs` với `status: 'Completed'` (hoặc `PartialSuccess`/`Failed` hợp lệ, miễn là workflow chạy trọn vẹn tới callback) và các dòng tương ứng trong `warm_join_run_items`. Đây là bằng chứng thay thế cho tuyên bố PASS sai ở `SNAP-20260905-76`.
- [ ] `npm run build` PASS 100% (không có thay đổi UI trong hotfix này, nhưng vẫn build để đảm bảo route mới không phá TypeScript/ESLint).
- [ ] Cập nhật `DEVELOPMENT_LOG.md`: thêm 1 snapshot mới (bảng tổng hợp + chi tiết) mô tả hotfix này, kèm đính chính PHẦN 5 ở trên.

## Ghi chú chung

- Toàn bộ PHẦN 1-5 đều nằm trong phạm vi của AG (đọc/sửa code Next.js + đọc/sửa n8n workflow qua MCP — AG đã xác nhận có quyền n8n MCP).
- Nếu trong lúc làm phát hiện cấu trúc Workflow C hiện tại khác với mô tả Claude đọc được lúc QA (ví dụ tên node đã đổi), ưu tiên đọc lại thực tế qua `get_workflow_details` và điều chỉnh cách đặt tên node cho phù hợp — mục tiêu hành vi (PHẦN 2-4) là bắt buộc, tên node cụ thể có thể linh hoạt.
- Sau khi hotfix này xong và test PASS, tiếp tục PHẦN 2-5 của `FIX_SPEC_2026-09-05_campaign-fb-autopost_campaign-type-split-and-bulk-group-assign.md` như bình thường.
