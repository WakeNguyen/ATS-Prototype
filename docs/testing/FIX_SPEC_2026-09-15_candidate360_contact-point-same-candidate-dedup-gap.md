**Từ:** Claude (Architect/QA)

# FIX_SPEC_2026-09-15 — Thiếu dedup Contact Point trong CÙNG 1 candidate (Candidate 360° — Contact Points Hub)

## Bối cảnh

PO phản hồi qua screenshot Candidate 360° (Contact Points Hub) — thêm thử 1 email trùng vào hồ sơ, hệ thống vẫn chấp nhận, không có cơ chế chặn.

## Nguyên nhân (đã xác nhận 100% qua đọc code thật, `src/app/actions.js`)

`addContactPoint` (dòng 731-767) CÓ cơ chế chống trùng ("Strict Duplicate Check", dòng 738-750), nhưng câu query **chỉ kiểm tra CROSS-CANDIDATE**:
```js
const dups = await tx`
  SELECT cp.id
  FROM contact_points cp
  WHERE cp.candidate_id != ${candidateId}   // <-- LOẠI TRỪ chính candidate đang thao tác
    AND cp.type ILIKE ${'%' + type + '%'} 
    AND LOWER(TRIM(cp.value)) = ${normalized}
  LIMIT 1
`;
```
Điều kiện `cp.candidate_id != ${candidateId}` khiến hàm **KHÔNG BAO GIỜ** phát hiện được trường hợp candidate A cố thêm 1 contact point ĐÃ CÓ SẴN của chính candidate A — đúng kịch bản PO vừa gặp. `updateContactPoint` (dòng 770-813) mắc lỗi tương tự (dòng 778-786, cũng loại trừ `cp.candidate_id != ${candidateId}`).

Đối chiếu `docs/architecture/schema-map.md` mục `contact_points` — không có UNIQUE constraint nào ở tầng DB làm lớp chặn dự phòng (`(candidate_id, type, value)` không unique) — nghĩa là đây là lỗ hổng thật ở CẢ tầng ứng dụng lẫn tầng DB, không có lớp nào khác bắt lỗi thay.

**Xác nhận KHÔNG phải lỗi UI:** `src/app/candidates/page.js` dòng 907-920 (`handleAddContact`) đã hiển thị đúng `res.error` qua `notify(...)` khi `success: false` — nếu backend trả lỗi, UI sẽ hiện đúng. Vấn đề nằm 100% ở backend, không cần sửa UI.

## Phạm vi (1 file — không sửa gì khác)

`src/app/actions.js`

Không đụng luồng dedup riêng của CV Parser/HITL Merge (`hitl_actions.js`, `syncCandidateAggregatedContacts`) — đó là luồng khác, không liên quan tới bug này, đã có test suite riêng (`DB-20 Deduplication Engine`).

## Việc cần làm

### 1. `addContactPoint` (dòng ~738-750) — gộp thành 1 query kiểm tra CẢ 2 trường hợp, phân biệt message

Đổi từ:
```js
const dups = await tx`
  SELECT cp.id
  FROM contact_points cp
  WHERE cp.candidate_id != ${candidateId} 
    AND cp.type ILIKE ${'%' + type + '%'} 
    AND LOWER(TRIM(cp.value)) = ${normalized}
  LIMIT 1
`;

if (dups.length > 0) {
  throw new Error(`Duplicate Contact Detected: This contact is already associated with another candidate.`);
}
```
thành:
```js
const dups = await tx`
  SELECT cp.id, cp.candidate_id
  FROM contact_points cp
  WHERE cp.type ILIKE ${'%' + type + '%'} 
    AND LOWER(TRIM(cp.value)) = ${normalized}
  LIMIT 1
