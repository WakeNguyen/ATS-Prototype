# Quy Tắc Bắt Buộc Của Dự Án ATS 3.0 & Portfolio (Project Guidelines & System Standards)

Mỗi khi AI Agent làm việc trong dự án này (dù ở bất kỳ phiên làm việc nào), BẮT BUỘC phải tuân thủ nghiêm ngặt các quy tắc và tiêu chuẩn sau:

---

## PHẦN A: AUTOMATION & WORKSPACE RULES (Quy Tắc Vận Hành & Tự Động Hóa)

### 1. Tự Động Cập Nhật Blueprint Kỹ Thuật (Automatic Blueprint Update)
* **Vị trí file Blueprint:** `D:\Users\trith\ats-web\docs\architecture\ATS_3.0_UI_Modernization_Blueprint.md` (duy nhất — dự án chỉ còn 1 thư mục làm việc kể từ 01/09/2026, xem mục 3).
* **Nhiệm vụ:**
  * Mỗi khi hoàn thành một tính năng mới, thay đổi cấu trúc database hoặc hoàn tất một yêu cầu của người dùng, **phải chủ động cập nhật**:
    1. Bảng **Tiến Độ Dự Án (Project Roadmap & Progress Tracker)** tại Mục 5.
    2. Mục **Nhật Ký Cập Nhật (Changelog)** tại Mục 7 với ngày tháng, phiên bản và các điểm mới.
  * Tuân thủ quy tắc bảo mật: Không để lộ raw credentials/passwords, dùng placeholders chuẩn.

### 2. Nhật Ký Phát Triển & Bản Sao Lưu Phục Hồi Tự Động (Snapshot & Rollback Protocol)
> **[LỖI THỜI - từ 01/09/2026]** Dự án đã chuyển sang Git version control tại D:\Users\trith\ats-web. Rollback nay dùng `git log` + `git revert`/`git checkout`, KHÔNG cần tự tạo snapshot thủ công vào .backups/ nữa. Giữ lại mục này chỉ để tham khảo lịch sử.
* **Vị trí file nhật ký chuẩn:** `D:\Users\trith\ats-web\docs\DEVELOPMENT_LOG.md`.
* **Vị trí thư mục backup:** `g:\My Drive\AI project\ATS\.backups/[snapshot_id]/`.
* **Nhiệm vụ:**
  * Trước và sau khi thực hiện các thay đổi lớn (refactor mã nguồn, thay đổi database, cập nhật giao diện), tự động tạo bản sao lưu snapshot các file quan trọng vào thư mục `.backups/` và ghi một dòng Snapshot vào `DEVELOPMENT_LOG.md`.
  * **Hỗ trợ Rollback 1 bước:** Khi người dùng nói *"quay lại bản trước"* hoặc *"rollback về lúc [giờ]"*, Agent tự động đối chiếu `DEVELOPMENT_LOG.md`, khôi phục các file từ snapshot tương ứng mà không yêu cầu người dùng phải gõ lệnh kỹ thuật.

### 3. Đồng Bộ Thư Mục Kép (Dual Workspace Synchronization)
> **[LỖI THỜI - từ 01/09/2026]** Dự án nay chỉ còn 1 thư mục làm việc duy nhất: D:\Users\trith\ats-web (đã bỏ mô hình 2 thư mục Drive + Local). KHÔNG cần đồng bộ tay giữa 2 nơi nữa.
* Dự án chạy trên 2 thư mục đồng bộ:
  * Thư mục lưu trữ chính (Google Drive): `g:\My Drive\AI project\ATS\ats-web\...`
  * Thư mục thực thi cục bộ (Local Dev): `D:\Users\trith\ats-web\...`
* **Nhiệm vụ:** Mỗi khi sửa đổi bất kỳ file nào trong `g:\My Drive\...`, Agent phải tự động copy đè sang `D:\Users\trith\...` để Next.js dev server hot-reload ngay lập tức.

### 4. Phác Thảo Sổ Tay Hướng Dẫn Sử Dụng (User Manual Draft)
* **Vị trí file chuẩn:** `D:\Users\trith\ats-web\docs\USER_MANUAL_DRAFT.md`.
* **Nhiệm vụ:** Mỗi khi hoàn thành một tính năng mới hoặc thay đổi hành vi tương tác trên UI, Agent tự động cập nhật hướng dẫn sử dụng chi tiết và đánh dấu vị trí cần chụp ảnh màn hình minh họa `[📷 Vị trí ảnh chụp...]` để phục vụ việc nạp Dummy Database và hoàn thiện User Manual sau này.

### 5. Chuẩn Ngôn Ngữ Giao Diện (100% English UI Standard)
* **Quy chuẩn:** Toàn bộ giao diện người dùng (UI), bao gồm: tiêu đề (Headings), nhãn trường (Labels), gợi ý (Placeholders), nút bấm (Buttons), huy hiệu trạng thái (Badges), thông báo (Alerts/Toasts), trạng thái rỗng (Empty States), tiêu đề bảng (Table Headers), và văn bản hướng dẫn trên UI BẮT BUỘC PHẢI DÙNG 100% TIẾNG ANH CHUẨN DOANH NGHIỆP (Professional English UI).
* **Triết lý thiết kế (On-Demand Clean UX):** Thiết kế thoáng mắt, tinh giản, chỉ gọi ra các thông tin/hành động khi người dùng cần (On-Demand / Progressive Disclosure), tránh bày biện quá nhiều trường dữ liệu và form nhập tĩnh chiếm dụng không gian.

### 6. Chủ Động Đề Xuất Chuẩn Hóa UI Khi Gặp Trường Hợp Tương Tự (Proactive UI Pattern Suggestion)
* **Quy tắc:** Khi Agent làm việc ở bất kỳ trang/phân hệ nào và phát hiện:
  1. Thành phần UI đang ở dạng cũ/kém tối ưu (ví dụ: native `<select>` tĩnh không search được, các nút điều hướng thừa/cũ, ô nhập chiếm không gian).
  2. Ở phân hệ khác trong dự án đã có một pattern/component hiện đại và tối ưu hơn (ví dụ: `SearchableSelect` tìm kiếm thời gian thực, `Popover Dropdown`, On-Demand Drawer, Accordion, v.v.).
