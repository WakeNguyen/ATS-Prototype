# FIX_SPEC — 2026-09-08 (v2 — đã chốt với User) — Campaign Auto-Scheduler + "Target Quota" thay thế "Max Posts Per Run" + xử lý an toàn nhóm bị cắt giữa chừng (Interrupted)

**Từ:** Claude (Architect/QA)
**Mức độ ưu tiên: Trung bình — tính năng mới theo yêu cầu User. Phụ thuộc FIX_SPEC `FIX_SPEC_2026-09-08_URGENT_execution1124-...md` đã fix xong (2 bug argv/`[object Object]` + reset `max_posts_per_run=18`) — PHẢI xác nhận VPS thật đã nhận bản vá đó (đang chờ User tự SCP/restart PM2) TRƯỚC khi bắt đầu spec này, vì spec này sẽ thay đổi tiếp cách dispatch hoạt động trên nền code đó.**

## Bối cảnh & toàn bộ quyết định đã chốt với User (qua nhiều vòng trao đổi)

1. **Đổi vai trò của `max_posts_per_run`** — tách làm 2 khái niệm RIÊNG BIỆT thay vì 1:
   - **`target_quota`** (đổi tên từ `max_posts_per_run`, giữ nguyên giá trị hiện có): DO USER TỰ SET trên UI campaign, mang ý nghĩa kinh doanh thuần tuý — "tổng số nhóm campaign này cần đạt được" (có thể nhỏ hơn tổng số nhóm đã liên kết). Dùng để biết KHI NÀO dừng (đạt quota hoặc hết Start-End Date).
   - **`SAFE_DISPATCH_BATCH_SIZE`** (MỚI, hằng số hệ thống, mặc định `18` — đã tính toán có margin ~18% dưới ngưỡng 55 phút — KHÔNG phải field User tự set theo từng campaign, để tránh lặp lại đúng kiểu nhầm lẫn đã gây sự cố hôm nay): trần kỹ thuật cho MỖI LẦN dispatch, đảm bảo luôn hoàn tất chắc chắn trước khi chạm watchdog 55 phút.
