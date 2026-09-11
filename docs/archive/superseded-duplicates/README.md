# docs/archive/superseded-duplicates/ — Tài liệu trùng/cũ đã dọn khỏi thư mục gốc (2026-09-01)

5 file này từng nằm rời ở thư mục gốc dự án, sót lại từ trước đợt gom tài liệu vào `docs/` (xem `docs/DEVELOPMENT_LOG.md`, mốc `SNAP-20260831-38`). Đã đối chiếu từng file — tất cả đều **cũ hơn hoặc trùng hoàn toàn** bản chính thức đang dùng trong `docs/`:

| File trong archive | Bản chính thức hiện dùng | Ghi chú đối chiếu |
| --- | --- | --- |
| `ATS_3.0_UI_Modernization_Blueprint.md` | `docs/architecture/ATS_3.0_UI_Modernization_Blueprint.md` | Bản archive 307 dòng, mô tả DB Neon (cũ); bản chính thức 778 dòng, mô tả Supabase (mới nhất, RC77) |
| `Test_BOM.md` | `docs/DEVELOPMENT_LOG.md` | Cùng 1 tài liệu (Development Log & Rollback History) — bản archive dừng ở RC74, bản chính thức tiếp tục tới RC78 |
| `USER_MANUAL_DRAFT.md` | `docs/USER_MANUAL_DRAFT.md` | Bản archive 170 dòng (bản nháp sớm); bản chính thức 314 dòng, đầy đủ hơn nhiều |
| `vercel_deployment_guide.md` | `docs/deployment/vercel_deployment_guide.md` | **Giống hệt 100% (byte-for-byte)** |
| `recovered_blueprint.md` | `docs/architecture/ATS_3.0_UI_Modernization_Blueprint.md` | Bản khôi phục tạm thời từ sự cố lỗi file trước đó (RC46), đã bị bản chính thức mới hơn thay thế hoàn toàn |

Giữ lại để đối chiếu lịch sử nếu cần, nhưng **không dùng các file trong thư mục này** — luôn tham chiếu bản chính thức trong `docs/`.
