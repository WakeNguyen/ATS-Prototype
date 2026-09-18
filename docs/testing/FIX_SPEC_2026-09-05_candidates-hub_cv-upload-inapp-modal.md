# FIX SPEC — Đưa "Parse CV" Vào Modal Trong App (Theo Đúng Cơ Chế Của "Import Social Groups from File")

**Từ:** Claude (Architect/QA)
**Ngày:** 2026-09-05
**Yêu cầu từ:** User (thích UX của modal "Import Social Groups from File", muốn áp dụng tương tự cho Parse CV)
**Hướng đã chọn (User xác nhận):** Modal trong app + gọi webhook n8n (giữ nguyên toàn bộ pipeline OCR/dedup phía sau, chỉ thay "cửa vào")

---

## 1. Hiện trạng — vì sao không thể copy y hệt 100%

| | Import Social Groups | Parse CV (hiện tại) |
|---|---|---|
| Nơi hiển thị | Modal trong app (`SocialGroupBulkImportModal.js`) | Link `<a target="_blank">` mở **form riêng do n8n host** (`n8n-nodes-base.formTrigger`, webhookId `df0ae174-...`), không phải trang trong app |
| Xử lý file | Đọc Excel/CSV **ngay trên trình duyệt** (`xlsx`/SheetJS), preview + map cột tức thì | File PDF được **n8n nhận trực tiếp**, chạy OCR bằng Gemini (bất đồng bộ, vài chục giây–vài phút), không thể preview ngay trong trình duyệt |
| Ghi dữ liệu | Gọi thẳng Server Action `bulkImportSocialGroups()` → insert Postgres | n8n tự xử lý xong mới POST JSON về `POST /api/webhooks/cv-import` của app |

Vì bước xử lý CV (OCR AI) diễn ra **bên ngoài trình duyệt và bất đồng bộ**, modal CV không thể có bước "xem trước dữ liệu đã parse" như Excel — chỉ có thể: chọn file → gửi đi → xác nhận "đã gửi, chờ xử lý" (giống hệt trải nghiệm HITL Queue người dùng đã quen với CV hiện tại, chỉ khác ở chỗ KHÔNG cần rời khỏi app / mở tab mới).

## 2. Thiết kế đề xuất

**Nguyên tắc: giữ nguyên 100% pipeline OCR/Google Drive/dedup phía sau (`Config` → `Prepare Batch Files` → `Loop Ingest Files` → `Upload CV to Drive` → ... → `POST cv-import`) — chỉ thay "cửa vào" từ Form Trigger (n8n tự host) sang Webhook Trigger (app gọi qua proxy server-side).**

### PHẦN A — n8n Workflow (`fofSZKkdyhlVd9Lc`, "CV Parser → ATS 3.0 (Supabase) Dedup")

- Thêm **1 node Webhook mới** (`n8n-nodes-base.webhook`, method POST, "Binary Data" bật, path ví dụ `cv-upload`), nối thẳng vào node `Config` hiện có (node đầu tiên sau Form Trigger) — **KHÔNG xoá/tắt Form Trigger cũ**, để link n8n cũ (`NEXT_PUBLIC_N8N_CV_PARSER_FORM_URL`) vẫn chạy được song song trong lúc chuyển đổi (an toàn rollback, đúng nguyên tắc đã áp dụng ở hotfix Warm & Join hôm nay).
- Node `Prepare Batch Files` hiện tại đã tự động lặp `Object.keys(item.binary)` và chuẩn hoá về key `CV_File` — **không cần sửa gì thêm ở đây**, Webhook node chỉ cần bật Binary Data là dữ liệu tự đi đúng luồng.
- **Bảo mật:** Webhook mới nên yêu cầu header `x-internal-secret` (dùng chung `INTERNAL_WEBHOOK_SECRET` như các webhook khác trong hệ thống — `campaign-data`, `warm-join-*`) — vì giờ chỉ có app (server-side) gọi vào, không còn là form public cho người dùng browser trực tiếp như Form Trigger cũ (form cũ không thể check header nên không có auth, đây là điểm yếu cũ tiện thể vá luôn).

### PHẦN B — API Route proxy mới trong app (chưa có tiền lệ trong repo, cần code mẫu cụ thể)

**File mới:** `src/app/api/webhooks/cv-upload-proxy/route.js`

```js
import { NextResponse } from 'next/server';

const MAX_FILES = 10; // giới hạn mềm, tránh gửi quá nhiều file 1 lượt (Loop Ingest Files xử lý tuần tự từng file)

export async function POST(request) {
  try {
    const incomingForm = await request.formData();
    const files = incomingForm.getAll('files'); // field name client gửi lên

    if (!files || files.length === 0) {
      return NextResponse.json({ error: 'No files provided' }, { status: 400 });
    }
    if (files.length > MAX_FILES) {
      return NextResponse.json({ error: `Maximum ${MAX_FILES} files per batch` }, { status: 400 });
    }

    const forwardForm = new FormData();
    for (const file of files) {
      forwardForm.append('CV File', file, file.name); // giữ đúng field label "CV File" như Form Trigger cũ để tương thích Prepare Batch Files
    }

    const n8nUrl = process.env.N8N_CV_UPLOAD_WEBHOOK_URL;
    const resp = await fetch(n8nUrl, {
      method: 'POST',
      headers: { 'x-internal-secret': process.env.INTERNAL_WEBHOOK_SECRET || '' },
      body: forwardForm
    });

    if (!resp.ok) {
      const errText = await resp.text().catch(() => '');
      return NextResponse.json({ error: `n8n webhook failed: ${errText || resp.status}` }, { status: 502 });
    }

    return NextResponse.json({ success: true, fileCount: files.length });
  } catch (error) {
    console.error('[cv-upload-proxy] Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
```

