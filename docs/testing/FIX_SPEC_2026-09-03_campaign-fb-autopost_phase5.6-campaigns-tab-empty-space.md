# FIX SPEC — PHẦN 5.6: Sửa Layout Sub-Tab "Campaigns" — Tận Dụng Diện Tích Trống Khi Chưa Chọn Campaign

**Từ:** Claude (Architect/QA)
**Gửi:** Antigravity (Implementer)
**Ngày:** 2026-09-03
**Bối cảnh:** User phản hồi kèm screenshot: ở sub-tab "Campaigns" (menu Campaigns & Auto-Post Hub), phần diện tích trống rất nhiều, phần diện tích để trình bày dữ liệu lại quá ít — trong khi 2 sub-tab còn lại ("FB Accounts & Warm/Join", "Social Group URLs") trình bày hài hòa hơn (bảng chiếm toàn bộ chiều cao khả dụng).

Claude đã đọc code `src/app/campaigns/page.js` và xác định nguyên nhân gốc (không phải bug logic/data, chỉ là CSS layout):
- Container bảng "Master Campaigns Table" (khoảng dòng 659) đang bị ép cứng `shrink-0 max-h-64` (~256px) **bất kể có chọn campaign hay không**.
- Panel chi tiết bên dưới ("Detail Expandable Panel", khoảng dòng 790) chỉ render khi `selectedCampaignId` có giá trị (`{selectedCampaignId && (...)}`).
- Khi mới vào tab (chưa click chọn campaign nào), panel chi tiết không tồn tại trong DOM → phần còn lại của khung `flex-1 flex flex-col min-h-0 space-y-4` (dòng 618) không có gì lấp đầy → để lại khoảng trống đen rất lớn phía dưới bảng, đúng như screenshot User gửi.
- Ngược lại, 2 sub-tab "FB Accounts & Warm/Join" (dòng ~1104) và "Social Group URLs" (dòng ~1275) chỉ có DUY NHẤT 1 bảng với class `flex-1 ... min-h-0`, luôn lấp đầy toàn bộ chiều cao khả dụng — đây là lý do User thấy 2 tab đó "hài hòa" hơn.

**Hướng sửa:** làm cho bảng Master Campaigns Table **tự co giãn theo trạng thái chọn**: khi CHƯA chọn campaign nào → bảng chiếm toàn bộ chiều cao còn lại (`flex-1`, hiển thị được nhiều dòng hơn, giống hành vi 2 tab kia); khi ĐÃ chọn 1 campaign → bảng thu gọn về chiều cao cố định như hiện tại (`max-h-64`, có scroll riêng) để nhường chỗ cho Detail Expandable Panel bên dưới — đúng hành vi hiện tại, không đổi gì khi đã chọn.

---

## 0. Phạm vi (CHỈ sửa đúng phần này)

✅ Trong phạm vi:
1. `src/app/campaigns/page.js` — CHỈ sửa `className` của đúng 1 `<div>` bọc ngoài bảng "Master Campaigns Table" (comment `{/* Master Campaigns Table */}`, hiện ở khoảng dòng 659) trong nhánh `activeTab === "campaigns"`. Đổi từ class tĩnh sang class động phụ thuộc `selectedCampaignId`.

❌ NGOÀI phạm vi — KHÔNG đụng vào:
- Cấu trúc bảng, các cột, dữ liệu hiển thị, sự kiện click chọn row (`handleSelectCampaign`) — giữ nguyên 100%.
- Detail Expandable Panel (dòng ~790 trở đi) và toàn bộ logic bên trong (Overview & Groups / Run History) — giữ nguyên 100%.
- 2 sub-tab "FB Accounts & Warm/Join" và "Social Group URLs" — đã hài hòa sẵn, KHÔNG sửa.
- Filter Bar phía trên bảng (search input, dropdown status) — giữ nguyên.
- Không thêm state mới, không thêm props mới, không đổi schema/DB/server action nào — đây là fix CSS/layout thuần tuý phía client.

Nếu đọc code thực tế thấy cấu trúc JSX khác với mô tả trên (ví dụ số dòng lệch do file đã đổi từ lúc viết spec này), dừng lại hỏi Claude trước, theo mục 10 GEMINI.md — KHÔNG tự suy đoán sửa chỗ khác.

---

## 1. Thay đổi cụ thể — `src/app/campaigns/page.js`

### 1.1. Trước (hiện tại)

```jsx
{/* Master Campaigns Table */}
<div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-900/40 shadow-sm flex flex-col shrink-0 max-h-64 overflow-y-auto">
  <table className="w-full text-left text-xs border-collapse">
    ...
  </table>
</div>
```

### 1.2. Sau (mong muốn)

```jsx
{/* Master Campaigns Table — chiếm toàn bộ chiều cao khả dụng khi chưa chọn campaign nào (tránh
    khoảng trống lớn phía dưới); tự thu gọn về max-h-64 khi đã chọn 1 campaign để nhường chỗ cho
    Detail Expandable Panel bên dưới. */}
<div
  className={`border border-slate-800 rounded-xl overflow-hidden bg-slate-900/40 shadow-sm flex flex-col overflow-y-auto ${
    selectedCampaignId ? "shrink-0 max-h-64" : "flex-1 min-h-0"
  }`}
>
  <table className="w-full text-left text-xs border-collapse">
    ...
  </table>
</div>
```

Chỉ đổi đúng chuỗi `className` của `<div>` bọc ngoài — phần `<table>...</table>` bên trong giữ nguyên y hệt, không sửa gì.

`selectedCampaignId` đã là state có sẵn trong component (dùng để điều khiển việc render Detail Expandable Panel ở dòng dưới), không cần khai báo thêm gì.

---

## 2. Yêu cầu QA/test trước khi báo PASS

1. Test trực quan qua UI thật (Playwright hoặc thao tác tay), tab "Campaigns":
   - Mới vào tab, CHƯA click chọn campaign nào → bảng phải chiếm gần hết chiều cao khả dụng (không còn khoảng đen trống lớn phía dưới như screenshot User gửi), hiển thị được nhiều dòng hơn trước khi cần scroll (tuỳ số lượng campaign thật).
   - Click chọn 1 campaign bất kỳ → bảng phải thu gọn lại về chiều cao cố định (~max-h-64, có scroll riêng nếu nhiều dòng) và Detail Expandable Panel phải xuất hiện ngay bên dưới, chiếm phần chiều cao còn lại — **hành vi này phải giống hệt hiện tại, không có regression**.
   - Bấm nút "X" đóng Detail Panel (dòng ~805) → bảng phải tự động giãn lại full-height như trạng thái ban đầu (vì `selectedCampaignId` được set về `null`).
   - Test với danh sách campaign ít (ví dụ 2-3 dòng) lẫn nhiều (đủ để tràn `max-h-64` khi đã chọn) — không có artefact lạ (bảng không bị co dúm hay giật khi chuyển trạng thái).
2. Đối chiếu bằng mắt với 2 sub-tab "FB Accounts & Warm/Join" và "Social Group URLs" — cảm giác "đầy khung hình" phải tương đương khi chưa chọn campaign.
3. `npm run build` PASS, không lỗi lint, không warning console.
4. Cập nhật `docs/DEVELOPMENT_LOG.md`: **BẮT BUỘC cập nhật CẢ 2 phần** — bảng tổng hợp đầu file VÀ chi tiết snapshot phía dưới.

Nếu có bất kỳ điểm nào không rõ hoặc code thực tế khác với mô tả, dừng lại hỏi Claude trước khi tự quyết, theo mục 10 GEMINI.md.
