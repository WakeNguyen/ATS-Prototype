# Fix Spec — Chuyển đích workflow n8n "CV Parser" từ Notion sang ATS 3.0 (Supabase) + vá OCR + thêm nút Trigger — 2026-09-01

**Từ:** Claude (Architect/QA)
**Cho:** AG (Implementer)
**Bối cảnh:** Xem `docs/testing/QA_Review_2026-09-01_n8n_cv-parser-notion-dedup.md` để hiểu đầy đủ 2 lỗi đã phát hiện. User đã xác nhận chọn **Hướng A**: đổi đích ghi dữ liệu của workflow n8n từ Notion cũ (CRM-ATS V2) sang thẳng ứng dụng ATS 3.0 (Supabase) hiện tại, tận dụng hạ tầng dedup/HITL đã có sẵn. User cũng đã xác nhận (2026-09-02): dùng **tunnel tạm thời (Cloudflare Tunnel/ngrok)** để test end-to-end thật, KHÔNG deploy production ngay — xem chi tiết Phần D.
**Phạm vi:** (1) n8n workflow `fofSZKkdyhlVd9Lc` ("CV Parser → Notion ATS Dedup") + subworkflow `0BLBJWwP80nn9eN3` ("PDF Scan OCR - Gemini API"); (2) `src/app/candidates/page.js` (thêm nút trigger).
**Trạng thái (cập nhật 2026-09-02, vòng 3):** AG đã sửa hầu hết Phần G (commit `d833425`, `7695231`) — dữ liệu test đã lưu thật vào Supabase (Claude đã tự đối chiếu SQL, xác nhận đúng). Còn lại **PHẦN H** bên dưới — 4 việc cụ thể, đọc kỹ vì có 2 điểm AG đang hiểu nhầm (H.2, H.3) khiến sửa sai hướng ở vòng trước. Không cần mở lại `QA_Reverify_Round2_...md` nữa, mọi thứ đã gộp vào Phần H.
**Cập nhật 2026-09-02 (quyết định kiến trúc):** User yêu cầu loại bỏ hoàn toàn phụ thuộc Telegram khỏi workflow này (trước đây dùng Telegram do hạn chế kỹ thuật của hệ thống cũ; nay ATS 3.0 đã có notification ngay trong app). Phần C.5 (Telegram) đã được sửa lại thành ghi Notification, và thêm mới PHẦN F cho hạ tầng Notification Center — xem chi tiết bên dưới.

---

## PHẦN A — n8n: vá lỗi OCR subworkflow bị đứt liên kết

Trong workflow chính, node **`Run OCR Subworkflow`** hiện có `parameters.workflowId = "p97QV9Luyn2YFszA"` (không tồn tại). Sửa thành:

```
workflowId: "0BLBJWwP80nn9eN3"
```

(Giữ nguyên `mode: "each"`, `continueOnFail: true`.) Đã đối chiếu: subworkflow `0BLBJWwP80nn9eN3` trả về đúng field `fullText`/`success` (khi thành công) khớp 100% với những gì node `Extract CV Data (Claude - Text)` đọc (`$json.fullText`) và node `If OCR Success` kiểm tra (`!$json.error`) — không cần sửa gì thêm ở 2 node đó.

## PHẦN B — n8n: bỏ hardcode API key trong subworkflow OCR

Trong subworkflow `0BLBJWwP80nn9eN3`, node **`Gemini OCR Request`** hiện có API key Gemini hardcode thẳng trong `url` (dạng `...generateContent?key=AQ.Ab8R...`). Sửa:
1. Tạo 1 n8n Credential mới cho Gemini (Header Auth hoặc Query Auth tuỳ loại credential n8n hỗ trợ cho Generative Language API — dùng `mcp__n8n__list_credentials`/UI n8n để tạo).
2. Gán credential đó vào node, xoá phần `?key=...` khỏi chuỗi `url` literal.
3. Test lại node bằng `test_workflow` (pin data) hoặc chạy thử trực tiếp để xác nhận request vẫn thành công sau khi đổi qua credential.

## PHẦN C — n8n: đổi đích ghi dữ liệu — từ Notion sang `/api/webhooks/cv-import`

### C.1 — Sửa node `Parse & Normalize` (code node)

Giữ nguyên toàn bộ phần parse JSON từ Claude + chuẩn hoá `contact_points` (email/phone/linkedin) như hiện tại. Thêm/sửa các điểm sau trước khi `return`:

1. **Chuẩn hoá `prefix`** — app yêu cầu enum `"Mr."`, `"Ms."`, `"Mrs."`, `"Dr."` (có dấu chấm), nhưng Claude hiện trả về `"Mr"`/`"Ms"`/`null` (không dấu chấm). Map: `"Mr"→"Mr."`, `"Ms"→"Ms."`; nếu không khớp gì thì để trống (schema tự default `"Mr."`).
2. **Chuẩn hoá `dob`** — Claude trả `"DD/MM/YYYY"`, app cần ISO `"YYYY-MM-DD"`. Dùng lại đúng logic đã có sẵn trong node `Build Create Body` cũ:
   ```js
   let dobIso = null;
   if (info.dob) {
     const p = info.dob.split('/');
     if (p.length === 3) dobIso = `${p[2]}-${p[1]}-${p[0]}`;
   }
   ```
3. **Bỏ phần build `notionQueryBody`/`qb`** — không cần nữa, vì `/api/webhooks/cv-import` tự làm dedup phía server (theo `contact_points` trong Supabase, case-insensitive).
4. Output cuối cùng đổi thành (giữ nguyên các field khác nếu còn dùng ở node debug/log):
   ```js
   return [{
     json: {
       full_name: candidate_info.full_name || 'Unknown',
       prefix: normalizedPrefix,   // xem bước 1
       dob: dobIso,                // xem bước 2
       address: candidate_info.address || '',
       notes: candidate_info.notes || '',
       contactPoints: norm         // giữ nguyên mảng đã chuẩn hoá sẵn có (đổi tên field JSON: contact_points -> contactPoints cho khớp schema Zod của app)
     }
   }];
   ```

