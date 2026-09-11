# FIX_SPEC (HOTFIX KHẨN CẤP) — 2026-09-08 — `postsToday is not defined` chặn đứng toàn bộ Preview & Dispatch, do sót 1 dòng khi bỏ Daily Quota

**Mức độ ưu tiên: KHẨN CẤP — chặn đứng hoàn toàn tính năng "Run Campaign" của MỌI campaign (không campaign nào chạy được lúc này).**
**Lỗi này do spec `FIX_SPEC_2026-09-07_remove-daily-post-quota-enforcement.md` (của Claude) thiếu sót — chỉ nói "đổi remainingQuota, không cần sửa gì thêm" nhưng không kiểm tra hết các nơi biến `postsToday` được dùng. Xin lỗi vì spec trước chưa đủ kỹ.**

## Root cause
File `src/app/campaign_actions.js`, hàm `_getEligibilityState`, dòng ~625-637:

```js
const todayPostsMap = new Map(todayPosts.map(tp => [tp.fb_account_id, tp.count]));

const accountState = new Map();
for (const acc of eligibleAccounts) {
  // Daily Post Quota enforcement removed per User request (2026-09-07 FIX_SPEC)
  const remainingQuota = Number.MAX_SAFE_INTEGER;
  accountState.set(acc.id, {
    ...acc,
    postsToday,          // <-- BUG: biến "postsToday" ĐÃ BỊ XOÁ khai báo, không còn tồn tại trong scope này
    remainingQuota,
    assignedThisRun: 0
  });
}
```

Khi sửa fix bỏ quota, dòng khai báo cũ `const postsToday = todayPostsMap.get(acc.id) || 0;` đã bị xoá (vì tưởng chỉ dùng để tính `remainingQuota`), nhưng biến `postsToday` **VẪN được dùng ở 2 chỗ khác**:
1. Dòng ~634: lưu vào `accountState` (object shorthand `postsToday,`) → **ReferenceError ngay tại đây, crash toàn bộ vòng lặp**.
2. Dòng ~743-744 (trong `computeCampaignDispatchPreview`, dùng cho load balancing): `a.postsToday + a.assignedThisRun` / `b.postsToday + b.assignedThisRun` — cần giá trị này để ưu tiên tài khoản đăng ít nhất trong ngày, không liên quan gì đến việc CHẶN quota.

## Fix (1 dòng, khôi phục lại đúng dòng đã lỡ xoá)
Thêm lại dòng bị thiếu, đặt ngay trước dòng `const remainingQuota`:

```js
const accountState = new Map();
for (const acc of eligibleAccounts) {
  const postsToday = todayPostsMap.get(acc.id) || 0;   // <-- THÊM LẠI dòng này, vẫn cần cho load balancing (dòng ~743-744), KHÔNG liên quan việc chặn quota
  // Daily Post Quota enforcement removed per User request (2026-09-07 FIX_SPEC)
  const remainingQuota = Number.MAX_SAFE_INTEGER;
  accountState.set(acc.id, {
    ...acc,
    postsToday,
    remainingQuota,
    assignedThisRun: 0
  });
}
```

**Không đổi gì khác** — giữ nguyên toàn bộ query `todayPosts`/`todayPostsMap` phía trên (vẫn cần để tính `postsToday`), giữ nguyên `remainingQuota = Number.MAX_SAFE_INTEGER` (không bật lại quota).

## Yêu cầu verify (bắt buộc, rút kinh nghiệm từ lần trước)
1. **Trước khi báo xong**: `grep -n "postsToday" src/app/campaign_actions.js` — liệt kê TOÀN BỘ nơi biến này xuất hiện, xác nhận không còn chỗ nào bị "declared but never read" hay "used but never declared" nữa.
2. Mở lại đúng campaign đã báo lỗi trong ảnh chụp màn hình (sub-tab Campaigns, bấm "Run") → xác nhận modal "Preview & Dispatch Breakdown" hiển thị được danh sách, KHÔNG còn báo "Cannot Generate Dispatch Preview".
3. `npm run build` PASS 100%.
4. Push lên GitHub + xác nhận Vercel deploy production READY với đúng commit mới nhất (dùng `git status` phải hết "ahead", và kiểm tra `githubCommitSha` của deployment khớp commit mới) — theo đúng bài học lần trước, đừng chỉ commit local mà quên push.
