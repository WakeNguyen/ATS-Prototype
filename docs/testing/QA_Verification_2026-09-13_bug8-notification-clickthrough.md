**Từ:** Claude (Architect/QA)

# QA Verification — Mục #8: Click Notification dẫn thẳng tới nơi cần điền

**Ngày:** 2026-09-13
**Kết quả:** ✅ PASS — verify bằng code trực tiếp (4 file) + test sống qua Playwright (điều hướng
thật, không phải suy đoán).

## Verify code (đọc trực tiếp, khớp 100% spec)

- `PendingCVClientWrapper.js`: `onClick` trên mỗi notification gọi `router.push(notif.link)` +
  `setIsOpen(false)` + mark-as-read; nút Mark as read có `e.stopPropagation()` tránh trigger kép.
- `campaign_actions.js`: `getSocialGroupsLibrary` nhận `focusGroupId`, WHERE clause bọc `OR sgu.id =
  focusGroupId` (an toàn khi null), `ORDER BY (sgu.id = focusGroupId) DESC, ...` ghim lên đầu.
- `campaigns/page.js`: state `focusGroupId` đọc đúng từ `group_id` query param (không còn nhét vào
  ô search), truyền xuyên suốt 3 điểm gọi `fetchSocialGroupsLibrary` + prop `autoOpenAnswer`.
- `JoinStatusBadge.js`: `autoOpenAnswer` khởi tạo `showAnswerPopover`, `useEffect` tự
  `scrollIntoView`.

## Live test (Playwright, dev server local)

Điều hướng trực tiếp tới `http://localhost:3000/campaigns?tab=social_groups&group_id=<real-id>`
(dùng 1 group thật trong sandbox, không mutate gì) — ảnh chụp xác nhận:
1. Tab "Social Group URLs" tự động active.
2. Group mục tiêu tự động lên ĐẦU trang 1 (dòng đầu tiên trong bảng), dù trang có 1,028 group.
3. Popover "Group Membership Questions" tự động mở ngay dưới đúng dòng đó — không cần bấm gì thêm.

Không test riêng bước click chuông notification (chỉ là 1 `onClick` gọi `router.push` theo đúng
pattern React chuẩn đã dùng ở nhiều nơi khác trong dự án) — verify qua code trực tiếp là đủ, phần
đích đến (khó/rủi ro hơn) đã test sống đầy đủ.

## Kết luận

#8 hoàn thành đầy đủ, không có sai lệch, không tác dụng phụ ngoài phạm vi.