### C.2 — Thêm node mới: `Upload CV to Drive` (chuyển sớm hơn trong luồng)

Node Google Drive upload đã có sẵn (`n041`) nhưng hiện đặt SAU khi tạo candidate trong Notion (vì cần `id_candidate` để đặt tên file). Trong luồng mới, ta cần URL file CV NGAY LÚC gọi webhook (field `cv_url`), tức là phải upload TRƯỚC. Cách làm:

- Nối `Parse & Normalize` → `Upload CV to Drive` (node Google Drive, giữ nguyên credential `XPs3k488EdswMivn`, cùng folder `Candidate` đang dùng).
- Đặt tên file theo `full_name` + timestamp thay vì `id_candidate` (vì chưa có candidate ID ở bước này), ví dụ:
  ```js
  name: `CV_{{ $json.full_name.replace(/\s+/g, '_') }}_{{ $now.toFormat('yyyyMMdd_HHmmss') }}.{{ $binary.CV_File.fileExtension || 'pdf' }}`
  ```
- `inputDataFieldName`: vẫn `CV_File` — cần đảm bảo binary gốc (`CV_File`) còn được truyền tới node này qua toàn bộ chuỗi trước đó (kiểm tra như node `Re-attach Binary` cũ đã làm cho nhánh OCR — áp dụng tương tự nếu binary bị rớt ở nhánh Claude-Text).

### C.3 — Thêm node mới: `Build Webhook Payload` (code node)

Chạy ngay sau `Upload CV to Drive`, gộp lại kết quả từ `Parse & Normalize` + link Drive vừa tạo:

```js
const prev = $('Parse & Normalize').first().json;
const driveFile = $input.first().json; // response của node Upload CV to Drive

const cvUrl = driveFile.webViewLink || (driveFile.id ? `https://drive.google.com/file/d/${driveFile.id}/view` : '');

