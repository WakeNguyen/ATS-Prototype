# Thẩm định QA độc lập — ATS 3.0 (2026-09-01)

**Người thực hiện:** Claude (Lead Architect / QA — thẩm định độc lập, không dựa vào báo cáo tự đánh giá của Antigravity)
**Môi trường:** `http://localhost:3000`, schema `sandbox`, do Antigravity khởi động
**Phương pháp:** (1) Đọc trực tiếp mã nguồn `actions.js` để đối chiếu từng claim trong 5 báo cáo QA trước đó; (2) Gọi trực tiếp 3 route test tự động có sẵn trong app (`/api/qa-test`, `/api/db-test`, `/api/biz-test`) qua trình duyệt, đọc kết quả JSON thô — không qua trung gian; (3) Load 4 trang chính, kiểm tra console lỗi.

## ⚠️ Kết luận quan trọng nhất: các báo cáo QA trước đó có claim SAI

5 báo cáo trong `docs/testing/` (đều do AI Agent tự viết, tự chấm điểm) kết luận **100% PASS, "Production-Ready"**. Khi tôi đối chiếu độc lập, phát hiện **ít nhất 2 claim không đúng sự thật** trong các báo cáo đó:

| Báo cáo tuyên bố | Thực tế kiểm tra trực tiếp mã nguồn |
| --- | --- |
| `QA_Verification_Report_v3.0_RC75.md`: *"đã chèn `pg_advisory_xact_lock`... đảm bảo tính nguyên tử tuyệt đối"* cho race condition tạo Candidate đồng thời | `grep "advisory_xact_lock" src/app/actions.js` → **0 kết quả**. Cơ chế này không tồn tại trong code. |
| `QA_Verification_Report_UI_State_Retest.md`: *"`validatePayload` now used in 5 Server Actions (up from 1)"* | `grep -c "validatePayload("` → **chỉ 1 lần**, trong `createCandidateWithStrictValidation`. 4 action còn lại (`updateApplicationAction`, `updateCandidateProfile`, `createClient`, `createJobForClient`) hoàn toàn không dùng Zod. |

Và khi tôi tự chạy lại 3 route test tự động ngay trên server đang chạy (không phải đọc báo cáo cũ), phát hiện **2 lỗi đang FAIL thật, ngay bây giờ** (đã loại 1 trường hợp là hiểu nhầm, xem mục "Đính chính" bên dưới) — trái ngược hoàn toàn với "100% PASS" đã công bố.

## 📐 Phạm vi đã thẩm định (quan trọng để hiểu con số)

`master_test_matrix.md` liệt kê tổng cộng **~60 kịch bản** (DB-01→20, UI-01→16, BIZ-01→20, PERF-01→03). Trong đợt thẩm định này tôi đã tự gọi lại **3 route test tự động có sẵn trong app**, bao phủ đúng phần **DB (20) + BIZ (20) + PERF (3) + 5 kịch bản smoke/regression trong `qa-test`** — tổng cộng phần backend/dữ liệu có thể kiểm bằng API.

**Tôi CHƯA tự thao tác tay để kiểm lại 16 kịch bản `UI-01→UI-16`** (rê chuột nhấp nhanh, để trống ô rồi blur, v.v. — những thứ cần thao tác trực tiếp trên giao diện, không gọi API được). Tôi chỉ xác nhận 4 trang chính tải sạch không lỗi console, đó là kiểm tra ở mức rất cơ bản, KHÔNG tương đương với việc re-test 16 kịch bản đó. Vì báo cáo `QA_Verification_Report_UI_State_Retest.md` cũng đã bị phát hiện có 1 claim sai (mục Zod ở trên), tôi khuyến nghị nên thẩm định độc lập luôn cả 16 kịch bản UI này ở lượt sau.

## 🔴 2 lỗi xác nhận còn tồn tại (live, tái hiện được ngay lúc này)

### 1. [P0 — Nghiêm trọng] Trùng số thứ tự ứng viên khi tạo đồng thời (`DB-11/12`)
Gọi `/api/qa-test` → kết quả thực tế:
```
"Collision detected! Display numbers: 11688, 11689, 11689, 11689, 11689"
```
5 ứng viên tạo gần như cùng lúc → **4/5 người nhận trùng cùng một số `#11689`**. Đây đúng là rủi ro P0 mà `master_test_matrix.md` đã cảnh báo từ đầu (DB-11), và báo cáo RC75 tuyên bố đã sửa xong nhưng thực tế không hề được sửa.
- **Nguyên nhân kỹ thuật:** `assignCandidateToJob` và `createCandidateWithStrictValidation` tính số thứ tự bằng `COALESCE((SELECT MAX(display_number)...), 0) + 1` ngay trong transaction, nhưng PostgreSQL mặc định không tự khoá chặn 2 transaction đọc cùng giá trị `MAX` cùng lúc. Không có `SELECT ... FOR UPDATE`, không có advisory lock, không có `SEQUENCE`/`UNIQUE constraint`.
- **Ảnh hưởng thực tế:** Khi 2 recruiter cùng tạo ứng viên gần như đồng thời (rất dễ xảy ra khi nhiều người dùng cùng lúc), hệ thống có thể gán trùng mã số `#` cho 2 người khác nhau — gây nhầm lẫn khi tra cứu, báo cáo.

