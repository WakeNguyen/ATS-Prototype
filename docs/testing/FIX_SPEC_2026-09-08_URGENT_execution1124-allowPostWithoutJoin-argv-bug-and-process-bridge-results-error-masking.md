# FIX_SPEC (KHẨN CẤP) — 2026-09-08 — Root cause Execution #1124 "Accenture - 8 Jobs" Failed 98/98: bug parse CLI argument trong `post-to-group.js` khi `allowPostWithoutJoin=true` + `Process Bridge Results` che mất lỗi thật ("[object Object]") và làm mất `partialResults`

**Từ:** Claude (Architect/QA)
**Mức độ ưu tiên: KHẨN CẤP — 100% lượt đăng bài của MỌI campaign đang bật `allow_post_without_join=true` sẽ fail ngay lập tức cho tới khi fix, không phải vấn đề FB chặn.**
**Người phát hiện:** User, báo qua 2 ảnh chụp màn hình (Campaign "Accenture..." Status Failed, Total Sent 0; n8n execution 1124 node "Process Bridge Results" báo lỗi 504 "Execution timed out after 3300s"). Claude đã điều tra trực tiếp qua n8n MCP (execution log thật, không suy đoán) + Supabase (giá trị cột thật) + đọc source code hiện tại.

## Tóm tắt chuỗi nguyên nhân (đã verify từng bước bằng dữ liệu thật)

1. Campaign "Accenture - 8 Jobs - HCMC/Taiwan - Group min 10k" (id `01a07b01-92cb-0da3-b13f-923ece51c482`) hiện có `max_posts_per_run = 98` và `allow_post_without_join = true` (đọc trực tiếp từ Supabase `public.campaigns`).
   - **Lưu ý quan trọng:** `max_posts_per_run` của CHÍNH campaign này đã từng được chủ động đặt về `18` trong fix khẩn cấp trước đó (commit `1a13427`, xem devlog `[2026-09-07 23:55]`) để tránh chạm ngưỡng timeout cứng 55 phút của VPS bridge. Giá trị hiện tại `98` là một REGRESSION — đã bị ai đó (rất có thể qua `CampaignEditModal.js`, field UI ghi nhãn "Max posts/day" nhưng thực chất ghi thẳng vào `max_posts_per_run` — xem mục "Khuyến nghị UX" bên dưới) ghi đè lại lên mức nguy hiểm, có khả năng vô tình khi sửa các field khác của campaign (ví dụ khi bật `allow_post_without_join`).
2. Vì `allow_post_without_join=true`, node `Build FB Post Bridge Payload` (n8n Workflow A) gắn `allowPostWithoutJoin: true` vào TỪNG job gửi xuống VPS Bridge → `scripts/run-batch.js` (dòng ~153-155) push thêm 1 tham số CLI dạng flag `--allowPostWithoutJoin` vào cuối mảng `spawnArgs` vốn đang ở dạng POSITIONAL (`[scriptPath, groupUrl, BASE64:..., imagesPayload, accountId, proxyUrl]`).
3. **BUG CHÍNH (nằm trong `scripts/post-to-group.js`, dòng ~37-44):**
   ```js
   if (rawArgs.some(a => a.startsWith('--'))) {
     // chế độ named-argument: chỉ đọc --groupUrl=, --content=, --account=, --proxy=, --images=
     ...
   } else {
     // chế độ positional: groupUrl = rawArgs[0], postContent = rawArgs[1], ...
   }
   ```
   Điều kiện rẽ nhánh chỉ kiểm tra "có BẤT KỲ arg nào bắt đầu bằng `--`" — nhưng `run-batch.js` gọi script ở dạng **positional CHO 5 tham số đầu, cộng thêm 1 flag `--allowPostWithoutJoin` ở cuối**. Vì có ít nhất 1 arg bắt đầu bằng `--`, toàn bộ parser bị chuyển sang chế độ "named-argument" — nhưng 5 giá trị positional (`groupUrl`, `postContent`, `imagesPayload`, `accountId`, `proxyUrl`) KHÔNG khớp bất kỳ pattern `--key=value` nào trong nhánh named, nên bị bỏ qua hoàn toàn → `groupUrl` và `postContent` giữ nguyên giá trị rỗng mặc định.
   → Ngay dòng 664: `if (!groupUrl || !postContent) { console.error('Usage: node post-to-group.js <group_url> <post_content_base64> [images] [accountId] [proxy] [--allowPostWithoutJoin]'); process.exit(1); }` bị kích hoạt **NGAY LẬP TỨC cho MỌI job**, không hề thực hiện bất kỳ thao tác Playwright/đăng bài thật nào.
   - **Bằng chứng trực tiếp:** trong response 504 của execution #1124 (đọc qua ảnh chụp User gửi), `partialResults[0].error` = chính xác chuỗi `"Usage: node post-to-group.js <group_url> <post_content_base64> [images] [accountId] [proxy] [--allowPostWithoutJoin]\n[--allowPostWithoutJoin]"` — khớp 100% với dòng 664 trên.
