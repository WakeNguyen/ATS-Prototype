**Từ:** Claude (Architect/QA)

# FIX_SPEC_2026-09-13 — Nút "Expand Activity Timeline" cho Action Menu Dashboard (mục 11 còn treo từ PLAN 11-item)

## Bối cảnh

`DEVELOPMENT_LOG.md` (`SNAP-20260909-142`) ghi nhận mục 11 của PLAN 11-item ("nút Expand Activity Timeline") **chưa có code triển khai ở bất kỳ đâu** trong repo, khác với các mục 1/2/3/4/6 đã PASS QA cùng đợt. Văn bản gốc đầy đủ của PLAN 11-item không tồn tại dưới dạng file trong `docs/` (không tìm thấy qua grep) — Claude đã xác nhận trực tiếp với Thức phạm vi cụ thể của mục 11 trước khi soạn spec này (không suy diễn).

**Xác nhận của Thức:** Thêm nút **Expand** cho khu vực "Interview & Activity Timeline" (bottom drawer) trong **Action Menu Dashboard** (`src/app/page.js`) — bấm vào sẽ **phóng to chiều cao drawer tại chỗ** (không mở modal riêng), bấm lại để thu về kích thước cũ.

## Hiện trạng (đã verify bằng đọc code trực tiếp)

- `src/app/page.js` dòng ~1036-1102: bottom drawer "Interview & Activity Timeline" có chiều cao cố định `h-[260px]` khi `isDetailVisible === true`, và `h-0` khi ẩn. Đã có nút **Hide** (dòng ~1057-1069, icon `ChevronDown`) để ẩn drawer, và nút nổi **`▲ Action Timeline (N)`** (dòng ~1105-1116) để mở lại khi đang ẩn. Đây là cơ chế Smart Auto-Slide đã có từ trước (Blueprint mục 4.2) — **giữ nguyên, không đụng vào**.
- Bên trong drawer, `<ActivityLogPanel>` (dòng ~1083-1095) tự quản lý layout. Danh sách log render trong `src/components/ActivityLogPanel.js` dòng 180 bị giới hạn cứng `max-h-[220px] overflow-y-auto` — đây là nút thắt cổ chai thật sự: nếu chỉ tăng chiều cao drawer ngoài mà không sửa giới hạn này, phần không gian tăng thêm sẽ chỉ là khoảng trống, KHÔNG giúp xem được nhiều dòng log hơn.
- `ActivityLogPanel` là **component dùng chung** cho 3 nơi: `src/app/page.js` (dòng 1083), `src/app/candidates/page.js` (dòng 1774), `src/app/jobs/page.js` (dòng 2895). Mọi thay đổi phải **backward-compatible 100%** với 2 nơi kia — không được đổi hành vi/giao diện của chúng.
- Codebase đã có sẵn đúng 1 pattern UI y hệt cho nhu cầu này — **PHẢI tái sử dụng, không tự chế mới** (theo GEMINI.md Phần B mục 1.4): `src/app/jobs/page.js` dòng ~2672-2685, nút toggle "Expand Pipeline" / "Split View" dùng state boolean đơn (`isAppsMaximized`), icon `Maximize2`/`Minimize2` (đã import sẵn `lucide-react` ở `jobs/page.js` và `candidates/page.js`, **chưa có** ở `page.js`).

## Phạm vi (CHỈ 2 file này — không sửa gì khác)

1. `src/components/ActivityLogPanel.js`
2. `src/app/page.js`

Nếu phát hiện cần sửa thêm file khác ngoài 2 file trên, DỪNG LẠI và xin xác nhận trước (GEMINI.md mục 10) — không tự mở rộng phạm vi.

## Chi tiết triển khai

### A. `src/components/ActivityLogPanel.js`

Thêm 1 prop mới **có giá trị mặc định giữ nguyên hành vi cũ 100%**, để không ảnh hưởng `candidates/page.js` và `jobs/page.js` (2 nơi này KHÔNG truyền prop mới, nên vẫn nhận default y hệt hiện tại):

