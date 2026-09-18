**Từ:** Claude (Architect/QA)

# FIX_SPEC_2026-09-15 — Bảng Run History tự cập nhật live + Fix giật do polling toàn cục

## Bối cảnh

PO phản hồi 2 vấn đề liên quan, gộp chung 1 spec vì cùng đụng cơ chế polling của `/campaigns`:

1. **Giật khi thao tác:** Khi có BẤT KỲ campaign nào đang chạy nền, `campaigns/page.js` cứ mỗi 8 giây lại ghi đè state lựa chọn Target Groups đang mở của user (dù đang xem campaign khác không liên quan) — đã root-cause bằng đọc code trực tiếp.
2. **Không thấy tiến độ từng nhóm khi run đang chạy:** Bảng breakdown per-group (Target Group / FB Account / Status / Details / Time — trong `RunHistoryTable.js`) chỉ fetch dữ liệu ĐÚNG 1 LẦN lúc mở rộng row, không tự cập nhật — PO phải đợi cả run xong (30-45 phút) hoặc tự vào Facebook kiểm tra (tăng rủi ro out session) mới biết nhóm nào Sent/Failed.

**Đã xác nhận không cần:** progress bar, ETA, hay sửa gì bên VPS Playwright runner — backend (`campaign-run-progress` webhook, `campaign_run_items`) đã đủ dữ liệu, chỉ thiếu frontend tự refresh đúng chỗ.

## Phạm vi (2 file)

1. `src/app/campaigns/page.js`
2. `src/app/components/RunHistoryTable.js`

## Việc cần làm

### 1. `src/app/campaigns/page.js` — Thu hẹp phạm vi polling ngầm (fix giật)

**1a. `loadCampaignDetailData` (dòng 498-533):** Di chuyển `setTargetGroupIds(tIds)` (hiện ở dòng 515-516, đang chạy VÔ ĐIỀU KIỆN kể cả khi silent) vào TRONG nhánh `if (!isSilent)`. Đổi nhánh `else` (dòng 522-524, hiện gọi `fetchTargetGroups(groupPage, ...)` mỗi lần silent) thành KHÔNG làm gì cả (bỏ hẳn lệnh gọi này khi silent — không cần giữ "trang/filter hiện tại" nữa vì không refetch list group lúc silent).

Cụ thể, đổi từ:
```js
        if (detailRes.success && detailRes.data) {
          const cData = detailRes.data.campaign || detailRes.data;
          const flattened = {
            ...cData,
            name: cData.campaign_name || cData.name,
            targetGroups: detailRes.data.targetGroups || [],
            fbAccounts: detailRes.data.assignedAccounts || [],
            runs: detailRes.data.runs || []
          };
          setCampaignDetail(flattened);
          const tIds = new Set((detailRes.data.targetGroups || []).map((g) => g.id));
          setTargetGroupIds(tIds);
        }
        if (!isSilent) {
          setShowOnlySelectedGroups(false);
          setGroupPage(1);
          await fetchTargetGroups(1, groupSearchTerm, selectedTagFilters, false);
        } else {
          // Silent background refresh: giu nguyen trang/filter hien tai cua User, chi lam moi du lieu
          await fetchTargetGroups(groupPage, groupSearchTerm, selectedTagFilters, showOnlySelectedGroups);
        }
```
thành:
```js
        if (detailRes.success && detailRes.data) {
          const cData = detailRes.data.campaign || detailRes.data;
          const flattened = {
            ...cData,
            name: cData.campaign_name || cData.name,
            targetGroups: detailRes.data.targetGroups || [],
            fbAccounts: detailRes.data.assignedAccounts || [],
            runs: detailRes.data.runs || []
          };
          setCampaignDetail(flattened);
          if (!isSilent) {
            const tIds = new Set((detailRes.data.targetGroups || []).map((g) => g.id));
            setTargetGroupIds(tIds);
          }
        }
        if (!isSilent) {
          setShowOnlySelectedGroups(false);
          setGroupPage(1);
          await fetchTargetGroups(1, groupSearchTerm, selectedTagFilters, false);
        }
        // Silent poll (nen chay khi co campaign dang Running): CHI cap nhat campaignDetail
        // (phuc vu Run History tu lam moi) — KHONG dung vao targetGroupIds hay refetch
        // group library list, tranh ghi de luc User dang thao tac chon nhom.
```

**1b. useEffect polling (dòng 598-605):** Thu hẹp điều kiện gọi `loadCampaignDetailData` — chỉ gọi khi CHÍNH campaign đang được chọn/xem là campaign đang Running (không phải "có campaign bất kỳ nào đang chạy"):

Đổi từ:
```js
  useEffect(() => {
    if (!hasRunningCampaign) return;
    const interval = setInterval(() => {
      loadCampaignsList(true);
      if (selectedCampaignId) loadCampaignDetailData(selectedCampaignId, true);
    }, 8000);
    return () => clearInterval(interval);
  }, [hasRunningCampaign, selectedCampaignId, loadCampaignsList, loadCampaignDetailData]);
```
thành:
```js
  useEffect(() => {
    if (!hasRunningCampaign) return;
    const interval = setInterval(() => {
      loadCampaignsList(true);
      const viewedCampaign = campaigns.find((c) => c.id === selectedCampaignId);
      if (selectedCampaignId && viewedCampaign?.latest_run_status === "Running") {
        loadCampaignDetailData(selectedCampaignId, true);
      }
    }, 8000);
    return () => clearInterval(interval);
  }, [hasRunningCampaign, selectedCampaignId, campaigns, loadCampaignsList, loadCampaignDetailData]);
```
(Thêm `campaigns` vào dependency array vì giờ đọc từ đó.)

