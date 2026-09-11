# FIX SPEC — PHẦN 3.2: Đổi Thông Báo Tiến Độ Campaign Sang Theo Mốc % (25/50/75/100), Không Cập Nhật Từng Nhóm

**Từ:** Claude (Architect/QA)
**Gửi:** Antigravity (Implementer)
**Ngày:** 2026-09-02
**Bối cảnh:** User (Product Owner) phản hồi trực tiếp về thiết kế notification đã chốt ở mục 11.6 của `PLAN_2026-09-02_campaign-fb-autopost-integration.md`: đúng là muốn dùng Notification Center thay Telegram, nhưng nếu cập nhật thông báo sau MỖI nhóm đăng xong (hành vi hiện tại của `POST /api/webhooks/campaign-run-progress`, xem PHẦN 3) thì với chiến dịch có hàng trăm nhóm, thông báo sẽ bị "nổ"/nhấp nháy liên tục rất phiền — dù về mặt kỹ thuật code hiện tại chỉ UPDATE 1 dòng `notifications` duy nhất (không tạo dòng mới), nhưng mỗi lần UPDATE đều set `is_read = false` + `updated_at = now()`, khiến notification bật lại thành "chưa đọc"/nhảy lên đầu danh sách sau mỗi nhóm — cảm giác y hệt bị spam. **Quyết định mới từ User:** chỉ "thông báo" (tức là chỉ đổi nội dung + đánh dấu unread) tại 4 mốc tiến độ cố định: **25%, 50%, 75%, 100%**, bỏ qua mọi lần hoàn tất nhóm nằm giữa các mốc.

---

## 0. Phạm vi (CHỈ sửa đúng phần này)

✅ Trong phạm vi:
1. Sửa `src/app/api/webhooks/campaign-run-progress/route.js`: thêm logic tính mốc % vừa đạt được sau khi 1 nhóm hoàn tất, chỉ UPDATE bảng `notifications` khi thực sự vừa vượt qua 1 mốc mới trong `[25, 50, 75, 100]` kể từ mốc gần nhất đã thông báo. Nếu KHÔNG vượt mốc mới, bỏ qua hoàn toàn bước UPDATE `notifications` (giữ nguyên `is_read`/`updated_at` cũ).
2. Thêm field `lastNotifiedMilestone` (số nguyên, mặc định 0 nếu chưa có) vào `campaign_runs.stats` (jsonb đã có sẵn, không cần migration DB mới) để nhớ mốc đã thông báo gần nhất, tránh thông báo lặp lại cùng 1 mốc khi có nhiều lệnh gọi webhook đến trong lúc chạy.
3. `INSERT INTO campaign_run_items` (ghi nhận từng nhóm hoàn tất) **giữ nguyên không đổi** — đây vẫn là nguồn dữ liệu đầy đủ, chính xác cho tab Run History, chỉ có notification là bị gộp lại theo mốc.

❌ NGOÀI phạm vi:
- KHÔNG đổi `src/app/api/webhooks/campaign-run-callback/route.js` (thông báo hoàn tất 100% cuối cùng khi n8n báo cả workflow xong) — hàm này đã đúng ý (chỉ bắn 1 lần khi thật sự kết thúc), giữ nguyên. Có thể xảy ra trường hợp mốc 100% từ PHẦN này (route `campaign-run-progress`, khi nhóm CUỐI CÙNG hoàn tất) và thông báo cuối từ `campaign-run-callback` (khi n8n báo cả workflow đóng xong) update `notifications` gần sát nhau — đây là hành vi CHẤP NHẬN ĐƯỢC (chỉ 2 lần update sát đuôi run, không phải spam), không cần dedup thêm.
- KHÔNG đổi UI (`PendingCVClientWrapper.js`, trang `campaigns/page.js`) — không cần, vì cấu trúc `notifications`/`metadata` không đổi field nào, chỉ đổi TẦN SUẤT ghi.
- KHÔNG đổi workflow n8n (PHẦN 4b) — n8n vẫn gọi `POST /api/webhooks/campaign-run-progress` sau MỖI nhóm y hệt hiện tại; việc "gộp mốc" xử lý hoàn toàn ở phía backend Next.js, n8n không cần biết gì về mốc %.
- KHÔNG đổi schema DB, không cần migration (chỉ thêm 1 key mới vào jsonb `stats` đã tồn tại).

