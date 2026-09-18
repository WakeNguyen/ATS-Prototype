**Từ:** Claude (Architect/QA)

# FIX_SPEC_2026-09-15 — Xóa hẳn bộ đếm Failed cũ (đã thừa, gây bug chặn lại account vừa tick lại)

## Bối cảnh

PO tự kiểm tra Nick Chính trên Facebook, tick lại vào WINPRO qua Edit Modal, Save — nhưng Dispatch Preview vẫn báo `No Active Account`. Nguyên nhân: spec trước (`FIX_SPEC_2026-09-15_campaigns_circuit-breaker-auto-untick-and-block-fallback.md`) giữ lại `_getDisabledAccountIdsForJobCampaign`/`_getDisabledAccountIdsForWarmingCampaign` (đếm TOÀN BỘ lịch sử `Failed`, không mốc thời gian) làm "lớp bảo vệ thứ 2" — nhưng lớp này lập tức loại account vừa tick lại vì lịch sử Failed cũ vẫn còn nguyên trong `campaign_run_items`/`warm_join_run_items`.

PO chỉ ra đúng: logic nên đơn giản — **account fail ≥3 lần → bị untick THẬT khỏi `campaign_fb_accounts` (đã có, spec trước) → 0 account nào còn được gán → full stop**. Một khi việc gỡ là THẬT (vật lý), việc đếm lại Failed để lọc thêm 1 lần nữa ở nơi khác là **THỪA** — chính cái thừa đó gây ra bug (double-jeopardy: account dù được gán lại vẫn bị lọc theo lịch sử cũ).

**Quyết định:** XÓA HẲN `_getDisabledAccountIdsForJobCampaign` và `_getDisabledAccountIdsForWarmingCampaign` (2 hàm + cả 3 nơi gọi) thay vì vá bằng mốc thời gian như spec bug-fix trước đã dự định (spec đó đã bị huỷ, không triển khai). `campaign_fb_accounts` (đã bị `_maybeTripCircuitBreaker` xóa dòng thật khi trip) giờ là NGUỒN XÁC ĐỊNH DUY NHẤT cho "account này còn được gán cho campaign này không" — không cần lớp lọc thứ 2 nào khác.

## Phạm vi (1 file)

`src/app/campaign_actions.js`

## Việc cần làm

### 1. Xóa 2 hàm helper (dòng 654-680)

Xóa toàn bộ khối sau (bao gồm cả 2 dòng comment phía trên mỗi hàm):
```js
// Job Posting: đếm Failed items của account này, chỉ tính trong các run thuộc campaign này
async function _getDisabledAccountIdsForJobCampaign(campaignId, sqlClient) {
  const rows = await sqlClient`
    SELECT fb_account_id
    FROM campaign_run_items
    WHERE run_id IN (SELECT id FROM campaign_runs WHERE campaign_id = ${campaignId})
      AND status = 'Failed'
      AND fb_account_id IS NOT NULL
    GROUP BY fb_account_id
    HAVING COUNT(*) >= 3
  `;
  return rows.map(r => r.fb_account_id);
}

// Warming: đếm action='Failed' trong warm_join_run_items, chỉ tính trong các run thuộc campaign này
async function _getDisabledAccountIdsForWarmingCampaign(campaignId, sqlClient) {
  const rows = await sqlClient`
    SELECT fb_account_id
    FROM warm_join_run_items
    WHERE run_id IN (SELECT id FROM warm_join_runs WHERE campaign_id = ${campaignId})
      AND action = 'Failed'
      AND fb_account_id IS NOT NULL
    GROUP BY fb_account_id
    HAVING COUNT(*) >= 3
  `;
  return rows.map(r => r.fb_account_id);
}
```
(Dòng `/**` ngay sau đó — đầu JSDoc của `_getEligibilityState` — GIỮ NGUYÊN, không xóa nhầm.)

### 2. `_getEligibilityState` (dòng ~807-811) — Xóa filter thừa

Đổi từ:
```js
  // Filter out accounts disabled due to 3+ failures in this campaign (Circuit Breaker)
  const disabledAccountIds = await _getDisabledAccountIdsForJobCampaign(campaignId, sqlClient);
  for (const disabledId of disabledAccountIds) {
    accountState.delete(disabledId);
  }

```
thành: XÓA HẲN cả khối trên (kể cả dòng trống sau nó nếu tạo 2 dòng trống liên tiếp — giữ đúng 1 dòng trống giữa đoạn build `accountState` và đoạn `// 5. Fetch Account Joined Groups Map` phía sau).

### 3. `checkWarmingCampaignAutoCompletion` (dòng ~1429-1437) — Xóa filter thừa