```js
export default function ActivityLogPanel({
  applicationId,
  currentStage,
  result = null,
  reasonFailed = null,
  logs = [],
  isLoadingLogs = false,
  onAddLog,
  onEditLog,
  onDeleteLog,
  outcomeMode = "readOnly",
  allowEditLog = false,
  logsMaxHeightClass = "max-h-[220px]", // MỚI — cho phép caller tùy chỉnh chiều cao scroll list log
}) {
```

Cập nhật JSDoc props (dòng 45-60) thêm dòng mô tả prop mới. Dòng 180, đổi:

```js
<div className="space-y-2 max-h-[220px] overflow-y-auto custom-scrollbar pr-1">
```
thành:
```js
<div className={`space-y-2 ${logsMaxHeightClass} overflow-y-auto custom-scrollbar pr-1`}>
```

Không sửa gì khác trong file này.

### B. `src/app/page.js`

**B.1. Import icon** — thêm `Maximize2, Minimize2` vào khối import `lucide-react` hiện có (dòng 20-43), giữ nguyên toàn bộ các icon khác.

**B.2. Thêm state mới** — cạnh khai báo `isDetailVisible` (dòng ~307):
```js
const [isDetailExpanded, setIsDetailExpanded] = useState(false);
```

**B.3. Chiều cao drawer động** — dòng ~1041-1045, sửa className của container drawer để có 3 trạng thái (ẩn / bình thường / phóng to), giữ nguyên transition đã có (`transition-all duration-300 ease-in-out`, KHÔNG thêm animation mới theo GEMINI.md Phần B mục 1.4):
```js
className={`transition-all duration-300 ease-in-out bg-slate-950 flex flex-col overflow-hidden shrink-0 ${
  isDetailVisible
    ? isDetailExpanded
      ? "h-[560px] border-t-2 border-slate-800 opacity-100"
      : "h-[260px] border-t-2 border-slate-800 opacity-100"
    : "h-0 border-t-0 opacity-0 pointer-events-none"
}`}
```
(Giá trị `560px` là gợi ý — AG được quyền tinh chỉnh trong khoảng ~480-600px nếu cần để không đè lên footer/header khi test thật trên viewport chuẩn, miễn là tạo khác biệt rõ rệt so với 260px hiện tại. Không dùng đơn vị `vh` để tránh lệch layout trên các màn hình thấp.)

**B.4. Nút Expand/Collapse** — thêm ngay cạnh nút "Hide" hiện có (dòng ~1057-1069), tái sử dụng đúng pattern `isAppsMaximized` ở `jobs/page.js` dòng 2672-2685:
```js
<button
  type="button"
  onClick={() => setIsDetailExpanded(prev => !prev)}
  title={isDetailExpanded ? "Collapse Timeline" : "Expand Timeline"}
  className={`px-2 py-0.5 text-[10px] font-bold rounded transition-colors flex items-center gap-1 cursor-pointer shrink-0 ${
    isDetailExpanded
      ? "bg-cyan-950 text-cyan-300 border border-cyan-600"
      : "text-slate-400 hover:text-emerald-400 hover:bg-slate-800 border border-transparent"
  }`}
>
  {isDetailExpanded ? <Minimize2 size={12} /> : <Maximize2 size={12} />}
  <span>{isDetailExpanded ? "Collapse" : "Expand"}</span>
</button>
```
Đặt nút này **trước** nút "Hide" trong cùng flex container (dòng ~1057), để thứ tự trái→phải là: Expand/Collapse → Hide.

**B.5. Reset khi Hide** — trong `onClick` của nút "Hide" hiện có (dòng ~1057-1062), thêm `setIsDetailExpanded(false);` để mỗi lần mở lại drawer (qua nút nổi `▲ Action Timeline`) luôn bắt đầu ở trạng thái thu gọn mặc định — tránh trạng thái phóng to "dính" lại gây khó hiểu cho người dùng lần mở sau.

