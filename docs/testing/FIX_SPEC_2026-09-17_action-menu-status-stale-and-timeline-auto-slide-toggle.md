**Từ:** Claude (Architect/QA)

# FIX_SPEC_2026-09-17 — 2 lỗi PO báo qua Google Doc (status không đồng bộ Candidates→Action Menu; chưa có toggle tắt Auto-Show Timeline)

## Nguồn báo lỗi

PO báo qua Google Doc (kèm 1 ảnh chụp màn hình khu vực "Applications & Pipeline" trên Candidate 360°, application `#3362 BE Developer Specialist`, hiển thị 2 dropdown "In Progress" / "Contact" và nút "Timeline"):

1. "thông in status lưu trên menu candidates nhưng không được lưu lại. chuyển qua menu action thì status này bị reset về lại giá trị cũ."
2. "chưa disable tính năng auto show của Action Timeline"

---

## PHẦN A — Bug 1: Status/Stage sửa ở Candidates không phản ánh đúng khi qua Action Menu

### Đã xác nhận qua đọc code trực tiếp (KHÔNG suy diễn)

- **Data layer nhất quán, KHÔNG lệch cột/lệch bảng**: Cả 2 trang dùng chung đúng 1 cột (`activity.status`, `activity.current_stage`) qua đúng 1 server action `updateApplicationAction` (`src/app/actions.js:189-223`) — UPDATE có `await` đầy đủ, không phải bug ghi sai chỗ.
  - Candidates page gọi tại `src/app/candidates/page.js:1682-1703` (dropdown Status) và `:1705-1724` (dropdown Stage), sau đó gọi `loadCandidateData(candidate.id)` (`:1689`, `:1713`) — đây là 1 query DB **live, không cache** (`getCandidateProfile`, `actions.js:436-533`).
  - Action Menu (`src/app/page.js`) đọc qua `getActionMenuData` (`actions.js:38-164`, cột `app.status`/`app.current_stage` dòng 101-102) — cũng là query DB live, không cache ở tầng server action.
- **Nghi vấn hàng đầu: state phía client của Action Menu bị "đứng hình" (stale) khi quay lại route `/`, KHÔNG phải do query sai.** `src/app/page.js` có state `applications` (dòng 299) chỉ được nạp lại qua `fetchApplications()` (dòng 377-403), được gọi trong `useEffect` (dòng 406-411) phụ thuộc `[searchTerm, statusFilter, passiveFilter, clientFilter, jobFilter, page, planningDateSort]` — **không có bất kỳ cơ chế nào ép fetch lại khi user điều hướng QUAY LẠI route `/`** (không có `usePathname()`, không `router.refresh()`, không listener `visibilitychange`/`focus`).
- **Yếu tố gây nhiễu cần loại trừ khi test**: `statusFilter` mặc định là `"In progress"` (dòng 315). Nếu PO đổi Status sang `"Closed"` trên Candidates rồi qua Action Menu, item đó **biến mất khỏi danh sách mặc định** (đúng thiết kế filter, không phải bug) — dễ bị hiểu nhầm thành "bị reset". Vì ảnh PO gửi cho thấy dropdown đang là "In Progress" (không phải Closed), khả năng cao PO đang test đổi **Stage** (dropdown "Contact" trong ảnh — đây là giá trị `current_stage`, không phải `status`) hoặc đổi Status nhưng vẫn giữ trong nhóm "In progress" filter — cần verify rõ bằng test thật ở bước B dưới đây, không suy đoán tiếp.

### Cơ chế cache phía client Next.js — ĐÃ tra cứu trực tiếp docs của bản Next.js 16.3.0 đang dùng trong repo này (`node_modules/next/dist/docs/`, theo đúng yêu cầu bắt buộc của `AGENTS.md` — bản Next.js này có breaking changes so với kiến thức huấn luyện thông thường, KHÔNG được đoán theo bản cũ)

