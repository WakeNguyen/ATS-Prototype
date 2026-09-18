# QA Report (PHẦN 5.8 + Fix 5.8.1 + Fix 5.8.2) — Tag Management Nâng Cao — 2026-09-03/04

**Người review:** Claude (Architect/QA) — độc lập với AG (Implementer)
**Đối tượng review:** Commit `6ff6b3d` (feature chính) + `338744d` (fix 5.8.1, overflow clipping) + `f5824f7` (fix 5.8.2, z-index/stacking) + 2 commit devlog fixup đi kèm.
**Phương pháp:** Đối chiếu diff với FIX_SPEC gốc + 2 prompt fix nhanh đã gửi trực tiếp trong hội thoại, cộng xác minh độc lập bằng SQL/DB constraint thật trên Supabase sandbox (không dựa script test của AG).

**Kết luận: ✅ PASS**

---

## PHẦN 1 — Bối cảnh 2 fix phát sinh giữa chừng

Trong lúc AG code xong PHẦN 5.8 gốc, User tự tay thử tính năng Rename trên UI thật và phát hiện 2 vấn đề UX liên tiếp — cả 2 đều được xử lý ngay trong phiên, không phải đợi vòng QA sau:

1. **5.8.1:** Bấm Rename nhưng không cancel được, phải chuyển sub-tab mới thoát. Nguyên nhân xác định qua đọc code: `campaigns/page.js` bọc `GroupTypeTagEditor` (Library tab) trong `<div className="overflow-x-auto">` thừa — tác dụng phụ CSS khiến `overflow-y` cũng bị kẹp theo, cắt mất phần popover (vốn đã có đủ cả 3 cách thoát: nút X, nút Cancel, phím Escape — AG code đủ ngay từ đầu, chỉ là bị CSS cha che khuất). Fix: bỏ hẳn wrapper thừa đó.
2. **5.8.2:** Sau khi bỏ wrapper, popover không bị cắt nữa nhưng lại hiện đè/lẫn với bảng bên dưới (ảnh User gửi cho thấy chữ header bảng xen vào giữa popover). Nguyên nhân: Toolbar chứa popover không có `position`+`z-index` riêng nên không chắc thắng được `<thead className="sticky z-10">` của bảng về thứ tự vẽ. Fix đề xuất: thêm `relative z-20` cho Toolbar.

AG đã áp cả 2 fix, còn làm kỹ hơn đề xuất: Toolbar dùng `relative z-30` (cao hơn đề xuất `z-20`), và thêm cả `z-50 opacity-100` ngay tại tag pill đang renaming (`GroupTypeTagEditor.js`) — lớp bảo vệ kép chắc chắn hơn, không sai lệch ý đồ.

---

## PHẦN 2 — Đối chiếu code với FIX_SPEC gốc (PHẦN D/E/F)

### 2.1 Migration (PHẦN D) — xác minh trực tiếp trên Supabase, cả 2 schema

| Ràng buộc | `sandbox` | `public` |
|---|---|---|
| `UNIQUE INDEX social_group_tags_name_lower_key ON (lower(name))` | ✅ tồn tại | ✅ tồn tại |
| `CHECK social_group_tags_name_charset_check (name ~ '^[A-Za-z0-9 _-]+$')` | ✅ tồn tại | ✅ tồn tại |

### 2.2 Backend (`campaign_actions.js`)

| Hàm | Đối chiếu |
|---|---|
| `isValidTagName()` | Khớp 100% spec. |
| `updateSocialGroupTags()` | Khớp 100% — validate all-or-nothing trước khi ghi, `ON CONFLICT ((lower(name))) DO NOTHING` đúng expression index. |
| `renameTagInRegistry()` | Khớp 100% — transaction `sql.begin`, `array_replace` đồng bộ registry + toàn bộ group, bắt `error.code === '23505'` để trả lỗi CHẶN (không dựa SELECT-check-trước dễ dính race condition, đúng ý đồ spec). |
| `bulkRemoveTagFromGroups()` | Khớp 100% — `array_remove`, không đụng tag khác. |
| `deleteTagFromRegistry()` | Có bổ sung `inUseCount` trong response lỗi — đúng theo đề xuất "nên làm" ở spec F.2 (không bắt buộc), giúp FE không phải regex-parse message. Cộng điểm. |
| `createSocialGroup()` | Không có trong spec gốc nhưng AG **tự giác mở rộng** cùng validate charset — nhất quán, không sai lệch, giảm rủi ro lọt tag có dấu qua đường tạo group mới. |

