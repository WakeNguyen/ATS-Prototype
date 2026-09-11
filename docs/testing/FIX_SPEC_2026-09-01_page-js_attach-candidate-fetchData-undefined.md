# Fix Spec — Bug: `fetchData is not defined` khi Attach Candidate to Job — 2026-09-01

**Từ:** Claude (Architect/QA)
**Cho:** AG (Implementer)
**Mức độ ưu tiên:** Cao — chặn 1 luồng nghiệp vụ chính (gán ứng viên có sẵn vào Job Order), gây hiểu nhầm nghiêm trọng (tưởng gán thất bại trong khi thực ra đã thành công).
**Phạm vi:** CHỈ `src/app/page.js`. Không đụng `AttachCandidateModal.js` hay `actions.js`.

## Bug report từ user (đã tự điều tra & xác nhận root cause)

User thử gán ứng viên "Trịnh Xuân Châu" (#11687) vào job "Head of Human Resources" tại "Abivin AI Route Logistics":
- **Lần 1 (Submit):** hiện lỗi đỏ trong modal + overlay dev-error của Next.js: `fetchData is not defined`, tại `handleCandidateAttached` (`src/app/page.js:338`), gọi từ `handleSubmit` (`AttachCandidateModal.js:210`). Modal KHÔNG đóng, trông như thao tác thất bại.
- **Lần 2 (Submit lại):** báo lỗi "Ứng viên đã được gán vào vị trí này và hiện đang ở trong pipeline" — tức bản ghi Application ĐÃ được tạo thành công ở **lần 1**, chỉ là UI bị crash SAU KHI server đã ghi thành công.

## Root cause (đã xác nhận qua code + `git blame`)

`src/app/page.js` dòng 336-339:
```js
function handleCandidateAttached(newApp) {
  notify("Đã gán ứng viên vào Job Order thành công!");
  fetchData();
}
```
`fetchData` **không tồn tại ở bất kỳ đâu trong file này** (grep xác nhận 0 định nghĩa). Đây là bug tồn tại từ commit baseline gốc (`5e279e7`), không liên quan gì tới các thay đổi Phase 5/6 hôm nay — chỉ là lần đầu luồng Attach Candidate được thao tác thật hôm nay nên mới lộ ra.

Vì `handleCandidateAttached` được gọi bên trong khối `try` của `handleSubmit` trong `AttachCandidateModal.js` (dòng ~207-210: `if (onAttached) onAttached(res.data); onClose();`), việc `fetchData()` throw ReferenceError khiến dòng `onClose()` NGAY SAU đó không bao giờ chạy được → modal không đóng, lỗi hiện ra như thể toàn bộ thao tác thất bại, dù `assignCandidateToJob` (server action) đã chạy xong và tạo Application thành công trước đó rồi.

**Thêm 1 vấn đề liên quan:** hiện tại KHÔNG có hàm dùng lại được (reusable) nào để refetch danh sách applications trong `page.js` — logic fetch (`getActionMenuData(...)`) hiện nằm gói gọn bên trong 1 `useEffect` debounce (dòng ~369-396), chỉ tự chạy khi các state filter (`searchTerm`, `statusFilter`, `passiveFilter`, `clientFilter`, `jobFilter`, `page`) thay đổi — không có cách nào gọi lại thủ công từ nơi khác như `handleCandidateAttached`.

## Việc cần làm

### 1. Tách logic fetch trong `useEffect` (dòng ~369-396) thành 1 hàm riêng có thể gọi lại

Đổi từ:
```js
useEffect(() => {
  setIsSearching(true);
  const timer = setTimeout(async () => {
    const res = await getActionMenuData({ searchTerm, status: statusFilter, isPassive: passiveFilter, client: clientFilter, jobId: jobFilter, page, pageSize });
    if (res.success) {
      setApplications(res.data || []);
      setTotalApps(res.totalCount || 0);
      if (res.data?.length > 0) { selectRow(res.data[0]); } else { setSelectedAppId(null); setActivityLogs([]); }
    }
    setLoading(false);
    setIsSearching(false);
  }, 250);
  return () => clearTimeout(timer);
}, [searchTerm, statusFilter, passiveFilter, clientFilter, jobFilter, page]);
```

Thành (tách phần thân async ra hàm `fetchApplications`, giữ nguyên behaviour debounce trong `useEffect`):
```js
async function fetchApplications() {
  const res = await getActionMenuData({ searchTerm, status: statusFilter, isPassive: passiveFilter, client: clientFilter, jobId: jobFilter, page, pageSize });
  if (res.success) {
    setApplications(res.data || []);
    setTotalApps(res.totalCount || 0);
    if (res.data?.length > 0) { selectRow(res.data[0]); } else { setSelectedAppId(null); setActivityLogs([]); }
  }
  setLoading(false);
  setIsSearching(false);
}

useEffect(() => {
  setIsSearching(true);
  const timer = setTimeout(fetchApplications, 250);
  return () => clearTimeout(timer);
}, [searchTerm, statusFilter, passiveFilter, clientFilter, jobFilter, page]);
```

*(Lưu ý: `fetchApplications` đọc state qua closure như cũ, không cần truyền tham số — giữ nguyên hành vi hiện tại 100%, chỉ tách hàm ra để dùng lại được.)*

### 2. Sửa `handleCandidateAttached` — gọi đúng hàm vừa tách ra

```js
function handleCandidateAttached(newApp) {
  notify("Đã gán ứng viên vào Job Order thành công!");
  fetchApplications();
}
```

### 3. Kiểm tra thứ tự khai báo trong file

`fetchApplications` cần được khai báo (hoặc hoisted) trước khi `handleCandidateAttached` dùng tới — vì đây đều là function declarations bên trong cùng 1 component function nên hoisting trong JS đã xử lý được thứ tự, nhưng AG vẫn nên đặt `fetchApplications` gần khu vực logic fetch/useEffect hiện có (dòng ~369) để dễ đọc, không cần di chuyển `handleCandidateAttached`.

## Test trước khi báo hoàn thành

1. Mở Action Menu (`/`), bấm "Attach Candidate", chọn 1 ứng viên CHƯA có trong pipeline của 1 job bất kỳ, điền đủ form, Submit — xác nhận:
   - Modal đóng ngay, KHÔNG còn lỗi `fetchData is not defined` (kiểm tra cả console lẫn Next.js dev overlay).
   - Toast "Đã gán ứng viên vào Job Order thành công!" hiện đúng.
   - Danh sách Applications trong Action Menu tự động cập nhật, có dòng mới vừa gán, không cần F5 lại trang.
2. Thử gán lại CHÍNH ứng viên + job vừa làm ở bước 1 lần nữa — xác nhận vẫn báo đúng lỗi "Ứng viên đã được gán vào vị trí này..." như thiết kế dedup hiện có (không đổi hành vi này).
3. Xác nhận các filter/search/pagination hiện có trên Action Menu (search, status filter, đổi trang) vẫn hoạt động bình thường sau khi tách hàm (không có regression từ việc refactor `useEffect`).
4. Đối chiếu trực tiếp Supabase: xác nhận bản ghi `activity` (Application) được tạo đúng 1 lần duy nhất ở bước 1 (không bị tạo trùng do gọi 2 lần).
5. Cập nhật `DEVELOPMENT_LOG.md`.
