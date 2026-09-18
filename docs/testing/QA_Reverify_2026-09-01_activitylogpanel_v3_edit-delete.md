# Thẩm định độc lập — Phase 4/N: Edit Log + Delete Log cho ActivityLogPanel — 2026-09-01

**Từ:** Claude (Architect/QA)
**Model AG dùng:** Gemini Flash 3.7 High (round #5/6)
**Phương pháp:** Đối chiếu `git show 4f834a9`/`4dd41e1` với spec, tự thao tác tay đầy đủ qua UI thật (Edit cả 2 nhánh Pass/Fail, Delete từng phần và Delete hết), đối chiếu Supabase trực tiếp sau mỗi bước.

## Kết luận: Implementation của AG khớp đúng spec (PASS phần code) — nhưng phát hiện 1 lỗi NGHIÊM TRỌNG có sẵn từ trước (không phải do AG tạo ra) chỉ lộ ra khi test thật qua UI

### Phần khớp spec — PASS

| # | Việc | Xác nhận |
| --- | --- | --- |
| 1 | Props `onEditLog`/`onDeleteLog` mới trên `ActivityLogPanel` | ✅ Đúng chữ ký `(applicationId, logId, {...})` / `(applicationId, logId)` như spec. |
| 2 | `allowEditLog` implement thật (trước là stub) | ✅ Icon Pencil/Trash2 chỉ hiện khi `allowEditLog=true`, đúng vị trí, đúng style. |
| 3 | Form edit inline 5 trường (Stage/Result/Reason-nếu-Fail/Date/Note) | ✅ Test qua UI xác nhận cả 5 trường prefill đúng giá trị hiện tại của dòng log, Reason chỉ hiện khi Result=Fail (đổi Pass→Fail hoặc Fail→Pass đều cập nhật đúng ngay lập tức). |
| 4 | Phím tắt Enter lưu / Escape huỷ | ✅ Test Escape → huỷ đúng, không lưu gì (xác nhận qua Supabase, dữ liệu không đổi sau Cancel). |
| 5 | `candidates/page.js`: `handleEditTimelineNote`/`handleDeleteTimelineNote` + refresh đúng pattern (giống `handleAddTimelineNote`) | ✅ Diff khớp gần như tuyệt đối với mẫu trong spec. Import `updateActivityLog`/`deleteActivityLog` đã có sẵn từ Phase 2, không cần thêm. |
| 6 | Delete Log + đồng bộ lại Application-level từ log mới nhất còn lại | ✅ Test thật: xoá log "Chasing Feedback" (Pass) → còn lại log "Contact" (Fail — Tech/Skill) → `activity.current_stage/result/reason_failed` tự đồng bộ đúng thành `Contact / Failed / Tech/Skill`, khớp Supabase 100%. |
| 7 | Delete hết log → reset về mặc định | ✅ Test thật: xoá nốt log cuối cùng → `activity.current_stage='Talent Mapping'`, `result=NULL`, `reason_failed=NULL`, `note_failure_reason=NULL` — đúng UI (badge Failed biến mất, chỉ còn "Talent Mapping"), đúng Supabase. |
| 8 | Không đụng `page.js`/`jobs/page.js` | ✅ Grep xác nhận diff chỉ có 2 file đúng phạm vi. |
| 9 | `DEVELOPMENT_LOG.md` | ✅ Entry mới, đúng commit hash (`4f834a9`), mô tả khớp diff thật. |

### 🔴 Phát hiện nghiêm trọng: lỗi timezone khi Edit Log làm SAI lệch `action_date`, kéo theo auto-sync Application-level bị SAI

**Không phải lỗi AG tạo mới** — đây là 1 pattern có sẵn từ trước trong `src/app/page.js` (`handleStartEditLog`, dòng ~531-538 mà tôi đã tự đọc code khi thiết kế spec Phase 4), và **chính tôi (Architect) đã yêu cầu AG copy nguyên văn pattern này** vào `ActivityLogPanel.js` (trích spec: *"pre-filled via the same `.toISOString().substring(0,16)` conversion pattern"*). AG làm đúng 100% những gì tôi yêu cầu. Lỗi nằm ở chính spec/pattern gốc, không lộ ra hậu quả nghiêm trọng cho tới bây giờ vì trước Phase 2, sửa sai ngày của 1 log chỉ ảnh hưởng hiển thị ngày của chính log đó — không có cơ chế "đồng bộ từ log mới nhất" nào dựa vào ngày để lan ra Application-level cả.

**Cơ chế lỗi (đã xác nhận bằng dữ liệu thật qua Supabase):**

`handleStartEditLog` tính giá trị prefill cho ô `<input type="datetime-local">` bằng:
```js
action_date: new Date(log.action_date).toISOString().substring(0, 16)
```
`toISOString()` LUÔN trả về giờ UTC. Nhưng `<input type="datetime-local">` hiển thị/diễn giải giá trị này như **giờ địa phương thuần (naive)**, KHÔNG tự quy đổi timezone. Kết quả: nếu log lưu trong DB là `05:06 UTC` (= `12:06 PM` giờ Việt Nam), ô ngày giờ hiển thị sai thành `05:06 AM` thay vì `12:06 PM` — **lệch đúng 7 tiếng (offset UTC+7 của Việt Nam)**.

Khi user bấm Save mà KHÔNG cố ý sửa lại ngày (chỉ định sửa Result/Reason/Note, như tình huống thực tế phổ biến nhất), giá trị lệch `05:06` này được gửi lên server. Server parse `new Date("...T05:06")` — vì server (Node dev) và browser cùng chạy trên máy Windows của user (cùng timezone ICT), server hiểu `05:06` là giờ ĐỊA PHƯƠNG và quy đổi ngược lại thành `05:06 - 7h = 22:06 UTC hôm trước` khi lưu... (tôi test thực tế lưu lại đúng `05:06 UTC`, tức là bị "đóng băng" ở giá trị hiển thị sai, không tiếp tục dịch chuyển thêm — nhưng đã lệch 7 tiếng so với giá trị ĐÚNG ban đầu).

**Hậu quả thực tế đã tái hiện được:** Ứng viên Trịnh Xuân Châu #11687, application `66c1f2c3-...`:
- Trước khi sửa: log "Chasing Feedback" (Fail — Culture Fit, `action_date` gốc tương đương ~12:06 PM VN) là log **mới nhất**, nên Application-level đang đúng là `Chasing Feedback / Failed / Culture Fit`.
- Tôi chỉ sửa Result của log "Chasing Feedback" từ Fail → Pass (không đụng ô ngày, giữ nguyên giá trị đang hiển thị — đúng hành vi user bình thường sẽ làm).
- Sau khi Save: `action_date` của log này bị ghi đè sai thành `05:06 UTC` (lệch 7 tiếng so với giá trị đúng ban đầu), khiến nó bị đánh giá là **CŨ HƠN** log "Contact" (đang có `action_date = 12:01 UTC` cùng ngày).
- Hệ quả: cơ chế auto-sync (Phase 2) đọc nhầm log "Contact" là "mới nhất", đồng bộ Application-level thành `Contact / Failed / Tech/Skill` — **hoàn toàn sai với log tôi vừa thực sự chỉnh sửa gần nhất**.

Đây là lỗi có thể xảy ra bất cứ lúc nào một user sửa Result/Reason/Note của 1 log qua Edit mà không chủ động sửa lại ô ngày — tức là gần như MỌI lần dùng Edit Log trong thực tế. Vì Application-level Result/Reason/Stage là thứ nhà tuyển dụng nhìn thấy ngay ở đầu trang (không phải chui vào từng dòng log), đây là rủi ro sai lệch dữ liệu thật, không phải lỗi cosmetic.

**Phạm vi ảnh hưởng:** `ActivityLogPanel.js` (mới, Candidates — vừa bật hôm nay) VÀ `page.js` (Action Menu, đã tồn tại từ trước Phase 2) đều dính cùng 1 pattern lỗi — nhưng ở `page.js`, hậu quả trước đây chỉ dừng ở "ngày hiển thị sai", CHƯA có auto-sync ăn theo ngày để lan sai lệch ra Result/Reason cấp Application như bây giờ.

## Đề xuất

Không rollback Phase 4 (phần code đúng spec, Delete Log hoạt động hoàn toàn chính xác). Nhưng cần vá lỗi timezone NGAY trước khi tiếp tục dùng Edit Log nhiều hơn hoặc tiến sang Phase 5 (migrate `page.js`) — tôi sẽ viết fix spec riêng, ưu tiên cao, gửi kèm theo báo cáo này.

## Đánh giá round #5/6 dưới Gemini Flash 3.7 High

AG tuân thủ đúng 100% những gì spec yêu cầu, 0 lần phải sửa lại vì lỗi AG tự gây ra. Lỗi timezone phát hiện được là do **chính spec của tôi** yêu cầu copy 1 pattern có sẵn (từ `page.js`) mà tôi (Architect) đã không kiểm tra kỹ đủ mức trước khi viết spec — bài học cho tôi: quy trình test thật qua UI (thay vì chỉ đọc diff) một lần nữa chứng minh giá trị, vì đối chiếu diff-với-spec sẽ PASS tuyệt đối ở trường hợp này (AG làm đúng từng chữ), chỉ có test hành vi thật mới lộ ra hậu quả. Ghi nhận: AG's implementation quality tiếp tục 5/5 round không lỗi tự gây ra; nhưng round này KHÔNG tính "0 lỗi tuyệt đối" theo nghĩa rộng vì có phát sinh vấn đề nghiêm trọng cần vá ngay — đã ghi chú rõ ràng vào bảng theo dõi model để không đánh giá sai công của AG lẫn trách nhiệm của Architect.