`;

if (dups.length > 0) {
  if (dups[0].candidate_id === candidateId) {
    throw new Error(`This contact already exists on this candidate's profile.`);
  }
  throw new Error(`Duplicate Contact Detected: This contact is already associated with another candidate.`);
}
```

### 2. `updateContactPoint` (dòng ~777-791) — áp dụng cùng pattern, giữ nguyên khối `if (candidateId) { ... }` bao ngoài (không đổi hành vi khi `candidateId` không được truyền — ngoài phạm vi bug này)

Đổi từ:
```js
if (candidateId) {
  const dups = await tx`
    SELECT cp.id
    FROM contact_points cp
    WHERE cp.candidate_id != ${candidateId} 
      AND cp.id != ${contactId}
      AND cp.type ILIKE ${'%' + type + '%'} 
      AND LOWER(TRIM(cp.value)) = ${normalized}
    LIMIT 1
  `;
  
  if (dups.length > 0) {
    throw new Error(`Duplicate Contact Detected: This contact is already associated with another candidate.`);
  }
}
```
thành:
```js
if (candidateId) {
  const dups = await tx`
    SELECT cp.id, cp.candidate_id
    FROM contact_points cp
    WHERE cp.id != ${contactId}
      AND cp.type ILIKE ${'%' + type + '%'} 
      AND LOWER(TRIM(cp.value)) = ${normalized}
    LIMIT 1
  `;
  
  if (dups.length > 0) {
    if (dups[0].candidate_id === candidateId) {
      throw new Error(`This contact already exists on this candidate's profile.`);
    }
    throw new Error(`Duplicate Contact Detected: This contact is already associated with another candidate.`);
  }
}
```

## Việc KHÔNG được làm

- Không đổi `normalizeContactValue` (`src/lib/utils.js`) — logic chuẩn hoá hiện đúng, không phải nguyên nhân.
- Không đụng `hitl_actions.js`, luồng MERGE, hay `syncCandidateAggregatedContacts`.
- Không thêm UNIQUE constraint ở DB trong spec này (thay đổi schema cần cân nhắc riêng vì `public.contact_points` đang có 10,856 dòng thật — rủi ro migration fail nếu đã tồn tại dữ liệu trùng sẵn; để dành đánh giá sau nếu cần lớp phòng thủ kép ở DB).

## Yêu cầu tài liệu (GEMINI.md mục 10.2)

Thêm 1 mục mới vào `docs/DEVELOPMENT_LOG.md` theo template mục 10.3.

## Verify bắt buộc trước khi báo hoàn thành

1. `node --check src/app/actions.js` → PASS.
2. `git diff --stat` → chỉ `src/app/actions.js` (+ doc bắt buộc).
3. Test cách ly trong `sandbox` (tự tạo, tự dọn theo mục 10.8 GEMINI.md — KHÔNG dùng candidate thật):
   - Tạo candidate test A, `addContactPoint(A, 'Email Address', 'dedup-test-A@example.com')` → `success:true`.
   - Gọi lại y hệt `addContactPoint(A, 'Email Address', 'dedup-test-A@example.com')` lần 2 → PHẢI trả `success:false`, message `"This contact already exists on this candidate's profile."`.
   - Tạo candidate test B, `addContactPoint(B, 'Email Address', 'dedup-test-A@example.com')` (trùng candidate A) → PHẢI trả `success:false`, message `"Duplicate Contact Detected: This contact is already associated with another candidate."` (xác nhận hành vi cross-candidate cũ KHÔNG bị hỏng do refactor).
   - Test tương tự cho `updateContactPoint` (sửa 1 contact point khác của A thành trùng giá trị contact đã có sẵn của chính A → bị chặn với message same-candidate).
   - Dọn sạch candidate A, B và toàn bộ contact_points liên quan sau khi verify xong.
4. Thêm 1 test case mới vào `/api/biz-test` (`BIZ-26` — theo đúng pattern isolated test data + cleanup của `BIZ-24`/`BIZ-25`) tự động hoá đúng kịch bản trên (same-candidate dedup phải bị chặn).
5. Chạy lại toàn bộ `/api/biz-test` → PASS 100% (bao gồm `BIZ-26` mới), không regression các case cũ (đặc biệt `BIZ-24`, `BIZ-25` liên quan `contact_points`/candidate).
6. `npm run build` → PASS 100% routes.

Báo cáo hoàn thành phải kèm output nguyên văn `git status`, `git diff --stat`, `npm run build`, và kết quả 4 kịch bản test ở mục 3 (nêu rõ message lỗi thật nhận được, không ghi "PASS" suông).

## Quy ước xử lý khi phát hiện lệch spec hoặc không rõ ràng

- Lệch nhỏ (không đổi hành vi nghiệp vụ) → tự sửa, ghi chú, KHÔNG dừng.
- Đụng database/API/quyết định sản phẩm ngoài phạm vi → DỪNG NGAY, in `ESCALATE: <mô tả>`.
- Chỉ cần hỏi 1 chi tiết kỹ thuật nhỏ → in `QUESTION: <câu hỏi>` rồi dừng.