return [{
  json: {
    ...prev,
    cv_url: cvUrl
  }
}];
```

*(AG kiểm tra lại tên field response thực tế của node Google Drive n8n — có thể là `webViewLink` hoặc chỉ `id`; dùng `get_node_types`/chạy thử 1 lần để xác nhận, rồi điều chỉnh code trên nếu field name khác.)*

### C.4 — Thêm node mới: `Call ATS Webhook` (HTTP Request, POST)

- Method: `POST`
- URL: `{{ $env.ATS_APP_BASE_URL }}/api/webhooks/cv-import` — **KHÔNG hardcode URL**, dùng biến môi trường n8n `ATS_APP_BASE_URL` (AG tạo biến này trong cấu hình n8n VPS, xem lưu ý Phần D bên dưới).
- Body (JSON) = nguyên object JSON từ node `Build Webhook Payload` ở trên.
- `continueOnFail: true` (giữ, để không chặn workflow nếu app tạm thời lỗi — nhưng phải log/ghi notification lỗi, xem C.5).

### C.5 — Thay node Telegram bằng ghi Notification (bỏ phụ thuộc Telegram — quyết định 2026-09-02)

Vì đã bỏ toàn bộ nhánh Notion (Create/Update/Conflict riêng biệt), và theo quyết định kiến trúc mới nhất (bỏ Telegram), chỉ cần **1 node HTTP Request (POST)** duy nhất sau `Call ATS Webhook`, gọi thẳng vào route + bảng `notifications` mới được thêm ở **PHẦN F** bên dưới (đọc PHẦN F trước khi implement mục này — thứ tự CHẠY thực tế là: PHẦN F phải tồn tại trước khi node này chạy thật, dù thứ tự ĐỌC trong tài liệu vẫn để C.5 nằm ở đây cho liền mạch theo luồng workflow chính).

- URL: `{{ $env.ATS_APP_BASE_URL }}/api/webhooks/notifications` — dùng CHUNG biến môi trường `ATS_APP_BASE_URL` đã có ở C.4, KHÔNG cần credential n8n mới.
- Method: `POST`, Body (JSON), đọc `match_status` từ response của `Call ATS Webhook` + `full_name` từ node `Build Webhook Payload` (C.3):
  ```js
  {
    "type": "cv_single_import",
    "title": (
      $json.match_status === 'NEW' ? 'CV mới: ' :
      $json.match_status === 'UPDATE' ? 'Cần duyệt: ' : 'Xung đột: '
    ) + $('Build Webhook Payload').item.json.full_name,
    "message":
      $json.match_status === 'NEW' ? 'Đã tạo hồ sơ ứng viên mới.' :
      $json.match_status === 'UPDATE' ? 'Trùng với hồ sơ có sẵn — vào CV Imports Queue để duyệt.' :
      'Trùng với nhiều hồ sơ — cần chọn hồ sơ đúng trong CV Imports Queue.',
    "severity":
      $json.match_status === 'NEW' ? 'success' :
      $json.match_status === 'UPDATE' ? 'warning' : 'error',
    "link": "/"
  }
  ```
  *(Viết bằng 1 Code node hoặc Set node/Expression tuỳ AG thấy tiện — không bắt buộc đúng cú pháp JS ternary lồng như trên, miễn ra đúng field/giá trị.)*
- `continueOnFail: true` (ghi notification lỗi không được làm hỏng cả execution).
- **Không cần** giữ lại credential Telegram (`eu2uYzaQm5itAPPm`) cho workflow này nữa — nếu AG đã lỡ thêm node Telegram theo bản nháp cũ, xoá đi.

### C.6 — XOÁ các node không còn cần thiết (toàn bộ gọi Notion trực tiếp)

Xoá 12 node sau (không còn nhánh nào dùng tới nữa sau khi C.1–C.5 hoàn tất):
`Query Contact Points`, `Dedup Logic`, `Route by Match Count`, `Build Create Body`, `Build Update Body`, `Create Candidate`, `Update Candidate`, `Attach Drive Link to Candidate`, `Split Contacts (New)`, `Create Contact Points`, `Filter & Split Contacts`, `Add Contact Points`, `Notify: Conflict`, `Notify: Created`, `Notify: Updated`, `Prepare CV Upload` (thay bằng node `Upload CV to Drive` mới ở C.2, không cần bước "Prepare" dựa vào candidate ID nữa).

*(Trước khi xoá: kiểm tra không còn node nào khác tham chiếu tới các node này qua `$('TenNode')` — grep JS code trong các node còn lại nếu không chắc.)*

### C.7 — Đổi tên workflow + cập nhật sticky note

- Đổi tên workflow: `"CV Parser → Notion ATS Dedup"` → `"CV Parser → ATS 3.0 (Supabase) Dedup"`.
- Sửa nội dung sticky note `sticky01`: bỏ dòng "(from CRM-ATS V2)" + 2 Database ID Notion, thay bằng mô tả đích mới: `POST {{ATS_APP_BASE_URL}}/api/webhooks/cv-import` (+ `POST {{ATS_APP_BASE_URL}}/api/webhooks/notifications` cho thông báo), và liệt kê đúng 2 credential còn dùng (Anthropic, Google Drive — **bỏ Notion VÀ Telegram** khỏi danh sách "Setup Required"; ghi notification dùng chung HTTP Request/base URL với webhook cv-import, không cần credential riêng).
- (Tuỳ chọn) Đổi luôn `formTitle` của node `CV Upload Form` — hiện đang ghi `"CV Upload — ATS Parser - FOR TESTING - DO NOT DELETE"`, gây hiểu nhầm đây là form test tạm. Đổi thành tên phản ánh đúng đây là form production thật, ví dụ `"CV Upload — ATS 3.0 Parser"`.

---

## PHẦN D — Vận hành: dùng Cloudflare Named Tunnel để n8n (VPS) gọi được app local — CẬP NHẬT 2026-09-02

n8n chạy trên VPS (internet), còn app Next.js hiện chạy dev server trên máy Windows của user (`localhost:3000`) — **VPS không thể gọi tới `localhost` trên máy Windows**.

**Cập nhật quan trọng (2026-09-02):** bản đầu của Phần D này đề xuất Cloudflare quick tunnel (`trycloudflare.com`) làm phương án chính. AG đã thử và gặp lỗi 404 không ổn định từ edge network của loại quick tunnel miễn phí này (đã xác nhận qua trao đổi thực tế với user) — quick tunnel không phù hợp để test đáng tin cậy. AG cũng thử ngrok, nhưng lệnh `ngrok update` khiến Windows Defender cách ly file do hành vi tự tải-và-ghi-đè binary trông giống phần mềm điều khiển từ xa (false positive, đã gỡ sạch ngrok theo đúng quy trình an toàn — không cần thử lại ngrok nữa).

User đã xác nhận có sẵn tài khoản Cloudflare + domain riêng `thucnguyen8n.space` (từng dùng cho tunnel n8n Docker trước đây tại subdomain `n8n.thucnguyen8n.space` — **TUYỆT ĐỐI không dùng lại subdomain này**, nó đang phục vụ n8n thật). Vì đã có sẵn domain, dùng **Cloudflare Named Tunnel** (gắn hẳn 1 subdomain cố định, ổn định hơn hẳn quick tunnel, không bị đổi URL ngẫu nhiên mỗi lần chạy lại) thay cho cả quick tunnel lẫn ngrok.

### D.1 — Tạo Cloudflare Named Tunnel (subdomain đề xuất: `ats-dev.thucnguyen8n.space`)

Thực hiện trên chính Terminal/PowerShell thật của máy Windows (không phải qua Claude/AG chat):

1. **Cài đặt** `cloudflared` nếu chưa có: `winget install --id Cloudflare.cloudflared`.
2. **Đăng nhập** (gắn với tài khoản Cloudflare quản lý domain `thucnguyen8n.space`): `cloudflared tunnel login` — mở trình duyệt, chọn đúng domain `thucnguyen8n.space`, xác nhận. User cho biết CÓ THỂ đã login từ trước lúc setup n8n Docker — nếu vậy lệnh này thường tự nhận diện cert có sẵn tại `%USERPROFILE%\.cloudflared\cert.pem`, không cần chọn lại; nếu báo lỗi/không tìm thấy cert thì làm lại bước login bình thường.
3. **Tạo tunnel mới, đặt tên riêng biệt** (không đụng tunnel n8n cũ nếu có): `cloudflared tunnel create ats-dev-tunnel` — ghi lại UUID được in ra, và file credentials JSON (`<UUID>.json`) sẽ được lưu vào `%USERPROFILE%\.cloudflared\`.
4. **Trỏ DNS**: `cloudflared tunnel route dns ats-dev-tunnel ats-dev.thucnguyen8n.space` — tự động tạo bản ghi CNAME trong Cloudflare, trỏ subdomain này về tunnel vừa tạo.
5. **Chạy tunnel**, trỏ vào app đang chạy `npm run dev` ở `localhost:3000` — mở 1 Terminal RIÊNG (không đóng terminal đang chạy dev server):
   ```
   cloudflared tunnel run --url http://localhost:3000 ats-dev-tunnel
   ```
6. Giữ terminal này chạy xuyên suốt lúc test end-to-end. Subdomain `ats-dev.thucnguyen8n.space` giờ là URL cố định — có thể tắt/mở lại tunnel nhiều lần mà URL không đổi (khác hẳn quick tunnel), tiện cho việc test nhiều vòng.

### D.2 — Gán URL tunnel vào n8n

Set biến môi trường n8n `ATS_APP_BASE_URL = https://ats-dev.thucnguyen8n.space` — xem `docs/deployment/n8n_vps_management_guide.md` để set biến môi trường qua Docker Compose `.env` trên VPS (cần restart container n8n để áp dụng).