Env var mới (đúng convention hiện có, không cần `NEXT_PUBLIC_` vì chỉ dùng server-side): `N8N_CV_UPLOAD_WEBHOOK_URL=https://<n8n-domain>/webhook/cv-upload`.

### PHẦN C — Modal mới trong app (tái dùng nguyên "vỏ" UI của `SocialGroupBulkImportModal.js`)

**File mới:** `src/components/CVUploadModal.js` (cùng chỗ với `NewCandidateModal.js`)

Tái sử dụng đúng khung modal/dropzone từ `SocialGroupBulkImportModal.js` bước "select" (dark modal `bg-slate-900`, dashed dropzone `border-2 border-dashed border-slate-700 hover:border-emerald-500/50`, icon badge tròn, nút "Select File from Computer" `bg-emerald-600`) — chỉ đổi:
- Tiêu đề: "Parse CV — AI Extraction" (badge phụ đổi từ "Excel / CSV" → "PDF / Image")
- Icon badge: `Sparkles` (đã dùng sẵn cho nút "+ Parse CV (AI)" hiện tại) thay vì `FileSpreadsheet`
- `<input type="file" multiple accept=".pdf,.png,.jpeg,.jpg">` (khớp đúng `acceptFileTypes` của Form Trigger cũ)
- Text: "Choose CV file(s) (PDF, PNG, JPG)" / "Supported formats: .pdf, .png, .jpg. Maximum 10 files per batch."

**Flow trong modal (đơn giản hơn Excel vì không preview được):**
1. `step: "select"` — dropzone như trên, cho chọn nhiều file → sau khi chọn, hiện danh sách tên file đã chọn (kèm nút xoá từng file) + nút "Upload & Queue for AI Parsing".
2. `step: "submitting"` — spinner khi gọi `fetch('/api/webhooks/cv-upload-proxy', {method:'POST', body: formData})` (client tự build `FormData` với field `files`, append nhiều file). Vì `responseMode: onReceived` ở n8n trả về ngay lập tức (không đợi OCR xong), bước này chỉ mất 1-2 giây.
3. `step: "success"` — thông báo: "Đã gửi N file để AI xử lý. Kết quả sẽ xuất hiện trong CV Imports Queue / thông báo trong vài phút." + nút "Done" đóng modal. **Không cần xây thêm cơ chế theo dõi tiến trình mới** — tái dùng nguyên hệ thống notification/HITL queue (`PendingCVClientWrapper.js`) đã có sẵn, giữ đúng tinh thần tối giản.
4. Lỗi mạng/n8n down → hiện lỗi inline + nút "Retry", giữ nguyên file đã chọn.

### PHẦN D — Wire-up trong `src/app/candidates/page.js`

Thay:
```jsx
<a href={process.env.NEXT_PUBLIC_N8N_CV_PARSER_FORM_URL || "#"} target="_blank" rel="noopener noreferrer" ...>
  <Sparkles size={13} /><span>+ Parse CV (AI)</span>
</a>
```
bằng:
```jsx
<button onClick={() => setShowCvUploadModal(true)} className="... (giữ nguyên className cũ) ...">
  <Sparkles size={13} /><span>+ Parse CV (AI)</span>
</button>
```
Thêm `const [showCvUploadModal, setShowCvUploadModal] = useState(false);` và render `<CVUploadModal isOpen={showCvUploadModal} onClose={() => setShowCvUploadModal(false)} />` cạnh `<NewCandidateModal .../>` — đúng convention modal đang dùng trong file này.

## 3. [Bonus, không bắt buộc] `cv-import` route hiện chưa có auth header

Khi rà lại, phát hiện `POST /api/webhooks/cv-import` (điểm nhận cuối cùng sau khi OCR xong) hiện **không kiểm tra `x-internal-secret`** — khác với các webhook khác trong hệ thống (`campaign-data`, `warm-join-*`). Không liên quan trực tiếp tới thay đổi lần này (route này giữ nguyên không đổi), nhưng nên cân nhắc thêm guard tương tự trong 1 đợt sửa riêng, tách biệt để không làm phình phạm vi lần này.

## 4. Rollout an toàn (theo đúng nguyên tắc đã áp dụng hôm nay với Warm & Join)

1. Thêm Webhook node mới + route proxy + modal mới **song song**, chưa đổi nút "+ Parse CV (AI)" trong lúc build.
2. Test thử: upload 1 file PDF thật qua modal mới → xác nhận chảy đúng qua toàn bộ pipeline cũ (OCR → Drive → `cv-import` → xuất hiện đúng trong HITL Queue/notification) — y hệt kết quả khi dùng form n8n cũ.
3. Sau khi xác nhận PASS, mới đổi nút sang mở modal mới thay vì mở tab n8n.
4. Giữ nguyên Form Trigger cũ + `NEXT_PUBLIC_N8N_CV_PARSER_FORM_URL` thêm 1 thời gian (phòng hờ), dọn dẹp sau khi chắc chắn ổn định — không xoá ngay trong đợt này.

## 5. Phạm vi thay đổi

- **n8n:** thêm 1 node Webhook mới trong workflow `fofSZKkdyhlVd9Lc` (không sửa/xoá node cũ nào).
- **App:** 1 file mới (`cv-upload-proxy/route.js`), 1 component mới (`CVUploadModal.js`), sửa nhỏ `candidates/page.js` (thay `<a>` bằng `<button>` + state + render modal), thêm 1 env var mới (`N8N_CV_UPLOAD_WEBHOOK_URL`).
- Không đổi DB schema, không đổi logic OCR/dedup/HITL hiện có.
