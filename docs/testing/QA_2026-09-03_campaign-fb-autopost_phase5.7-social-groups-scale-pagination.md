# QA Report (PHẦN 5.7) — Social Groups: Server-side Pagination + Search — 2026-09-03

**Người review:** Claude (Architect/QA) — độc lập với AG (Implementer)
**Đối tượng review:** Commit `0f42725` (implementation) + `c95e787` (devlog hash fixup)
**Phương pháp:** Diff review từng dòng đối chiếu FIX_SPEC gốc + xác minh trực tiếp trên Supabase (sandbox schema, dữ liệu thật) bằng SQL độc lập, không phụ thuộc script test của AG. Không dùng được Browser pane trực tiếp lần này (xem mục "Giới hạn kỹ thuật" bên dưới) nên phần verify hành vi UI dựa trên: (a) đối chiếu diff `campaigns/page.js` từng đoạn, (b) tái tạo chính xác logic SQL của các server action bằng query thủ công trên dữ liệu Supabase thật.

**Kết luận: ✅ PASS** — bug gốc đã được khắc phục triệt để và xác minh độc lập thành công. Phát sinh 1 finding mới (không phải regression, không phải lỗi của AG) cần theo dõi — xem PHẦN 3.

---

## PHẦN 1 — Đối chiếu code với FIX_SPEC

### 1.1 Backend (`src/app/campaign_actions.js`)

| Hàm | Kết quả đối chiếu |
|---|---|
| `getSocialGroupsLibrary()` | Khớp **100%** với spec — WHERE/GROUP BY/LIMIT/OFFSET, 2 câu COUNT tách biệt (`matching_count` không JOIN, `inactive_total` toàn bảng) đúng nguyên văn. |
| `getSocialGroupIdsMatchingFilter()` | Khớp **100%** với spec — SELECT id only, cùng WHERE clause với `getSocialGroups`, không LIMIT. |
| `getSocialGroups()` | Khớp spec, có **1 sai khác nhỏ mang tính tích cực**: spec đề `pageSize = 50` cố định, AG viết `pageSize = (filters.limit || 50)` — tức vẫn nhận `{limit: N}` cũ nếu lỡ sót nơi gọi nào chưa đổi sang `pageSize`. Đây là lớp phòng thủ hợp lý, không phải lỗi, không vi phạm ý đồ spec (breaking change vẫn được xử lý đúng ở toàn bộ 3 nơi gọi đã biết — xem 1.3). |

Grep toàn repo xác nhận **không còn nơi nào gọi `getSocialGroups({ limit: ... })`** kiểu cũ — cả 3 nơi gọi (`campaigns/page.js`, `CampaignEditModal.js`, `FbAccountEditModal.js`) đều đã đổi sang `pageSize`.

### 1.2 Frontend (`src/app/campaigns/page.js`, diff 571 dòng)

Đã đọc toàn bộ diff (chia 3 đoạn). Đối chiếu từng điểm trong PHẦN B của spec:

- ✅ State phân trang + debounce mới (`groupPage`, `groupPageSize=30`, `groupTotalCount`, `libraryPage`, `libraryPageSize=50`, `libraryTotalCount`, `libraryInactiveTotalCount`, `groupDebounceRef`, `libraryDebounceRef`) — đúng khuôn `search/page.js`.
- ✅ **`filteredSocialGroups` và `filteredLibraryGroups` (2 lớp lọc client-side cũ) đã bị xoá hoàn toàn** — grep xác nhận **0 kết quả** còn sót lại trong file. Không có tình trạng lọc chồng 2 lớp (server + client) như lo ngại ban đầu ở spec PHẦN C.5.
- ✅ `handleSelectAllFiltered` / `handleDeselectAllFiltered` viết lại đúng — gọi `getSocialGroupIdsMatchingFilter`, union/subtract toàn bộ ID trả về (không còn giới hạn ở 1 trang).
- ✅ Nhãn nút sửa đúng: `Select All ({groupTotalCount})`, `Show Inactive ({libraryInactiveTotalCount})` — cả 2 đều lấy từ số server trả, không phụ thuộc dữ liệu đã tải ở client.
- ✅ Khối phân trang (First/Prev/Page X of Y/Next/Last, "Showing X of Y groups") đã thêm cho cả 2 nơi: Library tab và Target Groups picker.
- ✅ Chỉ số thứ tự dòng ở Library đã tính đúng theo trang: `(libraryPage - 1) * libraryPageSize + idx + 1`.
- ✅ `JoinStatusBadge`'s `onAnswerUpdated` gọi lại `fetchTargetGroups(groupPage, ...)` thay vì reload toàn bộ `loadCampaignDetailData` — tối ưu hợp lý, không có trong spec nhưng không vi phạm gì.

