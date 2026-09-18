**Từ:** Claude (Architect/QA)

# FIX_SPEC_2026-09-17c — Sửa lỗi tạo trùng lặp Google Contact mỗi lần "Save to Google Contacts"

## Bối cảnh

PO báo: Google Contacts xuất hiện nhiều bản trùng lặp cho cùng 1 candidate (ảnh chụp: "Mr Viet An Tran" x3, "Mr Khuong Loc To" x4 trong UI "Hợp nhất các mục liên hệ trùng lặp" của Google).

## Root cause đã xác nhận qua đọc trực tiếp code + workflow n8n thật (KHÔNG suy diễn) — 2 nguyên nhân cộng hưởng

### Nguyên nhân 1 (chính) — "Always Create" cho candidate không có Email/Phone/LinkedIn

Workflow n8n **"A2: Save Contacts → Google Sync (ATS 3.0)"** (`O659fZyN2uGaaLyL`, đang `active`), node **`Normalize Contacts`** (`n005`) build `dedupValues` CHỈ từ 3 loại contact: Email/Phone/LinkedIn (bỏ qua Facebook/Zalo/Skype/Website...), và set `hasMatchableContacts = dedupValues.length > 0`.

Node **`Match Logic`** (`n007`) có early-return:
```js
if (!data.hasMatchableContacts) {
  return [{ json: { ...data, matchCount: 0, matches: [], note: 'No matchable contacts — will create new' } }];
}
```
→ Bất kỳ candidate nào KHÔNG có Email/Phone/LinkedIn nào (chỉ có Facebook/Zalo/Skype, hoặc không có contact nào) sẽ **LUÔN LUÔN bị route sang Create** (`Route by Match Count` n008: `matchCount === 0` → nhánh Create) ở **MỌI LẦN sync**, kể cả khi đã có sẵn 1 Google Contact được chính hệ thống này tạo ra trước đó cho candidate đó. Mỗi lần PO bấm "Save to Google Contacts" lại → thêm 1 bản trùng mới.

**Bằng chứng đã có sẵn để match chính xác 100% mà KHÔNG cần thêm cột DB mới**: Cả `Build Create Payload` (`n009`) lẫn `Build Update Payload` (`n012`) đều ghi `biographies: [{ value: '[ATS 3.0] ' + c.atsUrl + '\nID: ' + c.candidateDisplayNumber + ... }]` vào MỌI Google Contact được tạo/cập nhật — nghĩa là **URL ATS 3.0 duy nhất của candidate đã luôn được nhúng sẵn trong field `biographies`** của Google Contact đó. `Get All Google Contacts` (`n006`) đã fetch field `biographies` (`fields: [...,"biographies",...]`) nhưng `Match Logic` hiện KHÔNG dùng field này để so khớp — đây chính là dữ liệu cần dùng để match, không cần thêm bảng/cột mới trong Postgres.

### Nguyên nhân 2 (phụ, cộng hưởng) — Race condition do thiếu debounce trên nút bấm

`src/app/candidates/page.js:1206-1223` và `src/app/search/page.js:349-363`: nút "Save to Google Contacts" KHÔNG có state loading/disable — bấm nhanh 2 lần (hoặc double-click) sẽ bắn 2 request độc lập gần như đồng thời. Đã có bằng chứng thực tế trong `docs/testing/QA_Finding_2026-09-13_google-contacts-sync-duplicate-dispatch-etag-conflict.md` (2 dispatch cách nhau 4.6s cho 1 lần bấm) nhưng khuyến nghị disable nút CHƯA từng được triển khai — code hiện tại vẫn y hệt lúc phát hiện. Vì `Get All Google Contacts` (n006) chụp snapshot danh sách contact 1 LẦN đầu execution (không lock giữa các execution), 2 lần dispatch chồng nhau đều thấy "chưa có match" (nếu là lần sync đầu tiên) và đều tạo mới → thêm trùng.

### Phát hiện phụ (liên quan trực tiếp, sửa luôn trong spec này) — `atsUrl` sai định dạng

`src/app/actions.js:2272`: `atsUrl: \`${baseUrl}/candidates/${c.id}\`` — SAI định dạng. `src/app/candidates/page.js:734` đọc candidate cần xem qua query param `?id=`, KHÔNG phải path segment `/candidates/<id>`. Vì `atsUrl` này được nhúng làm link "Open in ATS 3.0" trong MỌI notification/biography Google Contact (và giờ còn được dùng làm khóa match ở Nguyên nhân 1), sửa luôn thành `${baseUrl}/candidates?id=${c.id}` — đúng 1 dòng, cùng file đang sửa, cùng bối cảnh.

## Phạm vi