- `node_modules/next/dist/docs/01-app/04-glossary.md` (mục "Client Cache"): *"Pages are not cached by default but are reused during browser back/forward navigation."* — nghĩa là điều hướng **forward bằng `<Link>` click** (như tab "Action Menu" trên `NavbarTabs.js` hoặc link "Open in Action Menu" ở `candidates/page.js:1768-1774`, cả 2 đều là `<Link href="/">` thường, không phải `router.back()`) **về lý thuyết PHẢI unmount/remount `page.js` mới mỗi lần**, tức `useEffect` mount sẽ tự chạy lại và fetch dữ liệu mới — nếu đúng vậy thì bug 1 sẽ KHÔNG xảy ra qua đường Link click bình thường.
- Ngược lại, nếu PO dùng **nút Back của trình duyệt** để quay lại `/`, tài liệu xác nhận rõ trường hợp này **CÓ** tái sử dụng lại đúng instance cũ (kèm state cũ) — đây là hành vi chuẩn của Next.js, không phải bug, nhưng sẽ gây đúng triệu chứng "status bị reset về giá trị cũ" nếu instance cũ được tạo TRƯỚC khi PO sang Candidates sửa dữ liệu.
- Dự án **KHÔNG bật `cacheComponents`** (không có trong `next.config.mjs`) nên cơ chế `<Activity>` preservation (`preserving-ui-state.md`) — vốn mới giải thích tốt nhất kiểu bug "state cũ dính lại" — **theo tài liệu chỉ áp dụng khi bật `cacheComponents: true`**. Vì flag này đang tắt, khả năng cao đây KHÔNG phải nguyên nhân, hoặc bản Next.js 16.3.0 này có hành vi mặc định khác biệt so với mô tả (cần verify thực tế, không tin tài liệu 100% vì đây là bản đã bị chỉnh sửa có chủ đích theo `AGENTS.md`).

**Kết luận: tài liệu không đủ để khẳng định chắc chắn cơ chế — BẮT BUỘC phải tái hiện lỗi thật trên `npm run dev` trước khi sửa bất kỳ dòng code nào (không suy diễn, không đoán).**

### B. Quy trình bắt buộc — Chẩn đoán trước, sửa sau

**Bước 1 — Tái hiện lỗi thật (ghi lại chính xác kịch bản nào tái hiện được):**

1. Mở `/candidates`, chọn 1 candidate có application, đổi **Stage** dropdown (không phải Status, để tránh bị filter ẩn) sang 1 giá trị khác hẳn hiện tại (ví dụ `Talent Mapping` → `Contact`).
2. Xác nhận toast "✓ Stage updated to ..." hiện ra (nghĩa là ghi DB thành công).
3. Thử LẦN LƯỢT 3 cách điều hướng sang Action Menu, ghi rõ kết quả từng cách (PASS = hiển thị đúng stage mới / FAIL = hiển thị stage cũ):
   - (a) Click tab "Action Menu" trên `NavbarTabs` (Link click, chưa từng mở `/` trước đó trong tab này).
   - (b) Click link "Open in Action Menu" ngay trên card application đó (`candidates/page.js:1768`).
   - (c) Mở sẵn `/` ở 1 tab khác từ TRƯỚC (đã load xong), rồi mới sang `/candidates` sửa, sau đó bấm nút Back trình duyệt (hoặc chuyển tab) để quay lại tab `/` đã mở sẵn đó.
4. Thêm 1 dòng `console.log("ActionMenuPage mounted", Date.now())` tạm thời ngay đầu component `ActionMenuPage` (`src/app/page.js:295`) trong lúc debug (XÓA lại trước khi commit) để xác nhận component có thực sự mount lại (log xuất hiện) hay không mỗi lần quay lại `/` ở từng kịch bản (a)/(b)/(c).
5. Nếu KHÔNG kịch bản nào tái hiện được lỗi thật (tức PASS cả 3), dừng lại, ghi rõ vào phần Verify là "không tái hiện được qua code hiện tại, nghi ngờ do PO thao tác trình duyệt cụ thể (ví dụ bookmark cũ, tab để lâu, hoặc nhầm với filter ẩn Closed)" và in `QUESTION:` hỏi Claude/PO xin thêm chi tiết thao tác chính xác trước khi tự ý sửa code — **không sửa mù nếu không tái hiện được**.

