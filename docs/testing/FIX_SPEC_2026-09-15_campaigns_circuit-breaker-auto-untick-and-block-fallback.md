**Từ:** Claude (Architect/QA)

# FIX_SPEC_2026-09-15 — Circuit breaker tự gỡ account khỏi campaign (thật) + chặn fallback khi đã bị gỡ

## Bối cảnh

PO phát hiện qua vụ campaign WINPRO không chạy được: cơ chế "circuit breaker" (≥3 `Failed` trong 1 campaign → account bị loại khỏi danh sách khả dụng, xem `_getDisabledAccountIdsForJobCampaign`/`_getDisabledAccountIdsForWarmingCampaign`) hiện **CHỈ lọc ngầm lúc tính eligibility** (`_getEligibilityState`, warming resolve block) — KHÔNG đụng vào bảng gán thật (`campaign_fb_accounts`). Hậu quả: mở Campaign Edit Modal, checkbox account vẫn tick, vẫn đếm "(N selected)" như chưa có gì xảy ra — PO hoàn toàn không có tín hiệu UI nào để biết account đã bị khóa, phải đi soi database mới phát hiện ra.

PO xác nhận mental model ban đầu khi thiết kế tính năng này là: **account bị breaker phải tự "untick" thật (gỡ khỏi assignment)**, PO tự tick lại khi đã xử lý xong vấn đề của account đó trên Facebook. Quyết định cuối: làm ĐÚNG vậy — gỡ thật khỏi `campaign_fb_accounts` ngay khi trip + **chặn hành vi fallback "dùng tất cả account Active khác"** cho campaign đó (để tránh campaign âm thầm đổi sang dùng account khác ngoài ý định ban đầu của PO chỉ vì vừa bị gỡ hết account được chỉ định).

**Áp dụng cho cả Job Posting VÀ Warming** (PO đã xác nhận) — 2 cơ chế breaker riêng biệt nhưng cùng chung bảng gán `campaign_fb_accounts`.

## Hạ tầng đã chuẩn bị (Claude đã làm, không cần AG làm lại)

Đã tạo bảng mới trong `sandbox` (infra exception, PO đã uỷ quyền qua quyết định thực thi spec này):

```sql
CREATE TABLE sandbox.campaign_account_circuit_breaker_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES sandbox.campaigns(id) ON DELETE CASCADE,
  fb_account_id uuid NOT NULL REFERENCES sandbox.fb_accounts(id) ON DELETE CASCADE,
  trigger_type text NOT NULL CHECK (trigger_type IN ('job_posting','warming')),
  failed_count int NOT NULL,
  disabled_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (campaign_id, fb_account_id)
);
```

**Ý nghĩa bảng:** là audit log — mỗi dòng nghĩa là "account này đã từng bị breaker tự gỡ khỏi campaign này". Sự TỒN TẠI của 1 dòng cho `(campaign_id, fb_account_id)` nào đó → chặn fallback "dùng tất cả account Active" cho đúng campaign đó, đến khi PO tự tay gán lại account (không cần xoá log — add lại account qua UI là đủ để campaign chạy lại bình thường, log vẫn giữ để tra lịch sử).

AG KHÔNG tự tạo bảng (không có quyền CREATE trên sandbox) — bảng đã có sẵn, chỉ cần dùng.

## Phạm vi (5 file)

1. `src/app/campaign_actions.js`
2. `src/app/api/webhooks/campaign-run-progress/route.js`
3. `src/app/api/webhooks/warm-join-run-progress/route.js`
4. `src/app/components/CampaignEditModal.js`
5. `src/app/components/CampaignDispatchPreviewModal.js`

## Việc cần làm

### 1. `campaign_actions.js` — Helper dùng chung để trip breaker

Thêm hàm mới ngay sau `_getDisabledAccountIdsForWarmingCampaign` (sau dòng 671), export để 2 webhook route dùng được:

