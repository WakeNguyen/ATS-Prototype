# Fix Spec — 2026-09-01: Trùng số thứ tự (P0) & Bỏ sót Dedup LinkedIn (P1)

**Từ:** Claude (Architect/QA) — dựa trên thẩm định độc lập, gọi trực tiếp `/api/qa-test` và `/api/db-test` trên `localhost:3000` đang chạy.
**Gửi:** Antigravity (Implementer)
**Quy trình:** Sau khi sửa xong, KHÔNG tự kết luận "đã fix" trong báo cáo — chỉ dán lại diff + kết quả gọi lại `/api/qa-test` và `/api/db-test`. Tôi (Claude) sẽ tự gọi lại 2 route này độc lập để xác nhận trước khi coi là hoàn tất.

---

## FIX 1 [P0] — Trùng `display_number` khi tạo đồng thời (DB-11/12)

### Vấn đề xác nhận
Gọi `/api/qa-test`, kịch bản `DB-11/12` trả về:
```
"Collision detected! Display numbers: 11688, 11689, 11689, 11689, 11689"
```
4/5 request tạo Candidate đồng thời nhận trùng `display_number`. Nguyên nhân: `COALESCE((SELECT MAX(display_number) FROM ...), 0) + 1` được tính ngay trong câu `INSERT`, nhưng không có cơ chế khoá nào ngăn 2 transaction đọc cùng giá trị `MAX` trước khi transaction kia commit.

### Vị trí bị ảnh hưởng (đều dùng chung pattern lỗi)
- `src/app/actions.js` — `createCandidateWithStrictValidation` (INSERT vào `candidates`, khoảng dòng 955-965)
- `src/app/actions.js` — `assignCandidateToJob` (INSERT vào `activity`, khoảng dòng 745-755)
- `src/app/actions.js` — tạo `clients` mới (khoảng dòng 1780)
- `src/app/actions.js` — tạo `jobs` mới (khoảng dòng 1845)

### Giải pháp yêu cầu: chuyển sang PostgreSQL SEQUENCE (không dùng advisory lock thủ công)
Bảng `client_persons` đã làm đúng theo cách này từ trước (`display_number` có default `nextval('client_persons_display_number_seq'::regclass)`) — áp dụng chính xác cùng pattern cho 4 bảng còn lại: `candidates`, `activity`, `jobs`, `clients`.

**Bước 1 — Tạo SEQUENCE cho từng bảng, ở CẢ 2 schema `sandbox` và `public`** (8 sequence tổng cộng). Với mỗi schema, chạy:
```sql
-- Lặp lại cho: candidates, activity, jobs, clients — và cho cả schema sandbox lẫn public
CREATE SEQUENCE IF NOT EXISTS <schema>.<table>_display_number_seq;

-- Set giá trị bắt đầu = MAX hiện tại + 1 của ĐÚNG schema đó (không lấy nhầm từ schema khác)
SELECT setval(
  '<schema>.<table>_display_number_seq',
  COALESCE((SELECT MAX(display_number) FROM <schema>.<table>), 0) + 1,
  false
);

ALTER TABLE <schema>.<table>
  ALTER COLUMN display_number SET DEFAULT nextval('<schema>.<table>_display_number_seq');
```
⚠️ **Lưu ý bắt buộc:** `sandbox` và `public` có dữ liệu khác nhau (số dòng khác nhau hoàn toàn — xem `docs/architecture/schema-map.md`), nên MỖI schema phải có sequence RIÊNG, set giá trị khởi đầu dựa trên MAX của ĐÚNG schema đó. Không dùng chung 1 sequence cho cả 2 schema.

**Bước 2 — Sửa code JS:** Bỏ hẳn phần tính `COALESCE((SELECT MAX(display_number)...), 0) + 1` ra khỏi câu `INSERT` ở cả 4 vị trí trên. Không truyền `display_number` trong danh sách cột/giá trị `INSERT` nữa — để cột tự nhận giá trị từ `DEFAULT nextval(...)` mới thêm ở Bước 1. (Cách này an toàn tuyệt đối vì `nextval()` là atomic ở cấp DB, không cần lock thủ công, không cần transaction đặc biệt.)

**Bước 3 — Verify:** Sau khi sửa, gọi lại `/api/qa-test`, xác nhận `DB-11/12` trả `PASS` với 5 số `display_number` khác nhau, liên tục tăng dần, không trùng.

---

## FIX 2 [P1] — Bỏ sót phát hiện trùng lặp khi dữ liệu cũ chưa chuẩn hoá (DB-18)

