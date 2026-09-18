**Từ:** Claude (Architect/QA)

# FIX_SPEC_2026-09-15 — Nút "Expand" cho Campaign Details Panel (`/campaigns`)

## Bối cảnh

Thức (PO) phản hồi trực tiếp qua screenshot (`crm-ats-web-hazel.vercel.app/campaigns`): panel **"Campaign Details"** (Overview & Groups / Run History) ở dưới bảng Master Campaigns đang quá nhỏ — ví dụ sub-tab "Run History" chỉ hiển thị ~2-3 dòng trước khi phải cuộn, dù campaign có 7 lượt chạy trở lên. Yêu cầu: thêm nút **Expand**, bấm vào kéo panel lên chiếm khoảng **60% chiều cao viewport (responsive)** — đúng theo pattern nút Expand đã có sẵn ở **Action Menu Dashboard** (`src/app/page.js`, khu vực "Interview & Activity Timeline"), không tự chế kiểu mới (GEMINI.md Phần B mục 1.4).

## Hiện trạng (đã verify bằng đọc code trực tiếp, chưa chạy dev server)

- `src/app/campaigns/page.js` dòng 1354-1403: khi `selectedCampaignId` có giá trị, panel "Campaign Details" render với container:
  ```js
  <div className="flex-1 flex flex-col border border-slate-800 rounded-xl bg-slate-900/70 overflow-hidden shadow-lg min-h-[360px]">
  ```
  Panel dùng `flex-1` để lấp đầy phần không gian còn lại trong cột cha (`flex-1 flex flex-col min-h-0 space-y-4`, dòng 1105) — **không có state Expand/Collapse nào**, chiều cao hoàn toàn thụ động theo layout.
- Bảng Master Campaigns phía trên (dòng 1159-1163) tự động co lại `shrink-0 max-h-64` (256px) ngay khi có `selectedCampaignId`, nhường chỗ cho panel — cơ chế này **giữ nguyên, không đụng**.
- Phần thân panel (`Detail Body`, dòng 1406: `flex-1 overflow-y-auto p-5 text-xs`) **không có giới hạn `max-h` cứng bên trong** (khác với case Action Menu, nơi `ActivityLogPanel.js` có `max-h-[220px]` là nút thắt cổ chai riêng phải sửa thêm 1 file). Ở đây, chỉ cần tăng chiều cao container ngoài là đủ để cả Overview & Groups lẫn Run History hiển thị nhiều nội dung hơn — **phạm vi chỉ 1 file**.
- Pattern tham chiếu bắt buộc tái sử dụng — `src/app/page.js`:
  - State `isDetailExpanded` (dòng 310).
  - Nút toggle dùng icon `Maximize2`/`Minimize2` từ `lucide-react` (dòng 1064-1076).
  - Container height đổi giữa `"h-[260px] ..."` và `"h-[clamp(380px,60vh,680px)] ..."` (dòng 1045-1051) — giá trị `clamp(380px,60vh,680px)` là bản đã tinh chỉnh 2 vòng theo phản hồi thật của PO (`docs/DEVELOPMENT_LOG.md` mục `[2026-09-13 10:15]`), **dùng lại đúng giá trị này** làm mặc định thay vì đoán giá trị mới.
- `src/app/campaigns/page.js` **chưa import** `Maximize2`, `Minimize2` (khối import `lucide-react` dòng 3-43, kết thúc bằng `Zap`).
- State liên quan panel hiện có: `selectedCampaignId` (dòng 229), `detailSubTab` (dòng 232).
- **Khác biệt layout cần AG lưu ý (rủi ro clipping):** `src/app/page.js` dùng chiều cao **cố định theo px/vh** (không phải `flex-1`) cho drawer nên không phụ thuộc flex-sharing với bảng trên; ở `campaigns/page.js`, panel hiện là `flex-1` (chia sẻ không gian còn lại), còn bảng Master Table đã bị cap cứng `max-h-64` khi có `selectedCampaignId`. Khi đổi panel sang chiều cao cố định `h-[clamp(...)]` (không dùng `flex-1` nữa), tổng chiều cao (header + filter row + bảng 256px + panel tới 680px) **có thể vượt quá `h-[calc(100vh-3.5rem)]`** của container gốc (dòng 995, có `overflow-hidden`) trên màn hình thấp (ví dụ 768px) → panel có thể bị cắt cụt ở đáy. Đây là rủi ro thật, PHẢI kiểm tra bằng mắt trên `npm run dev` ở nhiều chiều cao viewport trước khi báo hoàn thành (xem mục Verify).