### 1.3 2 nơi gọi phụ (`CampaignEditModal.js`, `FbAccountEditModal.js`)

Cả 2 chỉ đổi `limit` → `pageSize` (400 và 300) — đúng như spec yêu cầu ở mục "Breaking change có chủ đích" (chỉ cần không vỡ code, không bắt buộc thêm search/pagination ở 2 modal này vì ngoài phạm vi spec). Xem PHẦN 3 bên dưới về hệ quả thực tế của việc này.

---

## PHẦN 2 — Xác minh độc lập trên dữ liệu thật (Supabase, schema `sandbox`)

Không dựa vào kết quả tự test của AG (`scratch/test_phase5_7.mjs`, đã dọn dẹp — xác nhận sandbox về đúng baseline 141 dòng, không còn rác test). Claude tự tái tạo lại đúng logic SQL của app và chạy trực tiếp:

1. **Insert 1 dòng test tạm** `"Zzz QA Independent Verify 5.7"` với tag riêng `__qa_verify_tag_577__`, độc lập hoàn toàn với dữ liệu/test của AG.
2. **Test search:** chạy query `WHERE is_active=true AND (name ILIKE '%Zzz QA Independent Verify%' ...)` → trả về đúng 1 dòng, đúng bằng dòng vừa tạo. → Xác nhận cơ chế search server-side hoạt động, không phụ thuộc vị trí alphabet (bản chất bug gốc là `LIMIT 500` không có search cắt trước khi lọc — cấu trúc này đã biến mất khỏi query).
3. **Test "Select All (Filtered)" tương đương:** chạy query của `getSocialGroupIdsMatchingFilter` (cùng WHERE, không LIMIT) với filter tag `__qa_verify_tag_577__` → trả về `ids=[<id dòng test>]`, `n=1`. Đối chiếu chéo với 1 câu `COUNT(*)` độc lập hoàn toàn khác cú pháp (`WHERE tag = ANY(group_type)`) → cũng ra `1`. **3 con số khớp nhau (1=1=1)** → xác nhận cơ chế Select-All-Filtered sẽ chọn đúng toàn bộ tập khớp filter, không chỉ trang hiện tại.
4. **Dọn dẹp:** xoá dòng test, xác nhận `sandbox.social_group_urls` quay về đúng 141 dòng (baseline trước khi QA, không còn rác của bất kỳ ai).
5. **DEVELOPMENT_LOG.md:** xác nhận qua `git show 0f42725 -- docs/DEVELOPMENT_LOG.md` — cả 2 phần đều được cập nhật đúng (bảng tổng hợp Snapshot `SNAP-20260903-67` ở đầu file + mục chi tiết "[2026-09-03 23:30] Triển Khai Hoàn Tất PHẦN 5.7" ở dưới), commit hash được fix đúng qua `c95e787`. Tuân thủ đúng quy tắc đã ghi nhớ (`devlog-summary-table-rule.md`).

### Giới hạn kỹ thuật lần QA này

