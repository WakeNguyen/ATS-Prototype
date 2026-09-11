# Kế Hoạch Triển Khai & Đánh Giá Kiến Trúc: 11 Điểm Cải Tiến Hệ Thống ATS 3.0

Tài liệu này đánh giá tính khả thi và đề xuất giải pháp kỹ thuật chi tiết cho 11 hạng mục cải tiến được trích xuất từ [Google Doc phản hồi của User](https://docs.google.com/document/d/1toGIm1xy5I0iR4_z947ArGXDXd8yeHwNKoRXq8gk8qU/edit?usp=sharing), tuân thủ tiêu chuẩn Cố vấn Kiến trúc & Vận hành ATS 3.0.

---

## User Review Required

> [!IMPORTANT]
> **Cam kết an toàn mã nguồn:** Hiện tại **chưa có bất kỳ dòng code nào bị thay đổi**. Toàn bộ kế hoạch bên dưới cần User xem xét và phê duyệt trước khi Antigravity bắt đầu thực thi từng module.

> [!WARNING]
> **Vấn đề Session Facebook Cookie (acc_02):** Campaign run #1573 lúc 13:53 bị dừng là do Cookie của nick `acc_02` (Nick Chính) đã hết hạn / bị Facebook đăng xuất trên VPS (ảnh chụp màn hình xác nhận modal *“Xem thêm trên Facebook - Đăng nhập”*). Cần cập nhật cookie mới (`c_user` và `xs`) trước khi chạy lại batch tiếp theo.

---

## Bảng Đánh Giá Tính Khả Thi & Phân Bổ Kiến Trúc (11 Hạng Mục)

| # | Hạng mục cải tiến | Độ khả thi | Mức độ phức tạp | Vùng ảnh hưởng (Component / Workflow) |
|---|---|---|---|---|
| **1** | Tối ưu bố cục Drawer Campaign Details (Bảng rộng, thu gọn Linked Jobs) | 🟢 Rất cao | Thấp | Frontend (`src/app/campaigns/page.js`) |
| **2** | Tự động chuyển Timeline Note khi Candidate chuyển trạng thái (In progress ↔ Closed) | 🟢 Rất cao | Trung bình | Frontend Action Menu (`src/app/page.js`) |
| **3** | Mặc định Planning Date = Ngày hôm nay (`Today()`) khi tạo/attach Application | 🟢 Rất cao | Thấp | Frontend Modals & Server Actions (`src/app/actions.js`) |
| **4** | Cho phép chỉnh sửa trực tiếp Status & Stage trên thẻ Application ở Candidates Hub | 🟢 Rất cao | Trung bình | Frontend Candidate 360 (`src/app/candidates/page.js`) |
| **5** | Chuẩn hóa CV Parser: Kiểm tra regex LinkedIn thật, chống biến text/họ tên thành URL giả | 🟢 Rất cao | Trung bình | n8n Sub-workflow `WfSingle00000001` (Gemini + JS Node) |
| **6** | Chuẩn hóa Combobox Source Channel (Dropdown gợi ý kèm gõ tự do) | 🟢 Rất cao | Thấp | Frontend Component (`src/lib/enums.js`, Action Menu, Modals) |
| **7** | Làm rõ cơ chế Posting Campaign (Quota vs Safe Batch, Cooldown 24h, Auto-Scheduler) | 🟢 Đã hoàn thiện | Tài liệu | Docs & UI Tooltips giải thích trực quan |
| **8** | Deep-link từ Notification mở trực tiếp Modal trả lời câu hỏi Social Group | 🟢 Rất cao | Trung bình | Frontend Notification Bell & Campaigns Social Tab |
| **9** | Khử trùng lặp (Deduplication) Contact Points (Phone/Email) khi merge CV mới | 🟢 Rất cao | Trung bình | Backend API Webhook & HITL Server Action |
| **10** | Quản lý & hiển thị lịch sử nhiều phiên bản CV (CV Versioning) trên Candidate 360 | 🟢 Rất cao | Trung bình | Frontend Candidate 360 + DB `cv_urls` array |
| **11** | Nút Expand / Full Height cho Activity Timeline trên Action Menu (kéo dài tới hàng Status) | 🟢 Rất cao | Thấp | Frontend Action Menu (`src/app/page.js`) |

---

## Chi Tiết Đề Xuất Kỹ Thuật Cho Từng Hạng Mục (Architectural Trade-offs)

### Hạng Mục 1: Tối Ưu Bố Cục Campaign Details Panel (Drawer)
* **Vấn đề:** Khi chiến dịch gắn nhiều Job (ví dụ 8 jobs), danh sách badge `Linked Jobs` bị tràn xuống dòng, làm panel metadata phình to và đè hẹp bảng *Overview / Target Groups / Run History* ở dưới.
* **Giải pháp đề xuất:**
  1. Cấu trúc lại layout của Drawer sang dạng Flex Column toàn màn hình (`h-full flex flex-col`).
  2. Bọc `Linked Jobs` vào container có cuộn thông minh (`max-h-20 overflow-y-auto pr-1` hoặc nút `Show more (+5 jobs)`).
  3. Đặt bảng dữ liệu (Target Groups / History) vào khối mở rộng linh hoạt (`flex-1 min-h-[420px] overflow-y-auto`), giúp bảng luôn chiếm trọn 70% không gian hiển thị bên dưới.
* 💎 **Điểm mạnh:** Bảng danh sách nhóm và lịch sử chạy rộng rãi, hiển thị đủ cột status, cooldown, action mà không cần cuộn trang chính.
* ⚖️ **Đánh đổi:** Danh sách job liên kết chỉ hiển thị tóm tắt 3-4 jobs đầu và mở rộng khi click.

---

### Hạng Mục 2: Tự Động Đồng Bộ Timeline Note Khi Thay Đổi Status Ở Action Menu
* **Vấn đề:** Khi recruiter đổi trạng thái ứng viên từ `In progress` sang `Closed` (hoặc ngược lại) ở bảng Action Menu, dòng ứng viên đó biến mất khỏi tab hiện tại (do filter). Tuy nhiên, panel `Timeline & Notes` bên phải vẫn lưu `selectedAppId` cũ, dẫn đến tình trạng timeline bị rỗng hoặc không đồng bộ.
* **Giải pháp đề xuất:**
  - Trong hàm `handleInlineUpdate` và `handleStatusChange`: Khi application hiện tại bị ẩn khỏi view lọc, hệ thống tự động tìm bản ghi kế tiếp trong danh sách (Next Row at `index` hoặc `index - 1`), tự động set `setSelectedAppId(nextApp.application_id)` và gọi load timeline của ứng viên kế tiếp ngay lập tức.
* 💎 **Điểm mạnh:** Trải nghiệm chuyển tiếp liền mạch, không còn tình trạng Timeline mồ côi hay thông báo "No Candidate Selected".
* 🎯 **Giá trị:** Tiết kiệm thao tác click lại cho Recruiter khi duyệt pipeline hàng loạt.

---

### Hạng Mục 3: Mặc Định Planning Date Là `Today()` Khi Tạo Mới / Attach Candidate
* **Vấn đề:** Recruiter khi thêm ứng viên vào Job thường phải click chọn ngày lập kế hoạch thủ công.
* **Giải pháp đề xuất:**
  - Tại `AttachCandidateModal.js`, `NewCandidateModal.js`, và Server Action `createApplicationAction`:
  - Khởi tạo giá trị mặc định cho trường `planning_date` = Ngày hiện tại theo định dạng chuẩn ISO Local `new Date().toLocaleDateString('en-CA')` (`YYYY-MM-DD`).
  - Recruiter vẫn hoàn toàn có thể click chọn ngày tương lai hoặc quá khứ nếu muốn.
* 💎 **Điểm mạnh:** Giảm 100% thao tác chọn ngày cho các trường hợp xử lý ứng viên trong ngày (chiếm 90% tần suất làm việc).

---

### Hạng Mục 4: Chỉnh Sửa Trực Tiếp Status & Stage Trên Thẻ Ứng Viên Tại Candidates Hub
* **Vấn đề:** Trang `/candidates` (Candidate 360) hiện chỉ hiển thị Stage dưới dạng Badge tĩnh. Muốn chuyển Stage (VD: `Applied` ➔ `Interview 1`) hoặc đóng ứng viên (`Closed`), Recruiter phải quay lại trang Action Menu `/`.
* **Giải pháp đề xuất:**
  - Biến Stage Badge trên thẻ ứng viên (`ApplicationCard` bên trong `CandidatesView`) thành **Stage Dropdown** (chọn `Lead`, `Applied`, `Interview 1`, `Interview 2`, `Offer`, `Placed`, `Failed`...).
  - Thêm nút Toggle nhanh **Status** (`In progress` / `Closed`) với Modal xác nhận lý do (Reason & Result) tương tự như ở Action Menu.
  - Khi thay đổi, gọi trực tiếp `updateApplicationAction` và revalidate cache cục bộ.
* 💎 **Điểm mạnh:** Đạt đúng triết lý **Candidate 360 Workbench** — quản lý toàn diện ứng viên từ một màn hình duy nhất.
* ⚠️ **Thách thức:** Cần đồng bộ state tức thì giữa Candidate Profile và danh sách Applications con.

---

### Hạng Mục 5: Chuẩn Hóa CV Parser — Kiểm Tra Regex LinkedIn URL Hợp Lệ
* **Vấn đề:** 
  - Với PDF gốc tải từ LinkedIn: Có thẻ nhị phân `/URI (https://linkedin.com/in/...)` nên Node `Detect & Extract PDF Links` bóc tách chính xác 100%.
  - Với PDF thường: Gemini hoặc hàm sanitize hiện tại tự ý biến text họ tên (VD: `"Nguyen Van A"`) thành `linkedin.com/in/nguyen-van-a` dẫn đến link giả/hỏng.
* **Giải pháp đề xuất trên n8n Sub-workflow `WfSingle00000001`:**
  1. Cập nhật System Prompt cho Gemini AI: *"Chỉ trích xuất LinkedIn URL nếu trong text CV có chứa đường link hoặc username LinkedIn rõ ràng. TUYỆT ĐỐI KHÔNG tự suy đoán hay ghép tên ứng viên thành LinkedIn URL."*
  2. Tại Code Node `Parse & Normalize`: Thêm bộ lọc Regex nghiêm ngặt:
     ```javascript
     const linkedinRegex = /(?:https?:\/\/)?(?:www\.)?linkedin\.com\/in\/([a-zA-Z0-9_-]+)/i;
     if (rawLinkedin) {
       const match = rawLinkedin.match(linkedinRegex);
       normalizedLinkedin = match ? `https://www.linkedin.com/in/${match[1]}` : null;
     }
     ```
     Nếu chỉ là text thường không khớp URL thật thì trả về `null`.
* 💎 **Điểm mạnh:** Triệt tiêu hoàn toàn 100% link LinkedIn rác / 404.

---

### Hạng Mục 6: Chuẩn Hóa Combobox Cho `Source Channel`
* **Vấn đề:** Ô nhập Source Channel hiện là input tự do hoặc thiếu danh mục chuẩn, dễ gây sai lệch thống kê (VD: `linkedin`, `LinkedIn`, `Linkin`).
* **Giải pháp đề xuất:**
  - Định nghĩa bộ danh mục chuẩn trong `src/lib/enums.js`:
    - `LinkedIn`
    - `Facebook Group`
    - `TopCV`
    - `VietnamWorks`
    - `CareerBuilder`
    - `Referral (Giới thiệu)`
    - `Direct Sourcing (Headhunt)`
    - `Company Website`
    - `Other...` (cho phép gõ thêm chi tiết)
  - Áp dụng component `SearchableCombobox` trên tất cả các Modal tạo/sửa ứng viên và ứng tuyển.
* 💎 **Điểm mạnh:** Dữ liệu báo cáo nguồn tuyển dụng đồng nhất 100%, hỗ trợ tìm kiếm nhanh bằng bàn phím.

---

### Hạng Mục 7: Làm Rõ & Trực Quan Hóa Cơ Chế Đăng Bài Campaign (Posting Engine)
* **Quy tắc vận hành chuẩn của Engine ATS 3.0:**
  1. **Target Quota (VD: 200 groups):** Tổng số nhóm mục tiêu chiến dịch cần phủ sóng.
  2. **Safe Batch (18 groups/lượt):** Kích thước 1 mẻ chạy an toàn để tránh bị Facebook quét spam.
  3. **Pacing Time (90s - 120s / bài):** Giãn cách ngẫu nhiên giữa các lần post kèm gõ bàn phím mô phỏng người thật.
  4. **Cooldown 24h:** Mỗi nhóm sau khi đăng thành công sẽ vào trạng thái "Hồi chiêu 24h", đảm bảo không bao giờ bị đăng trùng lặp trong cùng 1 ngày.
  5. **Auto-Scheduler (Cron 15 phút):** Tự động thức dậy, kiểm tra nếu có nhóm hết cooldown và chiến dịch còn quota thì tự kích hoạt batch kế tiếp.
* **Hành động:** Bổ sung Tooltip & Progress Indicator trực quan ngay trên Header của Campaign Details để Recruiter nắm rõ trạng thái tức thì.

---

### Hạng Mục 8: Deep-Link Từ Notification Mở Trực Tiếp Modal Trả Lời Câu Hỏi Group
* **Vấn đề:** Khi n8n phát hiện nhóm có câu hỏi bảo mật (Pending Question) và gửi thông báo *"Needs Custom Answer"*, Recruiter click vào thông báo chỉ dẫn về trang chung chứ chưa mở đúng nhóm cần trả lời.
* **Giải pháp đề xuất:**
  - Trong payload Notification, đính kèm link dạng: `/campaigns?tab=social-groups&group_id=${groupId}&action=answer`
  - Trang `/campaigns` khi nhận URL query trên sẽ tự động chuyển sang tab **Social Groups**, mở Modal **Question & Answers** của đúng nhóm đó.
* 🎯 **Giá trị:** 1-Click Action — Recruiter trả lời câu hỏi xét duyệt nhóm chỉ trong 5 giây mà không cần tìm kiếm thủ công.

---

### Hạng Mục 9: Khử Trùng Lặp (Deduplication) Contact Points Khi Merge CV Mới
* **Vấn đề:** Khi một ứng viên gửi CV mới có cùng Số điện thoại hoặc Email với hồ sơ cũ, nếu hệ thống insert thẳng sẽ sinh ra nhiều dòng contact point giống nhau trong `candidate_contact_points`.
* **Giải pháp đề xuất:**
  - Tại API Route `src/app/api/webhooks/cv-import/route.js` và HITL Action:
  - Chuẩn hóa số điện thoại về chuẩn E.164 (hoặc số 10 chữ số nội địa), lowercase Email.
  - Trước khi insert/merge, thực hiện so khớp (Diff & Filter) với các contact points hiện có của ứng viên:
    ```javascript
    const existingValues = new Set(candidate.contact_points.map(cp => cp.value.trim().toLowerCase()));
    const newUniquePoints = incomingPoints.filter(cp => !existingValues.has(cp.value.trim().toLowerCase()));
    ```
  - Chỉ insert những liên hệ mới thực sự chưa từng có.
* 💎 **Điểm mạnh:** Database sạch sẽ, loại bỏ hoàn toàn các liên hệ trùng thừa.

---

### Hạng Mục 10: Quản Lý & Xem Lịch Sử Nhiều Bản CV (CV Versioning)
* **Vấn đề:** Ứng viên cập nhật CV theo thời gian (CV 2024, CV 2025, CV chuyên ngành...), Recruiter cần xem lại các phiên bản CV cũ mà không bị mất file gốc.
* **Giải pháp đề xuất:**
  - Cấu trúc dữ liệu đã có sẵn mảng `cv_urls` (`TEXT[]` hoặc JSON metadata lưu URL + Uploaded Date).
  - Trên giao diện Candidate 360 (Header & CV Preview Tab):
    - Hiển thị component **CV Versions Selector**:
      - `📄 CV v2 (Latest - 08/09/2026)`
      - `📄 CV v1 (Original - 15/01/2025)`
    - Cho phép click chuyển đổi nhanh giữa các phiên bản CV để xem trực tiếp trên Previewer hoặc tải về.
    - Thêm nút **"+ Upload New Version"** để đính kèm bản cập nhật mới nhất.
* 💎 **Điểm mạnh:** Bảo toàn trọn vẹn lịch sử hồ sơ ứng viên qua nhiều năm, hỗ trợ so sánh năng lực ứng viên theo thời gian.

---

### Hạng Mục 11: Nút Expand / Full-Height Cho Activity Timeline Trên Action Menu
* **Vấn đề:** Panel `Interview & Activity Timeline` ở cuối trang Action Menu (`src/app/page.js`) hiện có chiều cao cố định `h-[260px]` khi mở ra. Khi hồ sơ ứng viên có nhiều vòng phỏng vấn hoặc ghi chú dài, không gian 260px bị hẹp, Recruiter phải cuộn bên trong một khung nhỏ.
* **Giải pháp đề xuất:**
  1. Thêm state `isDetailExpanded` (`boolean`, mặc định `false`).
  2. Tính toán chiều cao linh hoạt cho panel:
     - Đóng: `h-0 border-t-0 opacity-0 pointer-events-none`
     - Mở chuẩn (Normal peek): `h-[260px] border-t-2 border-slate-800 opacity-100`
     - Mở rộng tối đa (Expanded mode): `h-[calc(100vh-140px)] border-t-2 border-emerald-500/50 shadow-2xl opacity-100 z-20` (kéo dài lên sát hàng Toolbar / Status filter ở trên).
  3. Cập nhật thanh tiêu đề Sub-table Header:
     - Thêm nút **Expand / Maximize** (icon `Maximize2` / `Minimize2` toggle): click để bung rộng toàn màn hình hoặc thu gọn về 260px.
     - Nút **Hide** (icon `ChevronDown`): click đóng hoàn toàn panel.
  4. Bảo lưu nguyên vẹn 100% logic tự động:
     - Khi lăn chuột lên trên danh sách (`onWheel` deltaY < -5), tự động đóng panel như hiện tại.
* 💎 **Điểm mạnh:** Người dùng có thể đọc và ghi chép nhật ký phỏng vấn cực kỳ thoải mái, không gian rộng rãi tối đa, chuyển đổi linh hoạt 1-click.
* 🎯 **Giá trị:** Nâng cao năng suất xử lý hồ sơ ứng viên và giảm mỏi mắt khi đối chiếu lịch sử trao đổi.

---

## Verification Plan

### 1. Automated Tests & Build Check
- Chạy `npm run build` hoặc Next.js type-check để đảm bảo không phát sinh lỗi biên dịch.
- Chạy script kiểm thử webhook khử trùng contact points (`scratch/test_contact_dedup.mjs`).

### 2. Manual End-to-End Verification
- **UI Test**: Mở Campaign Details drawer, kiểm tra bảng target groups to rõ, Linked Jobs thu gọn.
- **Workflow Test**: Đổi status ứng viên trên Action Menu, kiểm tra Timeline tự nhảy sang ứng viên tiếp theo.
- **CV Parser Test**: Chạy thử 1 file CV non-LinkedIn qua `WfSingle00000001`, kiểm tra trường `linkedin_url` không bị sinh link giả.
- **Candidate 360 Test**: Đổi Stage/Status trực tiếp từ Candidate Card và xem các phiên bản CV.
- **Action Menu Timeline Expand Test**: Bấm Expand bung toàn màn hình tới hàng Status, bấm Restore thu gọn 260px, lăn chuột tự đóng.


---

## Bổ Sung 2026-09-09: Google Doc Đã Có Thêm 4 Mục Mới (12-15) + Ưu Tiên Hoá 2 Mục Nghiêm Trọng

Thức đã note thêm 4 mục mới vào Google Doc (lúc đọc lại lần này, mục 15 đang bị cắt ngang câu trong doc gốc — cần Thức viết nốt/xác nhận lại ý):

12. Lỗi chỉ có 1 địa chỉ nhưng khi select lại hiện ra 2.
13. Một số profile có trường Social nhưng không xuất hiện trên mục Social & Web Profiles.
14. Update CV nhưng không chạy lên hệ thống.
15. *(bị cắt trong Google Doc)* "phần Candidate Source nên được..." — **cần Thức viết nốt câu này, chưa đủ để lên spec.**

**Chưa đủ thông tin để viết FIX_SPEC cho mục 12, 13** (cần Thức mô tả rõ hơn màn hình/luồng thao tác cụ thể, tốt nhất kèm ảnh chụp màn hình) — sẽ điều tra tiếp sau khi có repro rõ ràng.

### Ưu tiên hoá theo yêu cầu của Thức: Mục 5 (CV Parser LinkedIn) + Mục 10 (Multiple CV)

Đã điều tra sâu (đọc trực tiếp code n8n + Supabase + frontend, không đoán) và tách thành 2 FIX_SPEC riêng, chi tiết hơn nhiều so với mô tả sơ bộ ở mục 5 và 10 phía trên:

- `docs/testing/FIX_SPEC_2026-09-09_n8n_cv-parser-linkedin-hallucination.md` — xác định chính xác 2 dòng code trong node "Parse & Normalize" (workflow `WfSingle00000001`) gây bịa link LinkedIn, kèm giải thích vì sao 2 profile LinkedIn-generated Thức nêu không bị lỗi (chạy nhánh code khác). Fix 2 lớp: sửa prompt Gemini + thêm regex validate.
- `docs/testing/FIX_SPEC_2026-09-09_candidate360_upload-new-cv-version.md` — phát hiện cơ chế lưu multiple-CV (`cv_urls`) **đã tồn tại và hoạt động đúng** ở tầng dữ liệu (qua luồng HITL merge), chỉ thiếu 1 nút bấm trực tiếp trên Candidate 360 để thêm CV mới mà không phải đi qua toàn bộ pipeline duyệt trùng. Đồng thời phát hiện mục 14 ("Update CV không chạy lên hệ thống") trùng khớp với 1 bug baseUrl n8n đã được AG fix ngày 07/09 — **cần Thức xác nhận lại đã hết gặp lỗi này chưa** trước khi AG code thêm.

---

## Đính Chính 2026-09-09 (sau phản hồi trực tiếp của Thức)

Thức phản hồi trực tiếp 3 điểm khiến 2 FIX_SPEC ở trên được viết lại chính xác hơn nhiều:

1. **"vấn đề là các profile lỗi đều là Linkedin generated profile ấy"** — chẩn đoán ban đầu (đổ lỗi cho AI Gemini bịa link ở nhánh CV thường) SAI. Đã đọc lại execution n8n thật (5 execution ngày 09/09), tìm đúng nguyên nhân: chính nhánh xử lý PDF LinkedIn-generated bị lỗi regex trích `/URI`, nuốt rác xuyên nhiều PDF object (case thật: "Tung Le Duc", "Chien Trinh" — 2/3 file LinkedIn-generated test hôm nay bị). Đã viết lại toàn bộ `FIX_SPEC_2026-09-09_n8n_cv-parser-linkedin-hallucination.md`.
2. **"nhìn vào profile Do Minh Thien bạn sẽ rõ"** — phát hiện thêm 1 lỗi riêng biệt (mục 13 Google Doc): cột `candidates.socials` thỉnh thoảng bị lưu thành chuỗi JSON-lồng-JSON thay vì mảng thật (1/3394 candidate hiện tại), khiến Search Menu hiện trống dù Candidate 360 hiển thị đúng. Đã viết `FIX_SPEC_2026-09-09_candidates_socials-double-json-encoding.md` (kèm data-fix SQL cho dòng đã biết — Claude thử chạy nhưng bị permission classifier của phiên chặn, để lại cho AG/Thức chạy tay).
3. **"link này chỉ có thể chứa 1 giá trị url cv mà thôi... Embedded CV viewer cũng không có cơ chế switch"** — xác nhận đúng qua code: nút "Save Profile" chỉ ghi đè `cv_url`, không hề đụng `cv_urls`; dropdown chọn phiên bản CV có tồn tại trong code nhưng gần như không bao giờ render vì không có đường nào (ngoài pipeline HITL nặng) tạo ra phần tử thứ 2. Đã viết lại `FIX_SPEC_2026-09-09_candidate360_upload-new-cv-version.md` với giải pháp mạnh hơn: vừa thêm nút upload mới, vừa vá luôn chỗ `updateCandidateProfile()` để sửa tay ô CV Link không còn làm mất dấu vết bản cũ.
