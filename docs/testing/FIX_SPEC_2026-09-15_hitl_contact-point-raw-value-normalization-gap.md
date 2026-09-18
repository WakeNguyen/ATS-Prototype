**Từ:** Claude (Architect/QA)

# FIX_SPEC_2026-09-15 — 2 luồng HITL ghi Contact Point CHƯA qua chuẩn hóa (`hitl_actions.js`)

## Bối cảnh

Sau khi fix dedup Contact Point trong cùng 1 candidate (`FIX_SPEC_2026-09-15_candidate360_contact-point-same-candidate-dedup-gap.md`), PO đặt câu hỏi: nếu 1 bản ghi ĐÃ CÓ trong DB chưa từng qua `normalizeContactValue` (ví dụ Phone dạng `0901234567` thay vì `+84901234567`, hoặc URL còn `https://www.`), thì dedup mới xử lý ra sao?

**Phát hiện:** Dedup query trong `addContactPoint`/`updateContactPoint` chỉ áp `LOWER(TRIM(cp.value))` lên giá trị ĐÃ CÓ trong DB — điều này tương đương `normalizeContactValue` cho type **Email** (chỉ lowercase+trim) nên vô hại, nhưng **KHÔNG tương đương** cho **Phone** (chuẩn hóa về `+84...`) và **URL** (bỏ `https://`/`www.`/`/` cuối). Nếu bản ghi cũ trong DB là dạng thô, dedup sẽ bỏ sót.

**Nguyên nhân gốc (đã xác nhận qua đọc code, `src/app/hitl_actions.js`):** 2 luồng ghi `contact_points` KHÔNG gọi `normalizeContactValue` trước khi insert giá trị thật xuống DB:
1. `createCandidateFromPayload` (dòng 63-93, dùng khi FORCE_CREATE candidate mới từ CV Parser HITL) — dòng 89 insert thẳng `value: cp.value` (raw từ payload CV Parser), không normalize.
2. Luồng MERGE thêm contact point mới (dòng 186-218) — dòng 199 CÓ gọi `normalizeContactValue` để tính `normVal` dùng cho dedup check (so sánh đúng), nhưng dòng 208 khi insert lại dùng `value: cp.value` (raw) thay vì `normVal` đã tính sẵn — dedup logic đúng, nhưng giá trị ghi xuống DB vẫn thô.

Đây là nguyên nhân khiến dữ liệu "thô" (chưa chuẩn hóa) tồn tại thật trong DB, làm giảm hiệu quả dedup ở các thao tác thêm/sửa thủ công sau này qua Candidate 360.

## Phạm vi (1 file — chỉ sửa code, KHÔNG đụng dữ liệu đã có)

`src/app/hitl_actions.js`

**Quan trọng:** Spec này CHỈ vá 2 điểm ghi mới — KHÔNG backfill/UPDATE dữ liệu cũ đã tồn tại trong `contact_points` (kể cả `sandbox` lẫn `public`). Việc backfill dữ liệu thật là quyết định riêng, cần PO duyệt tách biệt theo GEMINI.md mục 9 (thao tác UPDATE hàng loạt trên dữ liệu thật) — KHÔNG nằm trong phạm vi task này.

## Việc cần làm

### 1. `createCandidateFromPayload` (dòng ~85-93)

Đổi từ:
```js
const contactInserts = payload.contactPoints.map(cp => ({
  candidate_id: newCand.id,
  type: cp.type,
  value: cp.value,
  created_time: new Date(),
  last_updated: new Date()
}));
```
thành (chuẩn hóa giá trị trước khi insert; nếu không chuẩn hóa được — ví dụ số điện thoại sai định dạng — giữ nguyên hành vi cũ là dùng giá trị gốc thay vì tự ý loại bỏ record, tương tự cách luồng MERGE đã xử lý ở dòng 200 hiện có):
```js
const contactInserts = payload.contactPoints
  .filter(cp => cp && cp.value)
  .map(cp => {
    const normVal = normalizeContactValue(cp.type, cp.value);
    return {
      candidate_id: newCand.id,
      type: cp.type,
      value: normVal || cp.value,
      created_time: new Date(),
      last_updated: new Date()
    };
  });
```
(`normalizeContactValue` đã được import sẵn ở đầu file — dòng 4 — không cần thêm import.)

### 2. Luồng MERGE (dòng ~204-213)