### Vấn đề xác nhận
Gọi `/api/db-test`, kịch bản `DB-18` trả về `"Action succeeded unexpectedly."` — hệ thống cho phép tạo candidate mới với LinkedIn URL trùng (chỉ khác định dạng: có `www.`/query param) với một candidate đã tồn tại có URL lưu ở dạng thô, chưa chuẩn hoá.

### Nguyên nhân
`createCandidateWithStrictValidation` (trong `src/app/actions.js`, khoảng dòng 940-951) tự viết một đoạn kiểm tra trùng lặp RIÊNG, đơn giản hơn hàm `checkCandidateContactDuplicate` đã có sẵn (dòng ~817). Đoạn kiểm tra riêng này so khớp **chính xác tuyệt đối** (`=`) giữa giá trị mới đã chuẩn hoá và `LOWER(TRIM(cp.value))` — giả định MỌI giá trị cũ trong `contact_points` đã luôn ở dạng chuẩn hoá sẵn. Với dữ liệu cũ import từ Notion hoặc chèn tay, giả định này không đúng → trùng lặp lọt lưới.

Trong khi đó, hàm `checkCandidateContactDuplicate` đã có sẵn dùng `LIKE '%normalized%'` — khoan dung hơn với dữ liệu chưa chuẩn hoá, đã verify hoạt động đúng qua `DB-20` PASS.

### Giải pháp yêu cầu: dùng LẠI `checkCandidateContactDuplicate`, không viết bộ kiểm tra riêng
1. Sửa chữ ký hàm `checkCandidateContactDuplicate(contactPoints, currentCandidateId = null)` → thêm tham số thứ 3: `checkCandidateContactDuplicate(contactPoints, currentCandidateId = null, sqlClient = sql)`. Bên trong hàm, đổi mọi lệnh gọi `sql\`...\`` thành `sqlClient\`...\`` (để hàm có thể chạy trong transaction khi cần).
2. Trong `createCandidateWithStrictValidation`, bên trong khối `sql.begin(async (sqlTx) => { ... })`: **xoá đoạn code tự viết kiểm tra trùng lặp riêng** (khối `for (const c of normalizedContacts) { const dups = await sqlTx\`...\` ... }`), thay bằng:
   ```js
   const dupCheck = await checkCandidateContactDuplicate(contactPoints, null, sqlTx);
   if (dupCheck.hasDuplicate) {
     const d = dupCheck.duplicates[0];
     throw new Error(`Duplicate Contact Detected: ${d.type} (${d.value}) is already registered for Candidate #${d.matchedCandidate.display_number} - ${d.matchedCandidate.full_name}.`);
   }
   ```
3. **Verify:** Gọi lại `/api/db-test`, xác nhận `DB-18` chuyển sang `PASS`. Đồng thời gọi lại `DB-17`, `DB-19`, `DB-20` và `/api/qa-test` để đảm bảo KHÔNG có hồi quy (regression) — các kịch bản dedup khác vẫn phải PASS như cũ.

---

## Ghi chú — KHÔNG cần sửa: `DB-09` (định dạng SĐT `+84...`)
Kịch bản `DB-09` trong `/api/db-test` báo FAIL vì bản thân file test đang kỳ vọng SAI định dạng (`0912345678` thay vì `+84912345678`). Product Owner đã xác nhận **`+84912345678` (mã vùng + số, không dấu cách) mới là định dạng chuẩn đúng yêu cầu** — hành vi hiện tại của app là ĐÚNG. Nếu rảnh, có thể sửa lại assertion trong `src/app/api/db-test/route.js` (dòng ~130, đổi điều kiện kiểm tra từ `'0912345678'` sang `'+84912345678'`) cho khỏi gây nhiễu kết quả test lần sau — không bắt buộc, không liên quan đến 2 fix trên.

---

## Yêu cầu báo cáo (bắt buộc)
Sau khi sửa xong CẢ 2 fix, dán lại cho tôi:
1. `git diff` đầy đủ của `src/app/actions.js`.
2. Toàn bộ câu SQL đã chạy để tạo sequence (để tôi đối chiếu qua Supabase MCP độc lập).
3. Kết quả JSON thô khi tự gọi `/api/qa-test` và `/api/db-test` SAU khi sửa.

Không viết "100% PASS" hay kết luận đã sửa xong trong báo cáo — chỉ nêu bằng chứng thô, tôi sẽ tự xác nhận.