4. **BUG PHỤ #1 (che giấu lỗi thật, `Process Bridge Results`, n8n Workflow A `9W588GooZeZhiSKm`):** Vì tổng thời gian batch vẫn vượt ngưỡng 55 phút (xem mục "Vì sao vẫn timeout" bên dưới), node HTTP Request "Call VPS Bridge: facebook-post-v2" nhận lỗi 504 → item output có dạng `{ error: { message, name, stack, details: { httpCode, body: { success, error, partialResults } } } }` (KHÔNG có `groupUrl`/`success` ở top-level, KHÔNG có `.output`). Code hiện tại của `Process Bridge Results` chỉ nhận diện đúng 2 dạng shape (`allItems[0].groupUrl`/`.success` hoặc `.output`) — dạng lỗi HTTP thật này rơi vào nhánh `isBridgeLevelFailure = true`, và:
   ```js
   const errMsg = (allItems[0] && (allItems[0].error || allItems[0].message)) || '...';
   ...
   errorMessage: String(errMsg).substring(0, 500)
   ```
   `allItems[0].error` là 1 OBJECT (không phải string) → `String(object)` = **`"[object Object]"`** — khớp 100% với `errorMessage` thấy trên cả 98/98 dòng trong execution log thật (đã tự verify qua n8n MCP, đếm đúng 98/98 `status: Failed`, `errorMessage: "[object Object]"`).
5. **BUG PHỤ #2 (mất dữ liệu thật):** Vì rơi vào nhánh `isBridgeLevelFailure`, code **bỏ qua hoàn toàn mảng `partialResults`** mà VPS bridge ĐÃ trả về kèm lỗi 504 (chính là nhờ cơ chế NDJSON incremental persistence đã làm đúng trong fix trước, commit `1a13427`) — quy hết 98 nhóm thành `Failed` một cách vô căn cứ, thay vì đọc đúng per-group `success`/`error` từ `partialResults`. Nói cách khác: NGAY CẢ KHI có nhóm nào đó lỡ đăng thành công thật trước khi timeout, hệ thống hiện tại vẫn sẽ báo sai là Failed.

## Vì sao vẫn chạm ngưỡng timeout 3300s dù mỗi job fail gần như tức thì?
`run-batch.js` vẫn áp dụng "Smart Inter-Account Cooldown" (mặc định ≥120s + jitter ngẫu nhiên, dòng ~122-131) giữa các lần post CÙNG 1 tài khoản — cooldown này chạy `execSync` bất kể job trước đó thành công hay fail-nhanh-vì-bug. Với 98 job luân phiên 2 tài khoản, tổng thời gian chờ cooldown cộng dồn đủ để chạm mốc 3300s trước khi xử lý xong toàn bộ 98 job trong danh sách dispatch. **AG cần tự đối chiếu log VPS thật (pm2 logs) để xác nhận chính xác job dừng ở vị trí bao nhiêu khi bị SIGKILL** — Claude không có quyền truy cập log VPS trực tiếp.