```js
/**
 * Nếu failedCount >= 3: gỡ thật account khỏi campaign_fb_accounts (circuit breaker),
 * ghi log vào campaign_account_circuit_breaker_log để _getEligibilityState / warming
 * resolve biết mà CHẶN fallback "dùng tất cả account Active" cho đúng campaign này.
 * Gọi trong CÙNG transaction với insert item Failed vừa ghi.
 */
export async function _maybeTripCircuitBreaker(sqlTx, campaignId, fbAccountId, failedCount, triggerType) {
  if (!campaignId || !fbAccountId || failedCount < 3) return;

  const deleted = await sqlTx`
    DELETE FROM campaign_fb_accounts
    WHERE campaign_id = ${campaignId} AND fb_account_id = ${fbAccountId}
    RETURNING fb_account_id
  `;

  if (deleted.length > 0) {
    await sqlTx`
      INSERT INTO campaign_account_circuit_breaker_log (campaign_id, fb_account_id, trigger_type, failed_count, disabled_at)
      VALUES (${campaignId}, ${fbAccountId}, ${triggerType}, ${failedCount}, now())
      ON CONFLICT (campaign_id, fb_account_id) DO UPDATE SET
        failed_count = EXCLUDED.failed_count,
        disabled_at = EXCLUDED.disabled_at,
        trigger_type = EXCLUDED.trigger_type
    `;
  }
}
```

**Lưu ý quan trọng:** hàm này KHÔNG tự tính `failedCount` — caller (webhook) phải tự query đếm TRƯỚC khi gọi (xem mục 2, 3 dưới). Lý do tách riêng: để hàm test được độc lập, không phụ thuộc schema bảng nào khác ngoài 2 bảng nó trực tiếp đụng.

### 2. `_getEligibilityState` (dòng 702-716) — Chặn fallback khi đã có log breaker

Đổi từ:
```js
  let eligibleAccounts = await sqlClient`
    SELECT fa.id, fa.account_name, fa.account_ref, fa.daily_quota, fa.status, fa.proxy_url, fa.reset_ip_url, fa.allow_post_without_join
    FROM campaign_fb_accounts cfa
    JOIN fb_accounts fa ON cfa.fb_account_id = fa.id
    WHERE cfa.campaign_id = ${campaignId} AND fa.status = 'Active'
  `;

  if (eligibleAccounts.length === 0) {
    eligibleAccounts = await sqlClient`
      SELECT id, account_name, account_ref, daily_quota, status, proxy_url, reset_ip_url, allow_post_without_join
      FROM fb_accounts
      WHERE status = 'Active'
    `;
  }
```
thành:
```js
  let eligibleAccounts = await sqlClient`
    SELECT fa.id, fa.account_name, fa.account_ref, fa.daily_quota, fa.status, fa.proxy_url, fa.reset_ip_url, fa.allow_post_without_join
    FROM campaign_fb_accounts cfa
    JOIN fb_accounts fa ON cfa.fb_account_id = fa.id
    WHERE cfa.campaign_id = ${campaignId} AND fa.status = 'Active'
  `;

  if (eligibleAccounts.length === 0) {
    // Chỉ fallback sang "tất cả account Active" nếu campaign này CHƯA TỪNG bị circuit
    // breaker tự gỡ account — tránh campaign âm thầm đổi sang account khác ngoài ý định
    // PO chỉ vì vừa bị gỡ hết account được chỉ định (PO quyết định 2026-09-15).
    const breakerHit = await sqlClient`
      SELECT 1 FROM campaign_account_circuit_breaker_log WHERE campaign_id = ${campaignId} LIMIT 1
    `;
    if (breakerHit.length === 0) {
      eligibleAccounts = await sqlClient`
        SELECT id, account_name, account_ref, daily_quota, status, proxy_url, reset_ip_url, allow_post_without_join
        FROM fb_accounts
        WHERE status = 'Active'
      `;
    }
  }
```

(Dòng 763-767 — filter `_getDisabledAccountIdsForJobCampaign` khỏi `accountState` — GIỮ NGUYÊN, không xoá. Giờ đây đa phần sẽ là no-op vì account đã bị gỡ thật khỏi `campaign_fb_accounts` nên không còn xuất hiện trong `eligibleAccounts` nữa — nhưng giữ lại làm lớp bảo vệ thứ 2, phòng trường hợp dữ liệu Failed cũ từ TRƯỚC khi tính năng này tồn tại.)

### 3. Warming resolve block (dòng ~1955-1971) — Chặn fallback tương tự

