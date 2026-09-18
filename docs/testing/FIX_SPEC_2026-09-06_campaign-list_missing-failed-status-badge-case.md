# FIX_SPEC_2026-09-06 — Campaign List hien "Draft" thay vi "Failed" (thieu 1 case trong switch)

**Boi canh**: User bao "Test Warming Campaign" hien STATUS = "Draft" tren bang Campaigns list, nhung Supabase xac nhan `campaigns.status` THAT SU la `'Failed'`. Day KHONG PHAI loi cache/chua rebuild — la 1 bug code that, moi lo ra vi day la LAN DAU TIEN Warming co campaign-level status = 'Failed' (truoc gio Warming chua tung dong bo status nen bug nay chua ai thay).

### Root cause (xac nhan qua doc code that)
Ham `renderCampaignStatusBadge(status)` (`src/app/campaigns/page.js`, dong ~772), dung o dong ~1208 de ve badge STATUS tren bang Campaigns list, co switch-case cho: `"Running"`, `"Ready"`, `"Completed"`, `"Paused"`, roi `case "Draft": default:`. **THIEU HAN case `"Failed"`** — nen bat ky campaign nao co `status = 'Failed'` (ca Job Posting lan Warming, vi day la ham dung chung cho ca 2 loai) deu roi vao nhanh `default` va hien nham thanh badge "Draft".

Luu y: day la ham RIENG cua bang Campaigns list, KHAC voi `getStatusBadge` trong `RunHistoryTable.js` (component do DA CO san case "Failed" dung, nen cot Run History van hien dung "Failed" mau do — chi rieng bang Campaigns list phia tren la thieu).

### Fix — them 1 case, copy dung style tu `RunHistoryTable.js` (dong ~90-95) cho dong nhat mau sac
Them vao switch cua `renderCampaignStatusBadge` (truoc `case "Draft":`):
```jsx
case "Failed":
  return (
    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-medium bg-rose-500/10 text-rose-400 border border-rose-500/20">
      <AlertCircle size={11} />
      Failed
    </span>
  );
```
(Kiem tra `AlertCircle` da import san tu `lucide-react` o dau file chua — RunHistoryTable.js da dung icon nay nen chac chan co san trong project, chi can import them vao page.js neu chua co).

### Yeu cau verify (BAT BUOC)
1. Hard refresh trang Campaigns — xac nhan "Test Warming Campaign" (dang co status that Failed trong DB) hien badge do "Failed", khong con "Draft".
2. Kiem tra 1 campaign Job Posting bat ky dang o trang thai that Failed (neu co) — xac nhan cung hien dung, vi bug nay anh huong CA 2 loai campaign.
3. Xac nhan cac trang thai khac (Running/Ready/Completed/Paused/Draft that su khi campaign chua co run nao) van hien dung nhu cu, khong bi anh huong.

---

## Ghi chu them — nut sort Planning Date da co trong code, chi la de nhan ra
Da doc lai code, xac nhan `handlePlanningDateSortToggle` + icon (`ArrowUpDown` mau xam, opacity 40%, sang len khi hover) DA duoc AG viet dung tai dong ~778-808 `src/app/page.js`, khop voi FIX_SPEC truoc. De icon de nhan ra hon (khong bi tuong nham la chua lam), doi `opacity-40` cua icon mac dinh (khi chua sort) thanh `opacity-70` (van giu the hover len 100% de phan biet trang thai active/hover), giup User nhin thay ngay ma khong can hover thu.