**Bước 2 — Áp dụng đúng 1 trong các fix sau, tuỳ kết quả Bước 1:**

- **Nếu (a) và (b) đều FAIL** (tức Link click bình thường cũng bị stale — nghĩa là hành vi thực tế của Next 16.3.0 khác tài liệu, hoặc component không thực sự remount): thêm cơ chế ép fetch lại dữ liệu mỗi khi route `/` trở thành active, độc lập với vòng đời mount, bằng cách thêm `usePathname` (đã có sẵn pattern tương tự ở `NavbarTabs.js:5,22`) và 1 `useEffect` riêng gọi `fetchApplications()` mỗi khi `pathname === "/"` trở thành true (dùng `useRef` lưu giá trị pathname trước đó để chỉ fetch lại khi thực sự "vừa đến" `/`, tránh gọi trùng với `useEffect` debounce filter hiện có ở dòng 406-411). Đặt `useEffect` mới này SAU `useEffect` debounce hiện có, không xoá/sửa cái cũ.
- **Nếu CHỈ (c) FAIL** (bug chỉ xảy ra qua nút Back trình duyệt / tab để sẵn từ trước, đúng như tài liệu Next.js mô tả là hành vi "reuse instance" khi back/forward): đây là edge case hẹp hơn — vẫn PHẢI fix (PO có thể thao tác đúng kiểu này), dùng cùng cơ chế `usePathname()` + fetch-on-arrival ở trên (nó tự động cover luôn cả trường hợp back/forward vì `pathname` value không đổi nhưng ta cần 1 tín hiệu khác để biết "vừa quay lại" — gợi ý dùng thêm listener `window.addEventListener('pageshow', ...)` kết hợp, đây là API chuẩn của trình duyệt để bắt sự kiện "trang được hiển thị lại kể cả từ cache back/forward", KHÔNG phải API riêng của Next.js nên không bị ảnh hưởng bởi breaking changes của bản Next.js custom này).
- **Nếu ĐÚNG NHƯ (5) ở Bước 1** (không tái hiện được lỗi thật nào): không sửa code, chỉ báo cáo lại rõ ràng, in `QUESTION:` như đã nêu.

**Ràng buộc bắt buộc cho fix (nếu có sửa)**:
- KHÔNG polling định kỳ (setInterval) cho toàn bộ trang — dự án đã từng bị lỗi "giật do polling toàn cục" (xem `DEVELOPMENT_LOG.md` `SNAP-20260915-181`), chỉ fetch đúng lúc "vừa đến" route, không lặp lại liên tục.
- KHÔNG đổi global config (`next.config.mjs` / `staleTimes`) trừ khi đã thử cách scoped ở trên mà vẫn FAIL và đã in `QUESTION:` xin xác nhận trước — thay đổi cache global ảnh hưởng toàn bộ app, ngoài phạm vi 2 lỗi này.
- KHÔNG đụng logic `statusFilter` mặc định (`"In progress"`) — đây là thiết kế filter có chủ đích, không phải bug, trừ khi Bước 1 xác nhận rõ ràng PO thực sự đang nhầm lẫn điều này và Claude xác nhận nên đổi (xin `QUESTION:` nếu nghi ngờ).

**Phạm vi file dự kiến (chỉ áp dụng nếu Bước 1 xác nhận cần sửa)**: `src/app/page.js` (thêm effect + import `usePathname`). Nếu cần sửa thêm file khác ngoài dự kiến này, DỪNG LẠI và xin xác nhận trước (GEMINI.md mục 10).

---

## PHẦN B — Bug 2: Thêm toggle tắt "Auto-Show" cho Action Timeline (Smart Auto-Slide)

### Hiện trạng (đã verify bằng đọc code trực tiếp, khớp Blueprint mục 4.2)

- `src/app/page.js:309-310`: state `isDetailVisible` / `isDetailExpanded`.
- `handleMasterWheel` (`src/app/page.js:350-362`): khi cuộn bảng trên, ẩn Timeline ngay (`setIsDetailVisible(false)`, dòng 353) rồi **tự động hiện lại sau 1800ms** (dòng 359-361) — đây chính là phần "auto show" PO muốn tắt được.
- Nút nổi "Quick Peek" đã có sẵn (`src/app/page.js:1128-1139`) để mở lại Timeline thủ công khi đang ẩn — **giữ nguyên, dùng làm cách mở lại duy nhất khi tắt Auto**.
- Chưa có bất kỳ toggle/setting/localStorage nào để tắt hành vi tự động hiện lại này (đã verify qua đọc trực tiếp, không có state/prop nào khác liên quan).

