# Báo Cáo Điều Tra Sự Cố (Investigation Report): Execution #956 FB Auto-Post

**Ngày thực hiện:** 07/09/2026 16:00 (GMT+7)  
**Tác giả:** Antigravity (Implementer) & Claude (Architect/QA)  
**Phân loại:** Bug Report / Root Cause Analysis (RCA)  
**Trạng thái:** 🔍 Đã xác định Root Cause — Lưu tài liệu chờ triển khai fix phiên tối nay  

---

## 1. Bối Cảnh Sự Cố (Incident Context)

* **Thời gian xảy ra:** 07/09/2026 `15:37:48` – `15:50:51` (GMT+7)
* **Chiến dịch:** `Accenture - 8 Jobs - HCMC/Taiwan - Group min 10k` (ID: `01a07b01-92cb-0da3-b13f-923ece51c482`)
* **Lượt chạy (Run ID):** `01a07b04-2b02-c820-a356-467da27b6322`
* **Workflow n8n:** `A: FB Group Auto-Post (Campaign)` (ID: `9W588GooZeZhiSKm`) — Execution ID: **`#956`**
* **Tài khoản thực thi:** `acc_02` (Nick Chính - Nguyễn Thức)
* **Quy mô batch:** 6 nhóm Facebook
* **Hiện tượng bất thường do User báo cáo:**
  * Giao diện ATS 3.0 và n8n báo cáo chiến dịch thất bại toàn bộ: **`0/6 nhóm thành công, 6 lỗi`**.
  * Tuy nhiên, trên thực tế Facebook của User, bài viết kèm hình ảnh **đã được đăng thật thành công** vào nhóm **"AE THỢ CƠ KHÍ HÀ NỘI"** lúc 15:47.

---

## 2. Bằng Chứng Thực Tế (Direct Evidence)

### 2.1. Bằng chứng trực tiếp từ Facebook của User
* **Thời gian đăng:** 07/09/2026 15:47
* **Nhóm:** `AE THỢ CƠ KHÍ HÀ NỘI` (`https://www.facebook.com/groups/3426341937677200/`)
* **Nội dung:** *"Cơ hội làm việc cho một trong những tập đoàn công nghệ lớn nhất toàn cầu tại Việt Nam và Đài Loan..."*
* **Hình ảnh đính kèm:** Bảng tuyển dụng 8 vị trí (đính kèm từ link Google Drive).

### 2.2. Dữ liệu thô thực tế trả về từ VPS Bridge (`Call VPS Bridge: facebook-post-v2`)
Trích xuất `runData` thô từ node HTTP Request của Execution `#956` xác nhận Playwright trên VPS **thực tế đã đăng thành công 1/6 nhóm**:

```json
[
  {
    "groupName": "❤️Việc Làm [ Điện Công Nghiệp/Tự Động Hoá | Electrical Jobs] Việt Nam",
    "groupUrl": "https://www.facebook.com/groups/892062927643489/",
    "accountId": "acc_02",
    "success": false,
    "error": "Account [acc_02] is NOT a member of this group. Please join group first.",
    "isCheckpoint": false,
    "durationSeconds": 0
  },
  {
    "groupName": "🏡 Tuyển Dụng Kiến Trúc Sư-Thiết Kế Nội Thất-Kỹ Sư-Kết Cấu-Bim Modeler-Mep✅",
    "groupUrl": "https://www.facebook.com/groups/631540095225978/",
    "accountId": "acc_02",
    "success": false,
    "error": "Account [acc_02] is NOT a member of this group. Please join group first.",
    "isCheckpoint": false,
    "durationSeconds": 0
  },
  {
    "groupName": "🏡 TUYỂN DỤNG VIỆC LÀM KIẾN TRÚC SƯ - KỸ SƯ XÂY DỰNG - THIẾT KẾ NỘI THẤT",
    "groupUrl": "https://www.facebook.com/groups/tuyendungvieclamkientrucnoithat02/",
    "accountId": "acc_02",
    "success": false,
    "error": "Account [acc_02] is NOT a member of this group. Please join group first.",
    "isCheckpoint": false,
    "durationSeconds": 0
  },
  {
    "groupName": "AE ĐIỆN-TỰ ĐỘNG HÓA",
    "groupUrl": "https://www.facebook.com/groups/740993239823491/",
    "accountId": "acc_02",
    "success": false,
    "error": "Account [acc_02] is NOT a member of this group. Please join group first.",
    "isCheckpoint": false,
    "durationSeconds": 0
  },
  {
    "groupName": "AE THỢ CƠ KHÍ HÀ NỘI",
    "groupUrl": "https://www.facebook.com/groups/3426341937677200/",
    "accountId": "acc_02",
    "success": true,
    "error": "",
    "isCheckpoint": false,
    "durationSeconds": 67
  },
  {
    "groupName": "AE Tự Động Hóa",
    "groupUrl": "https://www.facebook.com/groups/aetudonghoa/",
    "accountId": "acc_02",
    "success": false,
    "error": "Account [acc_02] is NOT a member of this group. Please join group first.",
    "isCheckpoint": false,
    "durationSeconds": 0
  }
]
```