Đổi từ:
```js
    } else if (resolvedCampaignId) {
      targetAccounts = await sqlTx`
        SELECT fa.id, fa.account_name, fa.account_ref, fa.proxy_url, fa.reset_ip_url, fa.status, fa.last_warmed_at
        FROM campaign_fb_accounts cfa
        JOIN fb_accounts fa ON cfa.fb_account_id = fa.id
        WHERE cfa.campaign_id = ${resolvedCampaignId} AND fa.status = 'Active'
        ORDER BY fa.last_warmed_at ASC NULLS FIRST
      `;

      if (targetAccounts.length === 0) {
        targetAccounts = await sqlTx`
          SELECT id, account_name, account_ref, proxy_url, reset_ip_url, status, last_warmed_at
          FROM fb_accounts
          WHERE status = 'Active'
          ORDER BY last_warmed_at ASC NULLS FIRST
        `;
      }
    } else {
```
thành:
```js
    } else if (resolvedCampaignId) {
      targetAccounts = await sqlTx`
        SELECT fa.id, fa.account_name, fa.account_ref, fa.proxy_url, fa.reset_ip_url, fa.status, fa.last_warmed_at
        FROM campaign_fb_accounts cfa
        JOIN fb_accounts fa ON cfa.fb_account_id = fa.id
        WHERE cfa.campaign_id = ${resolvedCampaignId} AND fa.status = 'Active'
        ORDER BY fa.last_warmed_at ASC NULLS FIRST
      `;

      if (targetAccounts.length === 0) {
        const breakerHit = await sqlTx`
          SELECT 1 FROM campaign_account_circuit_breaker_log WHERE campaign_id = ${resolvedCampaignId} LIMIT 1
        `;
        if (breakerHit.length === 0) {
          targetAccounts = await sqlTx`
            SELECT id, account_name, account_ref, proxy_url, reset_ip_url, status, last_warmed_at
            FROM fb_accounts
            WHERE status = 'Active'
            ORDER BY last_warmed_at ASC NULLS FIRST
          `;
        }
      }
    } else {
```

### 4. `getCampaignDetail` (dòng 198-212 khu vực `assignedAccounts`) — Trả thêm log breaker cho UI

Thêm ngay sau block `assignedAccounts`/`maskedAssignedAccounts` (sau dòng 218), TRƯỚC `let runs = []`:
```js
    const circuitBreakerLog = await sql`
      SELECT cbl.fb_account_id, fa.account_name, cbl.failed_count, cbl.disabled_at, cbl.trigger_type
      FROM campaign_account_circuit_breaker_log cbl
      JOIN fb_accounts fa ON fa.id = cbl.fb_account_id
      WHERE cbl.campaign_id = ${id}
      ORDER BY cbl.disabled_at DESC
    `;
```
Và thêm `circuitBreakerLog` vào object trả về (`return { success: true, data: { campaign, targetGroups, assignedAccounts: maskedAssignedAccounts, runs, circuitBreakerLog } }`).

### 5. `computeCampaignDispatchPreview` — Trả thêm log breaker vào `stats`

Thêm query tương tự ngay sau lấy `campaign` (sau dòng 815, trước gọi `_getEligibilityState`):
```js
    const circuitBreakerLog = await sql`
      SELECT fa.account_name, cbl.failed_count
      FROM campaign_account_circuit_breaker_log cbl
      JOIN fb_accounts fa ON fa.id = cbl.fb_account_id
      WHERE cbl.campaign_id = ${campaignId}
      ORDER BY cbl.disabled_at DESC
    `;
```
Thêm field `circuitBreakerRemovedAccounts: circuitBreakerLog` vào CẢ 2 object `stats` trả về trong hàm này: nhánh early-return khi `totalInCampaign === 0` (khoảng dòng 829-835) và object `stats` chính (khoảng dòng 934-945).

### 6. `campaign-run-progress/route.js` — Trip breaker khi ghi nhận Failed (Job Posting)

Sau bước "1. Insert item record" (sau dòng 56, trước "2. If Checkpoint..."), thêm:
```js
      // 1b. Circuit breaker: nếu Failed, đếm lại tổng Failed của account này TRONG campaign
      // này, trip (gỡ thật khỏi campaign_fb_accounts + log) nếu đã >= 3.
      if (status === 'Failed' && fbAccountId) {
        const [{ campaign_id: breakerCampaignId }] = await sqlTx`
          SELECT campaign_id FROM campaign_runs WHERE id = ${runId}
        `;
        const [{ cnt: failedCount }] = await sqlTx`
          SELECT COUNT(*)::int AS cnt
          FROM campaign_run_items
          WHERE run_id IN (SELECT id FROM campaign_runs WHERE campaign_id = ${breakerCampaignId})
            AND fb_account_id = ${fbAccountId} AND status = 'Failed'
        `;
        await _maybeTripCircuitBreaker(sqlTx, breakerCampaignId, fbAccountId, failedCount, 'job_posting');
      }
```
Import thêm `_maybeTripCircuitBreaker` từ `campaign_actions.js` ở đầu file.

