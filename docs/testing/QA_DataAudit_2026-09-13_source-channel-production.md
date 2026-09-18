**Từ:** Claude (Architect/QA)

# Data Audit — `public.activity.source_channel` (production thật)

**Ngày:** 2026-09-13
**Mục đích:** Chuẩn hoá danh sách kênh nguồn (`SOURCE_CHANNELS_LIST`) trước khi khoá cứng dropdown ở
Action Menu — theo mục 9 GEMINI.md (>5 bản ghi bị đổi phải in danh sách + xin phép trước khi chạy).

## Toàn bộ giá trị hiện có trên production, KHÔNG khớp 9 mục chuẩn cũ

| Giá trị hiện tại trong DB | Số dòng |
|---|---|
| `Linkedin` | 538 |
| `ITViec` | 409 |
| `Facebook` | 88 |
| `Linkedin Jobs` | 74 |
| `Referral` | 53 |
| `Website` | 20 |
| `Direct Sourcing` | 13 |
| `Linkedin Job Posting` | 1 |
| **Tổng** | **1196** |

## Quyết định của User (đã hỏi rõ, ghi lại làm căn cứ)

1. Thêm `ITViec` thành mục chuẩn thứ 10 (kênh thật, khối lượng lớn — không phải lỗi gõ).
2. Đổi tên các mục chuẩn cũ có ngoặc/tiếng Việt sang dạng ngắn gọn tiếng Anh:
   - `Facebook Group` → `Facebook`
   - `Referral (Giới thiệu)` → `Referral`
   - `Direct Sourcing (Headhunt)` → `Direct Sourcing`
3. Tách riêng `LinkedIn Job Post` thành 1 mục CHUẨN RIÊNG, KHÔNG gộp chung vào `LinkedIn`.

## Danh sách chuẩn MỚI (11 mục, thay `src/constants/enums.js`)

```
LinkedIn
LinkedIn Job Post
Facebook
TopCV
VietnamWorks
CareerBuilder
ITViec
Referral
Direct Sourcing
Company Website
Other
```

## Bảng mapping dữ liệu thật cần UPDATE trên `public.activity` (chỉ đúng những dòng LỆCH so với chuẩn mới)

| Giá trị cũ | → Giá trị mới | Số dòng bị đổi |
|---|---|---|
| `Linkedin` | `LinkedIn` | 538 |
| `Linkedin Jobs` | `LinkedIn Job Post` | 74 |
| `Linkedin Job Posting` | `LinkedIn Job Post` | 1 |
| `Website` | `Company Website` | 20 |
| **Tổng dòng thực sự bị UPDATE** | | **633** |

**Không cần UPDATE gì thêm cho các giá trị sau** — vì sau khi đổi tên chuẩn ở trên, chúng đã khớp
100% với tên chuẩn mới, không còn lệch:
- `Facebook` (88 dòng) — đã khớp chuẩn mới `Facebook`.
- `Referral` (53 dòng) — đã khớp chuẩn mới `Referral`.
- `Direct Sourcing` (13 dòng) — đã khớp chuẩn mới `Direct Sourcing`.
- `ITViec` (409 dòng) — đã khớp chuẩn mới `ITViec`.

## Câu lệnh dự kiến chạy (schema `public`, đã pin đúng giá trị cũ ở WHERE, không có DELETE)

```sql
UPDATE public.activity SET source_channel = 'LinkedIn' WHERE source_channel = 'Linkedin';
UPDATE public.activity SET source_channel = 'LinkedIn Job Post' WHERE source_channel IN ('Linkedin Jobs', 'Linkedin Job Posting');
UPDATE public.activity SET source_channel = 'Company Website' WHERE source_channel = 'Website';
```

## Trạng thái: ✅ ĐÃ HOÀN THÀNH (2026-09-13)

- User đã xác nhận, đã chạy đủ 3 câu UPDATE trên CẢ `public` và `sandbox` (633 dòng theo bảng trên).
- Phát hiện thêm lúc verify: 7 dòng mang đúng giá trị CHUẨN CŨ còn sót (`Direct Sourcing (Headhunt)`
  x5, `Referral (Giới thiệu)` x2) — thuộc đúng phạm vi đã duyệt, đã UPDATE nốt về `Direct Sourcing`/
  `Referral` trên cả 2 schema.
- Verify lại bằng SQL: `public.activity.source_channel` — 0 dòng còn lệch khỏi 11 giá trị chuẩn mới.
- `src/constants/enums.js` (`SOURCE_CHANNELS`, `SOURCE_CHANNELS_LIST`) đã cập nhật khớp 11 giá trị
  chuẩn mới, verify trực tiếp qua Antigravity round + Claude đọc lại file — khớp 100%.
