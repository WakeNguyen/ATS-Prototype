# FIX SPEC — PHẦN R.2: NavbarTabs Co Gọn Ở Tablet (Lộ Trình Responsive Tablet)

**Từ:** Claude (Architect/QA)
**Gửi:** Antigravity (Implementer)
**Ngày:** 2026-09-03
**Bối cảnh:** Theo `docs/architecture/PLAN_2026-09-03_tablet-responsive-rollout.md`, sau khi PHẦN R.1 (safety net `overflow-x-auto`) đã PASS QA, đây là PHẦN R.2: thanh menu trên cùng (`nav` trong `src/app/layout.js`, chứa `NavbarTabs.js`) hiện là hàng ngang cố định không có cơ chế thu gọn — 5 tab (icon + chữ) + logo bên trái, chuông thông báo + dòng chữ "Supabase Singapore Live" bên phải, không có `flex-wrap`. Đây là phần đầu tiên User nhìn thấy ở MỌI trang, cần đảm bảo không tràn/đè lên nhau ở khổ tablet (~768–1024px).

**Ước tính bề rộng (chỉ để tham khảo, không phải yêu cầu code):** Ở trạng thái đã co gọn (chỉ icon, không chữ), tổng bề rộng ước tính: logo+tên (~121px) + khoảng cách (24px) + 5 tab chỉ-icon (~209px) + padding nav 2 bên (32px) + chuông (~40px) + khoảng cách (16px) + chấm trạng thái (~16px) ≈ **458px** — dư rất nhiều so với khổ hẹp nhất cần hỗ trợ (768px), nên đây là hướng an toàn.

---

## 0. Phạm vi (CHỈ sửa đúng phần này)

✅ Trong phạm vi:

1. `src/app/NavbarTabs.js` — ở CẢ 5 tab (`Action Menu`, `Candidates`, `Jobs & Clients`, `Campaigns`, `Search Menu`):
   - Thêm class `hidden lg:inline` vào `<span>` chứa chữ label (ẩn chữ khi bề rộng màn hình < 1024px, chỉ hiện icon; chữ hiện lại bình thường từ `lg:` tức ≥1024px trở lên — bao trùm luôn cả khổ desktop chính ≥1280px, đảm bảo không đổi gì ở đó).
   - Thêm thuộc tính `title="<tên tab đầy đủ>"` vào từng `<Link>` tương ứng, để khi chỉ hiện icon vẫn có tooltip khi hover/focus (hỗ trợ accessibility, vì mất phần text hiển thị).
2. `src/app/layout.js` — khối "Cloud Database indicator" (dòng ~53-56, chứa chấm tròn trạng thái + chữ "Supabase Singapore Live"):
   - Thêm class `hidden lg:inline` vào `<span>` chứa chữ "Supabase Singapore Live" (ẩn chữ dưới `lg:`, chỉ còn lại chấm tròn xanh nhấp nháy — đúng như plan đã mô tả "rút gọn text... thành chấm tròn trạng thái").
   - Thêm thuộc tính `title="Supabase Singapore Live"` vào `<div>` bọc ngoài (dòng ~54) để có tooltip khi hover vào chấm tròn.

❌ NGOÀI phạm vi:
- KHÔNG thêm `flex-wrap` cho `<nav>` — nav có chiều cao cố định `h-12`, nếu wrap sẽ vỡ layout 2 dòng, không đúng mục tiêu "co gọn trong 1 hàng".
- KHÔNG đổi icon, không đổi thứ tự tab, không đổi route/href nào.
- KHÔNG đụng vào `PendingCVClientWrapper` (chuông thông báo) — giữ nguyên 100%.
- KHÔNG đổi text "CRM-ATS 3.0" (logo) — vẫn còn nhiều dư địa bề rộng theo ước tính ở trên, chưa cần đụng tới trong PHẦN này.
- KHÔNG đổi breakpoint `md:`/`lg:` mặc định của Tailwind, không thêm breakpoint tuỳ biến mới.
- Nếu đọc code thực tế thấy khác với mô tả dưới đây (do file đã đổi), tìm đúng đoạn bằng ngữ cảnh, KHÔNG đoán bừa — nếu không chắc, dừng lại hỏi Claude theo mục 10 GEMINI.md.

