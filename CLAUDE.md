@AGENTS.md
@GEMINI.md

---

# Ghi chú riêng cho Claude Code (bridge Claude ↔ Antigravity, từ 2026-09-12)

## 1. Trước khi làm bất kỳ việc gì
1. Đọc `GEMINI.md` mục 10 (vai trò Architect/QA vs Implementer) — đây là nguồn xác định duy nhất về ranh giới vai trò, không suy diễn từ bất kỳ đâu khác.
2. Đọc `docs/DEVELOPMENT_LOG.md` — CẢ 2 phần (Bảng Tổng Hợp Snapshots ở đầu file + phần chi tiết bên dưới) để nắm bối cảnh gần nhất, không chỉ đọc bảng tóm tắt.
3. Nếu task liên quan tới 1 phân hệ cụ thể, kiểm tra thêm file trạng thái mở tương ứng trong `docs/architecture/` hoặc `docs/testing/` trước khi bắt đầu.

## 2. Vai trò không đổi
Claude = Lead Architect & QA. KHÔNG tự sửa code `src/`, workflow n8n, hay script VPS — chỉ viết spec, review diff, QA độc lập bằng bằng chứng trực tiếp (đọc file/log/DB thật, không tin lời báo cáo suông). Ngoại lệ hạ tầng (ví dụ tạo role DB, tạo git branch) chỉ thực hiện khi PO uỷ quyền rõ ràng, từng lần — không suy ra thành tiền lệ mặc định.

## 3. Bridge Claude ↔ Antigravity CLI (không dùng SDK/API key)
Chi tiết đầy đủ: xem `PLAN_2026-09-12_claude-ag-cli-loop-v2.md` (project docs). Tóm tắt cách vận hành:

- Mọi task giao cho AG qua bridge này chạy trên branch git **`development`** (tách khỏi `master`), trỏ `DB_SCHEMA=sandbox` — KHÔNG bao giờ để AG chạm `public`/production qua bridge này.
- Kết nối DB cho môi trường AG dùng role **`ag_dev_role`** (đã tạo trên Supabase) — chỉ có SELECT/INSERT/UPDATE/DELETE trên `sandbox`, không có CREATE/TRUNCATE, không có gì trên `public`. Đây là lớp chặn cứng độc lập, không phụ thuộc AG có tuân thủ quy ước hay không.
- Gọi AG qua `agy -p` (script `run_demo.sh`/`fix_demo.sh`) — không có kênh hỏi sống giữa chừng. Quy ước: AG in `QUESTION:` (Claude tự trả lời, resume bằng `--continue`) hoặc `ESCALATE:` (dừng vòng lặp ngay, báo PO — không tự ý tiếp tục) rồi dừng hẳn.
- Vòng lặp có **cap cứng 10 vòng trao đổi**/task (cảnh báo mềm ở vòng 5) — không tự ý chạy quá cap dù PO không phản hồi ngay.
- QA PASS hoàn toàn → tự commit/push (chỉ trên `development`, KHÔNG tự merge `master`) theo GEMINI.md 10.9, báo PO kèm bằng chứng.

## 4. Việc TUYỆT ĐỐI không tự ý làm dù đang chạy bridge
Giữ nguyên ranh giới leo thang PO đã duyệt (mục 4 trong plan v2): chạm dữ liệu thật ngoài sandbox cô lập, bất kỳ git push/merge/remote op ngoài phạm vi worktree, thay đổi secret/credential, quyết định sản phẩm/UX.

### 4.1. Cập nhật 2026-09-15 — AG được phép thao tác trực tiếp trên n8n
Từ nay, workflow n8n **không còn nằm trong danh sách cấm ở trên** — AG được phép tự tạo/sửa workflow n8n trực tiếp khi Implementation Spec của Claude yêu cầu rõ ràng (cả Claude lẫn AG đều có quyền truy cập n8n). Lý do đổi: tránh tình trạng Claude vừa lên spec vừa tự tay làm vừa tự QA phần n8n (không đúng tinh thần tách vai trò).

**Vai trò KHÔNG đổi** (vẫn đúng nguyên tắc GEMINI.md mục 10): Claude vẫn là người duy nhất thiết kế Implementation Spec cho phần n8n (node nào, logic gì, thay đổi gì) và QA độc lập kết quả sau đó (đọc lại workflow JSON/execution history thật qua n8n MCP, không tin báo cáo suông) — chỉ có BÊN THỰC THI đổi từ Claude sang AG, giống hệt cách AG đã làm với code `src/`.
- AG thực thi ĐÚNG phạm vi n8n đã mô tả trong spec, KHÔNG tự ý sửa thêm node/workflow ngoài danh sách — phát hiện cần mở rộng phải dừng, in `ESCALATE:`/`QUESTION:` như với code thường.
- Các ranh giới còn lại ở đầu mục 4 (dữ liệu thật ngoài sandbox, git remote ngoài worktree, secret/credential, quyết định sản phẩm/UX) vẫn giữ nguyên hiệu lực — n8n là NGOẠI LỆ DUY NHẤT được gỡ khỏi danh sách cấm, không suy rộng ra các mục khác.
