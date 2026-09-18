# FIX SPEC — PHẦN R.1: Safety Net `overflow-x-auto` Cho Mọi Bảng Còn Thiếu (Lộ Trình Responsive Tablet)

**Từ:** Claude (Architect/QA)
**Gửi:** Antigravity (Implementer)
**Ngày:** 2026-09-03
**Bối cảnh:** Theo `docs/architecture/PLAN_2026-09-03_tablet-responsive-rollout.md` (User đã xác nhận thứ tự triển khai, ưu tiên PHẦN R.1 làm trước vì rủi ro thấp nhất). Đây là bước đầu tiên trong lộ trình hỗ trợ tablet (~768–1024px): đảm bảo MỌI bảng dữ liệu trong app đều có khả năng cuộn ngang khi nội dung rộng hơn khung nhìn, thay vì bị cắt mất/tràn layout.

**Rà soát lại chính xác hơn plan gốc:** Plan ban đầu liệt kê 5 file "thiếu `overflow-x-auto`" dựa trên tìm kiếm đúng chuỗi `overflow-x-auto`. Khi Claude đọc kỹ lại từng file để viết spec này, phát hiện 2 trong 5 file (`src/app/page.js`, `src/app/search/page.js`) **đã có sẵn** class `overflow-auto` (tương đương, cho phép cuộn CẢ 2 trục) bọc quanh bảng — KHÔNG cần sửa. Spec này chỉ còn đúng **3 file thật sự thiếu**, đã xác nhận lại bằng cách đọc trực tiếp className hiện tại của từng file.

---

## 0. Phạm vi (CHỈ sửa đúng phần này)

✅ Trong phạm vi — thêm đúng 1 class `overflow-x-auto` vào `className` của `<div>` bọc ngoài `<table>` đã có sẵn, ở đúng 3 vị trí sau (không tạo `<div>` mới, không đổi cấu trúc bảng bên trong):

1. `src/app/jobs/page.js`, dòng 2112.
2. `src/app/components/CampaignDispatchPreviewModal.js`, dòng 269.
3. `src/app/components/PendingCVClientWrapper.js`, dòng 464.

❌ NGOÀI phạm vi:
- `src/app/page.js` và `src/app/search/page.js` — đã có `overflow-auto` sẵn (cho phép cuộn cả 2 trục), KHÔNG cần sửa gì.
- `src/app/campaigns/page.js` — cả 3 bảng đã có `overflow-x-auto` từ trước (PHẦN 5.x), KHÔNG cần sửa.
- Bất kỳ thay đổi nào khác về bố cục, cột bảng, breakpoint `sm:`/`md:`/`lg:`, NavbarTabs — đó là các PHẦN R.2 trở đi, viết spec riêng sau.
- KHÔNG đổi cấu trúc cột, không ẩn/hiện cột nào — đó là việc của PHẦN R.4 (Jobs & Clients) sau khi có safety net này.

Nếu đọc code thực tế thấy số dòng lệch (do file đã đổi từ lúc viết spec), tìm đúng `<div>` bọc `<table>` tương ứng bằng comment/ngữ cảnh mô tả bên dưới, KHÔNG đoán bừa — nếu không chắc, dừng lại hỏi Claude theo mục 10 GEMINI.md.

---

## 1. Thay đổi cụ thể

### 1.1. `src/app/jobs/page.js` (dòng 2112) — bảng "Jobs Table"

**Trước:**
```jsx
{/* Jobs Table */}
<div className="flex-1 overflow-y-auto scrollbar-thin min-h-0 bg-slate-950/40">
  <table className="w-full text-left border-collapse text-[11px]">
```

**Sau:**
```jsx
{/* Jobs Table */}
<div className="flex-1 overflow-y-auto overflow-x-auto scrollbar-thin min-h-0 bg-slate-950/40">
  <table className="w-full text-left border-collapse text-[11px]">
```

