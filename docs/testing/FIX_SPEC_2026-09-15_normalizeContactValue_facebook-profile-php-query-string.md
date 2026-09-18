**Từ:** Claude (Architect/QA)

# FIX_SPEC_2026-09-15 — `normalizeContactValue` xóa nhầm `?id=` của Facebook `profile.php`

## Bối cảnh

Trong lúc audit dữ liệu thật (`public.contact_points`) để chuẩn bị cho việc so sánh dedup qua `normalizeContactValue`, phát hiện: hàm này cắt bỏ TOÀN BỘ query string cho mọi URL (`.replace(/[?#].*$/, "")`) — đúng với hầu hết loại (LinkedIn/Github/Twitter dùng path để định danh), nhưng **SAI với Facebook kiểu cũ `facebook.com/profile.php?id=XXXX`** — ở đây `?id=` chính là phần định danh DUY NHẤT của profile, không phải noise. Nếu bị cắt, nhiều Facebook profile khác nhau đều quy về cùng 1 chuỗi rỗng `"facebook.com/profile.php"` — gây báo động giả hàng loạt nếu dùng hàm này để so sánh dedup (đã kiểm chứng: ảnh hưởng 44 candidate thật trong `public`, toàn bộ là báo động giả, KHÔNG phải trùng thật).

## Phạm vi (1 file)

`src/lib/utils.js`

## Việc cần làm

Trong `normalizeContactValue`, TRƯỚC nhánh xử lý URL chung (đoạn `let cleanUrl = val.replace(/^https?:\/\//i, "")...`), thêm 1 nhánh riêng cho Facebook `profile.php`:

```js
// Facebook profile.php URLs mã hoá định danh DUY NHẤT trong query string (?id=...),
// khác với các URL khác nơi query string chỉ là noise (tracking param) — không được cắt bỏ.
if (/facebook\.com\/profile\.php/i.test(val)) {
  const idMatch = val.match(/id=(\d+)/);
  let cleanBase = val
    .replace(/^https?:\/\//i, "")
    .replace(/^www\./i, "")
    .replace(/\/+$/, "")
    .toLowerCase();
  const pathOnly = cleanBase.split('?')[0];
  return idMatch ? `${pathOnly}?id=${idMatch[1]}` : pathOnly;
}
```

Đặt nhánh này NGAY TRƯỚC đoạn code URL chung hiện có (dòng ~76-84), giữ nguyên toàn bộ phần còn lại của hàm không đổi.

## Việc KHÔNG được làm

- Không đổi logic cho Email, Phone, hay bất kỳ loại URL nào khác.
- Không đụng file nào khác — đây là fix 1 hàm, 1 file.

## Verify bắt buộc

1. `node --check src/lib/utils.js` → PASS.
2. Test nhanh bằng 1 script Node độc lập (không qua DB, chỉ gọi hàm) với các input mẫu:
   - `normalizeContactValue('Facebook', 'https://www.facebook.com/profile.php?%0did=100045121424813')` → PHẢI trả về `'facebook.com/profile.php?id=100045121424813'`.
   - `normalizeContactValue('Facebook', 'https://www.facebook.com/profile.php?id=61581122866182')` → PHẢI trả về `'facebook.com/profile.php?id=61581122866182'`.
   - `normalizeContactValue('Facebook', 'https://www.facebook.com/phamgiang19/')` (không phải profile.php, case thường) → PHẢI trả về `'facebook.com/phamgiang19'` như hành vi cũ (không bị ảnh hưởng bởi nhánh mới).
3. `git diff --stat` → chỉ `src/lib/utils.js`.
4. Chạy lại `/api/biz-test` → PASS 100%, không regression (đặc biệt các case liên quan `BIZ-24`/`BIZ-25`/`BIZ-26` dùng `contact_points`).
5. `npm run build` → PASS 100%.

## Yêu cầu tài liệu

Thêm mục mới vào `docs/DEVELOPMENT_LOG.md` theo template mục 10.3 GEMINI.md.

## Quy ước xử lý khi phát hiện lệch spec hoặc không rõ ràng

- Lệch nhỏ → tự sửa, ghi chú, KHÔNG dừng.
- Đụng file/API/quyết định sản phẩm ngoài phạm vi → DỪNG NGAY, in `ESCALATE: <mô tả>`.
- Chỉ cần hỏi 1 chi tiết kỹ thuật nhỏ → in `QUESTION: <câu hỏi>` rồi dừng.
