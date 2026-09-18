# ATS 3.0 Backend API & Server Actions Contracts

> **Standard:** Unified JSON Response Protocol  
> **Architecture:** Next.js 15 Server Actions with `try...catch` & Database Transaction Safety  
> **Last Updated:** 30/08/2026  

---

## 1. Chuẩn Định Dạng Phản Hồi (Unified Response Format)

Mọi Server Actions và API Endpoints đều bắt buộc tuân thủ định dạng phản hồi chuẩn:

### 1.1 Khi Thực Thi Thành Công (`Success Response`)
```typescript
interface SuccessResponse<T> {
  success: true;
  data?: T;
  [key: string]: any; // e.g. candidate, activity, count
}
```
* **Ví dụ:**
```json
{
  "success": true,
  "candidate": {
    "id": "c1f72a4e-8f23-4b61-9c8a-1a2b3c4d5e6f",
    "display_number": 3378,
    "full_name": "Nguyen Van An"
  }
}
```

### 1.2 Khi Xảy Ra Lỗi (`Error Response`)
```typescript
interface ErrorResponse {
  success: false;
  error: string;
  code?: string;
  details?: any;
}
```
* **Ví dụ:**
```json
{
  "success": false,
  "error": "Duplicate contact point detected: This LinkedIn profile already belongs to Candidate #35 - Le Minh Dat."
}
```

---

## 2. Danh Sách Server Actions Cốt Lõi (`src/app/actions.js`)

### 2.1 Candidate Management Actions
* **`checkCandidateContactDuplicate(contactPoints, currentCandidateId?)`**
  * **Mục đích:** Quét đối soát tức thì xem SĐT, Email, LinkedIn có trùng với bất kỳ ứng viên nào trong DB.
  * **Trả về:** `{ success: true, hasDuplicate: boolean, duplicates: Array<{ matchedCandidate, matchedContact }> }`.
* **`createCandidateWithStrictValidation(payload)`**
  * **Mục đích:** Kiểm tra tối thiểu 1 contact point, xác thực 0 duplicate, chạy transaction tạo ứng viên, contact points và gán vào Job Pipeline nếu có.
  * **Transaction:** `sql.begin` đảm bảo nguyên tử 100%.

### 2.2 Client & Branch Actions
* **`addClientBranch(clientId, branchData)`**: Thêm chi nhánh mới vào mảng JSONB `clients.branches`.
* **`updateClientBranch(clientId, branchId, branchData)`**: Cập nhật thông tin chi nhánh.
* **`deleteClientBranch(clientId, branchId)`**: Xóa chi nhánh và xử lý fallback HQ.
* **`setHeadquarterBranch(clientId, branchId)`**: Thiết lập chi nhánh làm Trụ sở chính và đồng bộ địa chỉ chính.

### 2.3 Job & Activity Actions
* **`getJobs()`**: Lấy danh sách vị trí tuyển dụng kèm thông tin công ty.
* **`updateJob(jobId, updates)`**: Cập nhật thông tin Job (Title, Location, Working Mode, Status, JD Link).
* **`createActivityLog(activityId, stage, note, actionDate)`**: Thêm nhật ký và đồng bộ `activity.current_stage`.