## Phạm vi (CHỈ 1 file code — không sửa gì khác)

1. `src/app/campaigns/page.js`

Nếu trong lúc làm phát hiện cần sửa thêm file khác (kể cả để né lỗi clipping), DỪNG LẠI và xin xác nhận trước (GEMINI.md mục 10) — không tự mở rộng phạm vi.

## Chi tiết triển khai

### 1. Import icon (dòng ~42, ngay trước `} from "lucide-react";`)
Thêm `Maximize2, Minimize2` vào cuối danh sách import hiện có (sau `Zap`), giữ nguyên toàn bộ icon khác.

### 2. Thêm state mới (cạnh dòng 232, ngay sau `detailSubTab`)
```js
const [isDetailPanelExpanded, setIsDetailPanelExpanded] = useState(false);
```

### 3. Chiều cao panel động (dòng 1356)
Đổi từ:
```js
<div className="flex-1 flex flex-col border border-slate-800 rounded-xl bg-slate-900/70 overflow-hidden shadow-lg min-h-[360px]">
```
thành (tái sử dụng đúng giá trị clamp đã kiểm chứng ở Action Menu, thêm transition nhất quán với pattern gốc — KHÔNG thêm animation mới theo GEMINI.md Phần B mục 1.4):
```js
<div className={`flex flex-col border border-slate-800 rounded-xl bg-slate-900/70 overflow-hidden shadow-lg transition-all duration-300 ease-in-out ${
  isDetailPanelExpanded
    ? "h-[clamp(420px,60vh,760px)] shrink-0"
    : "flex-1 min-h-[360px]"
}`}>
```
(Giá trị `420px` sàn dưới được nới rộng hơn 1 chút so với `min-h-[360px]` hiện có để tạo khác biệt rõ rệt khi Expand trên màn hình thấp; `60vh`/`760px` lấy nguyên từ Action Menu. AG được quyền tinh chỉnh 3 giá trị này trong khoảng hợp lý nếu test thật cho thấy bị tràn/clipping — miễn giữ đúng tinh thần "khoảng 60% viewport, responsive" PO yêu cầu.)

### 4. Nút Expand/Collapse (thêm vào nhóm nút bên phải header panel, dòng 1391-1401, đặt TRƯỚC nút Close "X" hiện có)
```jsx
<button
  type="button"
  onClick={() => setIsDetailPanelExpanded((prev) => !prev)}
  title={isDetailPanelExpanded ? "Collapse Details" : "Expand Details"}
  className={`px-2 py-0.5 text-[10px] font-bold rounded transition-colors flex items-center gap-1 cursor-pointer shrink-0 ${
    isDetailPanelExpanded
      ? "bg-cyan-950 text-cyan-300 border border-cyan-600"
      : "text-slate-400 hover:text-emerald-400 hover:bg-slate-800 border border-transparent"
  }`}
>
  {isDetailPanelExpanded ? <Minimize2 size={12} /> : <Maximize2 size={12} />}
  <span>{isDetailPanelExpanded ? "Collapse" : "Expand"}</span>
</button>
```
Thứ tự trái→phải trong nhóm nút: Expand/Collapse → Close (X).

### 5. Reset khi đóng panel (nút Close "X", onClick hiện tại dòng ~1393-1397)
Thêm `setIsDetailPanelExpanded(false);` cùng với `setSelectedCampaignId(null)` và `setCampaignDetail(null)` hiện có — đảm bảo mỗi lần mở lại 1 campaign khác (dù cùng hay khác campaign) đều bắt đầu ở trạng thái thu gọn mặc định, tránh trạng thái phóng to "dính" gây khó hiểu (đúng tinh thần B.5 của spec Action Menu gốc).

### 6. (Tuỳ chọn, chỉ áp dụng nếu Verify mục 3 phát hiện clipping) Giảm thêm chiều cao Master Table khi đang Expand
Nếu test thật ở màn hình thấp (768px) cho thấy panel bị cắt đáy, AG được phép đổi điều kiện dòng 1161 từ:
```js
selectedCampaignId ? "shrink-0 max-h-64" : "flex-1 min-h-0"
```
thành:
```js
selectedCampaignId ? (isDetailPanelExpanded ? "shrink-0 max-h-40" : "shrink-0 max-h-64") : "flex-1 min-h-0"
```
để nhường thêm không gian cho panel khi Expand. Đây vẫn nằm trong phạm vi file đã khai báo ở trên, không tính là mở rộng phạm vi — nhưng PHẢI ghi rõ vào mục 10.7 (Deviation Log) nếu áp dụng, vì khác với mô tả gốc ở mục 3.

