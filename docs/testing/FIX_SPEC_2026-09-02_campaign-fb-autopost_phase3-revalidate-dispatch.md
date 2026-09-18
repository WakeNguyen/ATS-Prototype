# FIX SPEC — PHẦN 3.1: Bổ Sung Re-Validate Dispatch Server-Side Trong `triggerCampaignRun`

**Từ:** Claude (Architect/QA)
**Gửi:** Antigravity (Implementer)
**Ngày:** 2026-09-02
**Bối cảnh:** Đây là follow-up sau khi Claude QA review PHẦN 3 (commit `3e92b40`). Kết quả: đa số đạt đúng spec, nhưng có 1 điểm lệch cần vá trước khi cho chạy chiến dịch thật — `triggerCampaignRun` hiện KHÔNG re-validate `confirmedDispatch` phía server trước khi thực thi, trong khi mục 3.3 của `FIX_SPEC_2026-09-02_campaign-fb-autopost_phase3-server-actions.md` đã yêu cầu rõ điều này. Spec này chỉ vá đúng lỗ hổng đó, không mở rộng gì thêm.

---

## 0. Phạm vi (CHỈ sửa đúng phần này)

✅ Trong phạm vi:
1. Sửa `src/app/campaign_actions.js`:
   - Refactor phần tính "trạng thái đủ điều kiện" (eligible accounts / 24h cooldown / joined groups) hiện đang nằm trong `computeCampaignDispatchPreview` ra thành 1 hàm nội bộ dùng chung (không export), ví dụ `async function _getEligibilityState(campaignId, sqlClient)`, để cả `computeCampaignDispatchPreview` và `triggerCampaignRun` dùng chung 1 nguồn logic — tránh 2 nơi tính khác nhau rồi lệch nhau theo thời gian.
   - Sửa `triggerCampaignRun`: bên trong transaction (`sql.begin`), sau khi lấy advisory lock và xác nhận `campaign.is_active` + chưa có run nào `Running`, thêm bước re-validate từng dòng trong `confirmedDispatch` dựa trên trạng thái MỚI NHẤT lấy ngay trong transaction đó (không tin dữ liệu client gửi lên).

❌ NGOÀI phạm vi:
- Không đổi schema DB (không cần migration mới).
- Không đổi UI, không đổi webhook routes.
- Không đổi `computeCampaignDispatchPreview` behavior khi gọi cho modal preview (giữ nguyên input/output hiện tại của hàm này với UI).

Nếu thấy cần sửa gì khác ngoài `campaign_actions.js`, dừng lại hỏi Claude trước, theo mục 10 GEMINI.md.

---

## 1. Vấn đề cụ thể

Code hiện tại (dòng ~673-724, hàm `triggerCampaignRun`) nhận `confirmedDispatch` từ client, chỉ kiểm tra campaign còn active và chưa có run nào đang chạy, rồi lưu thẳng `dispatchSnapshot: confirmedDispatch` và bắn sang n8n — không kiểm tra lại từng dòng dispatch. Vì khoảng thời gian giữa lúc User mở modal xem trước (`computeCampaignDispatchPreview`) và lúc bấm "Confirm & Start Posting" có thể là vài phút, dữ liệu có thể đã đổi:
- Nick FB trong dispatch có thể vừa bị đánh `Checkpoint`/`Inactive`/`Restricted` (do 1 run khác vừa phát hiện sự cố).
- Nhóm trong dispatch có thể đã bị xoá khỏi campaign (`campaign_social_groups`) hoặc bị `is_active = false`.
- Nhóm có thể vừa được đăng bởi 1 lượt chạy khác trong 24h qua (vi phạm cooldown).
- Quota ngày của account có thể đã bị dùng hết bởi 1 lượt chạy khác song song.

Chạy thẳng dispatch cũ mà không kiểm tra lại là rủi ro thật vì đây là hệ thống điều khiển hành vi tự động trên tài khoản Facebook thật (rủi ro checkpoint/khoá tài khoản nếu dùng nick sai trạng thái).

---

## 2. Yêu cầu triển khai chi tiết

### 2.1. Hàm dùng chung `_getEligibilityState`
Trích xuất logic bước 2 (Eligible Accounts), bước 3 (24h Cooldown), bước 4 (quota hôm nay), bước 5 (Joined Groups Map) hiện có trong `computeCampaignDispatchPreview` thành 1 hàm nội bộ nhận `campaignId` và client `sql`/`sqlTx` (để dùng được cả ngoài transaction lẫn trong transaction), trả về:
```js
{
  campaignGroupIds: Set<string>,      // id các social_group hợp lệ (is_active=true) đang gắn với campaign này
  accountState: Map<accountId, {..., remainingQuota, status}>,
  recentSet: Set<socialGroupId>,      // đã đăng trong 24h qua
  joinedMap: Map<socialGroupId, Set<accountId>>
}
```
`computeCampaignDispatchPreview` gọi hàm này rồi giữ nguyên phần logic ghép cặp/greedy-assign như hiện tại — không đổi output của `computeCampaignDispatchPreview`.

