# FIX SPEC — 2026-09-06 — Đổi Vercel Function Region về gần Supabase (Singapore) để giảm độ trễ

**Mức độ ưu tiên: Trung bình — không phải bug chức năng, không phải bảo mật, nhưng ảnh hưởng trải nghiệm dùng thật hàng ngày. Rủi ro thay đổi: THẤP (chỉ đổi 1 config, không đụng logic code).**

**Người phát hiện:** User, cảm nhận bản deploy chậm hơn hẳn so với chạy local.

---

## Nguyên nhân (đã xác nhận trực tiếp qua Vercel MCP, không đoán)

- Deployment hiện tại (`dpl_AjEoaHmhVrChVUUeqWUNDkJv8aL6`, production) đang chạy ở region **`iad1` = Washington D.C., Mỹ** — xác nhận qua `get_deployment`, field `regions: ["iad1"]`.
- Database Supabase của dự án đặt ở **Singapore** (đúng badge "Supabase Singapore Live" trong app).
- Kết quả: mỗi request cần đọc/ghi DB phải đi Mỹ ↔ Singapore ↔ Mỹ, rồi mới trả kết quả về cho user ở Việt Nam — vòng qua gần nửa vòng trái đất mỗi lần. Chạy local thì máy user (VN) gọi thẳng Supabase Singapore, quãng đường ngắn hơn nhiều.
- Kiểm tra thêm `get_runtime_logs`: toàn bộ request hiện tại đều `cache=MISS` — mọi trang render động 100%, không có tầng cache nào, nên độ trễ do lệch region này lặp lại ở MỌI request, không chỉ lần đầu.

`vercel.json` hiện **không tồn tại** trong repo — do đó Vercel đang dùng region mặc định (`iad1`) thay vì được chỉ định rõ ràng.

---

## Cách sửa

Tạo file `vercel.json` ở root repo (file này hiện chưa có) với nội dung:

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "regions": ["sin1"]
}
```

`sin1` là region Singapore của Vercel — cùng khu vực với Supabase, giúp DB round-trip nhanh hơn đáng kể.

**Lưu ý khi implement:**
- Chỉ thêm đúng field `regions`, không thêm các field khác vào `vercel.json` trừ khi thực sự cần (giữ đúng tinh thần tối giản).
- Nếu Vercel Dashboard → Project Settings → Functions có mục "Function Region" cho phép chọn trực tiếp (không cần sửa code) — có thể dùng cách đó thay thế, miễn kết quả cuối cùng function chạy ở `sin1`. Ưu tiên cách `vercel.json` vì rõ ràng, có version control, không phụ thuộc việc bấm đúng trong dashboard.
- **Đổi region KHÔNG có hiệu lực ngay** — bắt buộc phải deploy lại (commit + push nếu đã nối GitHub, hoặc `vercel --prod` nếu vẫn deploy tay) thì bản deploy mới mới chạy ở region mới.
- Không cần đổi gì ở phía Supabase — DB vẫn giữ nguyên ở Singapore.

---

## Test bắt buộc trước khi báo hoàn thành

1. Sau khi redeploy, xác nhận deployment mới thực sự chạy ở `sin1` (kiểm tra qua Vercel Dashboard → deployment detail → Region, hoặc field `regions` trả về khi query deployment).
2. So sánh cảm nhận tốc độ tải trang thật giữa trước và sau (mở vài trang chính: `/`, `/candidates`, `/jobs`, `/campaigns`, `/search`) — nên nhanh hơn rõ rệt so với bản `iad1` cũ.
3. (Nếu tiện) đo TTFB (Time to First Byte) qua tab Network của trình duyệt cho 1-2 trang, ghi lại con số trước/sau để có bằng chứng cụ thể — không bắt buộc, nhưng nên có nếu dễ làm.
4. Xác nhận các chức năng chính vẫn hoạt động bình thường sau redeploy (login Google OAuth, xem candidate, tạo action...) — đổi region không nên ảnh hưởng logic, nhưng vẫn cần smoke-test lại vì đây là 1 bản deploy mới.
5. `npm run build` PASS trước khi deploy (theo quy trình thường lệ).

**Báo cáo lại:** ghi vào `docs/DEVELOPMENT_LOG.md` như thường lệ — nêu rõ region cũ/mới, đã redeploy chưa, cảm nhận/số liệu tốc độ trước-sau nếu đo được.