### 7. `warm-join-run-progress/route.js` — Trip breaker khi ghi nhận Failed (Warming)

Sau khi `run` được SELECT (sau dòng 137, TRƯỚC `if (run && run.notification_id)` — vì cần chạy bất kể có notification_id hay không), thêm:
```js
      // Circuit breaker: nếu lượt này có bất kỳ action='Failed' nào (account-level hoặc
      // group-level) của fbAccountId, đếm lại tổng Failed của account này TRONG campaign
      // này, trip (gỡ thật khỏi campaign_fb_accounts + log) nếu đã >= 3.
      const hasFailedThisCall = accountAction === 'Failed' || groupItems.some(g => g.action === 'Failed');
      if (hasFailedThisCall && fbAccountId && run?.campaign_id) {
        const [{ cnt: failedCount }] = await sqlTx`
          SELECT COUNT(*)::int AS cnt
          FROM warm_join_run_items
          WHERE run_id IN (SELECT id FROM warm_join_runs WHERE campaign_id = ${run.campaign_id})
            AND fb_account_id = ${fbAccountId} AND action = 'Failed'
        `;
        await _maybeTripCircuitBreaker(sqlTx, run.campaign_id, fbAccountId, failedCount, 'warming');
      }
```
Import thêm `_maybeTripCircuitBreaker` từ `campaign_actions.js` ở đầu file.

**Lưu ý đếm Failed cho Warming:** `warm_join_run_items` không phân biệt social_group_id NULL (account-level) hay có giá trị (group-level) khi đếm — query trên đếm CẢ 2 loại, ĐÚNG như logic gốc `_getDisabledAccountIdsForWarmingCampaign` (dòng 660-671) đang làm — không đổi ngưỡng/logic đếm, chỉ thêm hành động trip.

### 8. `CampaignEditModal.js` — Hiện cảnh báo account đã bị breaker gỡ

Thêm state mới cạnh các state khác (gần chỗ khai báo `availableAccounts`): `const [circuitBreakerLog, setCircuitBreakerLog] = useState([]);`

Trong block load detail (gần dòng 196, cạnh `const assignedAccs = ...`), thêm: `const breakerLog = detailRes.data.circuitBreakerLog || [];` rồi `setCircuitBreakerLog(breakerLog);` (đặt cạnh các `setXxx` khác trong cùng block).

Trong JSX, giữa label row (dòng 913, kết thúc `</div>` của header) và account list box (dòng 914, mở `<div className="border border-slate-800...`), thêm:
```jsx
                {circuitBreakerLog.length > 0 && (
                  <div className="p-2.5 bg-amber-500/10 border border-amber-500/30 rounded-lg text-amber-300 text-[11px] space-y-1">
                    <div className="font-semibold flex items-center gap-1.5">
                      <AlertTriangle size={12} /> Auto-removed due to repeated failures
                    </div>
                    {circuitBreakerLog.map((entry) => (
                      <div key={entry.fb_account_id}>
                        {entry.account_name} — {entry.failed_count} failed items. Check this account on Facebook before re-adding it to the pool below.
                      </div>
                    ))}
                  </div>
                )}
```
Nếu `AlertTriangle` chưa import từ `lucide-react` trong file này, thêm vào import line hiện có.

### 9. `CampaignDispatchPreviewModal.js` — Hiện tên account bị breaker gỡ cạnh lý do "No target groups eligible"

Đổi từ (dòng 264-267):
```jsx
                {dispatchList.length === 0 ? (
                  <div className="p-6 text-center bg-slate-950/40 rounded-lg border border-slate-800 text-slate-500">
                    No target groups are currently eligible for dispatch. (All target groups may be in 24h cooldown or lack active FB accounts).
                  </div>
                ) : (
```
thành:
```jsx
                {dispatchList.length === 0 ? (
                  <div className="p-6 text-center bg-slate-950/40 rounded-lg border border-slate-800 text-slate-500 space-y-2">
                    <div>No target groups are currently eligible for dispatch. (All target groups may be in 24h cooldown or lack active FB accounts).</div>
                    {stats?.circuitBreakerRemovedAccounts?.length > 0 && (
                      <div className="text-amber-400 text-[11px]">
                        ⚠️ Auto-removed due to repeated failures: {stats.circuitBreakerRemovedAccounts.map(a => `${a.account_name} (${a.failed_count} failed)`).join(', ')} — add a different account to resume.
                      </div>
                    )}
                  </div>
                ) : (
```

