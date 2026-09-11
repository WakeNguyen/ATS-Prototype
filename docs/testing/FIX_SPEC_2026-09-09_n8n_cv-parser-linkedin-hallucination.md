# FIX SPEC — 2026-09-09 — CV Parser: LinkedIn Bị Ghi Sai Do Regex Trích Xuất /URI Từ PDF LinkedIn-Generated Bị Lỗi (Không Phải Do AI Bịa) — ĐÃ ĐÍNH CHÍNH

**Mức độ ưu tiên: CAO — lỗi đang xảy ra SỐNG trên production (đã xác nhận qua execution thật hôm nay 09/09), ảnh hưởng trực tiếp tới outreach ứng viên.**

**Người phát hiện:** Claude (Architect/QA). Bản FIX_SPEC đầu tiên (cùng ngày) chẩn đoán SAI nguyên nhân — Thức phản hồi trực tiếp "vấn đề là các profile lỗi đều là Linkedin generated profile" — đã đọc lại execution n8n thật để tìm đúng nguyên nhân, đính chính toàn bộ tại bản này.

**Nguồn:** Google Doc, mục 5: "Lỗi Workflow CV parser parse sai thông tin trường Linkedin... Kì lạ là profile của Trúc Lê Và Nguyễn Huỳnh Hải Phương dù parse bằng Linkedin generated profile thì lại không bị lỗi."

---

## ĐÍNH CHÍNH: Chẩn đoán ban đầu sai ở đâu

Bản đầu tiên cho rằng: PDF LinkedIn-generated (nhánh A, lấy link thật từ `/URI` trong file) luôn đúng; CV thường (nhánh B, dựa vào Gemini AI) mới là nguồn lỗi do AI "bịa" link từ tên ứng viên.

**Sai.** Đọc trực tiếp 5 execution thật gần nhất của `WfSingle00000001` (ngày 09/09/2026, giờ UTC) cho thấy: chính nhánh A (PDF LinkedIn-generated) mới là nguồn lỗi, và lỗi đang xảy ra 2/3 lần trên chính loại file mà Thức nói tới:

| Execution | Candidate | pdf_type | Kết quả field LinkedIn |
|---|---|---|---|
| 2911 (11:16 UTC) | Tung Le Duc | `linkedin` | ❌ HỎNG — xem bên dưới |
| 2908 (11:15 UTC) | Chien Trinh | `linkedin` | ❌ HỎNG — cùng 1 kiểu lỗi |
| 2751 (08:06 UTC) | Do Minh Thien | `linkedin` | ✅ Đúng: `https://www.linkedin.com/in/dominhthien` |
| 2854 (10:10 UTC) | Truong Thanh Nhan | `other` (scanned) | ✅ Đúng (qua Gemini AI, không liên quan bug này) |
| 2510 (02:59 UTC) | Dinh Nhat Truong | `other` (text-based) | ⚠️ Thiếu — có LinkedIn thật trong file (`...linkedin.com/in/%c4%91inh-tr%c6%b0%e1%bb%9dng-...`, tên có dấu) nhưng Gemini bỏ sót, không trả về contact point LinkedIn nào — vấn đề khác, ghi chú riêng bên dưới, không phải trọng tâm fix này |

## Bằng chứng — giá trị field LinkedIn thực tế bị ghi trong DB (execution 2911, candidate "Tung Le Duc")

```
"https://>>\nendobj\n8 0 obj\n<< /type /annot\n/subtype /link\n/rect [ 21.6 690.781 148.952 700.619 ]\n/c [ 0 0 0 ]\n/border [ 0 0 0 ]\n/a 7 0 r\n/h /i\n/structparent 1\n\n>>\nendobj\n9 0 obj\n<< /uri (https://www.linkedin.com/in/tung-le-duc-029402170"
```

Execution 2908 (candidate "Chien Trinh") bị hỏng theo ĐÚNG 1 kiểu, chỉ khác số liệu `/rect` và tên:
```
"https://>>\nendobj\n8 0 obj\n<< /type /annot\n/subtype /link\n/rect [ 21.6 703.381 142.526 713.219 ]\n...>>\nendobj\n9 0 obj\n<< /uri (https://www.linkedin.com/in/chientrinh"
```