## Việc cần AG làm (thứ tự ưu tiên)

### 1. (Chặn ngay, ưu tiên cao nhất) Sửa bug parse argument trong `scripts/post-to-group.js`
Đừng dùng "có `--` ở đâu đó" làm điều kiện rẽ nhánh chế độ — chỉ chuyển sang named-mode khi thực sự thấy pattern `--groupUrl=`/`--content=` (tức khi TOÀN BỘ lời gọi dùng named style, không phải hybrid). Gợi ý sửa (tham khảo, AG có thể chỉnh lại cho khớp style code hiện có):
```js
const hasNamedCore = rawArgs.some(a => a.startsWith('--groupUrl=') || a.startsWith('--content='));
if (hasNamedCore) {
  // giữ nguyên nhánh named-argument hiện tại
  for (const arg of rawArgs) { ... } // không đổi
} else {
  // giữ nguyên nhánh positional hiện tại
  groupUrl = rawArgs[0] || '';
  postContent = rawArgs[1] || '';
  imageUrlsArg = rawArgs[2] || '';
  accountId = rawArgs[3] || 'acc_01';
  proxyUrl = rawArgs[4] || '';
  // quét TOÀN BỘ rawArgs tìm flag allowPostWithoutJoin, không chỉ rawArgs[5],
  // để không phụ thuộc thứ tự tham số
  if (rawArgs.includes('--allowPostWithoutJoin') || rawArgs.includes('--allow-post-without-join') || rawArgs[5] === 'true') {
    allowPostWithoutJoin = true;
  }
}
```
Deploy lại file này lên VPS (`/opt/n8n/facebook auto posting 2.0/` hoặc đường dẫn tương ứng, giống quy trình đã làm ở fix trước) — đây là script chạy trực tiếp trên VPS, sửa trong repo KHÔNG tự động có hiệu lực.

### 2. Sửa `Process Bridge Results` (n8n Workflow A `9W588GooZeZhiSKm`) — đọc đúng `partialResults` khi HTTP-level error + không còn `[object Object]`
Bổ sung 1 nhánh nhận diện shape lỗi HTTP thật (`allItems[0].error.details.body.partialResults` là mảng) TRƯỚC khi kết luận `isBridgeLevelFailure`:
```js
const allItems = $input.all().map(function (item) { return item.json; });
...
let rawResults = [];
let bridgeErrorMsg = null;

const firstErr = allItems[0] && allItems[0].error;
const errBody = firstErr && firstErr.details && firstErr.details.body;

if (errBody && Array.isArray(errBody.partialResults)) {
  // Trường hợp HTTP request lỗi (vd 504) nhưng VPS bridge vẫn trả kèm partialResults thật
  rawResults = errBody.partialResults;
  bridgeErrorMsg = errBody.error || (firstErr && firstErr.message) || null;
} else if (allItems.length > 0 && (allItems[0].groupUrl || allItems[0].success !== undefined)) {
  rawResults = allItems;
} else if (allItems.length === 1 && allItems[0].output) {
  try {
    const parsed = JSON.parse(allItems[0].output.trim());
    if (Array.isArray(parsed)) rawResults = parsed;
    else if (parsed && Array.isArray(parsed.data)) rawResults = parsed.data;
  } catch (e) {}
}

const isBridgeLevelFailure = rawResults.length === 0;

const progressResults = [];
if (isBridgeLevelFailure) {
  const rawErr = bridgeErrorMsg || (firstErr && (firstErr.message || firstErr.name)) || (allItems[0] && allItems[0].message) || 'VPS bridge request failed or returned no data.';
  const errMsg = (rawErr && typeof rawErr === 'object') ? JSON.stringify(rawErr) : rawErr;
  for (const d of dispatch) {
    progressResults.push({ ..., status: 'Failed', errorMessage: String(errMsg).substring(0, 500) });
  }
} else {
  // NHÁNH NÀY GIỮ NGUYÊN 100% NHƯ HIỆN TẠI — dispatch với dữ liệu partialResults thật
  // sẽ tự nhiên đi vào đây và báo đúng per-group status
  for (const r of rawResults) { ... } // không đổi
}
```
Ghi chú cho AG: các nhóm trong `dispatch` KHÔNG xuất hiện trong `partialResults` (vì bị SIGKILL trước khi xử lý tới) vẫn cần 1 dòng `Failed` hợp lý (không phải "Sent" giả) — có thể thêm bước map ngược `dispatch` → nhóm nào không có trong `rawResults` thì tự thêm `status: 'Failed', errorMessage: 'Chưa xử lý (bridge timeout giữa chừng)'` sau vòng lặp trên, để không bị "biến mất" khỏi báo cáo.

