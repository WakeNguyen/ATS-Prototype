# FIX SPEC — Search Page: Popover Số Điện Thoại/Email Phụ Bị Cắt Bởi Container Cuộn (Bug Ngoài Lộ Trình Responsive, Phát Hiện Khi Audit R.5)

**Từ:** Claude (Architect/QA)
**Gửi:** Antigravity (Implementer)
**Ngày:** 2026-09-05
**Bối cảnh:** Khi audit PHẦN R.5 (xem `docs/testing/AUDIT_2026-09-05_tablet-responsive_phaseR5-search-page.md`), Claude phát hiện 2 vị trí trong `src/app/search/page.js` (bảng Candidate Database, badge "+N" số điện thoại/email phụ) dùng popover tự chế bằng `position: absolute` bên trong container cha có `overflow-auto` (dòng 332, bọc toàn bộ 3 bảng). Theo đúng bài học CSS đã ghi nhận trong dự án (PHẦN 5.8.1/5.8.2 ở `campaigns/page.js`): **bất kỳ ancestor nào có `overflow` khác `visible` đều sẽ cắt mất popover con nếu popover đó tràn ra ngoài biên của ancestor đó, bất kể popover dùng `position: absolute` neo vào ancestor gần hơn nào**. Vì đây là hành vi desktop có từ trước (không phải do lộ trình responsive gây ra hay làm nặng thêm), Claude không gộp vào PHẦN R.5 mà tách thành spec riêng theo yêu cầu của User.

**Biểu hiện lỗi:** khi bấm badge "+N" (xem thêm số điện thoại/email) ở 1 dòng ứng viên nằm gần mép dưới của vùng bảng đang hiển thị (rất dễ gặp — bảng cuộn dọc dài, đa số dòng đều có thể rơi vào mép dưới tại 1 thời điểm), popover xổ xuống dưới (`top-full`) sẽ bị cắt mất 1 phần hoặc toàn bộ bởi container `overflow-auto` bên ngoài, không thể thấy được bằng cách cuộn thêm.

**Hướng fix:** dự án đã có sẵn component `Popover`/`PopoverTrigger`/`PopoverContent` tại `src/components/ui/popover.jsx` (dựa trên `@base-ui/react/popover`), tự động render qua React Portal ra ngoài mọi ancestor có `overflow` (thoát hoàn toàn khỏi lỗi cắt) và tự tính toán vị trí/tránh va chạm mép màn hình. Component này đã được dùng ổn định trong `src/components/DateInputField.js` — đây chính là "component có sẵn" cần tái dùng theo đúng Nguyên Tắc Thiết Kế UI Mới (GEMINI.md mục 1.4), thay vì tự chế lại. Spec này thay thế 2 popover tự chế bằng component có sẵn đó — KHÔNG viết cơ chế portal/tính toán vị trí mới từ đầu.

---

## 0. Phạm vi (CHỈ sửa đúng phần này)

✅ Trong phạm vi — CHỈ trong `src/app/search/page.js`:
1. Thêm 1 dòng import component `Popover`/`PopoverTrigger`/`PopoverContent`.
2. Thay thế cấu trúc popover "+N phone" (quanh dòng ~453-479).
3. Thay thế cấu trúc popover "+N email" (quanh dòng ~506-533).

❌ NGOÀI phạm vi:
- KHÔNG đụng bảng Client Database hay Job Order Database (không có popover tương tự ở 2 bảng đó).
- KHÔNG đổi logic `copyToClipboard`, không đổi nội dung hiển thị (số điện thoại/email, nút Copy) — chỉ đổi CÁCH RENDER popover (từ `absolute` tự chế sang component `Popover` có sẵn).
- KHÔNG sửa `src/components/ui/popover.jsx` hay `DateInputField.js` — dùng nguyên trạng.
- KHÔNG đụng bất kỳ phần nào khác của trang Search (toolbar, bảng khác) — đây không phải PHẦN của lộ trình R.1-R.6, không được gộp chung.
- Nếu đọc code thực tế thấy khác mô tả dưới đây, tìm đúng đoạn bằng ngữ cảnh (comment `{/* Popover */}`, `{/* More Phones Badge */}`, `{/* More Emails Badge */}`), KHÔNG đoán bừa — nếu không chắc, dừng lại hỏi Claude theo mục 10 GEMINI.md.

---

## 1. Thay đổi cụ thể

### 1.1. Thêm import (đặt cạnh các import khác ở đầu file, sau dòng import `Copy`/`Users`/... từ `lucide-react`)

```jsx
import { Popover, PopoverContent, PopoverTrigger } from "src/components/ui/popover";
```

### 1.2. Popover "+N phone" — thay `<div className="relative inline-block">...</div>` bằng `<Popover>`