## Việc KHÔNG được làm

- KHÔNG tự `CREATE TABLE` — bảng `campaign_account_circuit_breaker_log` đã có sẵn trong sandbox.
- KHÔNG đổi ngưỡng `>= 3` hay cách đếm Failed hiện có (giữ đúng `_getDisabledAccountIdsForJobCampaign`/`_getDisabledAccountIdsForWarmingCampaign` — 2 hàm này GIỮ NGUYÊN, không xoá, không sửa, chỉ thêm cơ chế mới song song).
- KHÔNG tự động xoá dòng trong `campaign_account_circuit_breaker_log` ở bất kỳ đâu trong code — log chỉ mất khi PO tự xoá tay qua DB (không có UI xoá log trong phạm vi spec này).
- KHÔNG thêm nút "Reset"/"Re-enable" trong UI — phạm vi spec này CHỈ là: tự gỡ thật + chặn fallback + hiện cảnh báo. PO re-enable bằng cách tự tick lại account trong Edit Modal (hành vi UI Select/Deselect đã có sẵn, không cần sửa gì thêm).

## Verify bắt buộc

1. `node --check` cả 5 file → PASS.
2. `git diff --stat` → đúng 5 file (+ doc).
3. Test thật trong `sandbox` (tự tạo dữ liệu test riêng, dọn sau khi xong — theo mục 10.8 GEMINI.md):
   - Tạo 1 campaign Job Posting test, gán ĐÚNG 1 FB account test (status Active) làm account duy nhất.
   - Gọi webhook `campaign-run-progress` 3 lần với `status: 'Failed'` cho đúng account/run đó (qua `curl`/Postman tới `http://localhost:3000/api/webhooks/campaign-run-progress` với header `x-internal-secret` đúng `INTERNAL_WEBHOOK_SECRET`, body `environment: 'sandbox'`).
   - Sau lần thứ 3: query `sandbox.campaign_fb_accounts` xác nhận dòng gán đã bị xoá; query `sandbox.campaign_account_circuit_breaker_log` xác nhận có 1 dòng mới đúng `failed_count=3`.
   - Mở Campaign Edit Modal campaign test đó → xác nhận thấy cảnh báo amber đúng tên account + "3 failed items".
   - Mở Dispatch Preview Modal → xác nhận "No target groups eligible" kèm dòng cảnh báo tên account, và `skippedNoAccountAvailable` KHÔNG fallback sang account Active khác (nếu sandbox có sẵn account Active khác, xác nhận nó KHÔNG được dùng).
   - Lặp lại kịch bản tương tự cho Warming (`warm-join-run-progress`, action='Failed' x3 cho 1 account trong 1 campaign Warming test chỉ gán account đó).
   - Dọn toàn bộ dữ liệu test (campaign, run, items, log row) sau khi verify xong.
4. `/api/biz-test` + `/api/qa-test` → PASS 100%, không regression (đặc biệt chú ý trường hợp campaign có NHIỀU account gán — breaker chỉ gỡ ĐÚNG account bị lỗi, các account khác trong cùng campaign không bị ảnh hưởng).
5. `npm run build` → PASS 100%.

## Yêu cầu tài liệu

Thêm mục mới vào `docs/DEVELOPMENT_LOG.md` theo template mục 10.3 GEMINI.md. Cập nhật `docs/architecture/schema-map.md` phần liên quan `campaign_fb_accounts`/circuit breaker nếu file đó đang mô tả cơ chế cũ (Claude sẽ tự đối chiếu lại khi QA, nhưng nếu AG thấy rõ cần sửa ngay, có thể note trong báo cáo để Claude duyệt).

Báo cáo hoàn thành kèm `git status`, `git diff --stat`, `npm run build`, và mô tả cụ thể quan sát được ở test Job Posting + Warming (không ghi "PASS" suông).

## Quy ước xử lý khi phát hiện lệch spec hoặc không rõ ràng

- Lệch nhỏ → tự sửa, ghi chú, KHÔNG dừng.
- Đụng database/API/quyết định sản phẩm ngoài phạm vi → DỪNG NGAY, in `ESCALATE: <mô tả>`.
- Chỉ cần hỏi 1 chi tiết kỹ thuật nhỏ → in `QUESTION: <câu hỏi>` rồi dừng.
