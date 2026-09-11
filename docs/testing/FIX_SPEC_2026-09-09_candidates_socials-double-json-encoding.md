# FIX SPEC — 2026-09-09 — Cột `candidates.socials` Đôi Khi Bị Lưu Thành Chuỗi JSON-Trong-JSON Thay Vì Mảng Thật, Khiến Search Menu Hiện "—" Dù Dữ Liệu Đúng

**Mức độ ưu tiên: TRUNG BÌNH-CAO — Google Doc mục 13. Hiện chỉ phát hiện 1/3394 candidate bị (hiếm, không phải luôn luôn), nhưng đang xảy ra SỐNG trên production (candidate tạo hôm nay 09/09) và làm sai lệch số liệu hiển thị trên Search Menu.**

**Người phát hiện:** Claude (Architect/QA), theo gợi ý trực tiếp của Thức: "hãy nhìn vào profile Do Minh Thien bạn sẽ rõ".

**Nguồn:** Google Doc, mục 13: "Một số profile có trường Social nhưng không xuất hiện trên mục Social & Web Profiles."

---

## Bằng chứng cụ thể — candidate "Do Minh Thien" (display_number 3429)

- Candidate 360 (đọc từ `contact_points` table) hiển thị ĐÚNG: `LINKEDIN https://www.linkedin.com/in/dominhthien`.
- Search Menu, cột "SOCIAL & WEB PROFILES" hiển thị "—" (trống) cho đúng candidate này, trong khi các candidate khác cùng ngày (Tung Le Duc, Chien Trinh, Truong Thanh Nhan) hiển thị đúng badge LinkedIn/Github/Website.
- Đọc trực tiếp Supabase, so sánh `jsonb_typeof(socials)`:

| Candidate | `jsonb_typeof(socials)` | Kết quả hiển thị Search Menu |
|---|---|---|
| Do Minh Thien (3429) | `string` — giá trị thực tế là 1 CHUỖI chứa văn bản JSON (`"[{\"type\":\"LinkedIn\",...}]"`), KHÔNG PHẢI mảng | ❌ Trống |
| Truong Thanh Nhan (3430) | `array` | ✅ Đúng |
| Chien Trinh (3431) | `array` | ✅ Đúng |
| Tung Le Duc (3432) | `array` | ✅ Đúng |

Toàn bảng `candidates` hiện có **1/3394 dòng** bị lỗi dạng này (đã đếm qua `jsonb_typeof`).

## Nguyên nhân — code ghi `socials` không ép kiểu JSON tường minh, không nhất quán với cách ghi `cv_urls` trong CÙNG hàm

Tìm thấy đúng pattern lặp lại ở **6 vị trí** trong code, tất cả đều thiếu `sql.json(...)` khi ghi `socials` (khác với `cv_urls` ở gần đó trong CÙNG file, luôn được bọc `sql.json(...)` đúng chuẩn):

- `src/app/api/webhooks/cv-import/route.js` dòng 102
- `src/app/hitl_actions.js` dòng 106, 222
- `src/app/actions.js` dòng 679, 737, 1039

Ví dụ (`cv-import/route.js`):
```js
const phones = [], emails = [], socials = [];
...
socials.push({ type: cp.type, value: v, url: v });
...
await sqlTx`
  UPDATE candidates SET
    phones = ${phones}, emails = ${emails}, socials = ${socials}, all_contacts_text = ${texts.join(' | ')}
  WHERE id = ${newCand.id}
`;
```
So sánh với cách ghi `cv_urls` chỉ vài dòng phía trên trong CÙNG file: `cv_urls = ${sql.json(finalCvUrls)}` — luôn ép kiểu tường minh.

**Chưa xác định được 100% điều kiện chính xác khiến chỉ 1/3394 dòng bị lỗi trong khi code hoàn toàn giống nhau ở các dòng khác** (khả năng cao liên quan cách driver `postgres.js` tự suy luận kiểu tham số cho cột `jsonb` khi không được ép kiểu tường minh — không phải lúc nào cũng nhất quán). Tuy nhiên: **không cần biết chính xác nguyên nhân sâu xa để sửa dứt điểm** — chỉ cần ép kiểu tường minh bằng `sql.json(...)` ở cả 6 vị trí (giống hệt cách `cv_urls` đã làm đúng) sẽ loại bỏ hoàn toàn khả năng xảy ra, bất kể lý do gốc là gì.

---

## Cách sửa

Ở cả 6 vị trí trên, đổi:
```js
socials = ${socials}
```
thành:
```js
socials = ${sqlTx.json(socials)}
```
(hoặc `sql.json(socials)` tuỳ theo file dùng biến `sql` hay `sqlTx` — giữ đúng theo context sẵn có của từng file, xem cách `cv_urls` đang làm ngay cạnh đó để copy đúng pattern).

**Cân nhắc thêm (không bắt buộc, nhưng nên làm cùng lúc vì rẻ):** áp dụng luôn `sql.json(...)` cho `phones`/`emails` nếu 2 cột này cũng là kiểu `text[]`/`jsonb` để nhất quán — kiểm tra kiểu cột thật trước khi đổi, KHÔNG đổi nếu 2 cột đó là `text[]` thường (ép `.json()` sai kiểu sẽ gây lỗi).

## Data fix cho dòng đã bị lỗi (Do Minh Thien, id `01a08534-4ee9-c92d-966d-493f04a7e934`)

**Claude đã thử chạy trực tiếp nhưng bị chặn bởi permission classifier của phiên làm việc** (không phải lỗi kỹ thuật — là 1 lớp an toàn chặn UPDATE trực tiếp), nên để lại đây cho AG (hoặc Thức tự chạy qua Supabase Studio):
```sql
UPDATE candidates
SET socials = (socials #>> '{}')::jsonb
WHERE id = '01a08534-4ee9-c92d-966d-493f04a7e934'
  AND jsonb_typeof(socials) = 'string';
```
Câu lệnh này giải mã lại đúng 1 lớp JSON bị lồng, biến chuỗi trở lại thành mảng thật. Sau khi chạy, verify lại bằng:
```sql
SELECT jsonb_typeof(socials), socials FROM candidates WHERE display_number = 3429;
-- kỳ vọng: 'array', và Search Menu hiển thị đúng badge LinkedIn
```

## Test bắt buộc trước khi báo hoàn thành
1. Chạy lại data fix trên cho candidate Do Minh Thien → xác nhận Search Menu hiển thị đúng badge LinkedIn.
2. Sau khi sửa code (6 vị trí), test tạo 1 candidate mới có contact point Social (LinkedIn/Facebook/Github...) qua CV Parser → kiểm tra `jsonb_typeof(candidates.socials)` ngay sau đó phải luôn là `'array'`.
3. Test tương tự qua luồng HITL merge (APPEND thêm social mới cho candidate cũ) → cùng kiểm tra `jsonb_typeof`.
4. Quét lại toàn bộ `candidates` bằng `jsonb_typeof(socials) = 'string'` sau khi deploy 1-2 ngày để xác nhận không phát sinh dòng lỗi mới.

## Báo cáo lại
Ghi vào `docs/DEVELOPMENT_LOG.md`, kèm kết quả quét toàn bảng trước/sau fix.
