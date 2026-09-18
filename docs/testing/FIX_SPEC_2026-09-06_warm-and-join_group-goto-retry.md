# FIX_SPEC_2026-09-06 — Them retry cho page.goto khi vao trang nhom FB trong warm-and-join.js (giam flaky timeout)

**Boi canh**: Execution #581 that bai ca 2/2 tai khoan cung 1 loi: `page.goto: Timeout 45000ms exceeded` khi vao `facebook.com/groups/tuyendungvieclamcokhi/`. Day la timeout mang/proxy that (khong phai bug logic), nhung code hien tai KHONG co retry cho buoc nay — trong khi cac buoc navigate khac trong CUNG FILE da co san retry.

### Root cause (xac nhan qua doc code that)
File `scripts/warm-and-join.js` da co san 1 helper dung cho dung viec nay:
```js
async function safeGoto(page, url, timeout = 60000) {
  try {
    return await page.goto(url, { waitUntil: 'domcontentloaded', timeout });
  } catch (err) {
    console.error(`[Navigation Retry] First attempt to ${url} failed (${err.message}). Retrying...`);
    await page.waitForTimeout(3000);
    return await page.goto(url, { waitUntil: 'commit', timeout: 45000 });
  }
}
```
Ham nay DANG duoc dung cho Home Feed va Watch/Reels (`performFeedWarming`), nhung ham `joinTargetGroup` (dong ~227) lai goi THANG `page.goto` KHONG qua `safeGoto`:
```js
await page.goto(groupUrl, { waitUntil: 'domcontentloaded', timeout: 45000 });
```
→ Neu lan dau bi timeout (mang/proxy cham thoang qua), KHONG co co hoi thu lai — that bai ngay lap tuc, dung nhu da xay ra o execution #581.

### Fix — 1 dong, dung lai helper co san
Doi dong ~227 trong `scripts/warm-and-join.js`, ham `joinTargetGroup`:
```js
await page.goto(groupUrl, { waitUntil: 'domcontentloaded', timeout: 45000 });
```
thanh:
```js
await safeGoto(page, groupUrl, 45000);
```
(`safeGoto` da dinh nghia san o dau file — chi can goi lai, khong can code them logic retry moi.)

**KHONG doi gi khac** — day chi la ap dung lai 1 pattern retry da co san va da dung, cho 1 cho dang bi bo sot.

### Yeu cau verify
1. Test lai voi chinh URL nhom tung fail (`tuyendungvieclamcokhi`) hoac 1 nhom khac neu URL nay hien khong con truy cap duoc — xac nhan neu lan dau timeout, code se tu retry lan 2 (log co dong "[Navigation Retry]...") thay vi that bai ngay.
2. Neu van fail ca 2 lan (mang/proxy that su co van de dai han), day la van de ha tang (proxy/VPS), khong phai code — bao lai cho User biet de kiem tra rieng, KHONG can sua them code.
3. Xac nhan cac group khac (khong bi flaky) van hoat dong binh thuong, khong bi cham lai dang ke do them retry (retry chi kich hoat khi that bai lan dau).