### Yêu cầu

Thêm 1 toggle "Auto / Manual" cho riêng hành vi tự-hiện-lại-sau-khi-cuộn (KHÔNG đụng phần tự-ẩn-khi-cuộn — giữ nguyên, vì đó là hành vi dọn giao diện có chủ đích, không bị PO phàn nàn). Mặc định **giữ nguyên hành vi cũ (Auto = ON)** để không gây regression — PO tự tắt khi cần, đúng tinh thần "On-Demand Clean UX" (GEMINI.md Phần A mục 5).

### Chi tiết triển khai — `src/app/page.js`

**1. Import icon** — thêm `Pin, PinOff` vào khối import `lucide-react` hiện có (dòng 20-45), giữ nguyên các icon khác.

**2. State mới** — ngay cạnh `isDetailExpanded` (dòng 310):
```js
const [autoSlideEnabled, setAutoSlideEnabled] = useState(true);
```

**3. Nạp giá trị đã lưu (localStorage, quy ước đặt tên theo pattern có sẵn `ats_draft_new_client` ở `src/app/jobs/page.js:490`)** — thêm 1 `useEffect` mount-only, đặt gần effect "Initial Dropdowns Load" (dòng 365-375):
```js
useEffect(() => {
  const saved = localStorage.getItem("ats_action_menu_auto_slide_enabled");
  if (saved === "false") setAutoSlideEnabled(false);
}, []);
```

**4. Hàm toggle**:
```js
function toggleAutoSlide() {
  setAutoSlideEnabled((prev) => {
    const next = !prev;
    localStorage.setItem("ats_action_menu_auto_slide_enabled", String(next));
    return next;
  });
}
```

**5. Gate phần "tự hiện lại"** — sửa `handleMasterWheel` (dòng 359-361), CHỈ đổi đúng dòng bên trong `setTimeout`, giữ nguyên toàn bộ phần còn lại của hàm (kể cả `setIsDetailVisible(false)` ở dòng 353 — auto-HIDE khi cuộn vẫn giữ nguyên bất kể toggle):
```js
scrollTimeoutRef.current = setTimeout(() => {
  if (autoSlideEnabled) setIsDetailVisible(true);
}, 1800);
```

**6. Nút toggle trên UI** — thêm vào đúng flex container đang chứa nút Expand/Collapse và Hide (dòng 1063-1090), đặt làm nút ĐẦU TIÊN (trước Expand/Collapse):
```jsx
<button
  type="button"
  onClick={toggleAutoSlide}
  title={
    autoSlideEnabled
      ? "Auto-show Timeline: ON — click to switch to Manual (won't auto-reopen after scrolling)"
      : "Auto-show Timeline: OFF (Manual) — use the floating Quick Peek button to reopen"
  }
  className={`px-2 py-0.5 text-[10px] font-bold rounded transition-colors flex items-center gap-1 cursor-pointer shrink-0 ${
    autoSlideEnabled
      ? "text-slate-400 hover:text-emerald-400 hover:bg-slate-800 border border-transparent"
      : "bg-amber-950 text-amber-300 border border-amber-600"
  }`}
>
  {autoSlideEnabled ? <Pin size={12} /> : <PinOff size={12} />}
  <span>{autoSlideEnabled ? "Auto" : "Manual"}</span>
</button>
```

Không thêm animation mới ngoài transition đã có (GEMINI.md Phần B mục 1.4).

## Yêu cầu tài liệu (GEMINI.md mục 10.2 — cùng lượt, không để sau)

