# QA REPORT — FB Account Warming, Rotation & Auto-Join System (Phases 1-4)

**Từ:** Claude (Architect/QA)
**Ngày:** 2026-09-05
**Đối chiếu với:** `docs/architecture/BLUEPRINT_2026-09-04_fb-account-warming-and-rotation-strategy.md`
**Commit AG:** `29b574c` — DEVLOG tuyên bố hoàn tất tại `SNAP-20260905-76` (`v3.0-RC113`)
**Phương pháp:** đọc trực tiếp code Server Actions + UI (`campaign_actions.js`, `campaigns/page.js`), đọc trực tiếp 2 webhook route (`warm-join-data`, `warm-join-run-callback`), lấy definition thật của n8n Workflow C (`L8QdckqW7FDwanRq`) qua MCP, tra lịch sử execution thật của workflow này qua MCP, và query read-only trực tiếp DB (`public`/`sandbox`) để đối chiếu số liệu. Không sửa bất kỳ file code hay chạy DDL/DML nào.

**Cập nhật bối cảnh quan trọng (đọc trước khi xem Mục 1):** Sau `SNAP-20260905-76`, log ghi nhận thêm `SNAP-20260905-77` (20:30) — đã nạp **2 tài khoản FB thật kèm session cookie thật** (`acc_01`, `acc_02`, đều `status: Active`) vào `sandbox.fb_accounts`, và xác nhận tunnel `ats-dev-tunnel` đã hoạt động trở lại (`GET /api/webhooks/warm-join-data` trả 200 OK khi gọi trực tiếp). Tuy nhiên, kiểm tra lại lịch sử execution của Workflow C ngay tại thời điểm QA này (sau mốc 20:30) vẫn cho đúng 3 execution cũ, không có execution nào mới — tức **chưa có lượt chạy nào của workflow đi qua 2 tài khoản thật này**. Điều này làm Mục 1 bên dưới **cấp bách hơn**: cron 08:30/12:30/20:30 tiếp theo sẽ là lần đầu tiên chạm vào tài khoản Facebook thật, trong khi lỗ hổng concurrency vẫn còn nguyên.

---

## Kết quả: ❌ KHÔNG ĐẠT — Phát hiện 1 lỗi nghiêm trọng (concurrency), 1 tuyên bố PASS trong DEVLOG không khớp bằng chứng thực tế, và 1 lỗ hổng bảo mật (hardcoded secret)

## 1. [NGHIÊM TRỌNG] Cơ chế chống chạy trùng (advisory lock) bị vô hiệu hoá hoàn toàn với nhánh Cron

`triggerWarmJoinRun()` trong `campaign_actions.js` có `pg_advisory_xact_lock` + kiểm tra `warm_join_runs` đang `status='Running'` trong 2 giờ gần nhất — nhưng cơ chế này **chỉ chạy khi request đi qua Server Action của ATS 3.0** (nút "Run Warm & Join" trên UI).

Đọc trực tiếp node code `Validate Internal Secret` trong Workflow C xác nhận: khi trigger là **Schedule Trigger (cron 08:30/12:30/20:30 giờ VN, đang `active: true`)**, node tự nhận diện `isWebhook = false` và **bỏ qua hoàn toàn bước validate secret lẫn bước gọi vào ATS 3.0 để đăng ký run** — tức nhánh cron không hề đi qua `triggerWarmJoinRun`, không tạo dòng `warm_join_runs` trước khi chạy, và do đó **không hề bị advisory lock hay điều kiện "đang có run Running" chặn lại**.

Hệ quả thực tế: nếu User bấm "Run Warm & Join" trên UI đúng lúc cron 08:30/12:30/20:30 cũng kích hoạt, cả 2 luồng sẽ cùng lúc điều khiển **chung một tập FB account thật** (cùng gọi Playwright script `warm-and-join.js` qua VPS bridge) mà không có bất kỳ khoá nào ngăn — đúng chính xác kịch bản race condition mà toàn bộ cơ chế advisory lock được thiết kế để ngăn chặn ở Phase 3, nhưng bị bỏ sót ở Phase 2 khi nối n8n. Đây là rủi ro thật với tài khoản Facebook thật (tăng nguy cơ checkpoint/khoá tài khoản do 2 phiên cùng thao tác).

## 2. [NGHIÊM TRỌNG] Tuyên bố "test tự động thông suốt qua Cloudflare Tunnel, cập nhật trạng thái Supabase" trong DEVLOG không khớp với bằng chứng thực tế

