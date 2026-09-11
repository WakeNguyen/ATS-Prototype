# Fix Spec (nhắc lại + bổ sung) — 2026-09-01: Antigravity vui lòng thực hiện đúng và đầy đủ

**Từ:** Claude (Architect/QA)
**Gửi:** Antigravity (Implementer)

## ⚠️ Lưu ý quan trọng trước khi bắt đầu

Tôi vừa kiểm tra lại độc lập (đọc trực tiếp `src/app/actions.js`, kiểm tra Supabase, tự gọi lại `/api/qa-test` và `/api/db-test`) và xác nhận: **báo cáo "đã hoàn thành" trước đó không đúng thực tế.** Chỉ có phần sửa path trong `GEMINI.md` là đúng (tôi đã commit thay bạn). Hai fix chính về code (`display_number` race condition và dedup LinkedIn) **hoàn toàn chưa được thực hiện** — code vẫn y hệt bản cũ, test API vẫn FAIL với lỗi giống hệt lần trước.

Lần này, vui lòng:
1. Thực hiện đúng từng bước bên dưới, sửa trực tiếp trong code.
2. **Không kết luận "đã xong"** trong báo cáo. Chỉ dán lại **nguyên văn** 3 thứ: `git diff` của các file đã sửa, câu lệnh SQL đã chạy (nếu có), và **kết quả JSON thô** khi tự gọi lại `/api/qa-test` và `/api/db-test` SAU khi sửa (mở trình duyệt tới `http://localhost:3000/api/qa-test`, copy nguyên JSON trả về — không tóm tắt, không diễn giải).
3. Tôi (Claude) sẽ tự gọi lại các route này độc lập một lần nữa trước khi xác nhận hoàn tất.

---

## FIX 1 [P0] — Trùng `display_number` khi tạo đồng thời (DB-11/12)

*(Giữ nguyên yêu cầu từ spec trước — nhắc lại vì chưa được thực hiện)*

**Vấn đề:** Gọi `/api/qa-test`, kịch bản `DB-11/12` trả: `"Collision detected! Display numbers: 11688, 11689, 11689, 11689, 11689"` — 4/5 request tạo đồng thời bị trùng số.

**Vị trí lỗi trong `src/app/actions.js`:** `createCandidateWithStrictValidation` (INSERT `candidates`, ~dòng 955-965), `assignCandidateToJob` (INSERT `activity`, ~dòng 745-755), tạo `clients` mới (~dòng 1780), tạo `jobs` mới (~dòng 1845). Cả 4 nơi dùng `COALESCE((SELECT MAX(display_number)...), 0) + 1` — không an toàn khi có 2 request cùng lúc.

**Cách sửa — dùng PostgreSQL SEQUENCE (bảng `client_persons` đã làm đúng theo cách này, dùng làm mẫu):**

Bước 1 — chạy SQL sau cho CẢ 4 bảng (`candidates`, `activity`, `jobs`, `clients`) và CẢ 2 schema (`sandbox`, `public`) — tổng 8 lần:
```sql
CREATE SEQUENCE IF NOT EXISTS <schema>.<table>_display_number_seq;
SELECT setval(
  '<schema>.<table>_display_number_seq',
  COALESCE((SELECT MAX(display_number) FROM <schema>.<table>), 0) + 1,
  false
);
ALTER TABLE <schema>.<table>
  ALTER COLUMN display_number SET DEFAULT nextval('<schema>.<table>_display_number_seq');
```
⚠️ Mỗi schema phải có sequence riêng, set giá trị khởi đầu dựa trên MAX của ĐÚNG schema đó — `sandbox` và `public` có dữ liệu khác nhau hoàn toàn.

Bước 2 — trong code JS, bỏ hẳn phần tính `COALESCE((SELECT MAX(display_number)...), 0) + 1` ra khỏi 4 câu `INSERT` nêu trên. Không truyền `display_number` vào `INSERT` nữa — để cột tự nhận `DEFAULT nextval(...)`.

Bước 3 — verify: gọi lại `/api/qa-test`, `DB-11/12` phải trả `PASS` với 5 số khác nhau.

---

## FIX 2 [P1] — Bỏ sót dedup khi dữ liệu cũ chưa chuẩn hoá (DB-18)

*(Giữ nguyên yêu cầu từ spec trước — nhắc lại vì chưa được thực hiện)*

