# Fix Spec — HOTFIX ưu tiên cao: sửa lỗi timezone khi Edit Log (datetime-local) — 2026-09-01

**Từ:** Claude (Architect/QA)
**Cho:** AG (Implementer)
**Mức độ ưu tiên:** CAO — vá trước khi tiếp tục Phase 5. Xem chi tiết cơ chế lỗi + hậu quả thật đã tái hiện trong `QA_Reverify_2026-09-01_activitylogpanel_v3_edit-delete.md` (gửi kèm).

## Tóm tắt lỗi

Khi mở Edit Log, ô ngày giờ (`<input type="datetime-local">`) hiển thị SAI lệch 7 tiếng (giờ UTC thay vì giờ Việt Nam) do dùng `new Date(log.action_date).toISOString().substring(0, 16)`. Nếu user Save mà không tự sửa lại ngày (tình huống phổ biến nhất — chỉ định sửa Result/Note), giá trị sai này bị lưu đè lên `action_date` thật, làm log đó bị tính nhầm là "cũ hơn" các log khác — kéo theo cơ chế auto-sync Application-level (Phase 2) đồng bộ SAI Stage/Result/Reason từ nhầm log.

## Phạm vi

**CHỈ sửa `src/components/ActivityLogPanel.js`.** KHÔNG đụng `src/app/page.js` trong hotfix này — `page.js` có cùng pattern lỗi ở `handleStartEditLog` (dòng ~531-538) nhưng hậu quả ở đó hiện chỉ dừng ở "ngày hiển thị sai" (chưa ảnh hưởng auto-sync theo cách nghiêm trọng như `ActivityLogPanel` vừa bị, vì current_stage ở `page.js` sync qua đường khác — client-side, không phải qua auto-sync-by-latest-log-date của Phase 2). Sẽ vá `page.js` khi tới phase migrate nó (Phase 5+), lúc đó sẽ dùng đúng helper mới tạo ở hotfix này để không lặp lại lỗi.

## Việc cần làm

Thêm 1 helper function mới ở đầu `src/components/ActivityLogPanel.js` (ngay dưới `getStageBadgeClass`), quy đổi ĐÚNG từ UTC (lưu trong DB) sang giờ địa phương của trình duyệt trước khi nhét vào input `datetime-local`:

```js
// Quy đổi 1 timestamp UTC (từ DB) sang chuỗi "YYYY-MM-DDTHH:mm" ĐÚNG giờ địa phương
// của trình duyệt, để hiển thị đúng trong <input type="datetime-local">.
// Lưu ý: input datetime-local diễn giải giá trị là giờ địa phương thuần (naive),
// không tự quy đổi timezone — nên KHÔNG được dùng toISOString() trực tiếp (luôn ra giờ UTC).
export function toLocalDatetimeInputValue(utcDateStrOrDate) {
  if (!utcDateStrOrDate) return "";
  const d = new Date(utcDateStrOrDate);
  if (isNaN(d.getTime())) return "";
  const offsetMs = d.getTimezoneOffset() * 60000; // phút -> ms; dương nếu local chậm hơn UTC
  const local = new Date(d.getTime() - offsetMs);
  return local.toISOString().substring(0, 16);
}
```

Thay 2 chỗ đang dùng pattern cũ trong file này bằng helper mới:

1. Trong `handleStartEditLog`:
```js
// CŨ (sai):
// action_date: log.action_date ? new Date(log.action_date).toISOString().substring(0, 16) : new Date().toISOString().substring(0, 16),
// MỚI:
action_date: log.action_date ? toLocalDatetimeInputValue(log.action_date) : toLocalDatetimeInputValue(new Date()),
```

**Lưu ý về chiều lưu (save) — KHÔNG cần sửa:** Chiều gửi lên server (`handleSaveEditLog` → `onEditLog` → `updateActivityLog`) hiện đang hoạt động ĐÚNG cho môi trường hiện tại (server dev và browser cùng chạy trên máy Windows của user, cùng timezone) — vì input trả về chuỗi giờ địa phương thuần, và `new Date(actionDateString)` ở server parse đúng theo timezone của chính máy đó. Sau khi vá chiều hiển thị (Việc 1), 2 chiều sẽ khớp nhau: hiển thị đúng giờ VN, và nếu user không sửa gì rồi Save, giá trị lưu lại sẽ giữ nguyên chính xác thời điểm ban đầu (test được ở bước verify bên dưới).

## Yêu cầu test trước khi báo hoàn thành (bắt buộc, đây là hotfix cho lỗi data correctness)

Test qua UI thật + Supabase, theo đúng kịch bản đã làm lộ lỗi:
1. Chọn 1 ứng viên có sẵn ít nhất 2 log ở 2 thời điểm gần nhau trong ngày.
2. Click Edit trên log MỚI NHẤT (không phải log cũ nhất) → xác nhận ô ngày giờ hiển thị ĐÚNG giờ Việt Nam hiện tại của log đó (so sánh với giá trị `action_date` thật trong Supabase, quy đổi UTC+7 bằng tay để đối chiếu).
3. CHỈ sửa Result (Pass ⇄ Fail) hoặc Note, KHÔNG đụng ô ngày, Save.
4. Query Supabase xác nhận `action_date` của log đó **không đổi** (giữ nguyên giá trị UTC ban đầu, sai số cho phép < 1 phút do làm tròn) — đây là bằng chứng quan trọng nhất, chứng minh lỗi lệch 7 tiếng đã hết.
5. Xác nhận log vừa sửa vẫn được nhận diện đúng là "mới nhất" (nếu nó vốn là mới nhất) → Application-level Stage/Result/Reason vẫn đồng bộ đúng theo log này, không bị nhảy sang log khác.
6. Test thêm 1 vòng Edit thật sự đổi ngày (kéo lùi/đẩy tới) → xác nhận giá trị lưu đúng như ý user chọn, không bị lệch thêm 7 tiếng nào nữa.

Cập nhật `DEVELOPMENT_LOG.md` — ghi rõ đây là hotfix cho lỗi phát hiện ở Phase 4/N, không phải tính năng mới.