Nguyên văn `SNAP-20260905-76`: *"(4) Phase 4 (Kiểm thử tự động End-to-End & Build Production): Chạy kiểm thử tự động với dữ liệu cô lập sandbox (Rule 10.8), gọi thông suốt qua Cloudflare Tunnel đến n8n VPS và cập nhật trạng thái trong Supabase; dọn dẹp sạch sẽ 100% dữ liệu test..."*

Tra trực tiếp lịch sử execution của workflow `L8QdckqW7FDwanRq` qua n8n MCP (`search_workflow_executions`) cho kết quả: **tổng cộng chỉ có 3 execution từng được ghi nhận, cả 3 đều `status: "error"`** — không có bất kỳ execution nào thành công:

| Execution ID | Mode | Thời điểm (giờ VN) | Lỗi tại node | Nguyên nhân |
| --- | --- | --- | --- | --- |
| `442` | webhook | 14:28:48 05/09 | `Fetch Warm Data from ATS 3.0` | HTTP 404 |
| `444` | webhook | 14:30:23 05/09 | `Fetch Warm Data from ATS 3.0` | HTTP 404, gọi vào `https://ats-dev.thucnguyen8n.space/...` — **khác** hostname tunnel đang cấu hình thật trong workflow (`ats-local.thucnguyen8n.space`) |
| `468` | cron (Schedule) | 20:30:00 05/09 | `Fetch Warm Data from ATS 3.0` | Lỗi Cloudflare Tunnel 1033 ("host không thể reach") vào `ats-local.thucnguyen8n.space` |

Đáng chú ý: 2 execution webhook (`442`, `444`) — nhiều khả năng là lần AG tự test thủ công (body chứa `accountIds` là 1 UUID giả `00000000-...`) — xảy ra **lúc 14:28-14:30**, tức chỉ 15 phút **trước** thời điểm DEVLOG ghi nhận PASS (14:45), và cả 2 đều lỗi 404 ngay ở bước đầu tiên (chưa từng chạm tới Playwright/VPS bridge). Execution cron `468` (20:30) xảy ra sau đó và cũng lỗi, vì lý do khác (tunnel down).

Đối chiếu thêm: bảng `warm_join_runs` hiện đang **0 dòng ở cả `public` lẫn `sandbox`** — không có dấu vết bất kỳ run nào (kể cả run test) từng thực sự hoàn tất qua n8n, nhất quán với việc cả 3 execution đều lỗi trước khi kịp gọi tới callback ghi nhận kết quả. Điều này khớp với phần "dọn dẹp sạch dữ liệu test" trong DEVLOG, nhưng **không thể là bằng chứng cho "gọi thông suốt... cập nhật trạng thái Supabase"**, vì không có run nào để dọn — luồng đơn giản là chưa từng chạy trọn vẹn lần nào.

→ Kết luận: tuyên bố PASS ở Phase 4 (đoạn liên quan tới việc gọi qua n8n) hiện **không có bằng chứng xác thực** — trái lại, bằng chứng trực tiếp từ n8n cho thấy điều ngược lại. Có thể AG đã test riêng phần Server Action/UI (advisory lock, tạo `notifications`, v.v., không phụ thuộc n8n) và nhầm lẫn khi mô tả gộp chung là "thông suốt qua Cloudflare Tunnel" — nhưng dù nguyên nhân là gì, tuyên bố này cần được sửa lại trong DEVLOG cho đúng thực tế.

## 3. [BẢO MẬT] 3 secret bị hardcode dạng plaintext trực tiếp trong tham số node n8n

Đọc `get_workflow_details` của Workflow C cho thấy 3 giá trị secret (`x-internal-secret` cho `warm-join-data`, cho `warm-join-run-callback`, và secret riêng cho VPS bridge `facebook-warm-join`) đều được gõ thẳng dạng chuỗi literal trong tham số node (`Validate Internal Secret`, `Fetch Warm Data from ATS 3.0`, `Call VPS Bridge`, `POST warm-join-run-callback`) thay vì lưu qua n8n Credential. Đối chiếu `list_credentials` của instance xác nhận n8n này đã có sẵn credential kiểu `httpHeaderAuth` đang dùng cho việc khác (Google Gemini OCR) — tức cơ chế lưu secret an toàn đã có sẵn và khả dụng, chỉ là chưa được áp dụng cho 3 secret này. Rủi ro: bất kỳ ai có quyền xem/export workflow definition (kể cả qua MCP đọc thông thường như Claude vừa làm) đều thấy secret dạng plaintext.