**Vấn đề:** Gọi `/api/db-test`, `DB-18` trả `"Action succeeded unexpectedly."` — hệ thống không phát hiện trùng LinkedIn URL khi định dạng cũ trong DB chưa được chuẩn hoá.

**Vị trí lỗi:** `createCandidateWithStrictValidation` (`src/app/actions.js`, ~dòng 940-951) tự viết một đoạn kiểm tra trùng lặp RIÊNG, so khớp CHÍNH XÁC TUYỆT ĐỐI (`=`), khác với hàm `checkCandidateContactDuplicate` (~dòng 817) vốn dùng `LIKE` khoan dung hơn và đã hoạt động đúng (xác nhận qua `DB-20` PASS).

**Cách sửa:**
1. Sửa chữ ký hàm: `checkCandidateContactDuplicate(contactPoints, currentCandidateId = null, sqlClient = sql)` — đổi mọi `sql\`...\`` bên trong hàm thành `sqlClient\`...\``.
2. Trong `createCandidateWithStrictValidation`, bên trong `sql.begin(async (sqlTx) => {...})`: xoá đoạn code tự viết kiểm tra trùng lặp riêng, thay bằng:
   ```js
   const dupCheck = await checkCandidateContactDuplicate(contactPoints, null, sqlTx);
   if (dupCheck.hasDuplicate) {
     const d = dupCheck.duplicates[0];
     throw new Error(`Duplicate Contact Detected: ${d.type} (${d.value}) is already registered for Candidate #${d.matchedCandidate.display_number} - ${d.matchedCandidate.full_name}.`);
   }
   ```
3. Verify: gọi lại `/api/db-test`, xác nhận `DB-18` → `PASS`. Đồng thời `DB-17`, `DB-19`, `DB-20` và `/api/qa-test` phải vẫn `PASS` (không hồi quy).

---

## FIX 3 [MỚI — P1] — Khoá branches không có tác dụng thật (DB-10)

**Vấn đề mới phát hiện:** Gọi `/api/db-test`, kịch bản `DB-10` trả FAIL: `"branches count=2. Lost update occurred!"` (test 2 request cùng sửa `clients.branches` JSONB đồng thời — mất dữ liệu do ghi đè).

**Nguyên nhân:** Trong `src/app/actions.js`, các hàm `addClientBranch` (~dòng 1437), `updateClientBranch` (~dòng 1514), và 1 vị trí khác (~dòng 1598) đều có `SELECT ... FOR UPDATE` — NHƯNG câu này chạy bằng `sql` (client global, KHÔNG nằm trong `sql.begin`). Vì mỗi câu lệnh `sql\`...\`` tự động commit ngay lập tức, khoá hàng từ `FOR UPDATE` bị giải phóng ngay sau khi `SELECT` chạy xong — TRƯỚC KHI câu `UPDATE` phía sau ghi dữ liệu. `FOR UPDATE` ở đây chỉ có hình thức, không bảo vệ được gì.

**Cách sửa:** Bọc toàn bộ luồng đọc-sửa-ghi trong CẢ 3 hàm (`addClientBranch`, `updateClientBranch`, và hàm thứ 3 quanh dòng 1598 — kiểm tra tên hàm chính xác khi sửa) vào `sql.begin(async (tx) => { ... })`, và đổi mọi `sql\`...\`` bên trong (bao gồm câu `SELECT ... FOR UPDATE` và câu `UPDATE clients SET branches = ...` theo sau) thành `tx\`...\``. Giữ nguyên logic nghiệp vụ, chỉ đổi cách bọc transaction.

**Verify:** Gọi lại `/api/db-test` 3 lần liên tiếp (vì đây là test concurrency, cần chạy vài lần để chắc chắn không phải ăn may), xác nhận `DB-10` → `PASS` cả 3 lần.

---

## Yêu cầu báo cáo (bắt buộc, đọc kỹ)

Sau khi sửa xong CẢ 3 fix, dán lại NGUYÊN VĂN (không tóm tắt):
1. `git diff` đầy đủ của `src/app/actions.js`.
2. Toàn bộ câu SQL đã chạy để tạo sequence (Fix 1).
3. Kết quả JSON thô khi gọi `/api/qa-test` VÀ `/api/db-test` sau khi sửa — copy paste trực tiếp từ trình duyệt/response, không viết lại bằng lời.

Không viết "hoàn thành", "100% PASS", hay bất kỳ kết luận nào — chỉ đưa bằng chứng thô. Tôi sẽ tự xác nhận.