Đổi từ:
```js
const contactInserts = dedupedContactPoints.map(cp => ({
  candidate_id: targetCandidateId,
  type: cp.type,
  value: cp.value,
  created_time: new Date(),
  last_updated: new Date()
}));
```
thành (tái sử dụng lại giá trị `normVal` đã tính đúng ở dòng 199 trong vòng lặp filter phía trên — cần tính lại 1 lần nữa ở đây vì `normVal` trong `.filter()` không còn scope ở `.map()` này, viết gọn bằng cách tính lại qua `normalizeContactValue`, KHÔNG đổi logic dedup ở khối `.filter()` phía trên):
```js
const contactInserts = dedupedContactPoints.map(cp => {
  const normVal = normalizeContactValue(cp.type, cp.value);
  return {
    candidate_id: targetCandidateId,
    type: cp.type,
    value: normVal || cp.value,
    created_time: new Date(),
    last_updated: new Date()
  };
});
```

## Việc KHÔNG được làm

- Không UPDATE/backfill bất kỳ dòng nào đã tồn tại sẵn trong `contact_points` (cả `sandbox` lẫn `public`) — chỉ áp dụng cho record MỚI insert từ nay.
- Không đổi logic dedup ở khối `.filter()` (dòng 197-202) của luồng MERGE — logic so sánh ở đó đã đúng, chỉ phần INSERT giá trị là cần sửa.
- Không đụng `addContactPoint`/`updateContactPoint` (`actions.js`) — đã fix đúng phạm vi ở task trước, không liên quan task này.
- Không đụng `src/app/api/webhooks/cv-import/route.js` — CẦN Claude đọc riêng để xác nhận có cùng lỗi hay không trước khi quyết định có đưa vào phạm vi hay không (xem mục "Ghi chú" bên dưới); AG KHÔNG tự ý mở rộng sang file này dù thấy tương tự.

## Ghi chú cho Claude (không phải việc của AG)

`src/app/api/webhooks/cv-import/route.js` dòng 111 cũng có `INSERT INTO contact_points ${sql(contactInserts)}` — Claude sẽ tự đọc và đánh giá riêng (không giao trong spec này) vì cần xác nhận rõ payload từ n8n đã qua chuẩn hóa ở tầng nào trước khi tới route này.

## Yêu cầu tài liệu (GEMINI.md mục 10.2)

Thêm 1 mục mới vào `docs/DEVELOPMENT_LOG.md` theo template mục 10.3.

## Verify bắt buộc trước khi báo hoàn thành

1. `node --check src/app/hitl_actions.js` → PASS.
2. `git diff --stat` → chỉ `src/app/hitl_actions.js` (+ doc).
3. Test cách ly trong `sandbox` (tự tạo/tự dọn, KHÔNG dùng candidate/pending_cv_imports thật — tuân thủ mục 10.8 GEMINI.md):
   - Giả lập FORCE_CREATE với `contactPoints: [{type: 'Phone', value: '0901234567'}]` → query DB xác nhận `contact_points.value` đã lưu ở dạng `+84901234567` (chuẩn hóa), KHÔNG phải `0901234567` thô.
   - Giả lập MERGE thêm contact point mới `{type: 'Phone', value: '0987654321'}` vào 1 candidate test đã có sẵn → xác nhận giá trị lưu xuống DB là `+84987654321` (chuẩn hóa).
   - Test thêm 1 case URL (ví dụ LinkedIn `https://www.linkedin.com/in/test-user/`) qua cả 2 luồng → xác nhận lưu xuống DB đã bỏ `https://www.` và `/` cuối.
   - Dọn sạch dữ liệu test sau khi xong.
4. Chạy lại `/api/biz-test` (không cần thêm test case mới bắt buộc cho task này vì đây là 2 luồng nội bộ khó tự động hoá qua HTTP thật — nhưng nếu AG thấy khả thi thêm 1 case verify nhanh thì càng tốt, không bắt buộc) → PASS 100%, không regression.
5. `npm run build` → PASS 100% routes.

Báo cáo hoàn thành kèm `git status`, `git diff --stat`, `npm run build`, và giá trị thật quan sát được ở 3 kịch bản test tại mục 3.

## Quy ước xử lý khi phát hiện lệch spec hoặc không rõ ràng

- Lệch nhỏ → tự sửa, ghi chú, KHÔNG dừng.
- Đụng database/API/quyết định sản phẩm ngoài phạm vi (đặc biệt: PHÁT HIỆN CẦN BACKFILL DỮ LIỆU CŨ) → DỪNG NGAY, in `ESCALATE: <mô tả>` — đây là quyết định của PO, không tự làm.
- Chỉ cần hỏi 1 chi tiết kỹ thuật nhỏ → in `QUESTION: <câu hỏi>` rồi dừng.