---

## 1. Thay đổi cụ thể

### 1.1. `src/app/NavbarTabs.js` — 5 tab, mỗi tab thêm `title` + `hidden lg:inline`

**Trước (nguyên văn cả khối, dòng 30-92):**
```jsx
  return (
    <div className="flex items-center space-x-1.5 text-xs font-bold">
      <Link
        href="/"
        className={`px-3 py-1.5 rounded-lg flex items-center space-x-1.5 transition-all ${
          isActionActive
            ? "bg-slate-800 text-emerald-400 border border-slate-700 shadow-sm"
            : "text-slate-400 hover:text-slate-200 hover:bg-slate-900"
        }`}
      >
        <FileText size={13} />
        <span>Action Menu</span>
      </Link>

      <Link
        href="/candidates"
        className={`px-3 py-1.5 rounded-lg flex items-center space-x-1.5 transition-all ${
          isCandidateActive
            ? "bg-slate-800 text-emerald-400 border border-slate-700 shadow-sm"
            : "text-slate-400 hover:text-slate-200 hover:bg-slate-900"
        }`}
      >
        <Users size={13} />
        <span>Candidates</span>
      </Link>

      <Link
        href="/jobs"
        className={`px-3 py-1.5 rounded-lg flex items-center space-x-1.5 transition-all ${
          isJobsActive
            ? "bg-slate-800 text-emerald-400 border border-slate-700 shadow-sm"
            : "text-slate-400 hover:text-slate-200 hover:bg-slate-900"
        }`}
      >
        <Briefcase size={13} />
        <span>Jobs & Clients</span>
      </Link>

      <Link
        href="/campaigns"
        className={`px-3 py-1.5 rounded-lg flex items-center space-x-1.5 transition-all ${
          isCampaignsActive
            ? "bg-slate-800 text-emerald-400 border border-slate-700 shadow-sm"
            : "text-slate-400 hover:text-slate-200 hover:bg-slate-900"
        }`}
      >
        <Megaphone size={13} />
        <span>Campaigns</span>
      </Link>

      <Link
        href="/search"
        className={`px-3 py-1.5 rounded-lg flex items-center space-x-1.5 transition-all ${
          isSearchActive
            ? "bg-slate-800 text-emerald-400 border border-slate-700 shadow-sm"
            : "text-slate-400 hover:text-slate-200 hover:bg-slate-900"
        }`}
      >
        <Search size={13} />
        <span>Search Menu</span>
      </Link>
    </div>
  );
}
```

**Sau (mong muốn — chỉ thêm `title="..."` vào mỗi `<Link>` và đổi `<span>` → `<span className="hidden lg:inline">`, KHÔNG đổi gì khác):**
```jsx
  return (
    <div className="flex items-center space-x-1.5 text-xs font-bold">
      <Link
        href="/"
        title="Action Menu"
        className={`px-3 py-1.5 rounded-lg flex items-center space-x-1.5 transition-all ${
          isActionActive
            ? "bg-slate-800 text-emerald-400 border border-slate-700 shadow-sm"
            : "text-slate-400 hover:text-slate-200 hover:bg-slate-900"
        }`}
      >
        <FileText size={13} />
        <span className="hidden lg:inline">Action Menu</span>
      </Link>

      <Link
        href="/candidates"
        title="Candidates"
        className={`px-3 py-1.5 rounded-lg flex items-center space-x-1.5 transition-all ${
          isCandidateActive
            ? "bg-slate-800 text-emerald-400 border border-slate-700 shadow-sm"
            : "text-slate-400 hover:text-slate-200 hover:bg-slate-900"
        }`}
      >
        <Users size={13} />
        <span className="hidden lg:inline">Candidates</span>
      </Link>

      <Link
        href="/jobs"
        title="Jobs & Clients"
        className={`px-3 py-1.5 rounded-lg flex items-center space-x-1.5 transition-all ${
          isJobsActive
            ? "bg-slate-800 text-emerald-400 border border-slate-700 shadow-sm"
            : "text-slate-400 hover:text-slate-200 hover:bg-slate-900"
        }`}
      >
        <Briefcase size={13} />
        <span className="hidden lg:inline">Jobs & Clients</span>
      </Link>

      <Link
        href="/campaigns"
        title="Campaigns"
        className={`px-3 py-1.5 rounded-lg flex items-center space-x-1.5 transition-all ${
          isCampaignsActive
            ? "bg-slate-800 text-emerald-400 border border-slate-700 shadow-sm"
            : "text-slate-400 hover:text-slate-200 hover:bg-slate-900"
        }`}
      >
        <Megaphone size={13} />
        <span className="hidden lg:inline">Campaigns</span>
      </Link>

      <Link
        href="/search"
        title="Search Menu"
        className={`px-3 py-1.5 rounded-lg flex items-center space-x-1.5 transition-all ${
          isSearchActive
            ? "bg-slate-800 text-emerald-400 border border-slate-700 shadow-sm"
            : "text-slate-400 hover:text-slate-200 hover:bg-slate-900"
        }`}
      >
        <Search size={13} />
        <span className="hidden lg:inline">Search Menu</span>
      </Link>
    </div>
  );
}
```