## Việc KHÔNG được làm

- Không đụng `src/app/page.js`, `src/app/candidates/page.js`, `src/app/jobs/page.js`, hay `src/components/ActivityLogPanel.js` — verify bằng `git diff --stat` phải cho thấy CHỈ `src/app/campaigns/page.js` (+ file docs bắt buộc bên dưới) bị đổi.
- Không đổi logic `detailSubTab`, nội dung Overview & Groups, hay Run History (chỉ đổi chiều cao container bao ngoài).
- Không thêm animation/hiệu ứng mới ngoài `transition-all duration-300 ease-in-out` đã dùng nhất quán trong dự án.
- Không đổi hành vi nút Run/Edit/Warm & Join trong bảng Master Campaigns.

## Yêu cầu tài liệu (GEMINI.md mục 10.2 — cùng lượt, không để sau)

1. Thêm 1 mục mới vào `docs/DEVELOPMENT_LOG.md` theo đúng template mục 10.3, ghi rõ "Viết bởi: Antigravity (Implementer)", commit hash, file đã sửa, verify. Nếu áp dụng mục 6 (tuỳ chọn) ở trên, bắt buộc thêm khối "⚠️ Sai lệch so với spec" theo mục 10.7.1.
2. Cập nhật `docs/USER_MANUAL_DRAFT.md` mục **7.3** ("Khởi Chạy Nuôi Nick & Auto-Join Bên Trong Warming Campaign") — bổ sung 1 gạch đầu dòng mô tả nút Expand/Collapse mới trên Detail Panel, kèm dòng `_Cập nhật bởi: Antigravity (Implementer) — 2026-09-15_` ngay dưới đoạn vừa thêm.

## Verify bắt buộc trước khi báo hoàn thành

1. `node --check src/app/campaigns/page.js` → PASS.
2. `git diff --stat` → chỉ `src/app/campaigns/page.js` (+ 2 file docs ở trên) bị đổi.
3. Test thật trên `npm run dev` tại `/campaigns` (dùng Chrome DevTools MCP để đổi kích thước viewport, theo đúng cách đã làm ở tablet audit `SNAP-20260914-168`):
   - Ở viewport chuẩn desktop (≥1024×768): chọn 1 campaign Warming có ≥5 lượt chạy → mở sub-tab "Run History" → bấm **Expand** → xác nhận panel cao hơn rõ rệt, hiển thị được nhiều dòng Run History hơn hẳn (không chỉ là khoảng trống) → bấm lại (**Collapse**) → panel về đúng kích thước cũ.
   - Ở viewport thấp mô phỏng laptop phổ thông (1366×768) → lặp lại thao tác Expand → xác nhận panel **KHÔNG bị cắt cụt ở đáy** (không bị `overflow-hidden` của container gốc che mất phần dưới) và không tạo thanh cuộn kép chồng chéo. Nếu bị cắt, áp dụng mục 6 (tuỳ chọn) rồi test lại.
   - Bấm nút Close (X) → mở lại 1 campaign khác → xác nhận panel mở ở trạng thái **thu gọn mặc định** (không giữ trạng thái Expand từ lần trước).
   - Test cả sub-tab "Overview & Groups" (không chỉ Run History) để xác nhận Expand cũng hoạt động đúng ở tab này.
4. Test regression nhanh: mở lại Action Menu Dashboard (`/`) → xác nhận nút Expand "Interview & Activity Timeline" vẫn hoạt động y hệt trước khi sửa (không bị ảnh hưởng, vì không đụng file này).
5. `npm run build` → PASS 100% routes, không lỗi Turbopack.

Báo cáo hoàn thành gửi Claude phải kèm output nguyên văn của `git status`, `git diff --stat`, và kết quả `npm run build` (theo GEMINI.md mục 10). Nếu có bất kỳ sai lệch nào so với spec (kể cả áp dụng mục 6 tuỳ chọn), ghi rõ theo mục 10.7 (Mandatory Deviation Log) và nêu rõ ngay dòng đầu báo cáo.