1. Thêm 1 mục mới vào `docs/DEVELOPMENT_LOG.md` theo đúng template mục 10.3 — ghi rõ "Viết bởi: Antigravity (Implementer)", kết quả tái hiện lỗi Bug 1 ở từng kịch bản (a)/(b)/(c), fix nào đã áp dụng (hoặc không sửa + lý do), và toggle Bug 2.
2. Cập nhật `docs/USER_MANUAL_DRAFT.md` mục mô tả Action Menu / Smart Auto-Slide (mục 1.2, xem tiền lệ ở `FIX_SPEC_2026-09-13_action-menu_expand-activity-timeline.md`) — bổ sung mô tả nút Auto/Manual mới, kèm dòng `_Cập nhật bởi: Antigravity (Implementer) — 2026-09-17_`.

## Verify bắt buộc trước khi báo hoàn thành

1. `node --check src/app/page.js` → PASS.
2. `git diff --stat` → chỉ `src/app/page.js` (+ 2 file docs ở trên); nếu Bug 1 cần sửa thêm file ngoài dự kiến, phải đã xin phép trước (xem PHẦN A).
3. Test thật trên `npm run dev`:
   - Bug 1: chạy đúng quy trình Bước 1 PHẦN A, ghi lại kết quả PASS/FAIL từng kịch bản (a)/(b)/(c) TRƯỚC khi sửa, rồi lặp lại đúng 3 kịch bản đó SAU khi sửa để xác nhận cả 3 đều PASS.
   - Bug 2: cuộn bảng trên khi Auto đang ON → xác nhận Timeline tự ẩn rồi tự hiện lại sau ~1.8s như cũ → bấm nút "Auto" chuyển sang "Manual" → cuộn lại → xác nhận Timeline tự ẩn nhưng KHÔNG tự hiện lại → bấm nút nổi "Quick Peek" → Timeline hiện lại đúng cách → reload trang (F5) → xác nhận toggle vẫn giữ "Manual" (đã lưu localStorage).
4. `npm run build` → PASS 100% routes, không lỗi Turbopack.

Báo cáo hoàn thành gửi Claude phải kèm nguyên văn `git status`, `git diff --stat`, kết quả `npm run build`, và kết quả từng kịch bản test ở trên. Nếu có bất kỳ sai lệch nào so với spec này (đặc biệt là kết quả chẩn đoán Bug 1 khác với các nghi vấn nêu trên), ghi rõ theo mục 10.7 GEMINI.md (Mandatory Deviation Log) — đây là phần QUAN TRỌNG NHẤT của spec này vì bản chất Bug 1 chưa được xác nhận 100%, chỉ mới khoanh vùng qua đọc code + tài liệu.

---

## PHẦN C — Bổ sung 2026-09-17 (round 2, ĐÃ HUỶ — không áp dụng)

Ban đầu Claude hỏi PO có muốn đổi `statusFilter` mặc định của Action Menu từ `"In progress"` sang `"ALL"` (để hiển thị luôn cả `Closed`). PO ban đầu đồng ý ("ok làm đi"), round 2 đã được gửi qua bridge và Antigravity đã áp dụng thay đổi 1 dòng ở `src/app/page.js` dòng 318.

**Ngay sau đó PO xác nhận lại: `"In progress"` mới đúng là thiết kế mặc định PO muốn ban đầu** — tức đề xuất đổi sang `"ALL"` ở trên là hiểu sai ý PO, KHÔNG phải PO đổi ý. Claude đã:
1. Dừng ngay tiến trình bridge round 2 đang chạy (`TaskStop`) trước khi Antigravity kịp hoàn tất/ghi log.
2. `git checkout -- src/app/page.js` để khôi phục đúng bản đã commit ở round 1 (`statusFilter = "In progress"`, không đổi).
3. Không có gì được commit cho round 2 này (thay đổi chỉ tồn tại trong working tree, chưa từng lên Git) — vì vậy **không cần commit revert riêng, không có entry `DEVELOPMENT_LOG.md` nào cho round 2** (đúng tinh thần chỉ ghi log khi tính năng thực sự "hoàn thành", round 2 bị huỷ giữa chừng trước khi hoàn tất).

**Kết luận cuối cùng: `statusFilter` mặc định của Action Menu giữ nguyên `"In progress"` như code gốc — không có thay đổi nào từ PHẦN C này.**