### 2. `src/app/components/RunHistoryTable.js` — Bảng per-group tự cập nhật khi run đang chạy

Thêm 1 `useEffect` mới (đặt sau hàm `toggleExpand`, dòng ~72), poll lại CHÍNH XÁC run đang mở nếu nó còn `status === "Running"`:
```js
  React.useEffect(() => {
    if (!expandedRunId || !fetchRunDetail) return;
    const expandedRun = runs.find((r) => r.id === expandedRunId);
    if (!expandedRun || expandedRun.status !== "Running") return;

    const interval = setInterval(async () => {
      try {
        const res = await fetchRunDetail(expandedRunId);
        if (res?.success && res?.data) {
          setRunDetails((prev) => ({ ...prev, [expandedRunId]: res.data }));
        }
      } catch (err) {
        console.error("Failed to poll run detail:", err);
      }
    }, 10000);
    return () => clearInterval(interval);
  }, [expandedRunId, runs, fetchRunDetail]);
```
(File đã `import React, { useState } from "react"` — dùng `React.useEffect` để không phải sửa dòng import, hoặc đổi thành `import React, { useState, useEffect } from "react"` rồi dùng `useEffect` trực tiếp — AG tự chọn cách nào gọn hơn, không ảnh hưởng hành vi.)

**Quan trọng:** Component này dùng CHUNG cho cả Campaign runs (`type="campaign"`) lẫn Warming runs (`type="warm_join"`) — đảm bảo `runs` prop truyền vào (từ `campaigns/page.js` dòng ~1845) LUÔN có field `status` cho cả 2 loại (đã xác nhận qua `getCampaignDetail`: cả `campaign_runs` lẫn `warm_join_runs` đều SELECT `*` nên có sẵn cột `status`) — không cần sửa gì thêm ở tầng data cho việc này.

## Việc KHÔNG được làm

- Không thêm progress bar, ETA, hay bất kỳ UI mới nào ngoài việc làm bảng đã có tự refresh.
- Không đụng backend (`campaign-run-progress`, `campaign-run-callback`, VPS Playwright runner) — dữ liệu đã đủ.
- Không đổi mốc thời gian 8 giây của poll danh sách campaign (`loadCampaignsList`) — chỉ thu hẹp phạm vi gọi `loadCampaignDetailData`.
- Không đụng `getCampaignRunDetail`/`getWarmJoinRunDetail` hay bất kỳ server action nào khác.

## Verify bắt buộc

1. `node --check` cả 2 file → PASS.
2. `git diff --stat` → đúng 2 file (+ doc).
3. Test thật qua `npm run dev` trong `sandbox`:
   - **Fix giật:** Mở campaign A, vào tab "Overview & Groups", bắt đầu tick/untick vài group (KHÔNG lưu). Trong lúc đó, trigger chạy 1 campaign B khác (Warming hoặc Job Posting). Đợi >8 giây → xác nhận lựa chọn đang tick dở ở campaign A KHÔNG bị reset/nhảy.
   - **Bảng tự cập nhật:** Trigger chạy 1 campaign thật (ít nhất 3-4 nhóm để có thời gian quan sát), ngay khi vừa bấm Run mở rộng row Run History mới nhất (đang Running) — xác nhận sau mỗi lần có nhóm mới hoàn tất (khoảng 2-3 phút/nhóm theo tốc độ VPS), dòng mới TỰ xuất hiện trong bảng đang mở, không cần đóng/mở lại. Sau khi run xong (status chuyển Completed/Partial Success), xác nhận poll tự dừng (không còn network request lặp lại — kiểm tra qua tab Network của DevTools).
   - Test dở dang: mở đúng run đang chạy, đóng row lại rồi mở lại → dữ liệu vẫn đúng, không lỗi.
4. `/api/biz-test` + `/api/qa-test` → PASS 100%, không regression.
5. `npm run build` → PASS 100%.

## Yêu cầu tài liệu

Thêm mục mới vào `docs/DEVELOPMENT_LOG.md` theo template mục 10.3 GEMINI.md.

Báo cáo hoàn thành kèm `git status`, `git diff --stat`, `npm run build`, và mô tả cụ thể quan sát được ở 2 kịch bản test chính (không ghi "PASS" suông).

## Quy ước xử lý khi phát hiện lệch spec hoặc không rõ ràng

- Lệch nhỏ → tự sửa, ghi chú, KHÔNG dừng.
- Đụng database/API/quyết định sản phẩm ngoài phạm vi → DỪNG NGAY, in `ESCALATE: <mô tả>`.
- Chỉ cần hỏi 1 chi tiết kỹ thuật nhỏ → in `QUESTION: <câu hỏi>` rồi dừng.
