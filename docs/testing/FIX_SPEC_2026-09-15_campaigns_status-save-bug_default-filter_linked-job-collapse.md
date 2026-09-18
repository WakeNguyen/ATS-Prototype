**Từ:** Claude (Architect/QA)

# FIX_SPEC_2026-09-15 — 3 hạng mục độc lập trên `/campaigns` (Status không lưu được, Default Filter, Linked Job column)

Đây là 3 hạng mục ĐỘC LẬP, phát hiện qua phản hồi trực tiếp của PO kèm screenshot + đã root-cause bằng đọc code thật (không suy đoán). Làm đúng phạm vi từng hạng mục, không mở rộng sang file/tính năng khác.

---

## Hạng mục 1 (BUG — ưu tiên cao nhất): Đổi Campaign Status trong Edit Modal rồi Save không có tác dụng

**Nguyên nhân (đã xác nhận 100% qua đọc code):** `src/app/components/CampaignEditModal.js` (dòng 339) gửi `status` trong payload lên server action `updateCampaign`. Nhưng `src/app/campaign_actions.js`, hàm `updateCampaign` (dòng 439-463, khối destructure `const { campaign_name, campaign_type, ... } = data;`) **KHÔNG hề khai báo `status`** — trường này bị bỏ qua hoàn toàn, không xuất hiện trong khối `UPDATE campaigns SET ...` (dòng 493-519). Kết quả: dù UI cho chọn 7 giá trị Status (`Draft/Ready/Running/Paused/Completed/Failed/Archived`, xem `CAMPAIGN_STATUS_OPTIONS` dòng 32-40 cùng file modal), giá trị này **không bao giờ được ghi xuống DB** — cột `status` giữ nguyên giá trị cũ, gây hiện tượng "bấm Save xong vẫn về trạng thái cũ" PO gặp phải. (Lưu ý: cột `is_active` VẪN được ghi đúng vì có destructure riêng — chỉ `status` bị bỏ sót.)

**Việc cần làm — `src/app/campaign_actions.js`, hàm `updateCampaign`:**

1. Thêm `status` vào khối destructure (dòng ~441-463), cạnh `is_active`.
2. Thêm validate whitelist (theo đúng tinh thần GEMINI.md Phần B mục 2.1 — validate input trước khi chạm DB), đặt ngay sau khối validate `campaign_type` hiện có (dòng ~466-484):
   ```js
   if (status !== undefined) {
     const validStatuses = ['Draft', 'Ready', 'Running', 'Paused', 'Completed', 'Failed', 'Archived'];
     if (!validStatuses.includes(status)) {
       return { success: false, error: `Invalid status: "${status}". Must be one of: ${validStatuses.join(', ')}.` };
     }
   }
   ```
   (Danh sách `validStatuses` PHẢI khớp chính xác với `CAMPAIGN_STATUS_OPTIONS` trong `CampaignEditModal.js` — nếu 2 nơi lệch nhau sau này sẽ tự phát sinh bug tương tự, nên copy nguyên văn.)
3. Thêm dòng update vào khối `UPDATE campaigns SET ...` (dòng ~493-519), theo đúng pattern `CASE WHEN ... THEN ... ELSE ... END` đã dùng cho `campaign_type`/`target_criteria` (không dùng `COALESCE` vì `status` là string thường, cần phân biệt "không gửi" với "gửi giá trị falsy" — dù thực tế status luôn có giá trị từ dropdown, dùng CASE WHEN cho nhất quán và an toàn):
   ```sql
   status = CASE WHEN ${status !== undefined} THEN ${status || null} ELSE status END,
   ```
   Đặt ngay cạnh dòng `is_active = COALESCE(...)` hiện có.

**Việc KHÔNG được làm:** Không đổi logic tự động set status ở nơi khác (ví dụ khi trigger run campaign có thể tự set `status='Running'` — không đụng vào các chỗ đó, chỉ sửa đúng lỗ hổng ở `updateCampaign`).