**Trước:**
```jsx
                              {/* More Phones Badge */}
                              {phones.length > 1 && (
                                <div className="relative inline-block">
                                  <button
                                    onClick={() => setActivePopover(activePopover?.candidateId === c.candidate_id && activePopover?.type === 'phone' ? null : { candidateId: c.candidate_id, type: 'phone' })}
                                    className="px-1.5 py-0.2 bg-emerald-950 hover:bg-emerald-900 border border-emerald-700/80 text-emerald-400 font-bold rounded text-[10px] cursor-pointer"
                                    title={`View all ${phones.length} phone numbers`}
                                  >
                                    +{phones.length - 1}
                                  </button>

                                  {/* Popover */}
                                  {activePopover?.candidateId === c.candidate_id && activePopover?.type === 'phone' && (
                                    <div className="absolute left-0 top-full mt-1 z-30 bg-slate-900 border border-slate-700 rounded-lg shadow-2xl p-2 w-48 space-y-1">
                                      <div className="text-[10px] font-bold text-slate-400 border-b border-slate-800 pb-1">
                                        All Phone Numbers ({phones.length})
                                      </div>
                                      {phones.map((ph, idx) => (
                                        <div key={idx} className="flex items-center justify-between hover:bg-slate-800 p-1 rounded">
                                          <span className="font-mono text-[11px] text-slate-200">{ph}</span>
                                          <button
                                            onClick={() => copyToClipboard(ph, `Phone #${idx + 1}`)}
                                            className="text-slate-400 hover:text-emerald-400 p-0.5 cursor-pointer"
                                            title="Copy this phone"
                                          >
                                            <Copy size={10} />
                                          </button>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              )}
```

**Sau:**
```jsx
                              {/* More Phones Badge */}
                              {phones.length > 1 && (
                                <Popover
                                  open={activePopover?.candidateId === c.candidate_id && activePopover?.type === 'phone'}
                                  onOpenChange={(open) => setActivePopover(open ? { candidateId: c.candidate_id, type: 'phone' } : null)}
                                >
                                  <PopoverTrigger
                                    type="button"
                                    className="px-1.5 py-0.2 bg-emerald-950 hover:bg-emerald-900 border border-emerald-700/80 text-emerald-400 font-bold rounded text-[10px] cursor-pointer"
                                    title={`View all ${phones.length} phone numbers`}
                                  >
                                    +{phones.length - 1}
                                  </PopoverTrigger>
                                  <PopoverContent
                                    className="w-48 p-2 space-y-1 bg-slate-900 border border-slate-700 text-slate-200"
                                    align="start"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <div className="text-[10px] font-bold text-slate-400 border-b border-slate-800 pb-1">
                                      All Phone Numbers ({phones.length})
                                    </div>
                                    {phones.map((ph, idx) => (
                                      <div key={idx} className="flex items-center justify-between hover:bg-slate-800 p-1 rounded">
                                        <span className="font-mono text-[11px] text-slate-200">{ph}</span>
                                        <button
                                          onClick={() => copyToClipboard(ph, `Phone #${idx + 1}`)}
                                          className="text-slate-400 hover:text-emerald-400 p-0.5 cursor-pointer"
                                          title="Copy this phone"
                                        >
                                          <Copy size={10} />
                                        </button>
                                      </div>
                                    ))}
                                  </PopoverContent>
                                </Popover>
                              )}