Đổi từ:
```js
    // 2. Tính: còn nick nào ENABLED (chưa disabled) mà CHƯA join hết group không?
    const disabledIds = await _getDisabledAccountIdsForWarmingCampaign(campaignId, sqlClient);

    const [{ remaining_work }] = await sqlClient`
      SELECT COUNT(*)::int AS remaining_work
      FROM campaign_fb_accounts cfa
      CROSS JOIN campaign_social_groups csg
      WHERE cfa.campaign_id = ${campaignId} AND csg.campaign_id = ${campaignId}
        ${disabledIds.length > 0 ? sqlClient`AND cfa.fb_account_id != ALL(${disabledIds})` : sqlClient``}
        AND NOT EXISTS (
```
thành:
```js
    // 2. Tính: còn account nào trong campaign_fb_accounts (đã tự loại account bị breaker
    // gỡ — vì _maybeTripCircuitBreaker xóa dòng gán thật rồi) mà CHƯA join hết group không?
    const [{ remaining_work }] = await sqlClient`
      SELECT COUNT(*)::int AS remaining_work
      FROM campaign_fb_accounts cfa
      CROSS JOIN campaign_social_groups csg
      WHERE cfa.campaign_id = ${campaignId} AND csg.campaign_id = ${campaignId}
        AND NOT EXISTS (
```
(Phần còn lại của câu SQL — `SELECT 1 FROM fb_account_groups fag WHERE ...` — GIỮ NGUYÊN không đổi.)

### 4. Warming resolve targetAccounts (dòng ~2040-2045) — Xóa filter thừa

Đổi từ:
```js
    // Filter out accounts disabled due to 3+ failures in this Warming campaign (Circuit Breaker)
    if (resolvedCampaignId) {
      const disabledWarmingAccountIds = await _getDisabledAccountIdsForWarmingCampaign(resolvedCampaignId, sqlTx);
      if (disabledWarmingAccountIds.length > 0) {
        targetAccounts = targetAccounts.filter(a => !disabledWarmingAccountIds.includes(a.id));
      }
    }

```
thành: XÓA HẲN cả khối trên.

**Lưu ý về 1 edge case đã cân nhắc, KHÔNG cần xử lý thêm:** Nhánh `targetAccounts` được gọi bằng `accountIds` chỉ định thẳng (dòng ~2013-2019, không qua `campaign_fb_accounts`) vốn đã bỏ qua toàn bộ ràng buộc assignment theo campaign từ trước (chỉ check `status = 'Active'`) — việc xóa filter breaker ở đây không tạo ra lỗ hổng MỚI, chỉ đơn thuần không mở rộng phạm vi breaker ra nhánh vốn đã không tôn trọng phạm vi campaign. Không cần sửa gì thêm cho nhánh này.

## Việc KHÔNG được làm

- KHÔNG đụng bảng `campaign_account_circuit_breaker_log` hay `_maybeTripCircuitBreaker` — giữ nguyên như spec trước (cơ chế gỡ thật + chặn fallback vẫn đúng, chỉ bỏ lớp lọc phụ thừa).
- KHÔNG đụng 2 webhook (`campaign-run-progress/route.js`, `warm-join-run-progress/route.js`) — không cần sửa gì ở đó cho fix này (lưu ý: nếu sandbox hiện đang có diff dở dang từ vòng trước ở 2 file này, đối chiếu với git log/diff thật, không giả định — nhưng theo thiết kế mới, 2 file này giữ nguyên y hệt sau khi spec trước deploy, không có thay đổi nào áp dụng thêm cho fix lần này).
- KHÔNG đổi ngưỡng `>= 3` hay bất kỳ logic nào của `_maybeTripCircuitBreaker`.

## Verify bắt buộc

1. `node --check src/app/campaign_actions.js` → PASS.
2. `git diff --stat` → đúng 1 file (+ doc).
3. `grep -rn "_getDisabledAccountIdsForJobCampaign\|_getDisabledAccountIdsForWarmingCampaign" src/` → PHẢI trả về rỗng (không còn tồn tại ở đâu, kể cả định nghĩa).
4. Test thật trong `sandbox` (tự tạo dữ liệu test, dọn sau khi xong):
   - Tạo campaign Job Posting, gán 1 account, làm Failed đủ 3 lần → xác nhận account bị gỡ thật khỏi `campaign_fb_accounts` + có log (hành vi từ spec trước, vẫn phải đúng).
   - **Tick lại đúng account đó vào campaign** (qua `setCampaignAssignedAccounts`) → gọi `computeCampaignDispatchPreview`/`_getEligibilityState` cho campaign đó → xác nhận account đó **XUẤT HIỆN LẠI** trong `eligibleAccounts`, KHÔNG còn bị chặn bởi lịch sử Failed cũ (đây là điểm chính cần fix, PASS mới coi là xong).
   - Cho account đó Failed thêm 3 lần NỮA (sau khi tick lại) → xác nhận `_maybeTripCircuitBreaker` vẫn trip lại đúng (webhook tự đếm lại — dùng đúng logic đếm hiện có của webhook, KHÔNG đổi ở fix này — và gỡ account lần 2).
   - Lặp lại tương tự cho Warming (tick lại account đã bị gỡ → `_acquireWarmJoinRunLock`/warming resolve phải thấy lại account đó).
   - Test campaign nhiều account: account A bị gỡ, account B vẫn hoạt động bình thường (không bị ảnh hưởng bởi việc xóa filter).
   - Dọn dữ liệu test.
5. `/api/biz-test` + `/api/qa-test` → PASS 100%.
6. `npm run build` → PASS 100%.

## Yêu cầu tài liệu

Thêm mục mới vào `docs/DEVELOPMENT_LOG.md` theo template mục 10.3 GEMINI.md — ghi rõ đây là fix thay thế hướng tiếp cận ban đầu (PO chỉ ra bộ đếm cũ hoàn toàn thừa, không cần vá mốc thời gian).

## Quy ước xử lý khi phát hiện lệch spec hoặc không rõ ràng

- Lệch nhỏ → tự sửa, ghi chú, KHÔNG dừng.
- Đụng database/API/quyết định sản phẩm ngoài phạm vi → DỪNG NGAY, in `ESCALATE: <mô tả>`.
- Chỉ cần hỏi 1 chi tiết kỹ thuật nhỏ → in `QUESTION: <câu hỏi>` rồi dừng.