### 2.3 Frontend (`GroupTypeTagEditor.js` + `campaigns/page.js`)

- ✅ Nút Rename (icon `Edit2`) cạnh nút Delete, đúng vị trí, đúng hành vi disable khi đang xử lý.
- ✅ Popover Rename: input, lỗi hiển thị inline (không dùng `alert()` cho lỗi validate — đúng yêu cầu), nút Cancel + X + Escape đều hoạt động (sau 2 fix).
- ✅ Luồng Delete bị chặn: `window.confirm()` hỏi tháo N nhóm → `bulkRemoveTagFromGroups` → `deleteTagFromRegistry` lại → đúng luồng liền mạch F.2 yêu cầu.
- ✅ Toolbar Library tab: `relative z-30` (fix 5.8.2), không còn `overflow-x-auto` thừa (fix 5.8.1).

---

## PHẦN 3 — Xác minh độc lập trên dữ liệu thật (Supabase sandbox, không dùng script của AG)

Tự tái tạo tay từng kịch bản PHẦN G của spec bằng SQL thô, độc lập hoàn toàn với `scratch/test_phase5_8.mjs` của AG:

1. **Chặn trùng tên (case-insensitive), không gộp:** tạo 2 tag `QA58 Test A` / `QA58 Test B`, thử `UPDATE ... SET name='qa58 test b' WHERE name='QA58 Test A'` → **DB từ chối ngay** với `23505 duplicate key value violates unique constraint "social_group_tags_name_lower_key"` — đúng cơ chế CHẶN mà `renameTagInRegistry` dựa vào, xác nhận không có đường nào lách qua được kể cả thao tác SQL trực tiếp (bảo vệ ở tầng DB, không chỉ tầng app).
2. **Chặn ký tự có dấu:** thử đổi tên thành `Kiểm Tra` → **DB từ chối** với `23514 violates check constraint "social_group_tags_name_charset_check"` — xác nhận charset bị khoá cứng ở tầng DB, không phụ thuộc hoàn toàn vào validate phía app (defense-in-depth thật, không phải chỉ giả định).
3. **Rename lan toả đúng & atomic:** gắn tag `QA58 Test A` vào 3 group thật (kèm tag khác sẵn có `Tech Community`/`Facebook Group`), chạy đúng transaction của `renameTagInRegistry` (rename registry + `array_replace` toàn bảng trong 1 BEGIN/COMMIT) → cả 3 group đổi đúng sang `QA58 Renamed`, các tag khác của cùng group **không bị ảnh hưởng**, registry chỉ còn tên mới (không tạo dòng trùng).
4. **Bulk remove sạch:** `array_remove('QA58 Renamed')` trên 3 group đó → cả 3 quay lại đúng 2 tag gốc, không sót không dư.
5. Dọn dẹp toàn bộ dữ liệu test, xác nhận `sandbox.social_group_urls` quay về đúng baseline 141 dòng.

## PHẦN 4 — `docs/DEVELOPMENT_LOG.md`

Xác nhận qua `git show`: cả bảng tổng hợp Snapshot (`SNAP-20260903-68`, gộp chung PHẦN 5.8 + ghi rõ cả 2 fix 5.8.1/5.8.2 trong cùng 1 dòng) và mục chi tiết phía dưới đều được cập nhật đầy đủ, đúng `devlog-summary-table-rule.md`.

---

## Kết luận cuối cùng

| Hạng mục | Kết quả |
|---|---|
| Migration `lower(name)` unique + charset CHECK (2 schema) | ✅ |
| Rename: chặn trùng hoa/thường, KHÔNG gộp | ✅ (xác nhận ở tầng DB) |
| Rename: chặn ký tự có dấu | ✅ (xác nhận ở tầng DB) |
| Rename: lan toả đúng registry + mọi group, atomic | ✅ |
| Bulk remove tag khỏi N group | ✅ |
| Luồng Delete bị chặn → gộp bulk-remove | ✅ |
| Fix 5.8.1 (popover bị cắt mất Cancel) | ✅ đã fix, xác nhận qua code |
| Fix 5.8.2 (popover đè/lẫn bảng) | ✅ đã fix, còn làm kỹ hơn đề xuất |
| DEVELOPMENT_LOG.md (2 phần) | ✅ |
| **Verdict PHẦN 5.8** | **✅ PASS trọn gói (kèm cả 2 fix)** |