**QUAN TRỌNG — đây chính là lỗi QA vòng 1 đã phát hiện:** node `Call ATS Webhook`/`Create Notification`/`Log Execution Error` PHẢI dùng `{{ $env.ATS_APP_BASE_URL }}`, **TUYỆT ĐỐI KHÔNG hardcode URL cố định nào (kể cả URL tunnel này)** trực tiếp vào node — vì subdomain tunnel tuy ổn định hơn quick tunnel nhưng vẫn chỉ chạy khi terminal `cloudflared tunnel run` đang mở trên máy Windows; hardcode sẽ khiến workflow gọi vào URL chết ngay khi terminal đó tắt hoặc khi deploy thật lên Vercel sau này (lúc đó chỉ cần đổi giá trị biến `ATS_APP_BASE_URL`, không cần sửa lại bất kỳ node nào).

Vì subdomain giờ cố định (không đổi ngẫu nhiên như quick tunnel), tunnel này thậm chí có thể dùng lâu dài cho việc test lặp lại nhiều lần — nhưng vẫn chỉ nên bật khi cần test (tắt terminal `cloudflared tunnel run` khi không dùng), KHÔNG dùng thay cho deploy Vercel thật khi app đã sẵn sàng cho người dùng thật — việc deploy Vercel (xem `docs/deployment/vercel_deployment_guide.md`) vẫn ngoài phạm vi spec này, bàn riêng sau.

---

## PHẦN E — App: thêm nút "Trigger CV Parser" vào menu Add New Candidate

**File:** `src/app/candidates/page.js`, ngay cạnh nút `+ New Candidate` hiện có (dòng ~850-857).

Thêm 1 nút mới, ví dụ:

```jsx
{/* + Parse CV (n8n AI) Button */}
<a
  href={process.env.NEXT_PUBLIC_N8N_CV_PARSER_FORM_URL || "#"}
  target="_blank"
  rel="noopener noreferrer"
  className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-sky-400 border border-sky-600/60 font-bold text-xs flex items-center gap-1.5 transition-all"
  title="Mở form upload CV để AI tự trích xuất & thêm vào hàng đợi CV Imports Queue"
>
  <Sparkles size={13} />
  <span>+ Parse CV (AI)</span>
</a>
```

*(Thêm import icon `Sparkles` từ `lucide-react` nếu chưa có; đổi tên icon tuỳ ý miễn hợp ngữ nghĩa "AI/parse".)*

- `NEXT_PUBLIC_N8N_CV_PARSER_FORM_URL`: URL form public của n8n Form Trigger (node `CV Upload Form`, `webhookId: df0ae174-4b23-42f9-9bb6-847fc7b31686`) — dạng thường là `https://<domain-n8n-vps>/form/df0ae174-4b23-42f9-9bb6-847fc7b31686`, nhưng **AG phải xác nhận đúng domain/format URL thật** từ `docs/deployment/n8n_vps_management_guide.md` hoặc trực tiếp trong n8n UI (tab "Form" của node sau khi **publish/activate workflow** — form production URL chỉ hoạt động khi workflow đang `active`).
- Vì sao dùng link mở form n8n trực tiếp (thay vì tự xây upload trong app rồi gọi webhook n8n từ server): đơn giản, tận dụng UI form n8n có sẵn, không cần thêm code xử lý multipart upload trong Next.js. Nếu sau này muốn trải nghiệm mượt hơn (upload ngay trong modal `NewCandidateModal`), có thể làm 1 phase riêng — không nằm trong phạm vi spec này.
- **Bắt buộc**: sau khi hoàn tất Phần A–D, phải **activate/publish** workflow n8n (`fofSZKkdyhlVd9Lc`) — hiện đang `active: false`, không có form production URL nếu chưa publish.

---

## PHẦN F — Bỏ Telegram, thay bằng Notification Center trong app (ATS 3.0)

**Quyết định kiến trúc (chốt 2026-09-02, theo yêu cầu user):** loại bỏ hoàn toàn phụ thuộc Telegram khỏi hệ thống CV Parser — trước đây dùng Telegram do hạn chế kỹ thuật/khả năng của hệ thống cũ, nay ATS 3.0 đã có sẵn cơ chế thông báo trong app nên không cần phụ thuộc dịch vụ ngoài nữa. Thay thế bằng: (1) 1 bảng `notifications` mới trong Supabase, (2) 1 API route để n8n ghi/cập nhật thông báo (tái dùng đúng pattern webhook `/api/webhooks/cv-import` đã có — **không cần thêm credential n8n mới**), (3) mở rộng Bell icon/panel có sẵn trong `PendingCVClientWrapper.js` thành "Notification Center" chung, dùng lại cho cả case 1-CV/execution (Phase 1 này) lẫn tiến độ batch nhiều-CV (Phase 2, sẽ tái dùng đúng bảng/route này thay vì tạo mới).

### F.1 — Bảng mới `notifications`

```sql
CREATE TABLE notifications (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v7(),
  type text NOT NULL,               -- 'cv_single_import' (Phase 1) | 'cv_batch_progress' (Phase 2, sau này)
  title text NOT NULL,
  message text,
  severity text NOT NULL DEFAULT 'info' CHECK (severity IN ('info','success','warning','error')),
  link text,
  is_read boolean NOT NULL DEFAULT false,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_notifications_unread ON notifications (is_read, created_at DESC);
```

*(Không cần FK từ `notifications` đi đâu cả (bảng dạng log/thông báo, không có quan hệ "thuộc về" candidate cụ thể) — tuân thủ Rule B (UUID + timestamps + index) nhưng FK chỉ áp dụng khi có quan hệ thật; Phase 2 sau này sẽ thêm FK NGƯỢC LẠI từ `cv_import_batches.notification_id` trỏ tới bảng này, xem spec Phase 2.)*

### F.2 — API route mới: `src/app/api/webhooks/notifications/route.js`

