# Hướng dẫn vận hành Bridge Claude ↔ Antigravity (dùng khi quên quy trình)

Đây là bản "cheat sheet" thao tác thực tế — thiết kế đầy đủ (lý do, kiến trúc) nằm ở
`PLAN_2026-09-12_claude-ag-cli-loop-v2.md` (project docs Cowork). File này chỉ trả lời
**"giờ phải làm gì, theo đúng thứ tự nào"**.

---

## 0. Sơ đồ 1 task, từ đầu tới cuối

```
1. new_task.sh <ten-task>        -> tạo worktree + branch tạm + copy sẵn script
2. Viết spec.md trong worktree đó
3. Mở ĐÚNG folder worktree đó trong VS Code/Antigravity (File -> Open Folder)
4. Trong Claude Code (local): ./run_demo.sh
5. Đọc orchestration_log.md -> phân loại QUESTION: / ESCALATE: / PASS / cần sửa
6. Lặp lại bằng ./fix_demo.sh cho tới khi PASS hoặc ESCALATE hoặc chạm cap 10 vòng
7. PASS -> Claude tự QA -> commit + push vào development
8. Dọn dẹp: git worktree remove + git branch -d
```

---

## 1. Bắt đầu 1 task mới

Mở Git Bash (không dùng PowerShell thuần, vì đây là script bash), đứng tại `D:\Users\trith\ats-web`:

```bash
git checkout development
git pull
./bridge/new_task.sh <ten-task>
```

- `<ten-task>`: tự đặt, chỉ chữ không dấu/số/`-`/`_`, không khoảng trắng. Ví dụ: `expand-timeline`, `fix-login-bug`.
- Mặc định worktree mới tạo ở thư mục **cha** của `ats-web` (`D:\Users\trith\wt-<ten-task>`). Muốn tạo ở chỗ khác (ví dụ vẫn dùng `D:\Users\Orchestrator` như trước), thêm biến môi trường:
  ```bash
  WORKTREE_BASE_DIR=/d/Users/Orchestrator ./bridge/new_task.sh <ten-task>
  ```
- Script tự in ra đường dẫn worktree mới tạo + các bước tiếp theo — đọc kỹ output, không cần nhớ thuộc lòng.

## 2. Viết `spec.md`

Mở file `spec.md` (rỗng, đã được tạo sẵn) trong đúng worktree, viết mô tả task cho Antigravity. Cuối file, dán thêm đoạn quy ước rủi ro (đã có sẵn trong `PLAN_2026-09-12...` mục 3.6, hoặc hỏi Claude soạn):

```
## Quy ước xử lý khi phát hiện lệch spec hoặc không rõ ràng
- Lệch nhỏ (UI/trình bày) -> tự sửa, ghi chú, KHÔNG dừng.
- Đụng database/API/quyết định sản phẩm -> DỪNG NGAY, in "ESCALATE: ..."
- Chỉ cần hỏi 1 chi tiết kỹ thuật nhỏ -> in "QUESTION: ..." rồi dừng.
```

## 3. Mở đúng folder trong IDE

**Đây là lỗi hay gặp nhất** — nhớ kỹ: phải mở **CHÍNH folder worktree** (`wt-<ten-task>`) làm gốc workspace, không phải mở `ats-web`, không phải mở folder cha (`Orchestrator`, `trith`...).

Lý do: `.claude/settings.local.json` (pre-approve quyền chạy `run_demo.sh`/`fix_demo.sh` không cần hỏi mỗi lần) chỉ có tác dụng khi nó nằm ngay trong workspace gốc mà Claude Code đang mở.

File → Open Folder → chọn đúng đường dẫn worktree (ví dụ `D:\Users\trith\wt-expand-timeline`).

## 4. Chạy vòng đầu tiên

Trong Claude Code (đang mở đúng worktree), gõ: chạy `./run_demo.sh`. Claude Code sẽ tự thấy đây là lệnh đã pre-approve, không hỏi quyền.

Script này gọi `agy -p "$(cat spec.md)" --dangerously-skip-permissions ...`, ghi kết quả vào `orchestration_log.md`.

**Tự động lưu vào "AI Collab History":** mỗi lần `run_demo.sh`/`fix_demo.sh` chạy xong, ngoài ghi
vào `orchestration_log.md` trong chính worktree, script còn TỰ ĐỘNG copy toàn bộ log đó ra
`<thư mục cha của mọi worktree>/AI Collab History/<tên-nhánh>_orchestration_log.md` (ví dụ, nếu
worktree tạo qua `WORKTREE_BASE_DIR=/d/Users/Orchestrator`, thì đích là
`D:\Users\Orchestrator\AI Collab History\task-<ten-task>_orchestration_log.md`). Mục đích: log
KHÔNG bị mất khi dọn dẹp worktree ở bước 8, và có 1 nơi tổng hợp toàn bộ lịch sử trao đổi Claude↔AG
qua nhiều task để tham khảo sau này.