### 2.2. Re-validate trong `triggerCampaignRun`
Ngay sau khi xác nhận `campaign.is_active` và chưa có run `Running` (vẫn trong transaction, dùng `sqlTx`), gọi `_getEligibilityState(campaignId, sqlTx)` để lấy trạng thái mới nhất, rồi lọc `confirmedDispatch`:
- Loại bỏ dòng nào có `socialGroupId` không còn nằm trong `campaignGroupIds` → lý do `"group_removed_or_inactive"`.
- Loại bỏ dòng nào có `socialGroupId` nằm trong `recentSet` (đã đăng trong 24h) → lý do `"cooldown_24h"`.
- Loại bỏ dòng nào có `fbAccountId` không còn `status === 'Active'` trong `accountState` → lý do `"account_not_active"`.
- Với các dòng còn lại, duyệt tuần tự (giữ nguyên thứ tự client gửi), trừ dần `remainingQuota` của account tương ứng trong `accountState`; dòng nào khiến account vượt quota (remainingQuota đã về 0) → loại, lý do `"quota_exceeded"`.

Kết quả: `validatedDispatch` (danh sách còn lại) + `droppedItems` (danh sách bị loại kèm lý do).

- Nếu `validatedDispatch.length === 0`: `throw new Error('Tất cả các nhóm trong dispatch đã không còn hợp lệ (đã đổi trạng thái từ lúc xem trước). Vui lòng mở lại modal xem trước và thử lại.')` — không tạo notification, không tạo `campaign_runs`, không gọi webhook n8n.
- Nếu `droppedItems.length > 0` nhưng vẫn còn dòng hợp lệ: tiếp tục chạy bình thường với `validatedDispatch`, nhưng lưu `droppedItems` vào `campaign_runs.stats` (thêm field `droppedItems`) để hiển thị được trong Run Detail sau này (phục vụ đúng yêu cầu gốc của User: "lưu trữ báo cáo lượt chạy để tiện fix bug trong tương lai").
- Toàn bộ phần còn lại của hàm (insert notification, insert `campaign_runs`, update `campaigns.status`, gọi webhook n8n) dùng `validatedDispatch` thay vì `confirmedDispatch` trực tiếp.

### 2.3. Giới hạn đã biết (ghi rõ trong code comment, không cần xử lý thêm ở spec này)
Nếu 1 tài khoản FB được gán cho 2 campaign khác nhau và cả 2 được trigger gần như đồng thời, advisory lock hiện tại chỉ khoá theo `campaignId` nên không chặn được việc 2 transaction khác nhau cùng đọc quota "còn dư" của cùng 1 account trước khi transaction kia commit (race điều kiện hiếm, không phải lỗi P0). Ghi lại thành comment `// KNOWN LIMITATION:` ngay tại đoạn trừ quota, không cần sửa trong spec này — nếu muốn xử lý triệt để cần lock theo `fbAccountId` nữa, để dành cho 1 spec sau nếu User thấy cần.

---

## 3. Yêu cầu test bắt buộc trước khi báo hoàn thành

1. Test dispatch bình thường (không gì đổi giữa preview và confirm) → chạy y hệt hành vi cũ, không dòng nào bị loại.
2. Test giả lập 1 account trong dispatch bị đổi `status` sang `Checkpoint` ngay trước khi gọi `triggerCampaignRun` → xác nhận dòng đó bị loại, `droppedItems` ghi đúng lý do `account_not_active`, các dòng khác vẫn chạy bình thường.
3. Test giả lập tất cả dòng đều invalid → xác nhận trả về lỗi rõ ràng, KHÔNG tạo `campaign_runs`/`notifications` mới (kiểm tra trực tiếp trong DB sau khi gọi).
4. Test dữ liệu cô lập theo mục 10.8 GEMINI.md — không test trên `campaigns`/`fb_accounts` thật.
5. Chạy lại `npm run build` xác nhận không lỗi biên dịch.

## 4. Báo cáo hoàn thành

Bắt buộc mở đầu bằng đúng 1 trong 2 dòng: "⚠️ Sai lệch so với spec: ..." hoặc "✅ Không có sai lệch so với spec" (mục 10.7 GEMINI.md — lần báo cáo PHẦN 3 trước đã thiếu dòng này, lần này cần có).
