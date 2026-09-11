# FIX_SPEC_2026-09-06 — Warming campaign bao "Failed" oan trong khi thuc te ca 2 tai khoan da chay THANH CONG (loi trich xuat JSON trong bridge-server.js)

**Boi canh**: User chay thu Campaign "Test Warming Campaign" (run luc 18:41 06/09/2026, `warm_join_runs.id = 01a07686-767a-77a2-bf3b-7cc7ea0c8b6b`, n8n execution #606). Ca 2 tai khoan FB deu hien "Failed" tren UI, summary "Nuoi nick hoan tat: 0/2 acc thanh cong, 2 loi". Da dieu tra truc tiep qua n8n MCP (`get_workflow_execution` execution #606, `get_workflow_details` workflow C `L8QdckqW7FDwanRq`) va Supabase — xac nhan day la **BAO LOI SAI (false failure)**: script Playwright thuc te da chay xong thanh cong hoan toan (exit code 0, ca 2 account tra ve `"success":true`, tat ca group deu `"status":"Joined"`) nhung bi bao cao sai thanh "Failed" do 1 loi that trong `scripts/bridge-server.js`.

---

## Root cause (da xac nhan bang bang chung truc tiep, khong doan)

### Bang chung
Node "Call VPS Bridge: facebook-warm-join" trong execution #606 tra ve:
```json
{"success":true,"exitCode":0,"elapsedSeconds":1623.2,"output":"...(fragment JSON hop le, bi cat dau)...","error":"...(text progress log, bi cat dau)..."}
```
Day CHINH LA hinh dang fallback trong `bridge-server.js` (dong ~195-202: `{success: code===0, exitCode, elapsedSeconds, output: stdoutData.slice(-3000), error: stderrData.slice(-2000)}`) — nghia la `JSON.parse(stdoutData)` cua chinh bridge-server **DA THAT BAI**, dan toi rot vao nhanh fallback nay, MAC DU exit code = 0 va script thuc te co in ra JSON hop le.

### Vi sao JSON.parse that bai — loi logic trong `scripts/bridge-server.js` (dong ~168-179)
```js
const trimmedStdout = stdoutData.trim();
const jsonStart = trimmedStdout.lastIndexOf('[');
const jsonObjStart = trimmedStdout.lastIndexOf('{');
const startIdx = (jsonStart >= 0 && (jsonObjStart === -1 || jsonStart > jsonObjStart)) ? jsonStart : jsonObjStart;
if (startIdx >= 0) {
  parsedOutput = JSON.parse(trimmedStdout.substring(startIdx));
}
```
`scripts/warm-and-join.js` (dong 570) chi in ra stdout **DUY NHAT 1 dong**: `console.log(JSON.stringify(batchResults))` — moi log khac (tien trinh, pacing, phase...) deu dung `console.error` (stderr), KHONG lam ban stdout. Nghia la ve nguyen tac, `stdoutData.trim()` DA LA JSON hop le hoan chinh, KHONG can bat ky logic "tim vi tri bat dau JSON" nao ca.

Nhung doan code tren dung `lastIndexOf` (tim ky tu `[`/`{` **CUOI CUNG** trong toan bo chuoi) thay vi `indexOf` (dau tien) — vi ket qua `batchResults` la 1 MANG chua cac object account, moi object account lai co field `groupsJoined: [...]` la 1 MANG LONG NHAU chua cac object group ben trong. Voi cau truc long nhau nay, ky tu `{`/`[` CUOI CUNG trong toan bo chuoi JSN **HAU NHU LUON LA 1 dau ngoac long ben trong** (vi du: dau `{` mo object cua GROUP cuoi cung trong `groupsJoined` cua ACCOUNT cuoi cung) — KHONG PHAI dau ngoac ngoai cung that su cua ket qua. Khi `JSON.parse` chay tren substring bat dau tu vi tri sai nay, no parse duoc **1 object nho ben trong** (vi du `{"groupId":"...","details":"Already Joined"}`) roi gap ky tu du thua ngay sau do (`]}]` — dong cac ngoac ngoai con lai) → `JSON.parse` nem loi "Unexpected non-whitespace character after JSON" → roi vao catch → `parsedOutput = null` → bridge-server rot vao nhanh fallback (tra ve `output`/`error` la CHUOI THO bi cat 3000/2000 ky tu cuoi, khong con la JSON hop le nua).

**Vi sao co luc "may man" chay dung (vi du run truoc do luc 00:14, execution #521, "Completed" dung)**: hanh vi nay phu thuoc vao CAU TRUC CU THE cua ket qua — neu tai khoan cuoi cung trong mang `batchResults` co `groupsJoined` la mang RONG (`[]`, khong co group nao can join them), thi khong co ngoac long nao sau do, `lastIndexOf` co the vo tinh tro dung vi tri → parse dung. Day la ly do bug nay xuat hien KHONG ON DINH (luc dung luc sai), khien no de bi bo qua truoc gio.

### Hau qua day chuyen
`bridgeOutput` (dang fallback, KHONG phai mang ket qua that) duoc chuyen tiep sang node "Process Bridge Warm Results". Code cua node nay (`rawResults.length === 0 && (!bridgeOutput.success || ... || bridgeOutput.error || ...)`) thay `bridgeOutput.error` (chinh la noi dung STDERR — von LUON khac rong vi day la noi ghi toan bo log tien trinh binh thuong, KHONG phai bao hieu loi that) → `isBridgeError = true` → **MOI tai khoan trong batch deu bi gan cung 1 thong bao "Failed" giong het nhau**, lay tu `bridgeOutput.error.substring(0,500)` — chinh la doan text bi cat "oin Group ... Already Joined [" ma User thay tren UI.

---

## Fix — sua `scripts/bridge-server.js` (KHONG dong den `warm-and-join.js`, script nay dang dung)

Thay doan trich xuat JSON (dong ~168-179 trong `child.on('close', ...)`) bang: **thu parse TOAN BO stdout truoc tien** (vi day la truong hop chuan, 99% cac lan chay), CHI khi that bai moi fallback ve heuristic tim ngoac — va sua heuristic do dung `indexOf` (dau tien) thay vi `lastIndexOf` (cuoi cung), vi ve mat logic "tim vi tri JSON bat dau sau phan text thua o DAU" thi phai tim tu DAU chuoi tro di, khong phai tu CUOI:

```js
      // Try parsing stdout JSON output from script
      let parsedOutput = null;
      const trimmedStdout = stdoutData.trim();

      // 1. Thu parse TOAN BO truoc — day la truong hop chuan: script chi in DUY NHAT 1 dong
      //    console.log(JSON.stringify(...)) ra stdout, moi log khac deu qua stderr.
      try {
        parsedOutput = JSON.parse(trimmedStdout);
      } catch (directParseErr) {
        // 2. Fallback: neu stdout co lan them text thua o DAU (truong hop hiem), tim vi tri
        //    ky tu '[' hoac '{' DAU TIEN (indexOf, KHONG PHAI lastIndexOf — lastIndexOf se
        //    thuong xuyen tro nham vao 1 dau ngoac LONG BEN TRONG neu JSON co mang/object
        //    long nhau, gay loi parse sai — day chinh la bug da xay ra thuc te).
        try {
          const jsonStart = trimmedStdout.indexOf('[');
          const jsonObjStart = trimmedStdout.indexOf('{');
          const startIdx = (jsonStart >= 0 && (jsonObjStart === -1 || jsonStart < jsonObjStart)) ? jsonStart : jsonObjStart;
          if (startIdx >= 0) {
            parsedOutput = JSON.parse(trimmedStdout.substring(startIdx));
          }
        } catch (fallbackParseErr) {
          parsedOutput = null;
        }
      }
```

Giu nguyen toan bo phan con lai cua ham (nhanh `if (parsedOutput) {...} else {...}` phia sau) — KHONG doi.

---

## QUAN TRONG — Buoc deploy PHAI lam, de khong sot (`bridge-server.js` la 1 process PM2 chay rieng tren VPS, KHONG tu redeploy nhu Next.js app)

Theo `docs/DEVELOPMENT_LOG.md` (`SNAP-20260902-52`), `bridge-server.js` chay qua PM2 voi ten process **`fb-bridge`**. Sau khi cap nhat code, BAT BUOC phai:
```
pm2 restart fb-bridge
```
tren VPS Host (khong phai trong container n8n). Neu chi sua file ma KHONG restart, process cu van chay code loi — De AG bao cao ro trong QA: da restart chua, va dan `pm2 status`/log xac nhan process da restart voi uptime moi.

---

## Yeu cau verify

1. Sau khi restart `fb-bridge`, chay lai 1 Warming Campaign that (vi du lai "Test Warming Campaign" voi 2 tai khoan cu) — ky vong: neu ca 2 tai khoan thuc su thanh cong, status phai la **"Completed"** (hoac it nhat KHONG phai "Failed"), summary phai phan anh dung so lieu that.
2. Kiem tra bang MCP n8n (`get_workflow_execution` execution moi nhat cua workflow C) — node "Call VPS Bridge: facebook-warm-join" phai tra ve **truc tiep 1 MANG ket qua** (khong con field `output`/`error` dang fallback nua) khi script chay thanh cong.
3. Test truong hop script THAT SU loi/crash (co the mo phong bang cach tam thoi doi 1 tham so sai de kich hoat loi that, hoac doi bien moi truong sai) — xac nhan van BAO DUNG la "Failed" voi thong tin loi huu ich (khong bi vo tinh che giau loi that boi thay doi nay).
4. Khong can backfill lai run cu (`01a07686-767a-77a2-bf3b-7cc7ea0c8b6b`) — du lieu stdout day du cua run do da bi cat mat (chi con 3000 ky tu cuoi qua bridge fallback), khong du de tai dung 100%; huong dan User chi can CHAY LAI campaign sau khi fix la co ket qua dung, khong can sua du lieu lich su.