👉 **Kết luận thực tế:**
* 5 nhóm (1, 2, 3, 4, 6) thất bại thật do `acc_02` chưa tham gia nhóm.
* Nhóm 5 (*AE THỢ CƠ KHÍ HÀ NỘI*) **đã đăng thành công 100%**, thời gian xử lý 67s.

---

## 3. Phân Tích Nguyên Nhân Gốc Rễ (Root Cause Analysis)

Lỗi bắt nguồn từ logic xử lý dữ liệu đầu vào trong node JavaScript **`Process Bridge Results`** của Workflow A trên n8n.

### 3.1. Cơ chế phân mảnh Item của n8n HTTP Request
Khi node `Call VPS Bridge: facebook-post-v2` gọi sang VPS và nhận về một mảng JSON 6 phần tử `[{...}, {...}, ...]`, n8n tự động phân rã thành **6 Item riêng biệt** (`Item 0`, `Item 1`, ..., `Item 5`) để đưa sang node kế tiếp.

### 3.2. Sai sót trong code trích xuất dữ liệu
Trong node Code `Process Bridge Results`, dòng đầu tiên đang viết:
```javascript
const bridgeOutput = $input.first().json; // ❌ CHỈ LẤY ITEM 0
```
* `$input.first().json` chỉ trả về **Item 0** (dữ liệu của nhóm 1 - nhóm bị lỗi).
* Do `bridgeOutput` lúc này là một **Object đơn lẻ** (`{ groupName: "❤️Việc Làm...", success: false, ... }`) chứ **không phải Array**, tất cả các điều kiện kiểm tra mảng sau đó đều không khớp:
  * `Array.isArray(bridgeOutput)` ➔ `false`
  * `bridgeOutput.data` ➔ `undefined`
  * `typeof bridgeOutput.output` ➔ `undefined`
* Biến `rawResults` bị bỏ trống thành mảng rỗng: `rawResults = []`.

### 3.3. Nhánh Fallback `isBridgeLevelFailure` bị kích hoạt nhầm
Khi `rawResults.length === 0` và `bridgeOutput.error` có chuỗi lỗi của nhóm 1, điều kiện sau trở thành `true`:
```javascript
const isBridgeLevelFailure = rawResults.length === 0 && (
  !bridgeOutput.success || 
  (bridgeOutput.exitCode !== undefined && bridgeOutput.exitCode !== 0) || 
  bridgeOutput.error || 
  bridgeOutput.message
);
```

### 3.4. Gán đè trạng thái Failed lên toàn bộ 6 nhóm
Khi rơi vào nhánh `if (isBridgeLevelFailure)`:
```javascript
if (isBridgeLevelFailure) {
  const errMsg = bridgeOutput.error || bridgeOutput.message || 'VPS bridge request failed...';
  for (const d of dispatch) {
    progressResults.push({
      socialGroupId: d.socialGroupId || null,
      groupName: d.groupName || 'Unknown Group',
      groupUrl: d.groupUrl || '',
      fbAccountId: d.fbAccountId || null,
      status: 'Failed',
      errorMessage: String(errMsg).substring(0, 500)
    });
  }
}
```
* n8n lấy biến `errMsg` (lỗi của nhóm 1: `"Account [acc_02] is NOT a member..."`) và **lặp qua toàn bộ 6 nhóm trong `dispatch`, gán đè `status = 'Failed'` cho tất cả**.
* Nhóm 5 (*AE THỢ CƠ KHÍ HÀ NỘI*) vốn đã thành công bị ghi đè thành `Failed`.
* n8n gọi callback báo về ATS 3.0 với kết quả `0/6 thành công, 6 lỗi`.