2. Mỗi lần RUN kỹ thuật (dù thủ công hay tự động) dispatch = `MIN(quota còn thiếu, SAFE_DISPATCH_BATCH_SIZE)` — nhờ vậy hầu như KHÔNG BAO GIỜ chạm watchdog 55 phút nữa (khác với bản v2 trước đó định bỏ hẳn trần và để mỗi lần chạy tận dụng hết 55 phút — User đã quyết định quay lại dùng trần cố định vì đơn giản hơn, tránh phải review lặp đi lặp lại tình huống bị cắt giữa chừng). Cơ chế đọc `partialResults` khi bị cắt (mục 4-6 dưới) vẫn giữ lại làm LƯỚI AN TOÀN DỰ PHÒNG cho trường hợp hiếm/bất thường (proxy treo, trang tải chậm bất thường...), không phải cơ chế vận hành thường xuyên nữa.
3. **Circuit breaker:** 1 lượt chạy trả về lỗi HÀNG LOẠT thật (không có `partialResults` nào — `rawResults.length === 0`, tức lỗi hạ tầng/network, KHÔNG PHẢI chỉ đơn thuần bị cắt ở mốc 55 phút bình thường) → campaign tự chuyển `status = 'Needs Review'`, tắt `auto_run_enabled`, dừng tự động chạy tiếp cho tới khi User xác nhận đã khắc phục.
4. Auto-Scheduler kiểm tra ngẫu nhiên mỗi 1-5 phút (không phải cron cố định 60 phút) xem có được bắn lượt tiếp theo không — khoá chống chồng lượt PHẢI nguyên tử (atomic).
5. Khung giờ chạy: 24/7 suốt cả Start Date/giờ → End Date/giờ, không giới hạn giờ trong ngày ở bản này.
6. Điều kiện dừng: 1 trong 2 cái nào đến trước — (a) đã xử lý đủ số lượng nhóm = Target Quota, hoặc (b) đã hết khung Start-End Date/giờ.
7. **Phát sinh từ câu hỏi của User về nhóm bị cắt giữa chừng — giữ làm lưới an toàn dự phòng (hiếm khi kích hoạt nhờ mục 1-2 ở trên), KHÔNG bắt User phải chủ động review:** phân biệt rõ 3 trạng thái khác nhau cho 1 nhóm sau 1 lượt chạy, thay vì chỉ có Sent/Failed:
   - **`Sent`**: đăng thành công thật.
   - **`Failed`**: script ĐÃ chạy xong hoàn chỉnh cho nhóm này và trả về lỗi thật cụ thể (ví dụ tài khoản bị chặn, nhóm không tồn tại) — coi là "đã xử lý", tính vào Target Quota, KHÔNG cần thử lại nhóm này nữa (trừ khi User tự set lại).
   - **`Not Processed`** (MỚI): nhóm chưa từng được bắt đầu xử lý trong lượt này — KHÔNG tính vào Target Quota, tự động đủ điều kiện thử lại ở lượt sau, giống hệt hành vi Failed hiện tại về mặt retry. (Với `SAFE_DISPATCH_BATCH_SIZE` cố định, trạng thái này giờ chỉ xảy ra khi quota còn thiếu NHIỀU HƠN trần kỹ thuật — tức "còn phần chưa dispatch tới", không phải do bị cắt giữa chừng.)
   - **`Interrupted`** (MỚI, dự phòng cho trường hợp HIẾM/BẤT THƯỜNG — vd 1 job đơn lẻ treo lâu bất thường dù đã có margin an toàn): ĐÚNG 1 nhóm duy nhất (nếu có) đang được xử lý DỞ DANG chính xác tại thời điểm bị `SIGKILL` — không rõ bài đã đăng thật hay chưa (rủi ro đăng trùng nếu tự động thử lại ngay, giống sự cố thật đã từng xảy ra ở execution #956→#961). KHÔNG tính vào Target Quota. Thay vì bắt User chủ động bấm xác nhận mới cho thử lại (bản v2 trước), giờ chỉ cần **tự động áp cooldown dài hơn (3 tiếng) trước khi đủ điều kiện thử lại tự động** + hiển thị badge cảnh báo THÔNG TIN (không chặn, không cần thao tác) trong Run History — giảm phiền cho User trong khi vẫn tránh rủi ro đăng trùng tức thời.

## Kiến trúc & việc cần AG làm

### 1. Schema — `public.campaigns`
```sql
ALTER TABLE campaigns RENAME COLUMN max_posts_per_run TO target_quota; -- giữ nguyên giá trị hiện có (18 cho campaign Accenture) làm quota ban đầu, không mất dữ liệu
ALTER TABLE campaigns
  ADD COLUMN start_time TIME NOT NULL DEFAULT '00:00',
  ADD COLUMN end_time TIME NOT NULL DEFAULT '23:59',
  ADD COLUMN auto_run_enabled BOOLEAN NOT NULL DEFAULT false;
```
Grep lại TOÀN BỘ chỗ dùng tên cột `max_posts_per_run` trong `src/app/campaign_actions.js`, `src/app/components/CampaignEditModal.js`, `src/app/api/webhooks/campaign-data/route.js` và đổi tên biến/field cho khớp `target_quota` — không để sót (đây chính là loại lỗi đặt tên mơ hồ đã gây ra sự cố hôm nay, nên đổi tên PHẢI làm triệt để, không giữ tên cũ ở bất kỳ đâu).

### 2. Schema — `public.campaign_runs`
```sql
ALTER TABLE campaign_runs ADD COLUMN is_systemic_failure BOOLEAN NOT NULL DEFAULT false;
```

### 3. Schema — `public.campaign_run_items`
```sql
ALTER TABLE campaign_run_items ADD COLUMN retry_eligible_at TIMESTAMPTZ NULL;
```
(Dùng cho dòng `status = 'Interrupted'`: tự động set `retry_eligible_at = now() + interval '3 hours'` ngay khi ghi dòng này — nhóm chỉ đủ điều kiện dispatch lại SAU mốc thời gian đó, KHÔNG cần User chủ động xác nhận gì. Với các status khác, cột này để `NULL` (không áp dụng). Không cần thêm cột enum cho `status` — cột này vốn đã là kiểu text tự do, chỉ cần thêm 2 giá trị mới `'Not Processed'` và `'Interrupted'` vào quy ước, không đổi kiểu dữ liệu.)

### 3b. Hằng số hệ thống mới — `SAFE_DISPATCH_BATCH_SIZE`
Thêm 1 hằng số dùng chung (ví dụ export từ `src/app/campaign_actions.js` hoặc đọc từ biến môi trường `SAFE_DISPATCH_BATCH_SIZE` nếu muốn chỉnh không cần deploy lại code) — **mặc định `18`** (đã tính: 18 nhóm × ~2.5 phút/nhóm kịch bản chậm nhất = 45 phút, dư ~10 phút/18% đệm an toàn trước ngưỡng 55 phút `PROCESS_TIMEOUT_MS`). Đây KHÔNG phải field theo từng campaign, KHÔNG hiện trên UI campaign — chỉ AG mới chỉnh khi cần (ví dụ nếu sau này đo lại thời gian thực tế/nhóm khác đi).

### 4. `scripts/run-batch.js` — ghi mốc "ĐANG XỬ LÝ" trước khi spawn, không chỉ ghi sau khi xong
Hiện tại chỉ `fs.appendFileSync(progressFile, ...)` SAU KHI mỗi job xử lý xong. Cần thêm 1 dòng ghi NGAY TRƯỚC khi gọi `spawnSync`:
```js
const startMarker = { groupUrl, groupName, accountId, phase: 'STARTED', startedAt: new Date().toISOString() };
fs.appendFileSync(progressFile, JSON.stringify(startMarker) + '\n', 'utf-8');
// ... spawnSync như cũ ...
// sau khi có kết quả, ghi tiếp dòng phase: 'COMPLETED' như hiện tại (thêm field phase: 'COMPLETED' vào object kết quả đang ghi)
```

### 5. `scripts/bridge-server.js` — đọc `.ndjson`, xác định đúng 1 nhóm `Interrupted`
Trong nhánh xử lý timeout (đọc file `.ndjson` để lấy `partialResults`): với mỗi `groupUrl` có dòng `phase: 'STARTED'` nhưng KHÔNG có dòng `phase: 'COMPLETED'` tương ứng theo sau → thêm vào `partialResults` với `{ success: false, groupUrl, error: 'INTERRUPTED_MID_PROCESSING', interrupted: true }` thay vì bỏ sót hoàn toàn (hiện tại các nhóm không có dòng COMPLETED nào đơn giản là biến mất khỏi `partialResults`, không phân biệt được "chưa tới lượt" với "đang xử lý dở"). Vì xử lý tuần tự, tối đa CHỈ 1 nhóm có thể rơi vào tình huống này mỗi lần bị kill.

### 6. n8n Workflow A (`9W588GooZeZhiSKm`) — `Process Bridge Results`
- Với item trong `rawResults` có `interrupted === true` → `status: 'Interrupted'`, `errorMessage: 'Tiến trình bị dừng đột ngột khi đang xử lý nhóm này — chưa rõ đã đăng thành công hay chưa. Hệ thống tự động chờ 3 tiếng trước khi thử lại để giảm rủi ro đăng trùng; bạn có thể tự kiểm tra trên Facebook nếu muốn nhưng không bắt buộc.'`, kèm field `retryEligibleAt` (ISO string, `now + 3h`) để API ghi vào cột `retry_eligible_at` ở bước lưu `campaign_run_items`.
- Với các nhóm trong `dispatch` KHÔNG xuất hiện trong `rawResults` chút nào (chưa từng tới lượt) → đổi từ `status: 'Failed'` (bản v1 hôm nay) sang **`status: 'Not Processed'`**, giữ nguyên message "Chưa xử lý (tiến trình bridge bị timeout trước khi hoàn tất nhóm này)".
- Giữ nguyên hoàn toàn nhánh xử lý `Sent`/`Failed` thật cho các item có kết quả rõ ràng từ `rawResults`.

### 7. `src/app/campaign_actions.js` — đổi trần cứng theo campaign thành trần hệ thống cố định + giới hạn theo quota còn thiếu
Đổi đoạn cắt cứng hiện tại (khoảng dòng 828-829, đang dùng `campaign.max_posts_per_run`):
```js
if (campaign.max_posts_per_run && campaign.max_posts_per_run > 0 && finalDispatch.length > campaign.max_posts_per_run) {
  finalDispatch = finalDispatch.slice(0, campaign.max_posts_per_run);
}
```
Thay bằng tính "quota còn thiếu" rồi cắt theo CẢ 2 điều kiện — quota còn thiếu VÀ trần an toàn kỹ thuật (mục 3b), lấy số NHỎ HƠN:
```js
const [{ processed_count }] = await sqlClient`
  SELECT COUNT(DISTINCT social_group_id)::int AS processed_count
  FROM campaign_run_items
  WHERE run_id IN (SELECT id FROM campaign_runs WHERE campaign_id = ${campaignId} AND is_systemic_failure = false)
    AND status IN ('Sent', 'Failed')
`;
const quotaRemaining = Math.max(0, (campaign.target_quota || finalDispatch.length) - processed_count);
const dispatchLimit = Math.min(quotaRemaining, SAFE_DISPATCH_BATCH_SIZE);
finalDispatch = finalDispatch.slice(0, dispatchLimit);
```
(Nếu `target_quota` không set (null) → coi như không giới hạn theo quota, nhưng VẪN áp `SAFE_DISPATCH_BATCH_SIZE` — trần kỹ thuật luôn áp dụng bất kể quota, đây là điểm khác biệt quan trọng so với hành vi cũ.)

**Cập nhật điều kiện lọc eligibility (`_getEligibilityState`) — loại nhóm đang `Interrupted` còn trong thời gian cooldown:**
```sql
-- Thêm vào cùng logic đang loại trừ recentSet (status='Sent' trong 24h):
SELECT DISTINCT social_group_id FROM campaign_run_items
WHERE social_group_id = ANY(...)
  AND status = 'Interrupted'
  AND retry_eligible_at > now()
```
Nhóm nằm trong tập này bị loại khỏi danh sách ứng viên dispatch, GIỐNG như nhóm trong `recentSet`, cho tới khi `now() >= retry_eligible_at` (tự động, không cần thao tác gì từ User).

### 8. UI — badge thông tin cho `Interrupted` (không cần action/nút bấm)
Run History / chi tiết campaign hiển thị badge cảnh báo riêng (màu khác hẳn Failed thường, ví dụ vàng cam) cho dòng `status = 'Interrupted'`, kèm tooltip "Đang tự động chờ tới {retry_eligible_at} trước khi thử lại — bạn có thể tự kiểm tra trên Facebook nếu muốn nhưng không bắt buộc". KHÔNG cần server action hay nút bấm nào — cooldown tự hết hạn theo cột `retry_eligible_at`.

### 9. Quota completion check — server action `checkCampaignAutoCompletion(campaignId)`
```sql
SELECT COUNT(DISTINCT csg.social_group_id) AS total_target_pool,
       COUNT(DISTINCT cri.social_group_id) FILTER (WHERE cri.status IN ('Sent','Failed')) AS total_processed
FROM campaign_social_groups csg
LEFT JOIN campaign_run_items cri
  ON cri.social_group_id = csg.social_group_id
  AND cri.run_id IN (SELECT id FROM campaign_runs WHERE campaign_id = ${campaignId} AND is_systemic_failure = false)
WHERE csg.campaign_id = ${campaignId};
```
So sánh `total_processed >= campaign.target_quota` (không phải `total_target_pool` — quota có thể nhỏ hơn tổng nhóm đã liên kết) → nếu đạt, set `is_active = false, auto_run_enabled = false, status = 'Ready'` + notification hoàn tất. **`Not Processed` và `Interrupted` KHÔNG được tính vào `total_processed`** (đã loại đúng vì chỉ lọc `IN ('Sent','Failed')`).

### 10. Circuit breaker (giữ nguyên như bản v1) — `isBridgeLevelFailure`, `campaign-run-callback/route.js`, status `'Needs Review'`
(Không đổi so với bản trước — xem lại phần này ở lịch sử spec nếu cần, cốt lõi: `isBridgeLevelFailure = (rawResults.length === 0)` trong `Process Bridge Results`, TRUYỀN xuyên suốt tới `Build Final Run Summary` → `campaign-run-callback` → set `status='Needs Review'`, tắt `auto_run_enabled`.)

### 11. n8n Workflow mới "E: Campaign Auto-Scheduler" — kiểm tra ngẫu nhiên 1-5 phút, khoá atomic
(Giữ nguyên thiết kế đã chốt — Cron mỗi 1 phút hoặc tương đương, khoá bắt buộc theo mẫu atomic `UPDATE ... WHERE ... AND NOT EXISTS (SELECT 1 FROM campaign_runs WHERE status='Running') RETURNING id`, endpoint `GET /api/webhooks/auto-run-eligible-campaigns` liệt kê ứng viên + `POST /api/webhooks/auto-trigger-campaign-run` giành khoá và dispatch.)

### 12. UI
- `CampaignEditModal.js`: đổi label "Max Posts Per Run" → **"Target Quota"** kèm mô tả rõ "Tổng số nhóm campaign này cần đạt được (không phải giới hạn kỹ thuật mỗi lần chạy)"; thêm time picker cho Start/End; thêm toggle "Enable Auto-Scheduler".
- `campaigns/page.js` / Run History: badge riêng cho `Not Processed` (trung tính, "sẽ tự thử lại") và `Interrupted` (cảnh báo, kèm nút xác nhận đã kiểm tra).

## Yêu cầu verify (bắt buộc, đầy đủ — không được bỏ mục nào)
1. Test campaign nhỏ (nhóm test cô lập) với Target Quota nhỏ (ví dụ 3) → xác nhận dừng đúng khi đạt quota, không chạy thêm dù còn nhóm khác chưa xử lý.
2. Test kịch bản "hết giờ trước khi hết quota" (Start-End Date ngắn hơn thời gian cần) → dừng đúng lúc hết giờ, phần chưa xử lý giữ nguyên `Not Processed`, không tự đánh dấu giả.
3. Test riêng race-condition: bắn đồng thời 2-3 lần `POST /api/webhooks/auto-trigger-campaign-run` cho CÙNG 1 campaign trong < 1 giây → chỉ đúng 1 lượt thắng khoá atomic, không có 2 `campaign_runs` Running song song.
4. **Test riêng cơ chế Interrupted (lưới an toàn dự phòng — vẫn bắt buộc verify code đúng, dù kỳ vọng hiếm gặp trong thực tế):** hạ tạm `BRIDGE_TIMEOUT_MS` xuống mức đủ để cắt ngang ĐÚNG LÚC 1 nhóm đang xử lý (test trên môi trường test/staging, KHÔNG làm trên production) → xác nhận: (a) đúng 1 nhóm được đánh dấu `Interrupted` (không phải `Not Processed` hay `Failed`), (b) `retry_eligible_at` được set đúng `now + 3h`, (c) nhóm đó KHÔNG xuất hiện trong danh sách ứng viên dispatch cho tới khi qua mốc đó, (d) test riêng với `SAFE_DISPATCH_BATCH_SIZE` ở giá trị bình thường (18) và số nhóm dispatch bình thường (≤18, không cố tình set quá tải) → xác nhận KHÔNG BAO GIỜ chạm timeout trong điều kiện vận hành thường (đây là mục đích chính của trần kỹ thuật, quan trọng hơn cả việc test tình huống hiếm).
5. Test mô phỏng systemic failure (lỗi 504 không có `partialResults` nào) → `Needs Review` kích hoạt, `auto_run_enabled` tự tắt, không tính bất kỳ nhóm nào là đã xử lý.
6. Test campaign KHÔNG bật `auto_run_enabled` — xác nhận bấm Run thủ công vẫn hoạt động đúng với logic dispatch-theo-quota mới (không còn field `max_posts_per_run` cũ).
7. `npm run build` PASS 100%. Grep lại toàn bộ `max_posts_per_run` trong code để chắc chắn không còn sót tên cũ.