**Verify bắt buộc:** Trong `sandbox`, tạo 1 campaign test, mở Edit Modal đổi Status từ `Draft` sang `Paused` → Save → mở lại Edit Modal → xác nhận Status hiển thị đúng `Paused` (không về `Draft`) → query trực tiếp DB xác nhận cột `status = 'Paused'`. Thử thêm 1 lần đổi sang giá trị không hợp lệ (nếu có cách test qua code, ví dụ gọi trực tiếp `updateCampaign` qua route test với `status: "Bogus"`) xác nhận trả về lỗi rõ ràng, KHÔNG ghi đè DB. Dọn campaign test sau khi xong.

---

## Hạng mục 2 (Feature — quy hoạch trước cho tương lai nhiều campaign): Mặc định ẩn Campaign đã `Completed` khỏi danh sách

**Bối cảnh:** PO đề xuất — số lượng campaign còn ít nhưng nên quy hoạch trước để giảm tải khi tăng trưởng. Đã xác nhận: bộ lọc Status ở `/campaigns` **ĐÃ server-side 100%** (`src/app/campaigns/page.js` dòng 327: `if (campaignStatusFilter !== "ALL") filters.status = campaignStatusFilter;` → truyền vào `getCampaigns(filters)` → `campaign_actions.js` dòng 120-122 build `WHERE c.status = ...` thật sự trên DB, KHÔNG fetch hết rồi lọc ở client) — nên đây KHÔNG phải tình huống cần xin phép theo GEMINI.md Phần C mục 3 (đổi Client-side ↔ Server-side filtering), chỉ là thêm 1 giá trị mặc định mới cho bộ lọc đã có sẵn.

**Việc cần làm:**

1. `src/app/campaign_actions.js`, hàm `getCampaigns` (dòng ~120-122), sửa khối xử lý `status`:
   ```js
   if (status && status !== 'ALL') {
     if (status === 'HIDE_COMPLETED') {
       query = sql`${query} AND c.status <> 'Completed'`;
     } else {
       query = sql`${query} AND c.status = ${status}`;
     }
   }
   ```
2. `src/app/campaigns/page.js`:
   - Dòng 230: đổi giá trị khởi tạo state từ `useState("ALL")` thành `useState("HIDE_COMPLETED")` — đây là default mới khi user vào trang lần đầu.
   - Dòng ~1128 (dropdown Status filter), thêm 1 option MỚI ngay phía trên `<option value="ALL">All Statuses</option>`:
     ```jsx
     <option value="HIDE_COMPLETED">Active (Hide Completed)</option>
     ```
     Giữ nguyên toàn bộ các `<option>` còn lại (`ALL`, `Draft`, `Ready`, `Running`, `Paused`, `Completed`, `Needs Review`) — không xoá gì, `HIDE_COMPLETED` chỉ là lựa chọn bổ sung.

**Việc KHÔNG được làm:** Không thêm phân trang (`LIMIT`/`OFFSET`) trong hạng mục này — đó là 1 quyết định kiến trúc lớn hơn, PO chưa yêu cầu, để dành cho 1 spec riêng nếu số lượng campaign thực sự tăng nhiều sau này.

**Verify bắt buộc:** Trong `sandbox`, đảm bảo có ít nhất 1 campaign test với `status='Completed'` (dùng lại campaign test hoặc tạo mới rồi dọn sau) → mở `/campaigns` (load lần đầu, chưa đụng filter) → xác nhận campaign đó KHÔNG hiện trong danh sách → đổi dropdown sang "All Statuses" → xác nhận campaign đó XUẤT HIỆN lại → đổi sang "Completed" → xác nhận CHỈ campaign đó (và các campaign Completed khác nếu có) hiện ra.

---

## Hạng mục 3 (UI — On-Demand Clean UX theo GEMINI.md Phần A mục 5): Cột "Linked Job" đẩy cao hàng khi Campaign gắn nhiều Job