1 route, 1 POST handler, branch theo có/không có `id` trong body — không có `id` → INSERT dòng mới (trả `{ id }`, dùng cho Phase 1: ghi 1 lần rồi thôi); có `id` → UPDATE dòng đó tại chỗ (dùng cho Phase 2 sau này: cập nhật tiến độ batch, đúng vai trò mà Telegram `editMessageText` từng làm — chỉ khác là sửa 1 dòng DB thay vì sửa 1 tin nhắn chat).

```js
import { NextResponse } from 'next/server';
import sql from '../../../../lib/db';

export async function POST(req) {
  try {
    const body = await req.json();

    if (body.id) {
      const [row] = await sql`
        UPDATE notifications
        SET
          title = COALESCE(${body.title ?? null}, title),
          message = COALESCE(${body.message ?? null}, message),
          severity = COALESCE(${body.severity ?? null}, severity),
          metadata = COALESCE(${body.metadata ? JSON.stringify(body.metadata) : null}::jsonb, metadata),
          is_read = false,
          updated_at = NOW()
        WHERE id = ${body.id}
        RETURNING id
      `;
      return NextResponse.json({ id: row?.id ?? body.id });
    }

    const [row] = await sql`
      INSERT INTO notifications (type, title, message, severity, link, metadata)
      VALUES (${body.type}, ${body.title}, ${body.message ?? null}, ${body.severity ?? 'info'}, ${body.link ?? null}, ${body.metadata ? JSON.stringify(body.metadata) : null})
      RETURNING id
    `;
    return NextResponse.json({ id: row.id }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
```

*(Không có xác thực/auth trên route này — giữ nhất quán với `/api/webhooks/cv-import` hiện tại, cũng đang mở hoàn toàn; đây là hạn chế đã tồn tại từ trước trong dự án, không thuộc phạm vi vá của spec này.)*

### F.3 — Server actions mới: `src/app/notification_actions.js`

```js
'use server';
import sql from '../../lib/db';
import { revalidatePath } from 'next/cache';

export async function getNotifications(limit = 30) {
  return sql`SELECT * FROM notifications ORDER BY created_at DESC LIMIT ${limit}`;
}

export async function getUnreadNotificationCount() {
  const [row] = await sql`SELECT COUNT(*)::int AS count FROM notifications WHERE is_read = false`;
  return row.count;
}

export async function markNotificationRead(id) {
  await sql`UPDATE notifications SET is_read = true WHERE id = ${id}`;
  revalidatePath('/');
}

export async function markAllNotificationsRead() {
  await sql`UPDATE notifications SET is_read = true WHERE is_read = false`;
  revalidatePath('/');
}
```

### F.4 — UI: mở rộng Bell icon/panel trong `PendingCVClientWrapper.js` thành Notification Center

Theo đúng nguyên tắc MVC/không hoạt ảnh màu mè mà user đã nêu (áp dụng cho MỌI UI mới từ đây trở đi, không riêng Phase 2): KHÔNG dùng component/library mới, KHÔNG thêm animation ngoài animation đã có sẵn của panel (`animate-in slide-in-from-right`).

1. `layout.js`: gọi thêm `getNotifications()`, truyền xuống làm prop mới `initialNotifications` (cạnh `initialPending` đã có).
2. `PendingCVClientWrapper.js`:
   - Bell badge (dấu chấm đỏ) sáng khi `pendingItems.length > 0` **HOẶC** còn ít nhất 1 notification `is_read === false`.
   - Trong panel trượt, thêm 1 section MỚI ngay dưới "Pending CV Imports" hiện có, tiêu đề "Thông báo" — render danh sách phẳng, mỗi dòng: icon theo `severity` (dùng thêm từ `lucide-react` đã là dependency sẵn có — gợi ý `CheckCircle2` (success), `AlertTriangle` (warning), `XCircle` (error), `Info` (info) — không cần thêm lib mới), `title`, `message`, thời gian tương đối (viết 1 hàm `timeAgo()` nhỏ ngay trong file nếu `package.json` chưa có sẵn `date-fns`/`dayjs`; nếu đã có thì dùng luôn cho nhất quán), 1 nút nhỏ "Đánh dấu đã đọc" gọi `markNotificationRead` rồi cập nhật state local — cùng pattern optimistic-update với `handleResolve` đã có.
   - **KHÔNG** cần polling/Supabase Realtime/WebSocket ở bản này — panel lấy dữ liệu mới nhất khi mở lại (do `router.refresh()` đã được gọi sau mỗi hành động, và `layout.js` là server component nên fetch lại theo navigation). Nếu sau này cần thấy tiến độ batch "sống" ngay cả khi không thao tác gì (không cần đóng/mở panel để thấy cập nhật) — đó là 1 phase riêng, dùng Supabase Realtime, KHÔNG nằm trong phạm vi spec này.

## PHẦN G — QA Vòng 1: 5 vấn đề cần sửa trước khi test lại (MỚI 2026-09-02)

Claude đã đối chiếu trực tiếp workflow n8n (`fofSZKkdyhlVd9Lc` + subworkflow `0BLBJWwP80nn9eN3`), schema Supabase (`sandbox`/`public`), và diff code (commit `793e299`). **Đã làm đúng, không cần đụng lại:** Phần A (OCR subworkflow ID), C.1–C.3 (Parse & Normalize, Upload Drive, Build Webhook Payload), C.6 (xoá 12 node Notion cũ), C.7 (đổi tên workflow), Phần E (nút "+ Parse CV (AI)"), Phần F (bảng `notifications` cả 2 schema, route `/api/webhooks/notifications`, `notification_actions.js`, UI Bell/panel — đã test thật, hoạt động tốt). Việc thứ 6 (thư mục `docs/testing/test data/` bị lỡ commit vào git) Claude đã tự xử lý xong (`git rm -r --cached`, thêm `.gitignore`) — AG không cần làm gì cho mục này.

### G.1 — [NGHIÊM TRỌNG] URL webhook trỏ sai, không tới app thật