Nếu thấy cần sửa gì khác ngoài `campaign-run-progress/route.js`, dừng lại hỏi Claude trước, theo mục 10 GEMINI.md.

---

## 1. Vấn đề cụ thể (đối chiếu code hiện tại)

File `src/app/api/webhooks/campaign-run-progress/route.js`, bước 3 trong transaction — sau khi INSERT `campaign_run_items`, code hiện tại LUÔN chạy:

```js
await sqlTx`
  UPDATE notifications SET
    title = ...,
    message = ...,
    metadata = jsonb_set(metadata, '{progress}', ...),
    is_read = false,
    updated_at = now()
  WHERE id = ${run.notification_id}
`;
```

→ Chạy vô điều kiện sau MỌI nhóm hoàn tất (kể cả `Sent`/`Failed`/`Checkpoint`/`Skipped`). Với chiến dịch 100-200 nhóm, notification bị bật `is_read = false` hàng trăm lần liên tục trong vài phút — đúng như User mô tả, dù kỹ thuật chỉ là 1 dòng DB, trải nghiệm vẫn giống bị spam.

---

## 2. Yêu cầu triển khai chi tiết

### 2.1. Hằng số mốc

Thêm ở đầu file (hoặc trong hàm), KHÔNG cần file config riêng vì chỉ dùng ở đúng 1 chỗ:

```js
const PROGRESS_MILESTONES = [25, 50, 75, 100];
```

### 2.2. Đọc `lastNotifiedMilestone` hiện tại trong cùng transaction

Trong bước 3 (đoạn đang `SELECT cr.id, cr.campaign_id, cr.notification_id, cr.stats, c.campaign_name ... WHERE cr.id = ${runId}`), thêm khoá `FOR UPDATE` vào câu SELECT này để khoá đúng dòng `campaign_runs` trong lúc tính/ghi mốc — tránh trường hợp 2 lệnh gọi webhook đến gần như đồng thời (không chắc n8n có chạy tuần tự tuyệt đối hay không) cùng đọc thấy `lastNotifiedMilestone` cũ rồi cùng ghi đè, có thể bỏ sót/lặp mốc:

```js
const [run] = await sqlTx`
  SELECT cr.id, cr.campaign_id, cr.notification_id, cr.stats, c.campaign_name
  FROM campaign_runs cr
  JOIN campaigns c ON cr.campaign_id = c.id
  WHERE cr.id = ${runId}
  FOR UPDATE
`;
```

Lấy mốc cũ (mặc định 0 nếu chưa từng có, ví dụ run vừa mới tạo):

```js
const lastNotifiedMilestone = Number(run.stats?.lastNotifiedMilestone) || 0;
```

### 2.3. Tính mốc mới đã đạt được (nếu có) sau khi đếm lại `counts` (giữ nguyên câu SELECT COUNT hiện tại)

```js
const totalPlanned = run.stats?.totalDispatched || counts.total_completed;
const currentPct = totalPlanned > 0
  ? Math.floor((counts.total_completed / totalPlanned) * 100)
  : 0;

// Mốc CAO NHẤT trong PROGRESS_MILESTONES mà (a) đã đạt (currentPct >= mốc)
// và (b) chưa từng thông báo trước đó (mốc > lastNotifiedMilestone).
const newMilestone = PROGRESS_MILESTONES
  .filter(m => currentPct >= m && m > lastNotifiedMilestone)
  .pop(); // PROGRESS_MILESTONES đã sắp tăng dần -> phần tử cuối cùng thoả điều kiện là mốc cao nhất
```

### 2.4. Chỉ UPDATE `notifications` KHI `newMilestone` tồn tại (bỏ điều kiện `if (run && run.notification_id)` cũ, thay bằng điều kiện chặt hơn)