Giá trị này KHÔNG phải do AI bịa — nó thật sự chứa đúng URL LinkedIn thật ở cuối chuỗi (`.../tung-le-duc-029402170`, `.../chientrinh`), nhưng bị nuốt kèm theo cả 1 khối cấu trúc nhị phân PDF phía trước (nhiều dòng `endobj`, `obj`, `/rect`...) — rõ ràng là lỗi PARSE, không phải lỗi "đoán".

## Nguyên nhân gốc — code node "Detect & Extract PDF Links" (`WfSingle00000001`)

```js
const uriMatches = raw.match(/\/URI\s*\(?([^)]+)\)?/g) || [];
const extractedLinks = uriMatches.map(m => {
  const match = m.match(/\/URI\s*\(?([^)]+)\)?/);
  return match ? match[1] : null;
}).filter(Boolean);

const linkedinProfileUrls = extractedLinks
  .filter(u => u.includes('linkedin.com/in/'))   // .includes() — CHỈ kiểm tra có chứa chuỗi con, không xác thực là URL sạch
  ...
```

Regex này cố parse cú pháp `/URI (...)` của PDF bằng cách tìm ký tự `)` gần nhất để đóng chuỗi — nhưng nhóm capture `([^)]+)` không giới hạn số dòng/số object nó được phép "nuốt". Với 2 file lỗi trên, ngay trước entry `/uri (https://www.linkedin.com/in/...)` thật (viết thường `/uri`, object số 9) có 1 entry `/URI` khác (viết hoa, object số 7, dùng làm target cho annotation link ở object 8) có giá trị bắt đầu bằng `https://` nhưng KHÔNG có dấu đóng `)` ngay sau trong luồng byte thô — khiến regex chạy tràn qua toàn bộ object 8 và một phần object 9 phía sau mới gặp được dấu `)` đầu tiên, nuốt luôn cả khối rác vào giữa. Vì `.filter(u => u.includes('linkedin.com/in/'))` chỉ kiểm tra CHỨA chuỗi con (không phải khớp URL sạch), chuỗi rác này vẫn lọt qua filter vì nó CÓ chứa `linkedin.com/in/...` ở cuối.

Đây là lỗi **không ổn định theo cấu trúc nội bộ từng file PDF cụ thể** (phụ thuộc file LinkedIn export đó có bị dính pattern object rỗng/tham chiếu kiểu này hay không) — giải thích đúng từ "kì lạ" Thức dùng: có file dính, có file không, dù cùng là "Linkedin generated profile".

---

## Cách sửa — bỏ hẳn cách parse `/URI (...)` theo cấu trúc PDF, trích xuất trực tiếp URL LinkedIn bằng regex trên toàn bộ raw text

Sửa trong node "Detect & Extract PDF Links", thay đoạn trích xuất `uriMatches` / `extractedLinks` / `linkedinProfileUrls` bằng:

```js
// Trích trực tiếp URL LinkedIn dạng chuẩn xuất hiện bất kỳ đâu trong raw text của PDF —
// KHÔNG dựa vào việc parse cấu trúc /URI (...) (không đáng tin cậy, xem FIX_SPEC 2026-09-09
// case "Tung Le Duc" / "Chien Trinh": bị nuốt rác xuyên nhiều PDF object).
const linkedinUrlPattern = /https?:\/\/(?:www\.)?linkedin\.com\/in\/[a-zA-Z0-9\-_%]+/gi;
const rawLinkedinMatches = raw.match(linkedinUrlPattern) || [];
const linkedinProfileUrls = [...new Set(
  rawLinkedinMatches.map(u => u.split('?')[0].toLowerCase().replace(/\/+$/, ''))
)];
```
Giữ nguyên toàn bộ phần còn lại của node (`isLinkedInPDF` detection, `pdf_type`, `is_scanned`...) — chỉ thay đúng đoạn extract link.

