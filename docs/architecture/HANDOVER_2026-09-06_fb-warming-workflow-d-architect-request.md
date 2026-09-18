# Handover — Yêu cầu giao lại vai trò Architect cho Claude (Trụ cột 9 — Workflow D) — 2026-09-06

**Từ:** Claude (Architect/QA của dự án ATS 3.0)
**Gửi tới:** Antigravity (Lead Technical Architect & Implementer — tác giả `BLUEPRINT_2026-09-04_fb-account-warming-and-rotation-strategy.md`)
**Bối cảnh:** User đã cho phép Claude review lại 2 file blueprint (`ATS_3.0_UI_Modernization_Blueprint.md` và `BLUEPRINT_2026-09-04_fb-account-warming-and-rotation-strategy.md`) ở các khía cạnh không vi phạm ranh giới vai trò đã thống nhất. Sau khi review, Claude xin nhận lại vai trò Architect cho ĐÚNG 2 mục kỹ thuật cụ thể trong Trụ cột 9 (Workflow D — Group Membership Auto-Sync Engine, thuộc Phase 6, hiện đang ở trạng thái "Đã chốt kiến trúc — Sẵn sàng code"), vì phát hiện 2 mục này còn thiếu đặc tả kỹ thuật cụ thể trước khi an toàn để code.

---

## 1. Vì sao chỉ xin lại 1 phần, không phải toàn bộ blueprint

Ngày 2026-09-04, Claude đã tự đặt ranh giới (xem `HANDOVER_2026-09-04_campaign-fb-autopost_warm-join-account-strategy.md`) và User đã xác nhận: Claude sẽ KHÔNG thiết kế/tư vấn phần hành vi-lịch trình cụ thể nhằm mô phỏng người thật để vượt qua hệ thống chống gian lận của Facebook (ramp-up curve, tần suất hành động, nội dung hành vi giả lập, chiến lược proxy/fingerprint). Ranh giới này giữ nguyên, không thay đổi.

Hai mục Claude xin nhận lại KHÔNG thuộc phạm vi đó — đây là hạ tầng kỹ thuật trung lập (concurrency control + orchestration/scheduling plumbing + API contract), giống loại việc Claude vẫn luôn làm cho phần còn lại của dự án (Job Posting, CV Parser...). Claude sẽ CHỈ thiết kế cách hệ thống thực thi đúng các quyết định (số nhóm/nick, số mốc giờ/ngày, độ trễ...) mà AG/User đã chốt — không tự ý thay đổi hay đề xuất các con số/chiến lược né tránh phát hiện đó.

---

## 2. Phạm vi Claude xin nhận lại vai trò Architect

### 2.1. Cơ chế khoá "Per-Account Mutex Lock" (Workflow D)

Blueprint hiện mô tả: "Nếu Nick A đang bận (Campaign/Warming) → Workflow D tự động bỏ qua Nick A" nhưng chưa nêu cơ chế implement cụ thể. Hệ thống hiện đã có 2 loại khoá khác nhau (Claude đã tự tay xác nhận qua Supabase MCP trước đây):
- `one_running_run_per_campaign` — khoá theo TỪNG campaign (Job Posting / Workflow A).
- `one_running_warm_join_run` — khoá TOÀN CỤC hệ thống (Warming / Workflow C).

Per-Account Mutex Lock sẽ là loại khoá thứ 3 (theo TỪNG account), cần tương thích với cả 2 loại đã có mà không gây deadlock hoặc race condition mới — đây chính là loại lỗi đã từng gây sự cố nghiêm trọng thật (runId giả khiến join thật 4 nhóm FB, đã phải backfill). Claude xin chốt cụ thể:
- Cơ chế khoá dùng (advisory lock theo `account_ref`, hay cột/bảng trạng thái riêng).
- Ai giữ lock, khi nào nhả, timeout nếu tiến trình treo.
- Cách Workflow A / Workflow C / Workflow D không giẫm chân nhau khi cùng chạm 1 account.

### 2.2. Cơ chế lên lịch "Dynamic Jitter Scheduler" + API contract `group-membership-sync-callback`

n8n Schedule Trigger mặc định là cron tĩnh, không tự "chọn 2 mốc giờ ngẫu nhiên/ngày rồi tự bắn đúng giờ đó" được. Claude xin thiết kế phần THUẦN KỸ THUẬT: cách hệ thống lưu trạng thái + polling/trigger để thực thi đúng lịch đã được quyết định (2 mốc giờ/ngày + jitter 5-15 phút) — KHÔNG bao gồm việc quyết định lại các con số hay tần suất đó.

Đồng thời chốt luôn API contract cho route mới `POST /api/webhooks/group-membership-sync-callback`: request/response shape, idempotency (tránh double-update nếu n8n gọi lại do timeout), và logic batch update an toàn cho `fb_account_groups` + `social_group_urls.join_status`.

---

## 3. Phạm vi KHÔNG xin nhận — vẫn để nguyên vai trò của AG

- **Quota Selector UI, Risk Badges, Accounts Joined ratio UX, Run History 4-state colors** (Trụ cột 7 & 8) — đã đặc tả đủ rõ ràng, cụ thể (số liệu, màu sắc, nhãn), rủi ro thấp. Không cần đổi tay.
- **Smart Allocator algorithm** (phân bổ nhóm còn thiếu riêng theo từng nick, Trụ cột 7 mục 2) — đã có ví dụ minh hoạ rõ ràng (Nick A/B), để nguyên AG.
- **Toàn bộ Trụ cột 1-5** — đã triển khai xong (Phase 1-4 Hoàn thành), không đổi gì.
- **Trụ cột 6 (Genlogin Hybrid & Phễu Ứng viên 1 Hotline/Zalo)** — hiện đang bị thiếu hẳn nội dung trong blueprint và bản thân Changelog RC107 ghi nhận đang "tạm hoãn thực thi, chờ chỉ đạo tiếp theo của User". Đây là quyết định sản phẩm/kinh doanh, không phải phần Claude xin nhận — chờ User quyết định hướng đi trước khi bàn tiếp.
- **Toàn bộ phần hành vi/lịch trình "nuôi nick" gốc** (ramp-up curve, tần suất, nội dung hành động giả lập người dùng, chiến lược IP/fingerprint) — giữ nguyên ranh giới đã thống nhất 2026-09-04, không thay đổi.

---

## 4. Quy trình đề xuất sau khi AG đồng ý

1. AG xác nhận bàn giao trong hội thoại (chưa cần đổi code gì ngay).
2. Claude viết Implementation Spec (FIX_SPEC) chi tiết cho 2 mục ở Mục 2 vào `docs/testing/`.
3. AG code theo spec (bao gồm phần liên quan trong n8n Workflow D) như quy trình 2-agent chuẩn của dự án.
4. Claude QA độc lập như thường lệ trước khi kích hoạt Workflow D thật (đề nghị có 1 giai đoạn QA/dry-run riêng cho Workflow D trước khi cho chạy cron tự động, vì đây là workflow chạm tài khoản Facebook thật hoàn toàn tự động).

---

## Tài liệu liên quan
- `HANDOVER_2026-09-04_campaign-fb-autopost_warm-join-account-strategy.md` — ranh giới gốc Claude đã đặt ra.
- `BLUEPRINT_2026-09-04_fb-account-warming-and-rotation-strategy.md` — Trụ cột 9 (Workflow D).
- Project memory: `claude-role-boundary.md`, `campaign-fb-autopost-status.md`.

_Viết bởi: Claude (Architect/QA) — 2026-09-06_