3 node đang hardcode `https://crm-ats-web.vercel.app`: **`Call ATS Webhook`** (`call_ats_webhook`), **`Create Notification`** (`create_notification`), **`Log Execution Error`** (`log_error_node`). Đã xác nhận trực tiếp qua browser: domain này KHÔNG phải app của bạn — Vercel dashboard của user (`trithuc1995hcm-7590`) đang có 0 project, mở URL đó chỉ thấy trang demo "Acme Inc." của người khác. Nghĩa là hiện tại không có CV/notification/log lỗi nào tới được app hay Supabase thật qua 3 node này.

**Fix:** đổi cả 3 node dùng `{{ $env.ATS_APP_BASE_URL }}` thay cho URL cứng (đúng yêu cầu ban đầu ở C.4, TUYỆT ĐỐI không hardcode kể cả URL tunnel mới — xem lại D.2). Set biến `ATS_APP_BASE_URL` trong n8n theo đúng tunnel mới ở **PHẦN D** (`https://ats-dev.thucnguyen8n.space`), làm Phần D trước rồi quay lại sửa 3 node này.

### G.2 — [NGHIÊM TRỌNG] Credential Google Drive không resolve được

Node **`Upload CV to Drive`** báo lỗi lúc chạy thật: `Credential with ID "XPs3k488EdswMivn" does not exist for type "googleDriveOAuth2Api"`.

**Fix:** vào n8n UI, mở node này, gán lại credential Google Drive (có thể do credential chưa được share vào đúng project chứa workflow, hoặc ID đã đổi).

### G.3 — [NGHIÊM TRỌNG] PHẦN B chưa thực sự làm — API key Gemini vẫn hardcode

3 node đang có `x-goog-api-key` hardcode thẳng giá trị key trong header (chỉ chuyển từ query string `?key=...` sang header, KHÔNG phải credential n8n thật như PHẦN B đã yêu cầu): **`Extract CV Data (AI - PDF)`**, **`Extract CV Data (AI - Text)`**, và **`Gemini OCR Request`** (trong subworkflow `0BLBJWwP80nn9eN3`). Vì `saveDataSuccessExecution: "all"`, key này còn bị ghi lại trong log của MỌI execution.

**Fix:** tạo 1 n8n Credential (Header Auth) cho Gemini, gán vào cả 3 node, xoá `x-goog-api-key` khỏi `headerParameters` literal — đúng như PHẦN B đã mô tả từ đầu.

### G.4 — [TRUNG BÌNH] Thiếu `continueOnFail: true`

2 node sau đang thiếu `continueOnFail: true` (spec C.4/C.5 đã yêu cầu): **`Call ATS Webhook`**, **`Create Notification`**. Hiện tại nếu app lỗi tạm thời, cả execution chết ngang, không có notification báo lỗi nào — ngược với mục đích Notification Center.

**Fix:** bật `continueOnFail: true` cho cả 2 node.

### G.5 — [NHẸ] Sticky note ghi sai

Sticky note hiện ghi "Setup Required: 1. Anthropic API — for Claude CV extraction" nhưng thực tế workflow không dùng Anthropic/Claude node nào — extraction gọi thẳng Gemini. Sticky note cũng vẫn ghi `{{ATS_APP_BASE_URL}}` trong mô tả flow dù node thật đang hardcode URL khác (sẽ tự khớp lại sau khi sửa G.1).

**Fix:** sửa lại nội dung sticky note cho khớp thực tế (2 credential thật: Google Drive + Gemini Header Auth, không có Anthropic).

### Thứ tự làm khuyến nghị

Làm **PHẦN D** (tunnel) trước → có giá trị `ATS_APP_BASE_URL` thật → làm **G.1** (dùng đúng giá trị đó) → **G.2, G.3, G.4, G.5** (độc lập, thứ tự tuỳ ý) → chạy test plan bên dưới.

## PHẦN H — Vòng 3: audit VPS + sửa đúng hướng G.1/G.2/G.3 (MỚI 2026-09-02)

Claude đã đọc `docs/deployment/n8n_vps_management_guide.md` (tài liệu migration VPS gốc) và xác nhận: **`poppler-utils` (chứa `pdftoppm`) đúng ra PHẢI có sẵn** — VPS được build bằng Dockerfile tuỳ chỉnh có dòng `RUN apk add --no-cache poppler-utils ...`. Tài liệu cũng cảnh báo tuyệt đối không bấm nút "Nâng cấp" trên TinoHost Web Panel vì nó ghi đè `docker-compose.yml` về mặc định, xoá sạch phần tuỳ chỉnh này — nếu `pdftoppm` thật sự mất, đây là nghi phạm số 1. Claude không SSH được vào VPS (egress bị chặn ở tầng hạ tầng của Claude, không phải giới hạn có thể gỡ), nên cần AG xác minh trực tiếp.

### H.1 — Audit VPS (chỉ đọc, không sửa gì)

Chạy đúng khối lệnh sau qua SSH (`root@103.xxx.xxx.xxx`, xem `secrets.txt`), dán nguyên văn kết quả vào mục ghi chú hoàn thành (không tự diễn giải, Claude cần xem raw output):

```bash
docker ps --format '{{.Names}}\t{{.Image}}\t{{.Status}}'
docker exec n8n-n8n-1 which pdftoppm || echo 'PDFTOPPM_NOT_FOUND'
grep -c 'poppler-utils' /opt/n8n/docker-compose.yml
docker exec n8n-n8n-1 sh -c "env | grep -i BLOCK_ENV" || echo 'khong co bien nay trong container'
grep -i 'N8N_BLOCK_ENV_ACCESS_IN_NODE' /opt/n8n/.env /opt/n8n/docker-compose.yml
stat -c '%y' /opt/n8n/docker-compose.yml
```

Kết quả này xác nhận luôn 2 việc: (1) `pdftoppm` có thật sự mất không — nếu mất, cần rebuild lại đúng theo Dockerfile trong tài liệu migration (KHÔNG dùng nút Upgrade), Claude sẽ hướng dẫn tiếp sau khi có kết quả; (2) `N8N_BLOCK_ENV_ACCESS_IN_NODE` có thật sự bật không — quyết định cách sửa H.2 bên dưới.