---

## 4. Phương Án Khắc Phục Đề Xuất (Action Plan Cho Phiên Tối Nay)

### 4.1. Sửa node `Process Bridge Results` trên n8n Workflow A (`9W588GooZeZhiSKm`)
Chuyển cách đọc input từ `$input.first()` sang `$input.all()`, tương tự như pattern đã chuẩn hóa thành công ở Workflow C (SNAP-20260906-115):

```javascript
// Trích xuất toàn bộ items từ node HTTP Request trước đó
const allItems = $input.all().map(function (item) { return item.json; });
const webhookBody = $('Webhook: Campaign Trigger').first().json.body || {};
const dispatch = webhookBody.dispatch || [];
const runId = webhookBody.runId;
const campaignId = webhookBody.campaignId;

const dispatchByUrl = {};
for (const d of dispatch) {
  dispatchByUrl[d.groupUrl] = d;
}

let rawResults = [];
if (allItems.length > 0 && (allItems[0].groupUrl || allItems[0].success !== undefined)) {
  // Trường hợp n8n HTTP Request đã phân rã thành mảng Items chuẩn
  rawResults = allItems;
} else if (allItems.length === 1 && allItems[0].output) {
  // Trường hợp output trả về dạng wrapper object chứa output string
  try {
    const parsed = JSON.parse(allItems[0].output.trim());
    if (Array.isArray(parsed)) rawResults = parsed;
    else if (parsed && Array.isArray(parsed.data)) rawResults = parsed.data;
  } catch (e) {}
}

// Chỉ coi là Bridge Failure khi rawResults rỗng
const isBridgeLevelFailure = rawResults.length === 0;

const progressResults = [];
if (isBridgeLevelFailure) {
  const errMsg = (allItems[0] && (allItems[0].error || allItems[0].message)) || 'VPS bridge request failed or returned no data.';
  for (const d of dispatch) {
    progressResults.push({
      socialGroupId: d.socialGroupId || null,
      groupName: d.groupName || 'Unknown Group',
      groupUrl: d.groupUrl || '',
      fbAccountId: d.fbAccountId || null,
      status: 'Failed',
      errorMessage: String(errMsg).substring(0, 500)
    });
  }
} else {
  for (const r of rawResults) {
    const matched = dispatchByUrl[r.groupUrl] || {};
    let status = 'Failed';
    if (r.success === true) status = 'Sent';
    else if (r.isCheckpoint === true) status = 'Checkpoint';
    
    progressResults.push({
      socialGroupId: matched.socialGroupId || null,
      groupName: r.groupName || matched.groupName || 'Unknown Group',
      groupUrl: r.groupUrl || '',
      fbAccountId: matched.fbAccountId || null,
      status: status,
      errorMessage: r.error ? String(r.error).substring(0, 500) : null
    });
  }
}

return progressResults.map(function (item) {
  return { json: { runId: runId, campaignId: campaignId, completedItem: item } };
});
```

### 4.2. Dữ liệu & Hệ Thống Liên Quan
* **Mã nguồn Next.js (`ats-web`):** Không cần chỉnh sửa.
* **Database Schema (`Supabase`):** Không cần chỉnh sửa.
* **Quy trình kiểm thử:** Sẽ kiểm thử lại bằng 1 lượt chạy mẫu sau khi cập nhật node n8n.

---

## 5. Kết Luận

1. Việc bài đăng xuất hiện thành công trên Facebook là **chính xác 100%**.
2. Hệ thống Playwright và Bridge Server trên VPS hoạt động tốt.
3. Sai lệch nằm hoàn toàn ở **lớp chuyển đổi dữ liệu (Data Transformer Code Node) của n8n**, sẽ được xử lý dứt điểm trong phiên tối nay.