**B.6. Truyền prop mới cho `<ActivityLogPanel>`** (dòng ~1083):
```js
<ActivityLogPanel
  applicationId={selectedApp.application_id}
  currentStage={selectedApp.current_stage}
  result={selectedApp.result}
  reasonFailed={selectedApp.reason_failed}
  logs={activityLogs}
  isLoadingLogs={logsLoading}
  onAddLog={selectedApp.status === "Closed" ? undefined : handleAddNewLog}
  onEditLog={handleEditLog}
  onDeleteLog={handleDeleteLog}
  outcomeMode="readOnly"
  allowEditLog={true}
  logsMaxHeightClass={isDetailExpanded ? "max-h-[420px]" : "max-h-[220px]"}
/>
```
(Giá trị `420px` là gợi ý tương ứng với drawer `560px` — AG tự cân đối lại nếu chỉnh B.3, miễn log list thực sự hiển thị được nhiều dòng hơn rõ rệt khi Expand.)

**B.7. Cơ chế Smart Auto-Slide (`handleMasterWheel`, dòng ~347-359) — KHÔNG sửa.** Khi người dùng cuộn bảng trên, drawer vẫn tự ẩn rồi tự hiện lại sau 1.8s như cũ; nếu đang ở trạng thái Expand thì sau khi tự hiện lại vẫn giữ nguyên `isDetailExpanded` (vì `handleMasterWheel` chỉ đổi `isDetailVisible`, không đụng `isDetailExpanded` — hành vi này là chủ đích, không phải bug).

## Việc KHÔNG được làm

- Không đụng `src/app/candidates/page.js` hay `src/app/jobs/page.js` (2 nơi khác dùng `ActivityLogPanel`) — verify bằng `git diff --stat` phải cho thấy CHỈ 2 file trong Phạm vi ở trên bị đổi.
- Không thêm animation/hiệu ứng mới ngoài transition đã có sẵn (GEMINI.md Phần B mục 1.4).
- Không đổi cơ chế Smart Auto-Slide hiện tại.

## Yêu cầu tài liệu (GEMINI.md mục 10.2 — cùng lượt, không để sau)

1. Thêm 1 mục mới vào `docs/DEVELOPMENT_LOG.md` theo đúng template mục 10.3, ghi rõ "Viết bởi: Antigravity (Implementer)", commit hash, 2 file đã sửa, verify.
2. Cập nhật `docs/USER_MANUAL_DRAFT.md` mục **1.2** ("Cơ Chế Tự Động Thu Gọn / Trồi Lên Thông Minh Khi Cuộn Chuột") — bổ sung 1 gạch đầu dòng mô tả nút Expand/Collapse mới, kèm dòng `_Cập nhật bởi: Antigravity (Implementer) — YYYY-MM-DD_` ngay dưới đoạn vừa thêm.

## Verify bắt buộc trước khi báo hoàn thành

1. `node --check src/app/page.js` và `node --check src/components/ActivityLogPanel.js` → PASS.
2. `git diff --stat` → chỉ 2 file trong Phạm vi (+ 2 file docs ở trên) bị đổi.
3. Test thật trên `npm run dev` tại `/`: chọn 1 application → bấm Expand → xác nhận drawer cao hơn rõ rệt VÀ danh sách log hiển thị nhiều dòng hơn (không chỉ khoảng trống) → bấm lại (Collapse) → về đúng 260px như cũ → bấm Hide → nút nổi `▲ Action Timeline` xuất hiện → bấm lại → drawer mở lại ở trạng thái thu gọn (không phóng to).
4. Test regression nhanh: mở Candidate 360° (`/candidates`) và Jobs & Clients Workbench (`/jobs`) → xác nhận `ActivityLogPanel` ở 2 nơi này hiển thị/hoạt động **y hệt trước khi sửa** (list log vẫn giới hạn 220px như cũ, không có nút Expand nào xuất hiện ở 2 nơi này).
5. `npm run build` → PASS 100% routes, không lỗi Turbopack.

Báo cáo hoàn thành gửi Claude phải kèm output nguyên văn của `git status`, `git diff --stat`, và kết quả `npm run build` (theo GEMINI.md mục 10). Nếu có bất kỳ sai lệch nào so với spec (ví dụ giá trị `560px`/`420px` phải đổi khác để fit layout thật), ghi rõ theo mục 10.7 (Mandatory Deviation Log).