### H.2 — G.1 (URL hardcode): đổi cách tiếp cận, KHÔNG dùng `$env` nữa

Ghi nhận: báo cáo sai lệch của AG (n8n VPS chặn `$env` trong node bằng `N8N_BLOCK_ENV_ACCESS_IN_NODE=true`, gây `ExpressionError`) là hợp lý và đúng quy trình 10.7 — cảm ơn AG đã báo rõ thay vì im lặng. Nhưng **giữ nguyên URL hardcode ở 3 node thì không được** — khi đổi sang Vercel thật sẽ phải sửa tay lại cả 3 chỗ, dễ sót y như đã sót lần này.

**Cách thay thế (không đụng `$env`, không bị chặn):** thêm 1 node **Set/Edit Fields** mới tên `Config`, đặt trước `Call ATS Webhook` (hoặc đặt đầu workflow, không quan trọng vị trí miễn có trong luồng trước 3 node cần dùng), chỉ có 1 field:
```
baseUrl = "https://ats-dev.thucnguyen8n.space"
```
(giá trị literal, y hệt cách đang hardcode — khác biệt duy nhất là giờ chỉ nằm ở ĐÚNG 1 CHỖ). Sau đó 3 node `Call ATS Webhook`, `Create Notification`, `Log Execution Error` đổi URL thành:
```
={{ $('Config').item.json.baseUrl }}/api/webhooks/cv-import
={{ $('Config').item.json.baseUrl }}/api/webhooks/notifications
```
`$('Config')...` là tham chiếu node bình thường của n8n, KHÔNG phải `$env` — không bị `N8N_BLOCK_ENV_ACCESS_IN_NODE` chặn. Khi deploy Vercel thật, chỉ cần sửa đúng 1 giá trị trong node `Config`, không phải lần theo từng node HTTP Request nữa.

*(Nếu kết quả H.1 cho thấy `N8N_BLOCK_ENV_ACCESS_IN_NODE` KHÔNG thật sự bật, báo lại Claude — lúc đó quay về dùng `{{ $env.ATS_APP_BASE_URL }}` như spec gốc, không cần thêm node `Config`.)*

### H.3 — G.3 (key Gemini hardcode): KHÔNG liên quan gì đến việc chặn `$env` — vẫn phải xoá

AG đang hiểu nhầm là API key Gemini cũng bị chặn giống H.2 nên giữ nguyên header tĩnh — **đây là 2 cơ chế hoàn toàn khác nhau**. Credential n8n (`httpHeaderAuth`, đã tạo sẵn tên `Google Gemini OCR API Key`, id `O9UU0pADSN3PCYir`, đã gán đúng vào cả 3 node) tự động chèn header lúc gửi request, KHÔNG cần viết `{{ $env... }}` hay bất kỳ expression nào trong `headerParameters` — nên không hề bị `N8N_BLOCK_ENV_ACCESS_IN_NODE` ảnh hưởng.

**Fix (không có gì phải đổi cách tiếp cận, chỉ cần làm nốt phần còn thiếu):** ở cả 3 node `Extract CV Data (AI - PDF)`, `Extract CV Data (AI - Text)`, `Gemini OCR Request` (subworkflow `0BLBJWwP80nn9eN3`) — xoá dòng `{"name": "x-goog-api-key", "value": "AQ.Ab8R..."}` khỏi `headerParameters.parameters`, chỉ giữ lại `Content-Type`. Credential đã gán sẵn sẽ tự lo phần xác thực.

*Lưu ý cho AG: node `Gemini OCR Request` ở subworkflow đã có sẵn 1 bản DRAFT (do Claude tạo lúc trước) đã xoá đúng key này rồi nhưng CHƯA publish — vào n8n UI mở subworkflow đó, nếu thấy draft đã đúng thì chỉ cần bấm Publish, không cần sửa lại từ đầu.*

### H.4 — G.2 (Google Drive credential) — vẫn treo, cần AG làm qua UI

`cv_url` của 2 candidate tạo ở vòng 2 vẫn rỗng — credential ID `XPs3k488EdswMivn` vẫn lỗi y hệt. Vào n8n UI → Credentials → tìm hoặc tạo lại credential Google Drive OAuth2 → đăng nhập lại tài khoản Google → gán credential mới/đã sửa vào node `Upload CV to Drive`. Việc này bắt buộc thao tác qua UI (OAuth), không có cách nào làm qua API.

### H.5 — Làm rõ "script dọn dẹp" đã nhắc trong log 12:55

Devlog ghi: *"dữ liệu test vòng trước biến mất do script dọn dẹp chạy ngay sau test"* — cần AG nói rõ: script này tên gì, nằm ở đâu (cron trên VPS? cron trên máy Windows? trong code app?), chạy tự động theo lịch hay do AG tự chạy tay, và có khả năng đụng vào schema `public` (dữ liệu thật) không. Đây không phải để trách AG — nhưng theo mục 9 Phần C của GEMINI.md (cấm xoá hàng loạt không kiểm soát), một script tự xoá dữ liệu `sandbox` mà không ai biết rõ là rủi ro cần hiểu để tránh lặp lại, kể cả khi lần này vô hại.

---

Sau khi xong H.1–H.5, báo lại Claude kèm nguyên văn output H.1 — Claude sẽ tự đối chiếu Supabase + n8n độc lập như các vòng trước rồi mới kết luận PASS.

### Kết quả xác nhận vòng 3 (2026-09-02, Claude tự đối chiếu độc lập)

User đã tự chạy H.1 trên Xshell (Claude không điều khiển được máy do lỗi kỹ thuật của tool remote-control), dán nguyên văn output. Đối chiếu với n8n + Supabase:

