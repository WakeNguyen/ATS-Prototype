# Handover — Chiến lược "Nuôi Nick" FB Account (Warming/Rotation) — 2026-09-04

**Từ:** Claude (Architect/QA của dự án ATS 3.0)
**Lý do viết file này:** Đây là mục 2 trong 3 mối lo ban đầu User đặt ra về Campaign FB Auto-Post (2 mục còn lại — scale Social Groups và auto-chunk campaign — đã/đang xử lý riêng, xem [[campaign-fb-autopost-status]]). Claude đã dừng lại, không thiết kế tiếp phần NÀY — xem lý do ở mục "Vì sao Claude dừng lại" bên dưới. File này CHỈ ghi lại bối cảnh + hạ tầng đã có sẵn, KHÔNG chứa bất kỳ đề xuất nào về hành động/lịch trình warming cụ thể — người tiếp nhận (User, 1 kiến trúc sư khác, hoặc 1 phiên AI khác nếu User chủ động yêu cầu và tự chịu trách nhiệm thiết kế phần hành vi) sẽ cần tự quyết định phần đó từ đầu.

---

## Bối cảnh User đã mô tả (nguyên văn ý, 2026-09-04)

- Mối lo ban đầu: chạy nhiều FB account trên cùng 1 thiết bị (VPS chạy Playwright) kèm proxy xoay vòng — có rủi ro gì về việc bị Facebook liên kết/phát hiện các account với nhau không?
- Định nghĩa "nuôi nick" User đưa ra: hành động join các group + hành động "ngẫu nhiên" để giả lập người thật, mục tiêu cuối là để account "đủ tuổi" trước khi chạy posting thật. 1 account mới lập mà post bài ngay có rủi ro bị khoá ("bay acc") rất cao.

## Vì sao Claude dừng lại, không thiết kế tiếp

Mục tiêu được mô tả — mô phỏng hành vi người thật để vượt qua hệ thống phát hiện tài khoản giả/spam của Facebook rồi mới đăng bài hàng loạt — là thiết kế 1 cơ chế né tránh hệ thống chống gian lận của 1 nền tảng khác. Claude đã trao đổi thẳng với User (được User xác nhận hiểu và đồng ý) rằng đây là ranh giới Claude tự đặt: sẽ không thiết kế/tư vấn phần hành vi-lịch trình cụ thể (hành động gì, tần suất nào, đường cong ramp-up ra sao để "giống người"), dù mục đích cuối của cả hệ thống (marketing tuyển dụng) là chính đáng.

**Claude vẫn sẵn sàng, nếu ai đó khác tự thiết kế phần hành vi:**
- Thảo luận rủi ro/kiến trúc ở mức chung (đã trao đổi 1 phần, xem "Đã trao đổi ở mức chung" bên dưới).
- Xây/QA phần hạ tầng trung lập không phụ thuộc vào hành vi cụ thể là gì (ghi log batch run, notification, UI history) — tương tự mọi phần khác của dự án.
- QA lỗi THUẦN KỸ THUẬT cho code kết quả (đúng SQL, transaction an toàn, race condition, mã hoá credential, status machine nhất quán) — KHÔNG đánh giá hộ câu hỏi "hành vi này có đủ giống người thật để qua mặt Facebook không" (đó là đánh giá hiệu quả né tránh, không phải bug kỹ thuật).

## Đã trao đổi ở mức chung (không phải thiết kế, chỉ là kiến thức rủi ro phổ quát)

- `fb_accounts.reset_ip_url` cho thấy thiết kế DB ban đầu đã nghiêng về hướng **mỗi account 1 proxy riêng, cố định (sticky)**, có nút reset IP khi cần — không phải 1 pool proxy xoay vòng dùng chung nhiều account. Về nguyên tắc chung: 1 account đã đăng nhập mà IP nhảy liên tục là dấu hiệu bất thường dễ nhận biết hơn so với 1 account luôn dùng đúng 1 IP quen thuộc.
- Chạy nhiều account trên cùng 1 VPS không tự động là rủi ro cao nếu mỗi account chạy trong 1 Playwright browser context tách biệt hoàn toàn (cookie/session riêng) — đây là thực hành kỹ thuật chuẩn để tránh rò rỉ session chéo, không phải kỹ thuật né tránh phát hiện.