**Bối cảnh:** PO phản hồi qua screenshot — khi 1 campaign Job Posting gắn ≥3 job, cột "Linked Job" (`src/app/campaigns/page.js` dòng 1247-1264) hiện toàn bộ badge trong `<div className="flex flex-wrap gap-1 max-w-xs max-h-16 overflow-y-auto">`, gây hàng đó cao bất thường (wrap 2 dòng) hoặc phải cuộn nội bộ (khi ≥5-6 job, xuất hiện thanh cuộn dọc ngay trong ô bảng — trải nghiệm xấu, không nhất quán chiều cao hàng). PO muốn: mặc định chỉ hiện 1 số lượng nhỏ, có nút "See more" để bung ra khi cần, đúng tinh thần **On-Demand / Progressive Disclosure** đã quy định ở GEMINI.md Phần A mục 5.

**Việc cần làm — `src/app/campaigns/page.js`:**

1. Thêm 1 state mới quản lý danh sách campaign đang bung Linked Job đầy đủ (đặt cạnh `campaignStatusFilter` dòng 230):
   ```js
   const [expandedJobsRowIds, setExpandedJobsRowIds] = useState(new Set());
   ```
2. Thêm hằng số giới hạn hiển thị mặc định (đặt gần đầu component hoặc cạnh state trên):
   ```js
   const LINKED_JOB_BADGES_VISIBLE_LIMIT = 2;
   ```
3. Thêm 1 hàm toggle nhỏ:
   ```js
   const toggleJobsRowExpanded = (campaignId) => {
     setExpandedJobsRowIds((prev) => {
       const next = new Set(prev);
       if (next.has(campaignId)) next.delete(campaignId);
       else next.add(campaignId);
       return next;
     });
   };
   ```
4. Sửa khối render Linked Job (dòng 1247-1264), đổi từ hiện toàn bộ `c.job_ids.map(...)` thành hiện giới hạn + nút toggle:
   ```jsx
   <td className="py-3 px-3 text-slate-300">
     {c.job_ids && c.job_ids.length > 0 ? (
       <div className={`flex flex-wrap gap-1 max-w-xs ${expandedJobsRowIds.has(c.id) ? "max-h-32 overflow-y-auto" : ""}`}>
         {(expandedJobsRowIds.has(c.id) ? c.job_ids : c.job_ids.slice(0, LINKED_JOB_BADGES_VISIBLE_LIMIT)).map((jid, idx) => {
           const title = (c.job_titles && c.job_titles[idx]) || "Linked Job";
           return (
             <Link
               key={jid}
               href={`/jobs?job_id=${jid}`}
               onClick={(e) => e.stopPropagation()}
               className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 text-emerald-400 hover:text-emerald-300 hover:border-emerald-500/40 text-[11px] transition-colors"
             >
               <span className="truncate max-w-[130px]">{title}</span>
               <ExternalLink size={9} className="shrink-0" />
             </Link>
           );
         })}
         {c.job_ids.length > LINKED_JOB_BADGES_VISIBLE_LIMIT && (
           <button
             type="button"
             onClick={(e) => {
               e.stopPropagation();
               toggleJobsRowExpanded(c.id);
             }}
             className="text-[10px] font-semibold text-slate-400 hover:text-emerald-400 underline decoration-dotted decoration-slate-600 cursor-pointer"
           >
             {expandedJobsRowIds.has(c.id) ? "See less" : `+${c.job_ids.length - LINKED_JOB_BADGES_VISIBLE_LIMIT} more`}
           </button>
         )}
       </div>
     ) : c.job_id ? (
       /* giữ nguyên nhánh single job_id hiện có */
     ) : (
       /* giữ nguyên nhánh "—" hiện có */
     )}
   </td>
   ```
   (Giá trị `LINKED_JOB_BADGES_VISIBLE_LIMIT = 2` và `max-h-32` khi bung ra là gợi ý — AG được quyền tinh chỉnh nếu test thật trên dữ liệu có nhiều job (ví dụ campaign "WINPRO - 3 JOBS" hoặc campaign nào có nhiều job nhất trong `sandbox`) cho thấy cần điều chỉnh, miễn giữ đúng tinh thần: mặc định gọn, có "See more"/"See less" để bung/thu, không tự lan ra ngoài `<td>`.)

**Việc KHÔNG được làm:** Không đổi nhánh render khi campaign chỉ có `job_id` đơn (không có mảng `job_ids`) hay nhánh không có job nào — giữ nguyên 100%. Không đổi cách các cột khác trong bảng Master Campaigns render.