1. **n8n workflow `O659fZyN2uGaaLyL`, node `Match Logic` (`n007`)** — sửa code (chi tiết bên dưới).
2. **`src/app/actions.js`** — dòng 2272, sửa định dạng `atsUrl`.
3. **`src/app/candidates/page.js`** (~1206-1223) — thêm state disable nút khi đang sync.
4. **`src/app/search/page.js`** (~349-363) — thêm state disable nút khi đang sync.

Không đụng gì khác. Không sửa `Normalize Contacts`, `Build Create/Update Payload`, `Route by Match Count`, hay bất kỳ node/webhook nào khác. Không tạo migration DB mới (không cần thiết cho fix này). Nếu phát hiện cần mở rộng, DỪNG LẠI và in `ESCALATE:`.

## Chi tiết triển khai

### A. n8n — node `Match Logic` (`n007`), workflow `O659fZyN2uGaaLyL`

Code hiện tại (rút gọn phần đầu không đổi — giữ nguyên hàm `normPhone`):

```js
const data = $('Normalize Contacts').first().json;
const gcs = $('Get All Google Contacts').all();

if (!data.hasMatchableContacts) {
  return [{ json: { ...data, matchCount: 0, matches: [], note: 'No matchable contacts — will create new' } }];
}

function normPhone(p) { /* giữ nguyên */ }

const matches = [];
for (const gc of gcs) {
  const g = gc.json;
  const gcPhones = new Set((g.phoneNumbers || []).map(p => normPhone(p.value)));
  const gcEmails = new Set((g.emailAddresses || []).map(e => e.value.toLowerCase().trim()));
  const gcUrls = (g.urls || []).map(u => u.value.toLowerCase().trim().replace(/\/+$/, '').split('?')[0]);

  let matched = false, matchedOn = [];
  for (const d of data.dedupValues) {
    /* giữ nguyên logic so khớp email/phone/linkedin */
  }

  if (matched) matches.push({ resourceName: g.resourceName, etag: g.etag, /* ... giữ nguyên các field còn lại ... */, matchedOn });
}

return [{ json: { ...data, matchCount: matches.length, matches } }];
```

**2 thay đổi bắt buộc:**

1. **XÓA hẳn khối early-return `if (!data.hasMatchableContacts) { ... }`** — không còn short-circuit "chưa có email/phone/linkedin thì luôn Create" nữa. Vòng lặp `for (const d of data.dedupValues)` vẫn an toàn khi `dedupValues` rỗng (đơn giản là không match được gì qua nhánh này), không cần sửa gì thêm ở đó.

2. **Thêm 1 điều kiện match mới DỰA VÀO `atsUrl` đã nhúng sẵn trong `biographies`**, ngay sau vòng `for (const d of data.dedupValues) {...}` (trước dòng `if (matched) matches.push(...)`):

```js
  // Fallback match qua URL ATS 3.0 đã được nhúng sẵn trong field biography của MỌI
  // Google Contact do chính hệ thống này tạo/cập nhật (xem Build Create/Update Payload).
  // Bắt đúng trường hợp candidate không có Email/Phone/LinkedIn (trước đây luôn bị tạo
  // trùng) VÀ tự "chữa lành" các candidate đã lỡ bị tạo trùng trước đó — lần sync tiếp
  // theo sẽ match đúng vào 1 trong các bản trùng đã có thay vì tạo thêm bản mới.
  const gcBio = (g.biographies || []).map(b => b.value || '').join(' \n ');
  if (data.candidate.atsUrl && gcBio.includes(data.candidate.atsUrl)) {
    matched = true;
    matchedOn.push('ATS URL (biography)');
  }
```

Toàn bộ phần còn lại của node (khai báo `gcPhones`/`gcEmails`/`gcUrls`, object push vào `matches`, `return`) giữ nguyên 100%.

**Dùng n8n MCP tool cập nhật ĐÚNG node `Match Logic` (id `n007`)** trong workflow `O659fZyN2uGaaLyL`, giữ nguyên mọi node/connection khác. Publish lại workflow sau khi sửa nếu cần.

### B. `src/app/actions.js` — dòng 2272

Đổi:
```js
      atsUrl: `${baseUrl}/candidates/${c.id}`,
```
thành:
```js
      atsUrl: `${baseUrl}/candidates?id=${c.id}`,
```
Không sửa gì khác trong hàm `syncCandidatesToGoogleContacts`.

### C. `src/app/candidates/page.js` (~dòng 769-771 khai báo state, ~1206-1223 nút bấm)

Thêm state mới cạnh `showCvUploadModal` (dòng 771):
```js
const [isSyncingGoogleContacts, setIsSyncingGoogleContacts] = useState(false);
```