### 3. Đặt lại `max_posts_per_run = 18` cho campaign "Accenture - 8 Jobs..." (id `01a07b01-92cb-0da3-b13f-923ece51c482`)
Trả về đúng giá trị an toàn đã tính toán trong fix trước (commit `1a13427`) — hiện đang là `98`, cần chỉnh lại qua UI (`CampaignEditModal.js`) hoặc migration nhỏ. **Việc này CHƯA giải quyết được lỗi ở mục 1** (bug argv sẽ vẫn khiến 100% job fail dù batch nhỏ hơn) — làm mục 1 trước, mục 3 chỉ để tránh lặp lại rủi ro timeout 55 phút một khi mục 1 đã fix và bài thật bắt đầu đăng được (mỗi job giờ sẽ tốn thời gian Playwright thật, không còn fail tức thì).

### 4. (Khuyến nghị UX, không khẩn) Tách rõ 2 khái niệm đang bị đặt tên trùng lặp gây nhầm lẫn
`CampaignEditModal.js` hiện dùng biến `maxPostsPerDay` cho field UI nhưng lưu thẳng vào cột `campaigns.max_posts_per_run` (giới hạn per-RUN, không phải per-DAY) — đây rất có thể là lý do giá trị bị đổi nhầm thành 98 (hiểu lầm là "quota/ngày" trong khi thực chất là "trần số nhóm mỗi lần bấm Run", con số quyết định trực tiếp có bị SIGKILL 55 phút hay không). Đề xuất: đổi label UI thành đúng bản chất (vd "Max Groups Per Run (anti-timeout safety cap, khuyến nghị ≤ 20)"), và/hoặc thêm cảnh báo UI khi User nhập > 20-25.

## Yêu cầu verify (bắt buộc trước khi báo hoàn thành)
1. Test script `post-to-group.js` trực tiếp qua CLI với đúng dạng lời gọi mà `run-batch.js` dùng (5 positional + `--allowPostWithoutJoin`) trỏ tới 1 nhóm test thật (nhóm User đã tự tay test thành công thủ công) → xác nhận KHÔNG còn in ra dòng "Usage:", script chạy vào đúng luồng Playwright.
2. Chạy thử 1 batch nhỏ (2-3 nhóm) cho đúng campaign này (hoặc 1 campaign test) với `allow_post_without_join=true` → xác nhận `campaign_run_items`/UI hiển thị đúng `Sent`/`Failed` thật theo từng nhóm, KHÔNG còn `errorMessage = "[object Object]"`.
3. Mô phỏng lại tình huống timeout (có thể hạ tạm `BRIDGE_TIMEOUT_MS`/`PROCESS_TIMEOUT_MS` xuống mức nhỏ trên môi trường test, KHÔNG làm trên production) → xác nhận `Process Bridge Results` đọc đúng `partialResults` từ response lỗi, không quy hết thành Failed vô căn cứ.
4. Xác nhận lại `max_posts_per_run = 18` cho campaign Accenture qua query Supabase trực tiếp sau khi sửa.
5. `npm run build` PASS 100% nếu có đổi code Next.js liên quan.