**Verify bắt buộc:** Mở `/campaigns` trong `sandbox`, tìm 1 campaign có ≥3 job liên kết (ví dụ campaign nhiều job nhất hiện có) → xác nhận mặc định chỉ hiện 2 badge + nút `+N more`, chiều cao hàng đồng đều với các hàng campaign 0-2 job → bấm `+N more` → toàn bộ job hiện ra (cuộn nội bộ nếu quá nhiều, không đẩy layout trang) → bấm `See less` → thu gọn lại đúng 2 badge ban đầu. Xác nhận click vào 1 badge job vẫn điều hướng đúng sang `/jobs?job_id=...` (không bị chặn bởi `stopPropagation` mới thêm ở nút toggle), và click vào nút `+N more`/`See less` KHÔNG làm mở/đóng Campaign Details panel của hàng đó (do đã có `e.stopPropagation()`).

---

## Phạm vi tổng (2 file code — không sửa gì khác)

1. `src/app/campaign_actions.js` (Hạng mục 1 + 2)
2. `src/app/campaigns/page.js` (Hạng mục 2 phần dropdown/state + Hạng mục 3)

## Yêu cầu tài liệu (GEMINI.md mục 10.2 — cùng lượt, không để sau)

1. Thêm 1 mục mới vào `docs/DEVELOPMENT_LOG.md` theo đúng template mục 10.3, liệt kê rõ cả 3 hạng mục trong cùng 1 mục log (vì cùng 1 batch, cùng 1 lượt commit) hoặc 3 mục riêng nếu commit riêng — tự quyết định, miễn đầy đủ thông tin từng hạng mục.
2. Nếu có file `docs/features/*.md` mô tả Campaigns Hub — hiện tại KHÔNG có file này (đã kiểm tra `docs/features/`, chỉ có `action-menu.md`, `candidates-hub.md`, `jobs-clients-workbench.md`, `search-menu.md`) — KHÔNG cần tạo mới (tránh tài liệu mồ côi ngoài danh sách đã định ở GEMINI.md mục 8), chỉ cập nhật `docs/USER_MANUAL_DRAFT.md` mục **7.1** (phần liên quan tới danh sách/lọc Campaign) nếu thấy cần mô tả hành vi filter mới và nút See more/See less, kèm `_Cập nhật bởi: Antigravity (Implementer) — 2026-09-15_`.

## Verify bắt buộc trước khi báo hoàn thành (toàn batch)

1. `node --check src/app/campaign_actions.js src/app/campaigns/page.js` → PASS.
2. `git diff --stat` → chỉ 2 file code trên (+ docs bắt buộc) bị đổi.
3. Verify riêng từng hạng mục như mô tả ở mỗi mục trên.
4. Chạy lại `/api/biz-test` và `/api/qa-test` hiện có → PASS 100%, không regression.
5. `npm run build` → PASS 100% routes.

Báo cáo hoàn thành gửi Claude phải kèm output nguyên văn `git status`, `git diff --stat`, `npm run build`, kết quả verify từng hạng mục (không ghi "PASS" suông — nêu số liệu/hiện tượng cụ thể quan sát được).

## Quy ước xử lý khi phát hiện lệch spec hoặc không rõ ràng

- Lệch nhỏ (UI/trình bày, không đổi hành vi nghiệp vụ) → tự sửa, ghi chú, KHÔNG dừng.
- Đụng database/API/quyết định sản phẩm ngoài phạm vi đã mô tả ở trên → DỪNG NGAY, in `ESCALATE: <mô tả>`.
- Chỉ cần hỏi 1 chi tiết kỹ thuật nhỏ (ví dụ tên biến, cách gọi hàm) → in `QUESTION: <câu hỏi>` rồi dừng.
- Sau khi xong CẢ 3 hạng mục và verify PASS, ghi báo cáo tóm tắt cuối cùng liệt kê rõ: file đã sửa theo từng hạng mục, kết quả verify từng hạng mục, có sai lệch so với spec này ở đâu không (theo đúng format mục 10.7 GEMINI.md nếu có).