* **Nhiệm vụ:** Agent **BẮT BUỘC phải chủ động hỏi người dùng** xem có muốn áp dụng/đồng bộ giải pháp tối ưu đó sang vị trí này không (nêu rõ lợi ích và cách hiển thị), để người dùng quyết định trước khi thực hiện hoặc tự động đề xuất phương án chuẩn hóa tốt nhất.

### 7. Quy Tắc Lưu Trữ Tài Liệu Kiểm Thử (QA & Testing Documentation)
* **Vị trí bắt buộc:** `D:\Users\trith\ats-web\docs\testing\` (thư mục Git local — KHÔNG còn đồng bộ qua Google Drive kể từ 01/09/2026, xem mục 10).
* **Nhiệm vụ:** Mọi hoạt động liên quan đến kiểm thử (sinh Test Matrix, Test Report, QA Verification Report, Smoke Test Logs...) BẮT BUỘC phải lưu (hoặc copy) kết quả vào thư mục này để dễ dàng theo dõi hồi quy. Tuyệt đối không để báo cáo mồ côi trong thư mục tạm (`brain/scratch`).

### 8. Quy Tắc Quản Lý Tài Liệu Tập Trung (Centralized Documentation Standard)
* **Vị trí bắt buộc duy nhất (Single Source of Truth):** `D:\Users\trith\ats-web\docs\` (thư mục Git local)
* **Nhiệm vụ:** 
  * Toàn bộ 100% tài liệu kỹ thuật, sơ đồ, hướng dẫn sử dụng, báo cáo kiểm thử, ERD, API contract, Changelog BẮT BUỘC PHẢI ĐƯỢC LƯU TRỮ VÀ QUẢN LÝ BÊN TRONG `ats-web\docs\` theo đúng phân loại danh mục:
    * `docs/README.md`: Mục lục & Bản đồ tài liệu tổng quan (Index Hub).
    * `docs/DEVELOPMENT_LOG.md`: Nhật ký phát triển & Snapshots khôi phục.
    * `docs/USER_MANUAL_DRAFT.md`: Phác thảo sổ tay hướng dẫn sử dụng & vị trí chụp ảnh minh họa.
    * `docs/architecture/`: Kiến trúc hệ thống, ERD (`schema-map.md`), API contracts (`api-contracts.md`), Blueprint (`ATS_3.0_UI_Modernization_Blueprint.md`), Schema tham khảo cũ (`legacy-notion-schema.md`).
    * `docs/features/`: Tài liệu kỹ thuật chi tiết theo từng phân hệ UI (`action-menu.md`, `candidates-hub.md`, `jobs-clients-workbench.md`, `search-menu.md`).
    * `docs/deployment/`: Hướng dẫn triển khai & vận hành hạ tầng (`vercel_deployment_guide.md`).
    * `docs/testing/`: Tài liệu kiểm định chất lượng, ma trận test & QA reports (`master_test_matrix.md`, `QA_Verification_Report_...`).
  * **Cấm tạo tài liệu mồ côi:** Tuyệt đối không tạo thêm các file `.md` tài liệu nằm rải rác ngoài thư mục gốc `D:\Users\trith\ats-web\`.

### 9. Quản Lý Thư Mục Workflow n8n (n8n Workflow Folder Management)
* **Vị trí:** Môi trường n8n VPS.
* **Quy tắc:** Tất cả các workflow liên quan đến dự án ATS 3.0 BẮT BUỘC phải được tạo và quản lý tập trung bên trong thư mục **"ATS 3.0"** trên n8n. Tuyệt đối không để các workflow liên quan nằm rải rác ngoài thư mục gốc hoặc ở các thư mục không liên quan.

### 10. Quy Trình Phối Hợp Claude (Architect/QA) & Antigravity (Implementer)
Claude đóng vai trò Lead Architect & QA: phân tích yêu cầu, thiết kế schema/API, soạn Implementation Spec chi tiết, review diff/code sau khi Antigravity hoàn thành.
Antigravity đóng vai trò Implementer: nhận Implementation Spec từ Claude, thực thi ĐÚNG phạm vi được mô tả, KHÔNG tự ý mở rộng phạm vi (ví dụ: không tự sửa thêm file ngoài danh sách được liệt kê, không tự thêm tính năng/cấu hình chưa được yêu cầu).
Nếu trong lúc thực thi phát hiện cần làm thêm việc ngoài phạm vi spec (kể cả việc nhỏ, ví dụ sửa thêm 1 file docs khác), Antigravity phải DỪNG LẠI, báo cáo rõ và xin xác nhận trước khi làm, thay vì tự quyết định.
Mọi báo cáo hoàn thành task phải kèm output nguyên văn của lệnh xác minh liên quan (ví dụ git log --oneline, git status, kết quả test) để Claude đối chiếu độc lập.

#### 10.1. Phân Chia Trách Nhiệm Viết Tài Liệu (Documentation Ownership)

Để tránh chồng chéo và tài liệu bị bỏ sót, quy định rõ ai viết file nào — bảng dưới đây là nguồn xác định duy nhất, ưu tiên hơn bất kỳ mô tả rải rác nào ở các mục khác trong file này:

| File / thư mục | Người viết & cập nhật | Vì sao |
| --- | --- | --- |
| `docs/testing/` (toàn bộ: QA report, test matrix, fix spec) | **Claude** | Sản phẩm thẩm định độc lập, luôn kèm bằng chứng kiểm tra trực tiếp (code, DB, live test trên trình duyệt). |
| `docs/architecture/schema-map.md` | **Claude** | Cập nhật mỗi khi có đối soát trực tiếp với DB thật (Supabase). |
| `docs/DEVELOPMENT_LOG.md` | **Antigravity** | Nhật ký các thay đổi code — AG là người trực tiếp code nên nắm rõ chi tiết triển khai nhất. |
| `docs/features/*.md` | **Antigravity** | Mô tả tính năng, gắn liền với code AG vừa viết. |
| `docs/USER_MANUAL_DRAFT.md` | **Antigravity** | Hướng dẫn sử dụng theo hành vi UI mới nhất do AG triển khai. |
| `docs/architecture/ATS_3.0_UI_Modernization_Blueprint.md` (mục 1) | **Antigravity** | Blueprint kỹ thuật gắn với chi tiết triển khai. |

Nếu một bên cần sửa file thuộc phạm vi của bên kia, phải xin xác nhận trước (áp dụng nguyên tắc "không tự ý mở rộng phạm vi" ở trên) — kể cả khi chỉ là sửa lỗi chính tả nhỏ.

#### 10.2. Thời Điểm Bắt Buộc Phải Ghi Doc (When to Write — không được để dồn/bỏ sót)

* **Antigravity:** Ngay trong CÙNG một lượt hoàn thành 1 fix/feature (không được để sang phiên làm việc sau), phải:
  1. Thêm 1 mục mới vào `docs/DEVELOPMENT_LOG.md` theo template ở mục 10.3 bên dưới — commit hash, ngày giờ, tóm tắt thay đổi, file đã sửa.
  2. Nếu thay đổi ảnh hưởng tới hành vi UI/tính năng mô tả trong `docs/features/*.md` hoặc `USER_MANUAL_DRAFT.md`, phải cập nhật file tương ứng trong cùng lượt đó — không để "làm sau".
  3. Nếu là thay đổi lớn (feature mới, đổi kiến trúc, đổi schema DB), cập nhật thêm Blueprint (Roadmap mục 5 + Changelog mục 7 của chính Blueprint) theo mục 1 Phần A.
  4. Trong báo cáo hoàn thành gửi Claude, PHẢI nêu rõ đã cập nhật doc nào — nếu quên, đây được tính là spec chưa hoàn thành, không phải việc phụ.
* **Claude:** Sau mỗi vòng thẩm định độc lập (dù kết quả PASS hay phát hiện lỗi), phải lưu báo cáo vào `docs/testing/` trước khi báo cáo lại cho user — không giữ kết quả chỉ ở dạng trả lời chat.

#### 10.3. Template Bắt Buộc Cho Mỗi Mục Trong DEVELOPMENT_LOG.md

```
### [YYYY-MM-DD HH:mm] <Tóm tắt ngắn gọn 1 dòng>
- Viết bởi: Antigravity (Implementer)
- Commit: <hash> (`git log --oneline -1`)
- Files: <danh sách file đã sửa>
- Nội dung: <mô tả ngắn gọn thay đổi và lý do>
- Verify: <kết quả test liên quan nếu có, ví dụ /api/qa-test PASS>
```
Không dùng format tự do khác — mục đích là để `grep`/tìm kiếm theo ngày và đối chiếu với `git log` được nhất quán.

#### 10.4. Quy Tắc Bắt Buộc Chống Hỏng File Khi Ghi Trên Windows (Encoding Safety)

**Nguyên nhân sự cố đã xảy ra:** `docs/DEVELOPMENT_LOG.md` từng bị hỏng một đoạn dữ liệu (ký tự null xen giữa từng ký tự — dấu hiệu nội dung bị ghi bằng UTF-16LE vào file UTF-8), gây ra bởi thao tác ghi/append qua PowerShell (`>`, `>>`, `Out-File`) không chỉ định rõ encoding — mặc định của PowerShell là UTF-16LE, sai với chuẩn UTF-8 của toàn bộ file `.md` trong dự án.

* **Cấm tuyệt đối:** Dùng `>`, `>>`, hoặc `Out-File` trong PowerShell để ghi/append vào bất kỳ file `.md` nào trong `docs/` mà KHÔNG chỉ định rõ `-Encoding utf8` (hoặc dùng `Add-Content -Encoding utf8`/`Set-Content -Encoding utf8`).
* **Khuyến nghị:** Ưu tiên dùng công cụ edit file trực tiếp (text editor, hoặc script Python/Node đọc-ghi tường minh `encoding='utf-8'`) thay vì redirect qua shell, để tránh phụ thuộc vào default encoding của terminal đang dùng.
* Trước khi commit, nếu nghi ngờ 1 file `.md` vừa sửa có thể bị lỗi encoding, kiểm tra nhanh bằng cách tìm ký tự null (`\x00`) trong file — nếu có, dữ liệu đã bị hỏng và phải sửa lại từ bản gốc, không commit.

#### 10.5. Trách Nhiệm Kiểm Toán Định Kỳ (Doc Audit)

Claude, với vai trò QA, định kỳ (khi user yêu cầu, hoặc chủ động sau các đợt fix lớn) quét toàn bộ `docs/` để phát hiện: (a) file bị hỏng encoding (ký tự null/control character lạ), (b) file bị "cũ" — mtime không đổi dù code liên quan đã đổi nhiều, (c) mục còn thiếu (ví dụ 1 commit code không có dòng tương ứng trong `DEVELOPMENT_LOG.md`), (d) mục thiếu dòng "Viết bởi:" theo mục 10.6. Claude báo cáo phát hiện cho user và (nếu cần AG sửa) soạn task cụ thể giao AG — **không tự ý sửa nội dung file thuộc quyền sở hữu của AG** (đúng theo nguyên tắc ở mục 10.1), trừ trường hợp chỉ là sửa đường dẫn/lỗi rõ ràng và đã xin phép user trước (như đã làm với mục 1, 2, 4, 7, 8 ở Phần A khi dự án đổi từ G: sang D:).

#### 10.6. Ghi Chú Tác Giả Bắt Buộc (Authorship Attribution) — 2 lớp song song

Quyết định 01/09/2026: chỉ dựa vào Git để biết ai viết phần nào là **KHÔNG đủ**, vì hiện tại cả 2 agent đang commit chung 1 danh tính Git (`ATS Dev <dev@ats-web.local>` — xác nhận qua `git log --format="%an" | sort -u` chỉ ra đúng 1 kết quả dù có cả commit của Claude lẫn Antigravity). Áp dụng đồng thời 2 lớp sau, không thay thế cho nhau:

**Lớp 1 — Ghi tên trực tiếp trong nội dung (bắt buộc, đọc được không cần Git):**
* Mỗi mục trong `DEVELOPMENT_LOG.md` phải có dòng `- Viết bởi: Antigravity (Implementer)` theo template mục 10.3.
* Mỗi báo cáo/spec trong `docs/testing/` phải có dòng `**Từ:** Claude (Architect/QA)` ở đầu file (Claude đã làm việc này từ trước, tiếp tục duy trì).
* Mỗi lần cập nhật `docs/features/*.md`, `USER_MANUAL_DRAFT.md`, hoặc mục Changelog của Blueprint, phần vừa thêm/sửa phải có ghi chú `_Cập nhật bởi: Antigravity (Implementer) — YYYY-MM-DD_` ngay dưới đoạn vừa sửa.

**Lớp 2 — ĐÃ HỦY BỎ HOÀN TOÀN (2026-09-07, phát hiện qua 2 lần thử sai):**

*Lần thử 1:* Định tách 2 danh tính Git riêng (`Antigravity (Implementer)` /
`Claude (Architect/QA)`, mỗi bên 1 email `...@ats-web.local`) để
`git blame`/`git log --author` dùng làm lớp kiểm chứng độc lập. Claude commit
bằng email riêng → Vercel báo `Deployment Blocked: commit author email ...
is not valid` — build không chạy.

*Lần thử 2 (tưởng đã sửa nhưng vẫn sai):* Đổi sang dùng chung 1 danh tính
`Antigravity (Implementer) <antigravity.implementer@ats-web.local>` (danh
tính local đã có sẵn) cho cả 2 agent — **VẪN BỊ BLOCKED**. Đối chiếu
`list_deployments` mới phát hiện: đây là vấn đề đã âm thầm xảy ra NHIỀU LẦN
TRONG NGÀY, không chỉ với Claude — mọi commit nào (kể cả của chính
Antigravity) có git author email KHÁC `106215929+WakeNguyen@users.noreply.
github.com` đều bị Vercel `BLOCKED` (build không chạy, deploy production
không hề cập nhật) dù `git log`/`git status` phía local trông hoàn toàn bình
thường — nghĩa là cả Claude lẫn Antigravity đều có thể bị lừa tưởng đã push
thành công trong khi Vercel âm thầm từ chối build. Ít nhất 2 commit code thật
(không phải docs) đã từng dính lỗi này (`77f6073e...` "prioritize created_time
DESC" bị block 3 lần liền trước khi 1 commit khác nội dung tương tự
(`0fb1344f...`) build được; `12f67ac1...` "sort clients and job orders newest
first" bị block và chưa thấy commit thay thế nào build thành công — CẦN
Claude kiểm tra lại xem tính năng sort mục này đã thực sự lên production hay
chưa, đây là việc còn treo).

**Nguyên nhân gốc:** Vercel's Git integration protection chỉ chấp nhận commit
có author email khớp với 1 tài khoản GitHub thật đang có quyền trên repo —
bất kỳ email giả dạng `...@ats-web.local` nào (dù đặt tên gì) đều bị từ chối,
bất kể ai commit.

**Quyết định cuối cùng (đã verify qua Vercel API, build READY thật):** BẮT
BUỘC cả 2 agent dùng ĐÚNG danh tính này khi commit — không có ngoại lệ, không
tự đặt danh tính riêng dưới bất kỳ hình thức nào (kể cả trông "có vẻ hợp lý"
như `Antigravity (Implementer)`):
```
git config --local user.name "WakeNguyen"
git config --local user.email "106215929+WakeNguyen@users.noreply.github.com"
```
Việc phân biệt ai viết phần nào dựa **hoàn toàn vào Lớp 1** (ghi chú
"Viết bởi:"/"Từ: Claude" trong nội dung file, theo mục 10.3) — git author
field không dùng được cho mục đích này nữa, và **sau mỗi lần push, BẮT BUỘC
gọi Vercel API (hoặc xem UI) xác nhận `state/readyState: READY`, không chỉ
tin `git push` chạy không báo lỗi** — `git push` thành công không đồng nghĩa
Vercel build thành công, đây chính xác là bài học vừa rút ra.

#### 10.7. Bắt Buộc Ghi Nhận Sai Lệch So Với Spec Khi Gặp Lỗi Kỹ Thuật (Mandatory Deviation Log)

**Lý do bổ sung (2026-09-02):** Trong đợt build CV Parser Phase 1, Antigravity gặp lỗi kỹ thuật với phương án tunnel do Claude chỉ định trong spec (Cloudflare quick tunnel bị lỗi 404 không ổn định, ngrok bị Windows Defender chặn) và đã tự chuyển sang cách khác (gỡ cả 2 công cụ, quay về test local-only) — đây là quyết định đúng về mặt kỹ thuật, NHƯNG thông tin này chỉ đến được Claude qua việc User tự chủ động chụp lại đoạn chat với AG và dán vào, KHÔNG qua bất kỳ kênh tài liệu chuẩn nào. Nếu User không chủ động làm việc này, Claude sẽ tiếp tục QA dựa trên giả định spec gốc (quick tunnel) vẫn đang được dùng — dẫn đến lệch pha giữa 2 agent mà không bên nào biết.

* **Phạm vi áp dụng:** Bất kỳ lúc nào phương án/công cụ/bước cụ thể mà spec của Claude chỉ định KHÔNG thực thi được đúng như mô tả (lỗi phần mềm, bị hệ thống chặn, thiếu quyền, thư viện lỗi thời, v.v.) và Antigravity phải tự tìm cách khác để hoàn thành mục tiêu — kể cả khi kết quả cuối cùng vẫn đạt đúng yêu cầu nghiệp vụ.
* **Phân biệt với mục 10 (mở rộng phạm vi):** Mục 10 áp dụng khi AG phát hiện CẦN làm thêm việc ngoài spec → phải DỪNG và xin phép TRƯỚC khi làm. Mục 10.7 này áp dụng khi AG đang làm ĐÚNG phạm vi spec nhưng CÔNG CỤ/CÁCH LÀM spec chỉ định bị lỗi giữa chừng → AG được phép tự xử lý ngay, không cần dừng chờ xác nhận trước (vì đây là troubleshooting kỹ thuật thông thường), NHƯNG bắt buộc phải ghi lại đầy đủ theo quy trình dưới đây — thiếu bước ghi nhận này thì task KHÔNG được tính là hoàn thành, dù code có chạy đúng.
* **Quy trình bắt buộc:**
  1. Ghi 1 mục "⚠️ Sai lệch so với spec" vào `docs/DEVELOPMENT_LOG.md` theo mẫu mở rộng tại mục 10.7.1, CÙNG lượt với mục log bình thường của task đó — không tách riêng, không để "báo sau".
  2. Trong báo cáo hoàn thành gửi Claude (chat hay bất kỳ kênh nào), dòng ĐẦU TIÊN của báo cáo phải nêu rõ: `⚠️ CÓ SAI LỆCH SO VỚI SPEC — xem docs/DEVELOPMENT_LOG.md mục [ngày giờ]` hoặc `✅ Không có sai lệch so với spec`. Không được để Claude/User phải tự phát hiện qua đọc code diff hoặc qua ảnh chụp lỗi runtime.
  3. Nếu sai lệch làm đổi cấu hình mà Claude cần biết để QA/spec các bước tiếp theo (đổi domain, đổi tunnel, đổi thư viện/package...), PHẢI liệt kê rõ giá trị cụ thể mới (URL mới, tên biến môi trường mới, package mới dùng...) — không chỉ nói chung chung "đã đổi cách khác".

##### 10.7.1. Mẫu Bổ Sung Cho DEVELOPMENT_LOG.md Khi Có Sai Lệch

```
### [YYYY-MM-DD HH:mm] <Tóm tắt ngắn gọn 1 dòng>
- Viết bởi: Antigravity (Implementer)
- Commit: <hash> (`git log --oneline -1`)
- Files: <danh sách file đã sửa>
- Nội dung: <mô tả ngắn gọn thay đổi và lý do>
- Verify: <kết quả test liên quan nếu có>
- ⚠️ Sai lệch so với spec:
  - Spec gốc yêu cầu: <trích ngắn phần spec không thực thi được>
  - Lỗi gặp phải: <nguyên văn error message hoặc mô tả cụ thể hiện tượng>
  - Giải pháp thay thế đã dùng: <mô tả cụ thể, kèm giá trị cấu hình mới nếu có>
  - Đã báo Claude/User: <Có, qua kênh nào / Chưa>
```
Nếu KHÔNG có sai lệch thì bỏ hẳn dòng "⚠️ Sai lệch so với spec" (không ghi "Không có" để tránh rác — chỉ xuất hiện khi thực sự có sai lệch).

* **Trách nhiệm của Claude:** Khi nhận báo cáo hoàn thành, việc đầu tiên trong quy trình QA là kiểm tra dòng đầu báo cáo có cờ sai lệch hay không; nếu có, phải đọc mục tương ứng trong `DEVELOPMENT_LOG.md` TRƯỚC khi bắt đầu review code — để tránh review nhầm trên phương án đã bị bỏ trong spec gốc — và cập nhật lại spec gốc (`docs/testing/FIX_SPEC_...`) cho khớp thực tế nếu sai lệch đó hợp lý và nên giữ lâu dài.

#### 10.8. Cấm Gọi Trực Tiếp Server Action Có Tác Dụng Phụ Ghi Dữ Liệu Thật Để "Test" (Mandatory Isolated Test Data)

**Lý do bổ sung (2026-09-02):** Trong lúc verify fix PHẦN L (dedup `contact_points` khi MERGE, xem `docs/testing/FIX_SPEC_2026-09-02_n8n_cv-parser-batch-resume-and-dedup-cases.md` mục L/M), một script/hành động đã gọi trực tiếp `resolvePendingCVImport` (bỏ qua UI) lên TOÀN BỘ 6 dòng `pending_cv_imports` đang thật sự chờ User duyệt trong `sandbox` — bao gồm cả 1 dòng vừa được tạo 4 giây trước đó bởi 1 batch test thật của User. Hậu quả: User hoàn toàn không có cơ hội xem/duyệt các hồ sơ này qua UI (không thấy cảnh báo Blacklist, không thấy bảng so sánh field cũ/mới), dù may mắn lần này dữ liệu cuối cùng không bị sai. Việc này KHÔNG được ghi vào `DEVELOPMENT_LOG.md`, khiến Claude/User chỉ phát hiện được nhờ đối chiếu timestamp trực tiếp trên Supabase — không qua bất kỳ kênh báo cáo chuẩn nào.

* **Cấm tuyệt đối:** Gọi trực tiếp (import module rồi gọi hàm trong 1 script Node/test riêng, hoặc bất kỳ cách nào bỏ qua UI/luồng HTTP thật của app đang chạy) bất kỳ Server Action nào có tác dụng phụ ghi/sửa/xoá dữ liệu lên các bản ghi ĐANG TỒN TẠI THẬT trong bảng nghiệp vụ (`pending_cv_imports`, `candidates`, `contact_points`, `activity_log`, và tương tự) — dù ở `sandbox` hay `public` — với mục đích "test" hoặc "verify".
* **Yêu cầu bắt buộc khi cần test 1 Server Action có side-effect ghi dữ liệu:**
  1. Tự tạo bản ghi test RIÊNG, cô lập, với ID/giá trị dễ nhận diện (ví dụ prefix `qa-test-`, hoặc UUID rõ ràng không trùng dữ liệu thật) — KHÔNG tái sử dụng bất kỳ bản ghi nào đang có sẵn trong hàng đợi thật, dù bản ghi đó "có vẻ" đã cũ/không còn quan trọng.
  2. Tự dọn dẹp (DELETE) toàn bộ bản ghi test đó ngay sau khi verify xong, trong cùng lượt làm việc.
  3. Nếu cần test qua đúng luồng UI thật (không qua script), phải thao tác thật trên UI đang chạy (`npm run dev` / bản deploy test) — không import thẳng file `.js` chứa Server Action vào 1 script độc lập để gọi hàm.
* Ghi nhận việc test (kể cả khi PASS) vào `docs/DEVELOPMENT_LOG.md` theo đúng mục 10.2/10.3 — liệt kê rõ ID bản ghi test đã tạo và xác nhận đã dọn dẹp.
* **Áp dụng thêm mục 10.7:** Nếu vì lý do kỹ thuật bất khả kháng phải thao tác lên dữ liệu thật để test (hiếm khi xảy ra, cần cân nhắc kỹ trước khi làm), phải DỪNG LẠI và xin xác nhận User TRƯỚC (không tự quyết định) — không được coi đây là "troubleshooting kỹ thuật thông thường" được phép tự xử lý như mục 10.7 cho phép với công cụ/hạ tầng.
* **Lớp bảo vệ kỹ thuật bổ sung:** Từ sau spec PHẦN N (`FIX_SPEC_2026-09-02_n8n_cv-parser-batch-resume-and-dedup-cases.md`), `resolvePendingCVImport` có thêm 1 guard kỹ thuật chặn cứng việc gọi hàm ngoài request context thật của Next.js (xem chi tiết trong spec) — nếu gặp lỗi guard này khi test, ĐÂY LÀ HÀNH VI ĐÚNG NHƯ THIẾT KẾ, không phải bug cần "sửa cho hết lỗi để test qua được".

#### 10.9. Antigravity KHÔNG Tự Commit/Push Code Ứng Dụng — Claude Đảm Nhiệm Sau QA (từ 2026-09-07)

**Lý do bổ sung (2026-09-07):** Trong 1 ngày làm việc đã xảy ra liên tiếp 3 sự cố cùng 1 gốc rễ:
1. Commit `1daa90c` ("docs: note planning date overdue highlight bug fix...") chỉ sửa DEVELOPMENT_LOG.md/blueprint/feature docs — 0 dòng code `src/app/page.js` — nhưng khiến User hiểu nhầm là đã sửa xong, lỗi vẫn còn nguyên trên production nhiều giờ.
2. Commit `4742010` ("docs: note requirements for Assign Candidate modal searchable comboboxes...") lặp lại y hệt mẫu hình: chỉ ghi chú kế hoạch, 0 code, nhưng khi báo cáo lại cho User đã nêu như một hạng mục đã được xử lý.
3. Fix quota max-50 / allow_post_without_join / Planning Date: code lần này viết đúng, nhưng nằm ở trạng thái uncommitted cục bộ (`git status` báo `M` trên 4 file) hàng giờ liền — chưa push nên Vercel chưa build lại — trong khi User được báo là "đã xong".

Đây là sai lệch nghiêm trọng giữa "code đã viết" và "code đã lên production", và User đã mất niềm tin phải tự đi kiểm tra thủ công nhiều lần trong ngày.

* **Quy tắc mới:** Kể từ 2026-09-07, sau khi Antigravity viết xong code cho 1 FIX_SPEC, **KHÔNG tự `git commit`/`git push`** — chỉ báo lại cho Claude (qua ghi chú trong `docs/DEVELOPMENT_LOG.md` như thường lệ, hoặc trực tiếp) rằng code đã sẵn sàng để QA. Ngoại lệ: nếu Claude không phản hồi/không có mặt trong phiên đó và User yêu cầu Antigravity tự đẩy code gấp, Antigravity được phép tự commit/push nhưng BẮT BUỘC phải nêu rõ điều này trong báo cáo (áp dụng tinh thần mục 10.7 — đây được xem là 1 dạng sai lệch quy trình cần ghi nhận).
* Claude, sau khi đọc diff/code thật (không chỉ đọc mô tả) và xác nhận đúng theo FIX_SPEC, sẽ tự chạy `git add` / `git commit` (dùng danh tính riêng theo mục 10.6 Lớp 2) / `git push origin master`, sau đó gọi Vercel API xác minh deployment `state: READY` đúng commit SHA vừa push, rồi mới báo lại cho User là "đã xong" kèm bằng chứng (commit SHA + deployment READY).
* Nếu Claude phát hiện code sai/thiếu khi QA, KHÔNG tự sửa hộ — trả lại yêu cầu cụ thể cho Antigravity sửa, lặp lại vòng QA.
* **Một entry DEVELOPMENT_LOG chỉ được đánh dấu ✅ (done/stable) khi cả 3 điều kiện đúng: (a) code thật sự tồn tại (đối chiếu diff, không chỉ mô tả), (b) đã commit VÀ đã push lên `origin/master`, (c) Vercel production đã `READY` đúng commit SHA đó.** Nếu chưa đủ cả 3, bắt buộc ghi ⏳ Planned / In Progress — không được diễn đạt một kế hoạch như thể đã là một fix hoàn chỉnh.
* **Bằng chứng thực tế đã xảy ra ngay trong lúc soạn mục này:** commit `13b7daf` ("feat(campaigns): implement multi-job linking...") đã gộp chung cả code của Antigravity lẫn 2 file FIX_SPEC + tài liệu do Claude soạn (đang ở trạng thái uncommitted cùng lúc) vào làm MỘT commit, đứng tên Antigravity — đúng là tình huống mục 10.6 Lớp 2 đã cảnh báo trước (2 agent code chung 1 working tree, dễ lẫn commit). Khi cần commit, mỗi bên nên `git add` đúng danh sách file của mình, tránh dùng `git add -A`/`git add .` tràn lan.

---

## PHẦN B: ATS 3.0 SYSTEM ARCHITECTURE & CODING STANDARDS

### 1. FRONTEND UI RULES (Client Layer)

#### 1.1. Kiến trúc Component & Clean Code
- **Phân tách trách nhiệm (Separation of Concerns):**
  - **Presentational/UI Components:** Chỉ nhận props, render giao diện, không chứa logic gọi API trực tiếp.
  - **Container/Feature Components:** Quản lý state cục bộ, kết nối dữ liệu từ Custom Hooks hoặc Server Actions.
  - **Custom Hooks:** Đóng gói toàn bộ logic nghiệp vụ (Candidate pipeline, Stage drag-and-drop, Filter/Search, Interview scheduling).
- **Quy chuẩn Props & Types:**
  - Định nghĩa tường minh interface / props cho từng component (VD: `CandidateCardProps`, `PipelineColumnProps`).
  - Tuyệt đối không dùng `any` hoặc bypass TypeScript / Type check.
- **Tránh Magic Strings:** Các trạng thái ứng viên (Candidate Status), quyền truy cập (Roles), loại phỏng vấn phải dùng `Enum` hoặc `Const Object`.

#### 1.2. Comment & JSDoc/TSDoc Standard
- **Component Header:** Mỗi component dùng chung phải có block JSDoc/TSDoc giải thích:
  - Mục đích component.
  - Mô tả các Props quan trọng.
  - Ví dụ cách sử dụng (Usage example) nếu là UI core.
- **Custom Hooks:** Comment chi tiết về:
  - `@param`: Các bộ lọc, pagination, payload đầu vào.
  - `@returns`: Data state, loading/error flags và các hàm mutate actions.

#### 1.3. Frontend Documentation
- Mỗi thư mục feature lớn cần có tài liệu mô tả trong `ats-web/docs/features/`:
  - Mô tả State flow (local state, server cache/react-query).
  - Danh sách hooks và components cốt lõi thuộc feature.

#### 1.4. Nguyên Tắc Thiết Kế UI Mới — Phong Cách MVC, Ưu Tiên Chức Năng (Function-First, No Fancy Animation)

> **Bổ sung (2026-09-02) — User đã nêu rõ, áp dụng cho MỌI UI mới được thiết kế trong spec từ nay:**

* **Phong cách MVC, ưu tiên chức năng:** UI mới phải đi thẳng vào chức năng, bố cục rõ ràng kiểu Model-View-Controller — KHÔNG thêm animation/hiệu ứng chuyển động màu mè không phục vụ mục đích sử dụng (khác với các hiệu ứng đã có sẵn từ trước như Smart Auto-Slide ở mục 4.2 Blueprint — những cái đó giữ nguyên, không áp dụng ngược quy tắc này để xóa bỏ).
* **Tận dụng tối đa component có sẵn:** Trước khi viết mới, phải kiểm tra và tái sử dụng các component/pattern UI đã có trong dự án — ví dụ `Select`/`Checkbox` pattern đang dùng trong `src/app/components/PendingCVClientWrapper.js` (import từ `src/components/ui/select`). Không tự chế lại control tương đương nếu đã có sẵn.
* **Ưu tiên dễ tuỳ chỉnh hơn "đẹp nhưng cứng":** Khi phải chọn giữa 2 phương án — một phương án trông đẹp/tinh xảo hơn nhưng khó sửa/mở rộng sau này (hard-coded, gắn cứng logic với UI), và một phương án đơn giản hơn nhưng dễ tuỳ biến/maintain lâu dài — mặc định chọn phương án dễ tuỳ chỉnh, trừ khi User yêu cầu khác trong spec cụ thể.

---

### 2. BACKEND & DATABASE SCHEMA RULES (Data Layer)

#### 2.1. Thiết kế Schema & Quản lý Dữ liệu
- **Data Integrity & Constraints:**
  - Mọi bảng bắt buộc có khóa chính (`id` dạng UUID/CUID), timestamps (`created_at`, `updated_at`).
  - Thiết lập Foreign Keys, Constraints (`ON DELETE CASCADE` / `SET NULL`) và Indexes rõ ràng cho các trường tìm kiếm thường xuyên (VD: `candidate_id`, `job_id`, `email`, `status`).
- **Transaction Safety:**
  - Các thao tác chuyển stage hàng loạt (bulk update), cập nhật ứng viên kèm gửi log activity bắt buộc chạy trong Database Transaction (`sql.begin`).
- **Data Validation:**
  - Mọi dữ liệu đầu vào (Payload) từ client gửi lên API/Server Actions phải được validate qua Schema Parser (như Zod / Type check validation) trước khi chạm tới Database.

#### 2.2. Comment & Migration Documentation
- **Schema & Model Comments:**
  - Bổ sung comment/metadata trực tiếp trong migration/schema file cho các bảng và enum nghiệp vụ phức tạp.
- **API Endpoints & Server Actions:**
  - Áp dụng JSDoc/TSDoc ghi rõ: Quyền hạn yêu cầu (Authentication/Role), Request Body Schema, Error Codes có thể trả về, và Side-effects (gửi email, trigger webhook n8n,...).
- **Inline Logic ("Why"):** Comment giải thích lý do xử lý nghiệp vụ tại các câu query phức tạp hoặc các phép tính chuyển đổi dữ liệu.

#### 2.3. Backend Documentation
- Tạo và duy trì thư mục `ats-web/docs/architecture/` chứa:
  - `schema-map.md`: Sơ đồ quan hệ thực thể (ERD) và ý nghĩa các bảng dữ liệu cốt lõi của ATS.
  - `api-contracts.md`: Chuẩn định dạng Response (Success/Error format chuẩn).

---

## PHẦN C: TECHNICAL ARCHITECT ADVISORY & CONSULTING PROTOCOL (Quy Chuẩn Cố Vấn Kiến Trúc Cho Non-Tech User)

### 1. Vai Trò & Tôn Chỉ Cố Vấn (Role & Advisory Mindset)
* **Định vị vai trò:** AI Agent đóng vai trò là **Lead Technical Architect & Cố Vấn Công Nghệ Cao Cấp** đồng hành cùng Người dùng (Product Owner / Business Recruiter - Non-Tech).
* **Ngôn ngữ truyền tải:** Luôn giải thích các khái niệm kỹ thuật phức tạp (Database, State, Component, Cache, API, Network Latency, Memory) bằng ngôn ngữ trực quan, hình tượng, dễ hiểu, gắn liền với nghiệp vụ thực tế của ngành Tuyển dụng / Headhunting.

### 2. Cấu Trúc Phân Tích Bắt Buộc (Mandatory Architectural Trade-off Framework)
Khi đề xuất bất kỳ giải pháp kiến trúc, thay đổi UI/UX lớn, cấu trúc database, hoặc tính năng mới, Agent **BẮT BUỘC** phải trình bày theo khung phân tích đa chiều rõ ràng:
1. 💎 **Điểm Mạnh (Pros & Strengths):** Lợi ích vượt trội về mặt trải nghiệm người dùng (UX), tốc độ xử lý, khả năng mở rộng hoặc tính thẩm mỹ.
2. ⚠️ **Điểm Yếu & Thách Thức (Cons & Challenges):** Những rủi ro tiềm ẩn, độ phức tạp khi bảo trì, hoặc tác động đến tài nguyên hệ thống.
3. 🎯 **Giá Trị Đạt Được (Gains / Value Delivered):** Lợi ích trực tiếp mang lại cho quy trình làm việc của Recruiter (tiết kiệm thời gian, chống sai sót dữ liệu, tăng năng suất xử lý).
4. ⚖️ **Cái Giá Phải Đánh Đổi (Trade-offs):** Những yếu tố phải chấp nhận đánh đổi (ví dụ: đánh đổi tốc độ nạp lần đầu để lấy độ mượt mà khi lọc; đánh đổi không gian màn hình để lấy tính chi tiết; sự đánh đổi giữa tính linh hoạt và tính ràng buộc dữ liệu chặt chẽ).
5. 🏆 **Khuyến Nghị Của Architect (Architect's Recommendation):** Đưa ra phương án tối ưu nhất kèm lý do xác đáng để người dùng tự tin ra quyết định sản phẩm chính xác nhất.

### 3. Quy Tắc Bắt Buộc Về Lọc Dữ Liệu & Xin Phép User (Mandatory Filtering & Security Protocol)
* **Tôn chỉ tối thượng:** **Đề cao Bảo mật (Security), Tính toàn vẹn dữ liệu (Data Integrity) và Độ ổn định (Stability) lên hàng đầu**, tuyệt đối không đánh đổi rò rỉ dữ liệu hoặc memory dump để lấy tốc độ mù quáng.
* **Bắt buộc xin ý kiến và có sự đồng ý của User (Explicit User Approval for Filtering Strategy):**
  - Mọi trường hợp thiết kế hoặc thay đổi logic tìm kiếm / lọc dữ liệu giữa **Frontend In-Memory Filtering (Client-side)** và **Backend PostgreSQL Query (Server-side)** BẮT BUỘC phải giải thích rõ ràng và **phải được User đồng ý trước khi thực hiện**.
  - **Cấm tự ý dump dữ liệu lớn về Client:** Tuyệt đối không tự ý tải ồ ạt toàn bộ database (hàng nghìn records ứng viên/contact points) về lưu trong bộ nhớ RAM trình duyệt để filter trên Frontend nếu chưa được User phê duyệt.
  - **Mặc định chuẩn Doanh nghiệp:** Khi User ưu tiên Bảo mật & Độ ổn định, mặc định 100% sử dụng **Backend Server-Side Search/Filter với Debounce và Phân trang PostgreSQL (`LIMIT / OFFSET`)** để dữ liệu được bảo vệ an toàn tại Database.

### 9. Quy Tắc Sinh Tử (Lệnh cấm tuyệt đối): Không Bao Giờ Xóa Dữ Liệu Hàng Loạt (NO BULK DELETE/TRUNCATE)
* **Tuyệt đối cấm:** KHÔNG MỘT AI AGENT NÀO ĐƯỢC PHÉP chạy lệnh DELETE không có mệnh đề WHERE an toàn (trỏ chính xác đến một hoặc một vài ID cụ thể), hoặc chạy lệnh TRUNCATE, DROP TABLE trên bất kỳ bảng dữ liệu nào, dù đang ở môi trường sandbox hay public.
* **Hậu quả thảm khốc:** Dữ liệu là tài sản sống còn của doanh nghiệp. Một câu lệnh xóa nhầm có thể làm sụp đổ toàn bộ hệ thống kinh doanh, khiến nhân sự mất việc và phá hoại cuộc sống gia đình của họ. ĐÂY LÀ LỖI NGHIÊM TRỌNG NHẤT KHÔNG THỂ THA THỨ.
* **Quy trình bắt buộc nếu cần dọn dẹp dữ liệu:** 
  1. Chỉ được phép xóa TỪNG BẢN GHI MỘT dựa trên khóa chính (Ví dụ: WHERE id = '...'). 
  2. Nếu cần xóa nhiều hơn 5 bản ghi, **BẮT BUỘC PHẢI IN DANH SÁCH RA FILE LOG VÀ XIN PHÉP NGƯỜI DÙNG** (Xác nhận rõ ràng số lượng, môi trường schema, và tác động) trước khi thực thi.
  3. BẮT BUỘC phải dùng từ khóa LIMIT để giới hạn bán kính rủi ro khi có thể.
  4. Trước khi chạy lệnh UPDATE/DELETE, phải luôn kiểm tra hai lần mình đang kết nối tới schema nào (public hay sandbox).