### 1.2. `src/app/layout.js` — khối chấm trạng thái + "Supabase Singapore Live"

**Trước (dòng ~53-56):**
```jsx
            <div className="flex items-center space-x-2 text-[11px] text-slate-400">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span className="font-semibold text-slate-300">Supabase Singapore Live</span>
            </div>
```

**Sau:**
```jsx
            <div className="flex items-center space-x-2 text-[11px] text-slate-400" title="Supabase Singapore Live">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span className="hidden lg:inline font-semibold text-slate-300">Supabase Singapore Live</span>
            </div>
```

Chỉ thêm `title="Supabase Singapore Live"` vào `<div>` bọc ngoài, và thêm `hidden lg:inline` vào `<span>` chứa chữ. Chấm tròn nhấp nháy (`<span className="w-2 h-2 ...">`) giữ nguyên, luôn hiển thị ở mọi độ rộng — đây chính là "chấm tròn trạng thái" thay thế cho dòng chữ khi bị ẩn.

---

## 2. Yêu cầu QA/test trước khi báo PASS

1. Test trực quan qua UI thật ở độ rộng ~768px và ~1024px (DevTools responsive mode hoặc thu nhỏ cửa sổ):
   - Cả 5 tab chỉ còn hiển thị icon, không còn chữ label — không bị tràn ra ngoài `<nav>`, không đè lên chuông thông báo hay chấm trạng thái.
   - Hover (hoặc focus bằng bàn phím) vào từng icon tab phải hiện tooltip đúng tên tab (dùng thuộc tính `title` — trình duyệt tự hiển thị, không cần code thêm).
   - Dòng "Supabase Singapore Live" biến mất, chỉ còn chấm tròn xanh nhấp nháy; hover vào chấm phải hiện tooltip "Supabase Singapore Live".
   - Toàn bộ thanh nav vẫn nằm gọn trong 1 hàng ngang (`h-12`), không bị vỡ xuống 2 dòng.
2. **Đối chiếu không có regression ở độ rộng desktop bình thường (≥1280px):** tất cả 5 tab phải hiển thị đầy đủ icon + chữ như hiện tại, dòng "Supabase Singapore Live" phải hiển thị đầy đủ như hiện tại — pixel-identical với trước khi sửa.
3. Test riêng ở đúng ngưỡng `lg:` (1024px): xác nhận đây là điểm chuyển — dưới 1024px chỉ icon, từ 1024px trở lên có đủ chữ (do dùng `lg:inline` là mobile-first, chữ ẩn mặc định và chỉ hiện lại từ `lg:` trở lên).
4. `npm run build` PASS, không lỗi lint, không warning console.
5. Cập nhật `docs/DEVELOPMENT_LOG.md`: **BẮT BUỘC cập nhật CẢ 2 phần** — bảng tổng hợp đầu file VÀ chi tiết snapshot phía dưới.

Nếu có bất kỳ điểm nào không rõ hoặc code thực tế khác với mô tả, dừng lại hỏi Claude trước khi tự quyết, theo mục 10 GEMINI.md.