Không giữ được `npm run dev` chạy nền qua `device_bash` để tự lái Browser pane trực tiếp (mỗi lệnh `device_bash` là 1 shell mới, tiến trình `nohup`/`disown` không sống sót qua lần gọi kế tiếp — đã thử và xác nhận tiến trình bị kill ngay khi phiên shell đó kết thúc). Bù lại bằng cách xác minh trực tiếp trên dữ liệu Supabase thật với chính logic SQL của app (PHẦN 2 ở trên) — về bản chất là hình thức xác minh mạnh hơn việc chỉ xem screenshot, vì Claude tự chạy lại đúng câu lệnh app sẽ chạy trên dữ liệu thật, không phải quan sát báo cáo của AG.

---

## PHẦN 3 — ⚠️ Finding mới (không phải regression, không phải lỗi AG)

Khi grep toàn repo các nơi gọi `getSocialGroups(`, phát hiện **2 picker khác** ngoài phạm vi spec PHẦN 5.7 mà Claude đã bỏ sót khi điều tra ban đầu:

- `src/app/components/CampaignEditModal.js:85` → `getSocialGroups({ pageSize: 400 })`
- `src/app/components/FbAccountEditModal.js:76` → `getSocialGroups({ pageSize: 300 })`

Cả 2 nơi này có ô chọn nhóm riêng (`groupSearch` state cục bộ, lọc client-side trên tập đã tải), **không có search server-side, không phân trang** — chỉ đổi tên tham số `limit` → `pageSize` để không vỡ chữ ký hàm mới, đúng như spec đã yêu cầu ("breaking change" — không yêu cầu gì thêm ở 2 nơi này). AG làm đúng phạm vi được giao.

**Vấn đề thực tế:** schema `public` (dữ liệu thật) hiện đã có **455 group active** (đã kiểm tra trực tiếp). Cả 2 cap 400 và 300 đều **đã thấp hơn 455** — nghĩa là ngay bây giờ, 2 picker này (trong modal Sửa Campaign và modal Sửa FB Account) đã có thể bỏ sót một số group xếp cuối alphabet, y hệt bản chất bug gốc ở PHẦN 5.7 (chỉ khác con số cap). Đây là lỗi điều tra sót của Claude khi viết spec ban đầu (chỉ khảo sát `campaigns/page.js`), không phải sai sót của AG.

**Đề xuất:** mở PHẦN 5.9 riêng, áp dụng lại đúng pattern search+pagination (hoặc tối thiểu search server-side không cần UI phân trang đầy đủ, vì đây là 2 hộp multi-select nhỏ chứ không phải bảng lớn) cho 2 modal này. Không chặn việc chấp nhận PHẦN 5.7.

---

## PHẦN 4 — Ghi chú thêm

- Phát hiện AG đã bắt đầu code PHẦN 5.8 (Tag Management) ở working tree, **chưa commit**: `git status` cho thấy `campaign_actions.js` (+118 dòng, đã thấy `isValidTagName`, `renameTagInRegistry`, `bulkRemoveTagFromGroups` — đúng tên hàm trong spec 5.8), `campaigns/page.js` (+24 dòng), `GroupTypeTagEditor.js` (+200 dòng) đang là "modified" chưa staged. Đây là diff cộng dồn thêm, không đụng vào phần code PHẦN 5.7 đã commit — không ảnh hưởng đến kết luận QA lần này. Sẽ QA riêng khi AG commit và báo cáo hoàn tất 5.8.

## Kết luận cuối cùng

| Hạng mục | Kết quả |
|---|---|
| Bug gốc (`LIMIT 500` không search) | ✅ Đã khắc phục, xác minh độc lập trên dữ liệu thật |
| Select All (Filtered) xuyên trang | ✅ Đúng, xác minh 3 chiều khớp nhau |
| Show Inactive (N) độc lập filter | ✅ Đúng theo code (query tách biệt hoàn toàn khỏi filter) |
| Không còn lọc chồng 2 lớp | ✅ Xác nhận 0 kết quả grep |
| DEVELOPMENT_LOG.md (2 phần) | ✅ Đầy đủ |
| **Verdict PHẦN 5.7** | **✅ PASS** |
| Finding mới (CampaignEditModal/FbAccountEditModal) | ⚠️ Cần PHẦN 5.9 (không chặn PASS) |