> ⚠️ **BẮT BUỘC — KHÔNG BAO GIỜ commit thư mục "AI Collab History" vào Git, dưới bất kỳ hình
> thức nào (kể cả "chỉ 1 file để tham khảo").** Sự cố thật đã xảy ra 2026-09-13: 1 file snapshot
> của thư mục này bị copy tay vào trong repo `ats-web` rồi commit + push lên `master` (`d1a69ff`)
> — nội dung chứa plaintext `BRIDGE_INTERNAL_SECRET` đang active tại thời điểm đó (vì log log lại
> nguyên văn báo cáo rotate secret). Phải rotate lại secret lần 2 để vô hiệu hoá, rồi xoá file khỏi
> git (`50edb8b`). Từ nay, `.gitignore` ở gốc repo đã có dòng `AI Collab History/` làm hàng rào kỹ
> thuật chặn `git add`/`git add -A` vô tình bắt thư mục này — NHƯNG không dựa hoàn toàn vào đó, vẫn
> phải nhớ: thư mục này CHỈ tồn tại cục bộ trên máy, KHÔNG có bản sao nào của nó được phép nằm bên
> trong bất kỳ thư mục nào là working tree của Git repo `ats-web` (dù ở nhánh nào, worktree nào).
> Cần chia sẻ nội dung nào đó cho người khác → gửi trực tiếp file đó (email/Drive/chat), không đi
> qua Git.

## 5. Đọc log, quyết định bước tiếp theo

Yêu cầu Claude Code đọc `orchestration_log.md` và phân loại:

| Log có gì | Claude cần làm |
|---|---|
| `ESCALATE: ...` | **Dừng ngay, không tự ý tiếp tục.** Đọc mô tả, quyết định (bạn là PO) rồi mới bảo Claude làm tiếp hoặc huỷ task. |
| `QUESTION: ...` | Claude tự trả lời (vai Architect), viết `fix_instruction.md` kèm câu trả lời, chạy `./fix_demo.sh`. |
| Có vẻ đã xong nhưng Claude tự QA thấy sai/thiếu | Viết `fix_instruction.md` mô tả lỗi, chạy `./fix_demo.sh`. |
| PASS thật sự | Sang bước 7. |

## 6. Chạy vòng tiếp theo

Mỗi lần cần AG sửa thêm: cập nhật `fix_instruction.md`, chạy `./fix_demo.sh` (dùng `--continue` nên AG nhớ ngữ cảnh, không cần lặp lại toàn bộ spec).

- Cảnh báo mềm tự động xuất hiện trong log từ vòng 5.
- Vòng 11 trở đi: script tự chặn cứng, in `HARD_CAP_REACHED`, không gọi AG nữa — lúc này dừng lại, xem lại spec có vấn đề cấu trúc gì không, không cố "ép" chạy thêm.

## 7. Task PASS — commit & merge

Sau khi Claude tự QA (đọc diff thật, không chỉ tin báo cáo AG) và xác nhận PASS:

```bash
# Trong worktree, hoặc trong ats-web chính đều được (chung 1 repo)
git add -A
git commit -m "..."
git push origin task-<ten-task>          # (t㻳 chọn, nếu muốn backup nhánh tạm lên GitHub)

# Merge vào development
git checkout development
git pull
git merge task-<ten-task>
git push origin development
```

**KHÔNG tự merge vào `master`** — nhánh production chỉ merge khi bạn (PO) xác nhận rõ ràng, làm thủ công riêng.

## 8. Dọn dẹp worktree

Sau khi đã merge xong, không cần worktree đó nữa:

```bash
# Đóng VS Code đang mở tại worktree đó trước
cd /d/Users/trith/ats-web
git worktree remove ../wt-<ten-task>
git branch -d task-<ten-task>
```

Nẵu `git worktree remove` báo lỗi vì còn thay đổi chưa commit: hoặc commit/merge nốt, hoặc dùng `--force` (mất hết thay đổi chưa commit trong worktree đó, cẩn thận).

---

## 9. Lỗi hay gặp — tra nhanh

**"Mở IDE ở sai folder, Claude Code không thấy run_demo.sh"**
→ Kiểm tra thanh địa chỉ trên cùng VS Code / status bar — phải đúng tên worktree, không phải `ats-web` hay folder cha.

**Google OAuth báo "redirect_uri_mismatch" khi mở preview Vercel**
→ Domain preview đó (ví dụ `crm-ats-web-git-<nhánh>-...vercel.app`) chưa được thêm vào "Authorized redirect URIs" của OAuth Client trên Google Cloud Console. Vào Console → Credentials → thêm `https://<domain-đó>/api/auth/callback/google` → Save. Domain theo tên nhánh là cố định, chỉ cần thêm 1 lần.

**Push code rồi mà Vercel production không đổi gì (không báo lỗi rõ)**
→ Kiểm tra git author email của commit đó — Vercel âm thầm chặn build (`BLOCKED`) nếu email khác đúng tài khoản GitHub liên kết deploy. Luôn dùng:
```bash
git config user.name "WakeNguyen"
git config user.email "106215929+WakeNguyen@users.noreply.github.com"
```

**Sửa file `.md` trong `docs/` bằng PowerShell mà bị lỗi ký tự lạ**
→ Không dùng `>`/`>>`/`Out-File` trong PowerShell mà không chỉ định `-Encoding utf8`. ůu tiên dùng editor hoặc script Python/Node đọc-ghi tường minh `encoding='utf-8'`.

**`agy` báo "Out of credits" dù tài khoản còn quota**
→ Bug đã biết phía Google (server-side entitlement desync), không phải lỗi cấu hình của mình. Không có cách khắc phục từ client — chờ tự đồng bộ lại hoặc báo Google.

---

## 10. Bảng lệnh tham khảo nhanh

```bash
# Bắt đầu task mới
./bridge/new_task.sh <ten-task>

# Vòng đầu
./run_demo.sh

# Các vòng sau (sau khi sửa fix_instruction.md)
./fix_demo.sh

# Merge sau khi PASS
git checkout development && git pull && git merge task-<ten-task> && git push origin development

# Dọn dẹp
git worktree remove ../wt-<ten-task>
git branch -d task-<ten-task>
```