```js
if (run && run.notification_id && newMilestone) {
  const progressMessage = `📢 Chiến dịch "${run.campaign_name}": ${newMilestone}% hoàn tất ` +
    `(${counts.total_completed}/${totalPlanned} nhóm — ✅ ${counts.sent_count} thành công` +
    `${counts.failed_count > 0 ? `, ❌ ${counts.failed_count} lỗi` : ''}` +
    `${counts.checkpoint_count > 0 ? `, ⚠️ ${counts.checkpoint_count} checkpoint` : ''})`;

  await sqlTx`
    UPDATE notifications SET
      title = ${'Đang chạy chiến dịch... (' + newMilestone + '%)'},
      message = ${progressMessage},
      metadata = jsonb_set(
        metadata,
        '{progress}',
        ${sqlTx.json({
          totalPlanned,
          completed: counts.total_completed,
          sent: counts.sent_count,
          failed: counts.failed_count,
          checkpoint: counts.checkpoint_count,
          skipped: counts.skipped_count,
          milestone: newMilestone
        })}
      ),
      is_read = false,
      updated_at = now()
    WHERE id = ${run.notification_id}
  `;

  // Ghi nhớ mốc vừa thông báo để không lặp lại
  await sqlTx`
    UPDATE campaign_runs SET
      stats = jsonb_set(COALESCE(stats, '{}'::jsonb), '{lastNotifiedMilestone}', ${sqlTx.json(newMilestone)})
    WHERE id = ${runId}
  `;
}
```

Nếu `newMilestone` là `undefined` (chưa vượt mốc nào mới) → không làm gì thêm với `notifications`/`campaign_runs.stats`, giữ nguyên như cũ. `campaign_run_items` vẫn đã được INSERT ở bước 1 như bình thường — không mất dữ liệu, chỉ là notification không "nhắc" ở lần này.

### 2.5. Trường hợp biên cần AG tự test, không suy đoán

- **Chiến dịch rất nhỏ (1-3 nhóm):** ví dụ 3 nhóm → nhóm 1 xong = 33% (vượt mốc 25 → thông báo "25%"), nhóm 2 xong = 66% (vượt mốc 50 → thông báo "50%"), nhóm 3 xong = 100% (vượt mốc 75 VÀ 100 cùng lúc → chỉ thông báo 1 lần với mốc CAO NHẤT là "100%", không thông báo 75% riêng — đúng theo logic `.pop()` ở mục 2.3). Test case 3 nhóm để xác nhận đúng hành vi này.
- **Chiến dịch 1 nhóm duy nhất:** nhóm 1 xong = 100% ngay lập tức → chỉ 1 thông báo duy nhất mốc "100%", không có 25/50/75 nào cả. Test riêng case này.
- **Có nhóm `Failed`/`Skipped` xen giữa:** mốc % tính theo TỔNG số nhóm đã xử lý xong (`total_completed`, bao gồm mọi status) trên `totalPlanned` — không loại trừ `Failed`/`Skipped` ra khỏi mẫu số/tử số. Giữ nguyên logic đếm hiện tại, chỉ đổi điều kiện UPDATE.

---

## 3. Yêu cầu QA/test trước khi báo PASS

1. Test cô lập (record `campaign_runs`/`campaign_run_items`/`notifications` tự tạo trên schema sandbox, theo đúng mục 10.8 GEMINI.md — **không được gọi thẳng webhook này lên run thật**): giả lập 1 run có `totalDispatched = 20`, gọi tuần tự route với 20 `completedItem`, xác nhận:
   - `notifications` chỉ bị UPDATE đúng 4 lần trong suốt quá trình (ứng với nhóm thứ 5, 10, 15, 20 — làm tròn xuống theo % thật, cần tính tay bằng `Math.floor` để xác nhận đúng nhóm thứ mấy sẽ trigger).
   - `campaign_run_items` vẫn có đủ 20 dòng — không bị ảnh hưởng.
   - `campaign_runs.stats.lastNotifiedMilestone` cuối cùng = 100.
2. Test 2 trường hợp biên ở mục 2.5 (1 nhóm, 3 nhóm).
3. `npm run build` PASS, không lỗi lint.
4. Cập nhật `docs/DEVELOPMENT_LOG.md`: **BẮT BUỘC cập nhật CẢ 2 phần** — (a) thêm dòng mới vào bảng "📌 Bảng Tổng Hợp Snapshots" đầu file VÀ (b) thêm entry chi tiết "📝 Chi Tiết Từng Snapshot" — không chỉ thêm 1 trong 2 (đã từng bị bỏ sót trước đây).

Nếu có bất kỳ điểm nào trong spec này không rõ hoặc phát sinh xung đột với code thực tế khác với mô tả ở mục 1, dừng lại hỏi Claude trước khi tự quyết, theo mục 10 GEMINI.md.
