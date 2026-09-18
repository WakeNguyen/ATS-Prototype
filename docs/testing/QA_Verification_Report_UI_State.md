# QA VERIFICATION REPORT: UI STATE MANAGEMENT & BOUNDARY AUDIT
**ATS 3.0 Platform Quality Assurance (Supabase Sandbox Schema - 11,882 Records)**
**Date**: August 31, 2026 | **Environment**: `http://localhost:3000` | **Version**: `v3.0-RC76`

---

## 1. Executive Summary

A comprehensive automated browser testing and static code audit was conducted on ATS 3.0 covering 16 mission-critical frontend state management, race condition, data validation, boundary, and sanitization scenarios (`[UI-01]` to `[UI-16]`).

- **Total Scenarios Tested**: 16
- **Passed**: 12 (75%)
- **Failed**: 4 (25%)
  - **[UI-01]** Rapid Clicking Race Condition on Action Menu Row Selection
  - **[UI-02]** Optimistic UI Rollback Failure on Network/Server Error
  - **[UI-13]** Client Name Empty String Persistence on Blur
  - **[UI-16]** Incomplete Zod `validatePayload` Coverage Across Server Actions

---

## 2. Test Execution Matrix (UI-01 to UI-16)

| Test ID | Tên Kịch Bản | Trạng Thái | Bằng Chứng Thực Tế (DOM / Behavior) | Ghi Chú & Dòng Code Lỗi (nếu có) |
| :--- | :--- | :---: | :--- | :--- |
| **UI-01** | Rapid Clicking Race Condition | ❌ **FAIL** | Nhấp liên tiếp 3 hàng trong 200ms: request bất đồng bộ `getActivityLogs` không có sequence id/AbortController dẫn đến log của hàng trước đè lên ứng viên mới. | **Lỗi Code**: [`src/app/page.js:411-425`](file:///g:/My%20Drive/AI%20project/ATS/ats-web/src/app/page.js#L411-L425)<br>`selectRow` thiếu `AbortController` hoặc `latestSelectedAppIdRef` sequence guard để hủy stale promises. |
| **UI-02** | Optimistic UI Rollback | ❌ **FAIL** | Cập nhật inline Stage/Priority khi server lỗi: UI cập nhật lạc quan sang giá trị mới, khi API trả về `{ success: false }` UI chỉ toast thông báo lỗi mà **không rollback** state về giá trị cũ. | **Lỗi Code**: [`src/app/page.js:439-459`](file:///g:/My%20Drive/AI%20project/ATS/ats-web/src/app/page.js#L439-L459)<br>`handleInlineUpdate` thiếu logic khôi phục `setApplications(prev => ...)` từ `previousApplications` snapshot khi API fail. |
| **UI-03** | Accordion State Leak | ⚠️ **PASS*** | Mở Accordion ở Ứng viên A, bấm chuyển sang Ứng viên B: Accordion trên Ứng viên B đóng hoàn toàn vì key accordion theo `application_id`. *(Lưu ý: State object giữ key rác do chưa reset)*. | **Trực quan PASS**. Đề xuất tối ưu: gọi `setExpandedTimelines({})` trong `loadCandidateData` ([`src/app/candidates/page.js:502`](file:///g:/My%20Drive/AI%20project/ATS/ats-web/src/app/candidates/page.js#L502)) để giải phóng RAM. |
| **UI-04** | Job Switch Reset | ✅ **PASS** | Tại `/jobs`, Client A chọn Job `#41` (5 apps), chuyển sang Client B: `selectedJobId` tự động reset sang Job `#140` của Client B, pipeline hiển thị chuẩn xác 2 ứng viên. | [`src/app/jobs/page.js:481-509`](file:///g:/My%20Drive/AI%20project/ATS/ats-web/src/app/jobs/page.js#L481-L509)<br>`navigateClient` cập nhật đồng bộ `selectedJobId`, `selectedJob`, `applications` và xóa `expandedAppIds`. |
| **UI-05** | Cross-View Freshness | ✅ **PASS** | Cập nhật note `FreshnessTest_1788146143445` tại `/candidates`, quay lại `/` tìm "Rollback Test User": hiển thị ngay lập tức, không bị cache cũ. | [`src/app/actions.js:557-560`](file:///g:/My%20Drive/AI%20project/ATS/ats-web/src/app/actions.js#L557-L560)<br>`revalidatePath('/')` và `revalidatePath('/candidates')` hoạt động chuẩn xác trên Next.js App Router. |
| **UI-06** | XSS Sanitization | ✅ **PASS** | Nhập `<script>alert('XSS')</script><img onerror="alert(1)" src=x>`: Render dưới dạng plain text an toàn, không có alert pop-up hoặc mã độc nào được thực thi. | [`src/app/page.js:206-215`](file:///g:/My%20Drive/AI%20project/ATS/ats-web/src/app/page.js#L206-L215)<br>`stripHtml()` loại bỏ thẻ nguy hiểm, React JSX tự động escape text node. |
| **UI-07** | Special Characters & Emoji | ✅ **PASS** | Nhập `"quotes" 'singles' \`code\` 🎯🔥👍 \${template_var}`: Toàn bộ dấu ngoặc kép, nháy đơn, backtick, emoji và template literals hiển thị 100% nguyên vẹn. | [`src/app/actions.js:208-226`](file:///g:/My%20Drive/AI%20project/ATS/ats-web/src/app/actions.js#L208-L226)<br>Database text column và Postgres parameterized queries bảo toàn toàn bộ ký tự đặc biệt. |
| **UI-08** | Newline & Legacy HTML | ✅ **PASS** | Nhập text có ký tự xuống dòng `\n` và thẻ `<br>`: Render nhiều dòng chuẩn xác với CSS `whitespace-pre-wrap` và `stripHtml`. | [`src/app/page.js:206`](file:///g:/My%20Drive/AI%20project/ATS/ats-web/src/app/page.js#L206) & [`src/app/candidates/page.js:1304`](file:///g:/My%20Drive/AI%20project/ATS/ats-web/src/app/candidates/page.js#L1304)<br>Xử lý `\n` mượt mà, không bị dính chữ. |
| **UI-09** | Embedded CV Viewer | ✅ **PASS** | Gán link `https://example.com/sample_cv.pdf`: iframe hiển thị an toàn với sandbox, kèm nút "Open in New Tab" chuẩn xác, không crash React tree. | [`src/app/candidates/page.js:690, 1374-1410`](file:///g:/My%20Drive/AI%20project/ATS/ats-web/src/app/candidates/page.js#L690)<br>`getEmbeddableCvUrl` trả về direct URL và fallback iframe an toàn. |
| **UI-10** | Empty Search State | ✅ **PASS** | Tìm kiếm `ZZZNONEXISTENT999`: Bảng hiển thị thông báo "No records found matching filters", sub-table ẩn an toàn, không có lỗi `Cannot read properties of undefined`. | [`src/app/page.js:1000-1015`](file:///g:/My%20Drive/AI%20project/ATS/ats-web/src/app/page.js#L1000-L1015)<br>Null-safe check `selectedApp` và empty state rendering chuẩn. |
| **UI-11** | Pagination Boundary | ✅ **PASS** | Điều hướng đến trang cuối (Page 16 of 16): Nút "Next Page" (`▶`) và "Last Page" (`▶|`) tự động chuyển sang trạng thái `disabled={true}` với `opacity-20`. | [`src/app/page.js:1326-1365`](file:///g:/My%20Drive/AI%20project/ATS/ats-web/src/app/page.js#L1326-L1365)<br>Boundary guard `disabled={page >= totalPages}` hoạt động chuẩn xác. |
| **UI-12** | Infinite Scroll Dropdown | ✅ **PASS** | Cuộn danh sách đến cuối tổng số candidates: `loadNextBatch` kiểm tra `results.length >= totalCount` và dừng gửi request, nút load biến mất. | [`src/components/SearchableCandidateDropdown.js:99-120, 374-384`](file:///g:/My%20Drive/AI%20project/ATS/ats-web/src/components/SearchableCandidateDropdown.js#L99-L120)<br>Guard `if (results.length >= totalCount) return;` ngăn chặn hoàn toàn request dư thừa. |
| **UI-13** | Client Name Blur Validation | ❌ **FAIL** | Tại `/jobs`, xóa trắng tên Client và blur chuột ra ngoài: Hệ thống gửi chuỗi rỗng lên server và cập nhật `name = ""` vào database PostgreSQL. | **Lỗi Code**: [`src/app/jobs/page.js:512-518`](file:///g:/My%20Drive/AI%20project/ATS/ats-web/src/app/jobs/page.js#L512-L518) & [`src/app/actions.js:1730-1749`](file:///g:/My%20Drive/AI%20project/ATS/ats-web/src/app/actions.js#L1730-L1749)<br>`handleClientFieldChange` và `updateClientField` thiếu validation `if (field === 'name' && !value.trim()) return`. |
| **UI-14** | Empty Job Title | ✅ **PASS** | Để trống ô New Job Title tại `/jobs`: Nút "Add Job" bị disable (`disabled={!newJobTitle.trim()}`) và hàm `handleAddJob` chặn submit chuỗi rỗng. | [`src/app/jobs/page.js:920-940, 2488-2495`](file:///g:/My%20Drive/AI%20project/ATS/ats-web/src/app/jobs/page.js#L920-L940)<br>Chặn submit ở cả cấp độ nút bấm và hàm handler. |
| **UI-15** | Phone Format Validation | ✅ **PASS** | Thêm contact point Type="Phone" với giá trị `abc-invalid-phone`: Toast hiển thị lỗi `"Failed to add contact point: Contact value is invalid"`. | [`src/app/actions.js:571, 762-790`](file:///g:/My%20Drive/AI%20project/ATS/ats-web/src/app/actions.js#L571)<br>`normalizeContactValue` bóc tách số, nếu rỗng trả về invalid và chặn insert. |
| **UI-16** | Zod Validation Audit | ❌ **FAIL** | Kiểm tra toàn bộ 15 Server Actions nhận payload trong `src/app/actions.js`: Chỉ duy nhất 1 action (`createCandidateWithStrictValidation`) dùng `validatePayload`. 14 actions còn lại không dùng Zod schema. | **Lỗi Code**: [`src/app/actions.js`](file:///g:/My%20Drive/AI%20project/ATS/ats-web/src/app/actions.js)<br>Các actions như `updateApplicationAction`, `addActivityLog`, `updateActivityLog`, `updateCandidateProfile`, `addContactPoint`, `addClientBranch`, `updateJobField` chưa được bọc qua `validatePayload`. |

---

## 3. Detailed Root-Cause Analysis for 4 Failed Scenarios

### 3.1. [UI-01] Rapid Clicking Race Condition
- **Root Cause**: In `src/app/page.js`, `selectRow(app)` triggers `getActivityLogs(app.application_id)` directly without keeping a reference to the latest requested `application_id`. When clicking rapidly across Candidate 1 -> Candidate 2 -> Candidate 3, if Candidate 1's network request resolves last, `setActivityLogs(res.data)` will overwrite Candidate 3's timeline with Candidate 1's logs.
- **Recommended Fix**:
  ```javascript
  const latestSelectedAppIdRef = useRef(null);
  
  const selectRow = (app) => {
    setSelectedAppId(app.application_id);
    setSelectedApp(app);
    latestSelectedAppIdRef.current = app.application_id;
    setLogsLoading(true);
    
    getActivityLogs(app.application_id).then(res => {
      // Drop response if user has already selected a different candidate
      if (latestSelectedAppIdRef.current !== app.application_id) return;
      if (res.success) setActivityLogs(res.data);
      setLogsLoading(false);
    });
  };
  ```

### 3.2. [UI-02] Optimistic UI Rollback
- **Root Cause**: In `src/app/page.js:439-459`, `handleInlineUpdate` applies state changes optimistically using `setApplications(prev => ...)`. If the Server Action fails (`res.success === false`), it displays an error notification but never rolls back the local `applications` array to its previous snapshot.
- **Recommended Fix**:
  ```javascript
  const handleInlineUpdate = async (applicationId, field, value) => {
    let previousApplications = [];
    setApplications(prev => {
      previousApplications = prev;
      return prev.map(a => a.application_id === applicationId ? { ...a, [field]: value } : a);
    });
    
    const res = await updateApplicationAction(applicationId, { [field]: value });
    if (!res.success) {
      setApplications(previousApplications); // Rollback to snapshot
      notify("Failed to update: " + res.error);
    }
  };
  ```

### 3.3. [UI-13] Client Name Empty String Persistence on Blur
- **Root Cause**: `handleClientFieldChange` in `src/app/jobs/page.js:512` updates local state and directly invokes `updateClientField(clientForm.id, "name", "")`. In `src/app/actions.js:1730`, `updateClientField` only checks if the field name is in the whitelist, permitting `name = ""` to be written to PostgreSQL.
- **Recommended Fix**:
  - Frontend: If `field === 'name'` and `!value.trim()`, revert `clientForm.name` to the previous name and alert the user.
  - Backend: In `updateClientField`, validate `if (field === 'name' && (!value || !value.trim())) return { success: false, error: "Client name cannot be empty" };`.

### 3.4. [UI-16] Zod Validation Audit
- **Root Cause**: `src/lib/validation.js` contains schemas (`candidateCreationSchema`, `contactPointItemSchema`, `clientBranchSchema`, `jobOrderUpdateSchema`, `activityLogCreationSchema`), but only `createCandidateWithStrictValidation` utilizes `validatePayload`. 14 mutation endpoints in `src/app/actions.js` still rely on ad-hoc or missing validations.
- **Recommended Fix**: Wrap all mutation endpoints with their corresponding Zod schemas using `validatePayload(...)` prior to executing any SQL query.

---

## 4. Architectural Compliance & Sign-off

- **Data Integrity**: Checked against Supabase Sandbox schema (11,882 dummy records).
- **Security & XSS**: 100% compliant (`stripHtml` + React 19 JSX escaping).
- **Infinite Scroll**: Compliant with Rule C.3 (No client-side memory dump, 50-item batches).
