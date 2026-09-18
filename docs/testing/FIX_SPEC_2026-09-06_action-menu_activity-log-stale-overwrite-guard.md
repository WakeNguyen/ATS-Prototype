# FIX_SPEC_2026-09-06 — Action Menu: Action Note add/edit/delete co the ghi de nham Timeline dang xem (bien the that cua UI-01)

**Boi canh**: `docs/testing/master_test_matrix.md` kich ban **UI-01** mo ta rui ro "click nhanh giua 2 row -> Timeline hien sai ung vien". Da doc lai truc tiep `src/app/page.js` (dong 409-423): ham `selectRow()` **DA CO SAN** `selectRowSequenceRef` (sequence guard) tu baseline — kich ban goc cua UI-01 (click A roi click B lien tiep) **DA duoc chan dung**, ket luan "van con mo" o lan ra soat truoc la SAI (do grep sai tu khoa, khong doc code truc tiep — xin nhan loi ve viec nay).

Tuy nhien, ra soat mo rong (dung phuong phap: doc toan bo cac noi co goi `setActivityLogs`, khong chi rieng `selectRow`) phat hien **1 bien the THAT cua cung 1 loi**, chua duoc guard, trong `src/app/page.js`.

---

## Root cause

3 ham xu ly Action Note trong `src/app/page.js`:
- `handleAddNewLog(applicationId, logData)` (dong ~511-538)
- `handleEditLog(applicationId, logId, logData)` (dong ~541-559)
- `handleDeleteLog(applicationId, logId)` (dong ~562-575)

Ca 3 deu theo pattern: goi server action (add/update/delete activity log) -> `await getActivityLogs(applicationId)` -> `setActivityLogs(logsRes.data)` **TRUC TIEP, KHONG qua `selectRowSequenceRef`**.

`activityLogs` la state DUY NHAT, dung chung cho ca panel Timeline (khong phan biet theo `applicationId` nhu cach `jobs/page.js` lam voi `appLogsMap` — noi nay AN TOAN vi la object map theo key `appId`, khong bi loi nay).

### Kich ban loi that
1. User dang xem App A (`selectedAppId = A`), bam "Save" 1 Action Note moi cho A -> `handleAddNewLog(A, ...)` bat dau chay (goi `addActivityLog` roi `getActivityLogs(A)`).
2. **Truoc khi** request tren tra ve, user click sang row B -> `selectRow(B)` chay: set `selectedAppId = B`, tang `selectRowSequenceRef`, tu goi `getActivityLogs(B)` va set dung `activityLogs` cho B (co guard, dung).
3. Neu response `getActivityLogs(A)` (buoc 1) ve **SAU** response cua B (do dang them 1 buoc `addActivityLog` truoc do nen thuong CHAM HON, de xay ra tren thuc te) -> `setActivityLogs(logsRes.data)` cua A **ghi de len** Timeline dang hien dung cua B -> **User dang xem App B nhung thay Timeline cua App A**.

Day la kich ban de xay ra HON ca UI-01 goc (khong can click nhanh <200ms — chi can 1 thao tac luu note binh thuong roi chuyen row trong luc dang luu, hoan toan la hanh vi su dung tu nhien) va hau qua giong het: hien thi SAI thong tin ung vien.

`syncApplicationFromLogs(applicationId, logs)` (goi ngay sau do trong ca 3 ham) thi **AN TOAN**, khong can sua — vi no cap nhat state `applications` (mang danh sach) loc theo dung `applicationId`, khong anh huong toi row dang duoc chon hien tai.

---

## Fix — tai su dung dung pattern `selectRowSequenceRef` da co san (khong tao co che moi)

Trong `src/app/page.js`:

**1. Cung co diem "moc" sequence khi selection bi clear ve `null`** (dong ~392, trong `fetchApplications`, nhanh `res.data.length === 0`) — hien tai KHONG tang sequence, can tang de dam bao guard cung dung ca truong hop nay:
```js
} else {
  selectRowSequenceRef.current++; // THEM: dam bao moi request dang cho bi coi la stale
  setSelectedAppId(null);
  setActivityLogs([]);
}
```

**2. Them guard vao ca 3 ham, ngay TRUOC khi `setActivityLogs`:**

`handleAddNewLog`:
```js
async function handleAddNewLog(applicationId, logData) {
  if (!applicationId) return { success: false, error: "Missing application" };
  const stage = logData?.action_type || "Contact";
  const note = (logData?.note || "").trim();
  if (!note) return { success: false, error: "Empty note" };

  const seqAtStart = selectRowSequenceRef.current; // THEM: chup sequence tai thoi diem bat dau

  setSavingNewLog(true);
  try {
    const res = await addActivityLog({
      application_id: applicationId,
      action_type: stage,
      note,
      result: logData?.result,
      reason_failed: logData?.reason_failed,
    });
    if (res.success) {
      notify("Da luu buoc Action Note moi!");
      const logsRes = await getActivityLogs(applicationId);
      if (logsRes.success) {
        // THEM: chi cap nhat Timeline dang hien thi neu user CHUA chuyen sang row khac
        if (seqAtStart === selectRowSequenceRef.current) {
          setActivityLogs(logsRes.data);
        }
        syncApplicationFromLogs(applicationId, logsRes.data); // van chay binh thuong, an toan
      }
    } else {
      notify("Loi: " + res.error);
    }
    return res;
  } finally {
    setSavingNewLog(false);
  }
}
```

Ap dung **dung mau tuong tu** (chup `seqAtStart` dau ham, kiem tra truoc `setActivityLogs`, giu nguyen `syncApplicationFromLogs` khong doi) cho `handleEditLog` va `handleDeleteLog`.

Luu y: **KHONG dong** `selectRowSequenceRef.current` trong 3 ham nay (chi DOC, khong tang) — chi `selectRow` va diem clear-selection (muc 1) moi duoc tang, giu dung nguyen tac "1 nguon tang duy nhat" de tranh roi logic.

---

## Yeu cau verify

1. Mo App A, bam "Save" 1 Action Note (co the them 1 chut delay gia lap qua DevTools Network throttling de de tai hien), **ngay lap tuc** click sang App B truoc khi thay toast "Da luu...".
2. Sau khi thao tac add note cho A hoan tat (co the thay o Network tab), xac nhan Timeline dang hien thi **VAN LA cua App B**, khong bi nhay ve hien thi log cua App A.
3. Lap lai tuong tu voi Edit va Delete 1 Action Note.
4. Test lai kich ban UI-01 GOC (click row A roi B lien tiep <200ms nhieu lan) — xac nhan van hoat dong dung nhu truoc (khong regression).
5. Test truong hop filter/search lam danh sach applications ve rong (vi du go search term khong khop ai) ngay trong luc dang luu 1 note — xac nhan khong bi loi javascript (selectedAppId = null, activityLogs = []).