Ở node "Parse & Normalize", **giữ nguyên logic `value = pdfLinks[0]`** khi `pdfType === 'linkedin' && pdfLinks.length > 0` — với cách trích xuất mới, `pdfLinks[0]` sẽ là 1 URL LinkedIn SẠCH thay vì chuỗi rác. Không cần đổi gì thêm ở node này cho phần logic chính.

**Lớp phòng thủ bổ sung (giữ từ bản trước, vẫn nên làm cùng lúc vì không tốn thêm công sức, phòng trường hợp Gemini AI đoán bừa ở nhánh CV thường):** thêm rule vào prompt Gemini (2 node "Extract CV Data (AI - Text)" và "Extract CV Data (AI - PDF)"):
```
- LinkedIn: CHỈ điền nếu trong văn bản CV có xuất hiện rõ ràng URL linkedin.com hoặc username LinkedIn thật. TUYỆT ĐỐI KHÔNG được suy đoán, bịa, hay ghép từ họ tên ứng viên. Nếu không tìm thấy, KHÔNG thêm contact_point loại LinkedIn.
```

## Ghi chú riêng — Case "Dinh Nhat Truong" (execution 2510, thiếu LinkedIn dù có thật trong file)

Không thuộc phạm vi fix chính (đây là bỏ sót, không phải sai lệch), nhưng đáng ghi lại: file này có `pdf_type = 'other'` (không được nhận diện là LinkedIn-generated dù raw text vẫn chứa `linkedin.com/in/%c4%91inh-tr%c6%b0%e1%bb%9dng-...`, URL bị mã hoá phần trăm cho tên có dấu tiếng Việt "đinh trưởng"), nên đi qua nhánh Gemini AI thay vì trích xuất trực tiếp — và Gemini không trả về contact point LinkedIn nào cho candidate này. **Với fix ở trên (regex trực tiếp trên toàn bộ raw text, không phụ thuộc `pdf_type`), nên cân nhắc chạy `linkedinUrlPattern` trên MỌI file bất kể `pdf_type`** (không chỉ khi `pdf_type === 'linkedin'`) rồi ưu tiên dùng kết quả trực tiếp này nếu tìm thấy, thay vì chỉ tin Gemini — sẽ tự sửa luôn cả case này. Đề xuất AG cân nhắc khi implement, không bắt buộc nếu muốn giữ phạm vi fix hẹp.

---

## Lưu ý khi implement
- Chỉ sửa đúng đoạn extract link trong node "Detect & Extract PDF Links" — không đổi `isLinkedInPDF`, `is_scanned`, hay bất kỳ field nào khác.
- Sau khi sửa, AG cần tự publish lại workflow "CV Parser - Process Single Item" (`WfSingle00000001`, đang `active: true`) — Claude không có quyền publish n8n.

## Test bắt buộc trước khi báo hoàn thành
1. Chạy lại đúng 2 file gốc của "Tung Le Duc" và "Chien Trinh" (nếu còn trên Drive, tìm qua `drive_file_id` trong execution 2911 / 2908) → field LinkedIn phải ra URL sạch, không còn chuỗi chứa `endobj`/`obj`/`/rect`.
2. Chạy lại file của "Do Minh Thien" (execution 2751) → xác nhận vẫn đúng như cũ (không regression).
3. Test 1 CV không có LinkedIn thật → không tự bịa contact point LinkedIn nào.
4. Rà lại toàn bộ candidate có `source = CV Parsing` trong Supabase, lọc `contact_points` type LinkedIn có `value` chứa các chuỗi bất thường (`endobj`, `\n`, độ dài bất thường >200 ký tự) — liệt kê danh sách để Thức xem lại và sửa tay (KHÔNG tự động xoá dữ liệu cũ trong phạm vi fix này).

## Báo cáo lại
Ghi vào `docs/DEVELOPMENT_LOG.md` như thường lệ, kèm kết quả 4 test trên và danh sách candidate cũ bị lỗi dạng này tìm được ở bước 4.