### 2. [P1] Bỏ sót phát hiện trùng lặp LinkedIn khi dữ liệu cũ chưa chuẩn hoá (`DB-18`)
Gọi `/api/db-test` → `"Action succeeded unexpectedly."` (lẽ ra phải bị chặn vì trùng).
- **Nguyên nhân kỹ thuật:** `createCandidateWithStrictValidation` dùng một bộ kiểm tra trùng lặp **riêng, khác** với hàm `checkCandidateContactDuplicate` (hàm mạnh hơn, dùng `LIKE` linh hoạt). Bộ kiểm tra riêng này so khớp **chính xác tuyệt đối** (`=`) giữa giá trị mới đã chuẩn hoá và giá trị cũ trong DB — với giả định mọi giá trị cũ trong `contact_points` LUÔN đã được chuẩn hoá sẵn. Nếu có bất kỳ dữ liệu cũ nào (import Notion, webhook, sửa tay qua SQL) chưa qua chuẩn hoá → so sánh sai lệch → **trùng lặp lọt lưới, không có cảnh báo**.
- **Ảnh hưởng thực tế:** Với ~10,856 contact points thật trong `public` (dữ liệu di chuyển từ Notion), rủi ro tồn tại dữ liệu chưa chuẩn hoá là có thật → dedup có thể không đáng tin cậy 100% như đã công bố.

## ✏️ Đính chính: KHÔNG phải lỗi — `DB-09` (định dạng SĐT `+84...`)

Gọi `/api/db-test` → `phones=["+84912345678"]`, bản thân test này đánh dấu FAIL vì code test kỳ vọng thấy định dạng gốc `0912345678`. Nhưng Product Owner xác nhận: **định dạng chuẩn được yêu cầu chính là `+84912345678`** (mã vùng + số, không dấu cách) — đây là hành vi ĐÚNG theo spec, không phải lỗi. Bản thân file test (`db-test/route.js`) đang có assertion sai (kỳ vọng nhầm định dạng cũ), không phải code ứng dụng sai. Không cần Antigravity sửa gì ở đây — nếu muốn, có thể nhờ AG sửa lại assertion trong file test cho khỏi gây nhiễu ở lần chạy sau, nhưng không cấp bách.

## ✅ Những gì xác nhận ĐÚNG là đã sửa tốt (kiểm chứng cả 2 chiều: đọc code + chạy test sống)

- `assignCandidateToJob`: chặn ứng viên trong danh sách đen (blacklist), chặn gán vào Job đã Closed/Filled/On Hold, chặn trùng ứng tuyển cùng 1 job — cả 3 đều nằm trong transaction `sql.begin` đàng hoàng.
- `getClientSearchData` đã đổi đúng sang bảng `client_persons` (không còn dùng bảng cũ `client_contacts`).
- 6 Server Action quan trọng đã dùng transaction `sql.begin` (so với 0/44 lúc đầu): `addActivityLog`, `updateActivityLog`, `addContactPoint`, `updateContactPoint`, `assignCandidateToJob`, `createCandidateWithStrictValidation`.
- Chống XSS, chống SQL injection: xác nhận hoạt động tốt qua test sống.
- 21/21 kịch bản trong `/api/biz-test` (nghiệp vụ + hiệu năng) chạy PASS thật khi tôi tự gọi lại.
- 4 trang chính (`/`, `/candidates`, `/jobs`, `/search`) tải sạch, không lỗi console.

## Khuyến nghị

1. **Ưu tiên xử lý ngay lỗi #1 (trùng số thứ tự)** — đây là lỗi dữ liệu thật, ảnh hưởng trực tiếp đến việc tra cứu/báo cáo hàng ngày. Xem spec sửa chi tiết đã gửi kèm cho Antigravity (`docs/testing/FIX_SPEC_2026-09-01_display-number-and-dedup.md`).
2. Lỗi #2 (dedup LinkedIn) gộp chung vào đợt sửa lần này — cùng file spec.
3. Sau khi 2 lỗi này được sửa và AG báo cáo, tôi sẽ thẩm định độc lập lại bằng đúng phương pháp trên (đọc code + tự gọi test route) trước khi xác nhận.
4. Nên bố trí thêm 1 đợt thẩm định độc lập riêng cho 16 kịch bản UI-01→16 (cần thao tác tay trên trình duyệt) — hiện vẫn đang dựa vào báo cáo tự đánh giá của AG, vốn đã có tiền lệ chứa claim sai.
5. **Về quy trình:** Từ nay, mọi báo cáo "100% PASS" từ Antigravity nên được xem là *đề xuất cần thẩm định*, không phải kết luận cuối — như đã thấy, ít nhất 2 claim trong 5 báo cáo trước không khớp với mã nguồn thực tế. Tôi sẽ tiếp tục đối chiếu độc lập (đọc code + chạy lại test trực tiếp) trước khi xác nhận bất kỳ đợt sửa lỗi nào là "hoàn tất".

---
*Thẩm định dựa trên: đọc trực tiếp `src/app/actions.js` (2138 dòng), gọi trực tiếp `/api/qa-test`, `/api/db-test`, `/api/biz-test` qua trình duyệt trên server đang chạy tại `localhost:3000`, kiểm tra console lỗi trên 4 trang chính. Không dựa vào bất kỳ báo cáo tự đánh giá nào.*