Sửa block nút (dòng 1206-1223):
```jsx
{/* Save to Google Contacts Button */}
{candidate?.id && (
  <button
    onClick={async () => {
      if (isSyncingGoogleContacts) return;
      setIsSyncingGoogleContacts(true);
      try {
        const res = await syncCandidatesToGoogleContacts([candidate.id]);
        if (res.success) {
          notify(`Đã gửi yêu cầu đồng bộ ${res.count} candidate tới Google Contacts`, 'success');
        } else {
          notify(`Lỗi: ${res.error}`);
        }
      } finally {
        setIsSyncingGoogleContacts(false);
      }
    }}
    disabled={isSyncingGoogleContacts}
    className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-emerald-400 border border-emerald-600/60 font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
    title="Save candidate to Google Contacts"
  >
    <Contact size={13} />
    <span>{isSyncingGoogleContacts ? 'Syncing...' : 'Save to Google Contacts'}</span>
  </button>
)}
```

### D. `src/app/search/page.js` (~dòng 62 khai báo state, ~349-363 nút bấm)

Thêm state mới cạnh `selectedCandidateIds` (dòng 62):
```js
const [isSyncingGoogleContacts, setIsSyncingGoogleContacts] = useState(false);
```

Sửa block nút (dòng 349-363):
```jsx
<button
  onClick={async () => {
    if (isSyncingGoogleContacts) return;
    setIsSyncingGoogleContacts(true);
    try {
      const ids = Array.from(selectedCandidateIds);
      const res = await syncCandidatesToGoogleContacts(ids);
      if (res.success) {
        notify(`Đã gửi yêu cầu đồng bộ ${res.count} candidate tới Google Contacts`, 'success');
        setSelectedCandidateIds(new Set());
      } else {
        notify(`Lỗi: ${res.error}`, 'error');
      }
    } finally {
      setIsSyncingGoogleContacts(false);
    }
  }}
  disabled={isSyncingGoogleContacts}
  className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
>
  {isSyncingGoogleContacts ? 'Syncing...' : `Save to Google Contacts (${selectedCandidateIds.size})`}
</button>
```

## Việc KHÔNG được làm

- Không thêm cột/bảng DB mới — fix này KHÔNG cần schema migration.
- Không tự động xoá/hợp nhất (merge) các Google Contact đã bị trùng sẵn từ trước — đó là dữ liệu Google, ngoài phạm vi Postgres của dự án, PO tự xử lý qua UI "Hợp nhất các mục liên hệ trùng lặp" của Google nếu muốn dọn dữ liệu cũ. Fix này chỉ ngăn KHÔNG tạo thêm trùng mới, và giúp các candidate đã trùng không bị trùng THÊM nữa ở các lần sync sau (nhờ match qua biography).
- Không sửa `Normalize Contacts`, `Build Create Payload`, `Build Update Payload`, `Route by Match Count`, hay các node khác trong 2 workflow liên quan.

## Verify bắt buộc trước khi báo hoàn thành

1. `node --check src/app/actions.js src/app/candidates/page.js src/app/search/page.js` → PASS.
2. Đọc lại `get_workflow_details(O659fZyN2uGaaLyL)` sau khi sửa — xác nhận CHỈ node `Match Logic` thay đổi.
3. Test thật (KHÔNG dùng dữ liệu thật để test theo mục 10.8 GEMINI.md — tự tạo 1 candidate test cô lập, ví dụ tên có prefix rõ ràng như "QA Test XYZ", KHÔNG có Email/Phone/LinkedIn, chỉ có Facebook, rồi dọn sạch sau khi test xong):
   - Bấm "Save to Google Contacts" lần 1 → xác nhận Google Contact MỚI được tạo (trước đây sẽ luôn tạo, vẫn đúng).
   - Bấm "Save to Google Contacts" lần 2 cho ĐÚNG candidate đó → xác nhận lần này KHÔNG tạo thêm bản mới, mà UPDATE đúng bản đã tạo ở lần 1 (kiểm tra qua notification "Google Contact Updated" thay vì "Created", và số lượng Google Contact cho tên test đó vẫn là 1).
   - Bấm nhanh 2 lần liên tiếp (trong vòng &lt;1s) nút "Save to Google Contacts" → xác nhận nút bị disable ngay sau lần bấm đầu, không gửi request thứ 2 cho tới khi lần 1 xong.
   - Dọn sạch: xoá Google Contact test vừa tạo, xoá candidate test khỏi DB.
4. `npm run build` → PASS 100% routes.

## Tài liệu

Thêm 1 mục mới vào `docs/DEVELOPMENT_LOG.md` theo template mục 10.3 — liệt kê rõ cả phần n8n (workflow/node đã sửa) lẫn 3 file `src/` đã sửa, và ID candidate test đã tạo + xác nhận đã dọn dẹp (theo mục 10.8 GEMINI.md).

Báo cáo hoàn thành kèm bằng chứng đọc lại workflow n8n sau khi sửa, kết quả từng bước test. Nếu có sai lệch so với spec, ghi theo mục 10.7 GEMINI.md.