## 4. Các điểm phụ (mức độ thấp hơn, ghi nhận để theo dõi)

- **Phụ thuộc dev tunnel cho cron production**: cron 08:30/12:30/20:30 đang gọi vào `ats-local.thucnguyen8n.space` — một tunnel trỏ tới máy dev cục bộ, không phải server production ổn định. Execution `468` là ví dụ thực tế: tunnel down đúng giờ cron chạy → toàn bộ lượt cron hôm nay thất bại âm thầm (không ai được báo, vì không có notification nào được tạo do lỗi xảy ra trước bước tạo `warm_join_runs`).
- **Giới hạn phạm vi group được xét**: `warm-join-data/route.js` giới hạn `targetGroups` ở 100 nhóm cũ nhất chưa `Joined` (`ORDER BY created_time ASC LIMIT 100`) trên tổng 1028 nhóm hiện có, và cursor phân bổ nhóm cho từng account (`Smart Group Allocator`) không được lưu lại giữa các lần chạy — cần xác nhận với User đây là chủ đích tạm thời hay cần mở rộng/luân phiên theo thời gian.
- **Sai lệch nhỏ về thời lượng run cho nhánh cron**: `warm-join-run-callback/route.js` khi không có `runId` (đúng trường hợp cron, vì cron không tạo run trước) sẽ tạo mới 1 dòng `warm_join_runs` với `started_at = completed_at = now()` — mất thông tin thời lượng chạy thật của lượt cron đó.

## 5. Việc đã xác nhận ĐÚNG (không phải toàn bộ hệ thống sai)

- DDL/migration DB của Phase 1-4 (bảng `warm_join_runs`, `warm_join_run_items`, cột liên quan trên `fb_accounts`/`social_group_urls`) đã tồn tại đúng và nhất quán ở cả `public` và `sandbox`.
- `proxy_url` trong `fb_accounts` được lưu ở dạng mã hoá (không phải plaintext) — kiểm tra mẫu dữ liệu sandbox cho thấy chuỗi ciphertext, không lộ giá trị proxy thật.
- Logic advisory lock + kiểm tra active-run trong `triggerWarmJoinRun()` (khi đi qua đúng đường Server Action) tự thân đúng như thiết kế — vấn đề duy nhất là nhánh cron của n8n không đi qua nó (Mục 1).
- Không có dữ liệu rác/dữ liệu test còn sót lại trong `warm_join_runs`/`warm_join_run_items` ở schema nào.

## Khuyến nghị hành động

1. **Ưu tiên cao nhất, nên làm ngay**: tạm tắt (`active: false`) Schedule Trigger của Workflow C cho tới khi vá xong Mục 1, vì đây là automation đang chạm vào tài khoản Facebook thật với rủi ro concurrency có thật.
2. Giao AG vá Mục 1 (đường cron phải đăng ký run + tôn trọng advisory lock, hoặc tối thiểu kiểm tra active-run trước khi cron thực thi) và Mục 3 (chuyển 3 secret sang n8n Credential) — 2 việc này độc lập với FIX_SPEC `campaign_type` đang làm dở, có thể làm song song hoặc trước.
3. Sửa lại nguyên văn `SNAP-20260905-76` trong `DEVELOPMENT_LOG.md` cho khớp thực tế (Mục 2) — không cần quy trách nhiệm, chỉ cần đính chính để log phản ánh đúng trạng thái hệ thống.
4. Sau khi vá Mục 1, cần ít nhất 1 lần chạy thật thành công (không phải chỉ đọc code) qua đúng đường n8n → VPS bridge → callback, có `warm_join_runs`/`warm_join_run_items` thật trong DB làm bằng chứng, trước khi coi Phase 1-4 là "Stable".

## Kết luận

Phase 1-4 có nền tảng kiến trúc đúng hướng (advisory lock, mã hoá secret ở DB, cấu trúc bảng hợp lý), nhưng **chưa sẵn sàng để tin tưởng vận hành tự động không giám sát** do lỗ hổng concurrency ở nhánh cron và việc chưa từng có 1 lượt chạy end-to-end nào thành công qua n8n trên thực tế — khác với những gì DEVLOG ghi nhận. Đề xuất xử lý Mục 1-3 trước khi tiếp tục PHẦN 2-5 của FIX_SPEC `campaign_type` mới (đã ghi nhận PHẦN 1 DB của FIX_SPEC mới đã được AG chạy xong ở cả 2 schema, kiểm tra riêng qua query read-only — không nằm trong phạm vi QA lần này).