* **H.1 xác nhận:** `pdftoppm` CÓ THẬT tại `/usr/bin/pdftoppm`, `poppler-utils` có 2 lần xuất hiện trong `docker-compose.yml`, image đang chạy là `n8n-custom-n8n:2.37.6` (đúng bản custom, không bị nút Upgrade ghi đè). `docker-compose.yml` mtime là `2026-08-31 20:31` — không bị đụng vào từ lúc migrate tới giờ. `N8N_BLOCK_ENV_ACCESS_IN_NODE` KHÔNG xuất hiện trong container env, `.env`, lẫn `docker-compose.yml`.
* **Ghi nhận sai lệch cần đính chính:** báo cáo sai lệch đầu tiên của AG (Phần F, "Docker container n8n không cài sẵn poppler-utils") **không đúng thực tế** — `pdftoppm` vẫn có sẵn. Quyết định chuyển sang Gemini native multimodal (bỏ `pdftoppm`) vẫn được GIỮ NGUYÊN vì đang chạy tốt và về kỹ thuật là giải pháp gọn hơn — không cần revert — nhưng lý do ban đầu AG đưa ra là sai, cần AG lưu ý kiểm tra kỹ hơn trước khi kết luận môi trường thiếu gì đó.
* **H.2 (Config node):** ĐÃ XÁC NHẬN ĐÚNG qua n8n — node `Config` hoạt động, `Call ATS Webhook`/`Create Notification` đọc URL qua node này.
* **H.3 (key Gemini):** ĐÃ XÁC NHẬN ĐÚNG — hết hardcode ở cả 3 node (2 node chính + subworkflow, bản subworkflow đã publish).
* **H.4 (Google Drive) — VẪN CHƯA FIX:** credential vẫn là `XPs3k488EdswMivn` (ID cũ, chưa đổi), `cv_url` của cả 2 candidate tạo ra ở vòng 3 (display_number `11831`, `11832`) vẫn là chuỗi rỗng. Đây là việc DUY NHẤT còn lại chặn PASS toàn phần.

**Kết luận:** chỉ còn H.4 (Google Drive OAuth) cần AG hoàn thành qua UI n8n. Mọi việc khác của Phần G + H đã PASS, xác nhận độc lập.

### PASS cuối cùng (2026-09-02, sau khi AG relink Google Drive OAuth)

Claude tự kiểm tra execution thật (#88) trên n8n: node `Upload CV to Drive` trả về file Google Drive thật (`webViewLink` hợp lệ, chủ sở hữu đúng tài khoản), `cv_url` được truyền đúng xuống `Build Webhook Payload` và lưu đúng vào `sandbox.pending_cv_imports.payload.cv_url` trên Supabase — xác nhận bằng SQL trực tiếp, không dựa vào báo cáo.

**H.4 — PASS.** (Lưu ý nhỏ: credential ID trong workflow JSON vẫn hiển thị `XPs3k488EdswMivn` như cũ — có vẻ AG đã re-authenticate lại đúng credential này thay vì tạo credential mới, không ảnh hưởng gì vì đã chạy thật thành công.)

**KẾT LUẬN TOÀN BỘ PHẦN G + H: PASS.** Toàn bộ 5 vấn đề Phần G và 5 mục Phần H đã được xác nhận độc lập (không dựa vào báo cáo AG) qua n8n execution log + Supabase SQL trực tiếp. CV Parser Phase 1 (chuyển đích Notion→Supabase, vá OCR, Notification Center, Cloudflare Named Tunnel) chính thức PASS. Sẵn sàng chuyển sang Phase 2 (`FIX_SPEC_2026-09-02_n8n_cv-parser-batch-resume-and-dedup-cases.md`).



## Test trước khi báo hoàn thành

1. **OCR subworkflow độc lập**: dùng `test_workflow` (n8n MCP) với pin data trên `0BLBJWwP80nn9eN3`, xác nhận `pdftoppm` chạy được trên VPS (không lỗi "command not found"), Gemini node được gọi qua credential (không còn key lộ trong URL).
2. **Webhook payload đúng schema**: dùng `curl`/Postman gọi thẳng `POST {{ATS_APP_BASE_URL}}/api/webhooks/cv-import` với 1 payload mẫu khớp cấu trúc ở C.1 bước 4 — xác nhận trả `201` (candidate mới) khi dùng SĐT/email chưa tồn tại, và `202` (queued) khi dùng dữ liệu trùng với ứng viên có sẵn trong `sandbox.candidates`/`sandbox.contact_points`.
3. **End-to-end thật với 2 file test đã chuẩn bị** (`docs/testing/test data/CV_18_...pdf` — text, ứng viên mới; `CV_25_...pdf` — scan, ứng viên mới): chạy qua form n8n thật (sau khi publish), xác nhận: (a) OCR thật sự chạy cho file scan (không còn "Notify OCR Fail"), (b) ứng viên mới xuất hiện đúng trong Supabase `sandbox.candidates` + `contact_points`, (c) file CV lên đúng Google Drive, `cv_url` lưu đúng trong DB, (d) đúng 1 dòng được tạo trong bảng `notifications` (severity/nội dung khớp `match_status`), và Bell icon trên app hiện đúng badge chưa đọc.
4. **Test trùng lặp**: chạy 1 trong 5 profile trùng cố ý từ `generate_cvs.py` (`duplicates` list, CV_01–CV_10) — xác nhận request bị đẩy vào `pending_cv_imports` (không tự tạo candidate mới), và hàng đợi "CV Imports Queue" trên UI app hiển thị đúng bản ghi chờ duyệt.
5. Nút "+ Parse CV (AI)" trên `candidates/page.js` mở đúng form n8n ở tab mới, không vỡ layout cạnh 2 nút hiện có.
6. Cập nhật `DEVELOPMENT_LOG.md`.

**Lưu ý:** các bước 1–4 có tác dụng phụ thật (ghi Supabase sandbox, upload Drive thật, ghi notification thật vào Supabase) — vì đây là môi trường `sandbox` đã dùng xuyên suốt dự án hôm nay nên an toàn để test, không đụng dữ liệu `public`/production.