```

### 1.3. Popover "+N email" — làm ĐÚNG Y HỆT logic mục 1.2, chỉ đổi `type: 'phone'` → `type: 'email'` và nội dung email

**Trước:**
```jsx
                              {/* More Emails Badge */}
                              {emails.length > 1 && (
                                <div className="relative inline-block">
                                  <button
                                    onClick={() => setActivePopover(activePopover?.candidateId === c.candidate_id && activePopover?.type === 'email' ? null : { candidateId: c.candidate_id, type: 'email' })}
                                    className="px-1.5 py-0.2 bg-emerald-950 hover:bg-emerald-900 border border-emerald-700/80 text-emerald-400 font-bold rounded text-[10px] cursor-pointer"
                                    title={`View all ${emails.length} emails`}
                                  >
                                    +{emails.length - 1}
                                  </button>

                                  {/* Popover */}
                                  {activePopover?.candidateId === c.candidate_id && activePopover?.type === 'email' && (
                                    <div className="absolute left-0 top-full mt-1 z-30 bg-slate-900 border border-slate-700 rounded-lg shadow-2xl p-2 w-56 space-y-1">
                                      <div className="text-[10px] font-bold text-slate-400 border-b border-slate-800 pb-1">
                                        All Email Addresses ({emails.length})
                                      </div>
                                      {emails.map((em, idx) => (
                                        <div key={idx} className="flex items-center justify-between hover:bg-slate-800 p-1 rounded">
                                          <span className="font-mono text-[11px] text-slate-200 truncate max-w-[170px]">{em}</span>
                                          <button
                                            onClick={() => copyToClipboard(em, `Email #${idx + 1}`)}
                                            className="text-slate-400 hover:text-emerald-400 p-0.5 cursor-pointer"
                                            title="Copy this email"
                                          >
                                            <Copy size={10} />
                                          </button>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              )}
```

**Sau:**
```jsx
                              {/* More Emails Badge */}
                              {emails.length > 1 && (
                                <Popover
                                  open={activePopover?.candidateId === c.candidate_id && activePopover?.type === 'email'}
                                  onOpenChange={(open) => setActivePopover(open ? { candidateId: c.candidate_id, type: 'email' } : null)}
                                >
                                  <PopoverTrigger
                                    type="button"
                                    className="px-1.5 py-0.2 bg-emerald-950 hover:bg-emerald-900 border border-emerald-700/80 text-emerald-400 font-bold rounded text-[10px] cursor-pointer"
                                    title={`View all ${emails.length} emails`}
                                  >
                                    +{emails.length - 1}
                                  </PopoverTrigger>
                                  <PopoverContent
                                    className="w-56 p-2 space-y-1 bg-slate-900 border border-slate-700 text-slate-200"
                                    align="start"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <div className="text-[10px] font-bold text-slate-400 border-b border-slate-800 pb-1">
                                      All Email Addresses ({emails.length})
                                    </div>
                                    {emails.map((em, idx) => (
                                      <div key={idx} className="flex items-center justify-between hover:bg-slate-800 p-1 rounded">
                                        <span className="font-mono text-[11px] text-slate-200 truncate max-w-[170px]">{em}</span>
                                        <button
                                          onClick={() => copyToClipboard(em, `Email #${idx + 1}`)}
                                          className="text-slate-400 hover:text-emerald-400 p-0.5 cursor-pointer"
                                          title="Copy this email"
                                        >
                                          <Copy size={10} />
                                        </button>
                                      </div>
                                    ))}
                                  </PopoverContent>
                                </Popover>
                              )}
```

**Tham khảo cách dùng đã chạy ổn định trong dự án:** `src/components/DateInputField.js` (dòng 12-71) dùng đúng pattern `<Popover open={...} onOpenChange={...}><PopoverTrigger type="button" className="..." onClick={...}>...</PopoverTrigger><PopoverContent className="..." align="start" onClick={(e) => e.stopPropagation()}>...</PopoverContent></Popover>` — spec này áp dụng đúng cùng 1 pattern, không phát minh cách dùng mới.

---

## 2. Hành vi thay đổi cần biết trước (không phải lỗi, là cải thiện đi kèm)

Cách làm cũ KHÔNG có cơ chế đóng popover khi bấm ra ngoài (chỉ đóng khi bấm lại đúng badge "+N"). Component `Popover` có sẵn (`@base-ui/react/popover`) tự động đóng khi bấm ra ngoài — đây là hành vi MỚI, tốt hơn, đi kèм miễn phí khi tái dùng component, KHÔNG cần code thêm gì cho việc này. AG không cần và không nên tự viết thêm logic đóng popover.

---

## 3. Yêu cầu QA/test trước khi báo PASS

1. **Test đúng bug đã phát hiện:** cuộn bảng Candidate Database sao cho 1 dòng có "+N" phone/email nằm gần mép DƯỚI của vùng bảng đang hiển thị, bấm badge "+N" — xác nhận popover hiện ra ĐẦY ĐỦ, không bị cắt, tự động canh lại vị trí (bung lên trên nếu không đủ chỗ phía dưới) — đây là hành vi engine `@base-ui/react/popover` tự xử lý.
2. Test cả 2 loại popover (phone và email) ở cả 3 mốc 768px/1024px/1440px.
3. Test nút Copy bên trong mỗi dòng số điện thoại/email vẫn hoạt động đúng (không bị chặn bởi thay đổi cấu trúc).
4. Test bấm ra ngoài popover — xác nhận đóng lại đúng (hành vi mới, xem mục 2).
5. Test bấm đúng badge "+N" lần nữa để đóng — vẫn phải hoạt động như cũ (dùng `open`/`onOpenChange` controlled, không đổi ý nghĩa toggle).
6. Đối chiếu KHÔNG regression: giao diện popover (màu nền, viền, nội dung, layout từng dòng số/email + nút Copy) hiển thị giống hệt trước khi sửa — chỉ khác ở việc không còn bị cắt.
7. Console sạch, không lỗi liên quan `@base-ui/react/popover`.
8. `npm run build` PASS.
9. Cập nhật `docs/DEVELOPMENT_LOG.md` cả 2 phần.

Nếu có bất kỳ điểm nào không rõ, hoặc API thực tế của `Popover`/`PopoverTrigger`/`PopoverContent` khác với ví dụ tham khảo ở `DateInputField.js`, dừng lại hỏi Claude trước khi tự đoán, theo mục 10 GEMINI.md.