Chỉ thêm `overflow-x-auto` vào giữa `overflow-y-auto` và `scrollbar-thin` (hoặc bất kỳ vị trí nào trong chuỗi class, không quan trọng thứ tự). Giữ nguyên `overflow-y-auto` — bảng vẫn cuộn dọc như cũ, giờ thêm cuộn ngang khi cần.

### 1.2. `src/app/components/CampaignDispatchPreviewModal.js` (dòng 269) — bảng Target Groups trong Dispatch Preview Modal

**Trước:**
```jsx
<div className="border border-slate-800 rounded-lg overflow-hidden bg-slate-950/60 max-h-64 overflow-y-auto">
  <table className="w-full text-left text-xs border-collapse">
```

**Sau:**
```jsx
<div className="border border-slate-800 rounded-lg overflow-hidden bg-slate-950/60 max-h-64 overflow-y-auto overflow-x-auto">
  <table className="w-full text-left text-xs border-collapse">
```

Chỉ thêm `overflow-x-auto` vào cuối chuỗi class hiện có. Giữ nguyên `overflow-hidden` (chỉ còn tác dụng bo tròn góc + fallback, không còn chặn trục nào vì cả `overflow-y-auto` và `overflow-x-auto` đều ghi đè đúng trục của nó — giống cách `overflow-y-auto` đã ghi đè `overflow-hidden` ở trục dọc từ trước, hành vi này đã chạy đúng trong code hiện tại nên thêm `overflow-x-auto` theo đúng pattern tương tự là an toàn).

### 1.3. `src/app/components/PendingCVClientWrapper.js` (dòng 464) — bảng "Field Updates" trong HITL review

**Trước:**
```jsx
<div className="border border-slate-800 rounded overflow-hidden">
  <table className="w-full text-[11px] text-left">
```

**Sau:**
```jsx
<div className="border border-slate-800 rounded overflow-hidden overflow-x-auto">
  <table className="w-full text-[11px] text-left">
```

Chỉ thêm `overflow-x-auto` vào cuối chuỗi class hiện có. Bảng này không cuộn dọc (không có `overflow-y-auto`) — giữ nguyên, KHÔNG thêm, vì bảng "Field Updates" thường ngắn (số lượng field diff nhỏ), PHẦN R.1 chỉ giải quyết trục ngang.

---

## 2. Yêu cầu QA/test trước khi báo PASS

1. Test trực quan qua UI thật ở độ rộng cửa sổ hẹp (ví dụ thu nhỏ cửa sổ trình duyệt xuống ~800-900px hoặc dùng DevTools responsive mode ~768-1024px) cho cả 3 vị trí:
   - `/jobs`: bảng Jobs Table phải xuất hiện thanh cuộn ngang khi nội dung rộng hơn khung nhìn, không bị cắt mất cột nào (vẫn truy cập được cột phải nhất bằng cách cuộn).
   - Modal "Dispatch Preview" (nút Run trên 1 campaign ở `/campaigns`): bảng Target Groups trong modal phải cuộn ngang được tương tự.
   - Màn hình HITL Pending CV review (nơi có bảng "Field Updates" khi có field diff) — có thể cần tạo/giả lập 1 pending CV import có field diff để thấy bảng này xuất hiện.
2. **Đối chiếu không có regression ở độ rộng desktop bình thường** (≥1280px, ví dụ 1440px): cả 3 bảng phải hiển thị y hệt như trước khi sửa — không xuất hiện thanh cuộn ngang không cần thiết khi bảng đã đủ chỗ, không đổi chiều cao/vị trí gì khác.
3. `npm run build` PASS, không lỗi lint, không warning console.
4. Cập nhật `docs/DEVELOPMENT_LOG.md`: **BẮT BUỘC cập nhật CẢ 2 phần** — bảng tổng hợp đầu file VÀ chi tiết snapshot phía dưới.

Nếu có bất kỳ điểm nào không rõ hoặc code thực tế khác với mô tả, dừng lại hỏi Claude trước khi tự quyết, theo mục 10 GEMINI.md.