## Hạ tầng ĐÃ CÓ SẴN trong DB/code (xác nhận qua Supabase MCP + đọc code, 2026-09-04)

Từ PHẦN 1 (schema) + PHẦN 3 (Server Actions), khung sườn lưu trữ/hiển thị đã được dựng sẵn một phần, dù chưa có logic thật chạy:

- `fb_accounts` (cả 2 schema `sandbox`/`public`) đã có cột: `last_warmed_at` (timestamptz), `reset_ip_url` (text), `proxy_url` (text, mã hoá AES-256-GCM), `daily_quota` (int, mặc định 6), `status` (text: `'Active'`/`'Checkpoint'`...).
- Bảng `warm_join_runs`: `id`, `status`, `trigger_source`, `started_at`, `completed_at`, `stats` (jsonb), `summary`, `error_message`, `n8n_execution_id`, `created_time`, `notification_id`.
- Bảng `warm_join_run_items`: `id`, `run_id`, `fb_account_id`, `social_group_id`, `group_name`, `group_url`, `action` (text — code hiện đang phân loại các giá trị `'Joined'`/`'Warmed'`/`'Failed'`), `error_message`, `created_time`.
- Bảng `fb_account_groups`: `fb_account_id`, `social_group_id`, `joined_at` — theo dõi account nào đã join group nào.
- Server actions đã có (chỉ ĐỌC, chưa có action nào TRIGGER 1 run mới): `getWarmJoinRuns(limit)` và `getWarmJoinRunDetail(runId)` trong `src/app/campaign_actions.js` (~dòng 1195-1260).
- UI: `src/app/campaigns/page.js` đã có sub-tab "Warm/Join History" (state `fbAccountsTab`, `warmJoinRuns`), render qua component dùng chung `RunHistoryTable` (`type="warm_join"`) — cùng component đang dùng cho lịch sử campaign runs.
- Notification type `warm_join_needs_attention` đã có icon mapping sẵn trong `src/app/components/PendingCVClientWrapper.js` (~dòng 93) — hiện CHƯA có nơi nào thật sự tạo ra notification loại này (chỉ là chỗ chờ sẵn).

## Còn thiếu — người tiếp nhận cần tự quyết định/thiết kế

1. **Định nghĩa cụ thể hành động "nuôi nick"** và chính sách lịch trình/ramp-up (Claude không tham gia phần này).
2. **Mô hình cô lập thiết bị/browser profile:** schema hiện KHÔNG có cột nào theo dõi "account nào chạy trên browser profile/thiết bị nào" — nếu thiết kế cần việc này, phải thêm cột mới (ví dụ `device_id`/`browser_profile_ref` trên `fb_accounts`, hoặc 1 bảng gán riêng).
3. Quyết định `reset_ip_url` được gọi tự động (ví dụ trước mỗi phiên warming) hay chỉ gọi tay khi cần.
4. Thiết kế workflow n8n (C) "Auto-Warm & Auto-Join" + script Playwright tương ứng, theo đúng pattern Bridge Server đã dùng cho workflow (A) Auto-Post.
5. Viết FIX_SPEC cho phần Server Actions còn thiếu (ví dụ 1 action TRIGGER run mới, cập nhật `fb_accounts.last_warmed_at`/`status` sau mỗi phiên).

## Tài liệu liên quan
- [[campaign-fb-autopost-status]] — mục "Việc còn mở", điểm 6.
- Toàn bộ cuộc trao đổi liên quan nằm trong phiên làm việc 2026-09-04 (không có file transcript riêng — nội dung cốt lõi đã tóm tắt đầy đủ ở trên).
