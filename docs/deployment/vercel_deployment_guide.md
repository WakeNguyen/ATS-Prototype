# HƯỚNG DẪN CHẠY LOCAL & TRIỂN KHAI VERCEL (CRM-ATS 3.0)

Tài liệu này hướng dẫn bạn cách khởi động dự án tuyển dụng CRM-ATS 3.0 Next.js ở môi trường máy tính cá nhân (Local) và cách đẩy lên đám mây Vercel để sử dụng online miễn phí.

---

## 1. HƯỚNG DẪN CHẠY THỬ LOCAL (MÁY CÁ NHÂN)

> [!IMPORTANT]
> **Lưu ý về Google Drive**: Vì thư mục hiện tại nằm trong Google Drive (`G:\My Drive`), việc chạy cài đặt trực tiếp tại đây rất dễ gặp lỗi do tính năng đồng bộ file của Google Drive khóa file liên tục làm chậm tốc độ I/O.
> **Khuyên dùng**: Hãy làm theo các bước dưới đây để chạy thử mượt mà nhất.

1.  **Sao chép thư mục**: Copy thư mục `ats-web` từ Google Drive ra một thư mục trên ổ đĩa local của máy tính (Ví dụ: `C:\ats-web` hoặc `D:\ats-web`).
2.  **Mở Terminal / Command Prompt**: Di chuyển đến thư mục vừa copy.
    ```bash
    cd C:\ats-web
    ```
3.  **Cài đặt dependencies**: Chạy lệnh dưới đây với cờ hỗ trợ tương thích React 19:
    ```bash
    npm install --legacy-peer-deps
    ```
4.  **Khởi động local dev**:
    ```bash
    npm run dev
    ```
5.  **Tương tác ứng dụng**: Mở trình duyệt web và truy cập địa chỉ `http://localhost:3000`. Giao diện Master-Detail sẽ tự động load dữ liệu từ Neon Postgres trực tiếp.

---

## 2. HƯỚNG DẪN TRIỂN KHAI LÊN VERCEL (DÙNG ONLINE MIỄN PHÍ)

Vercel cho phép bạn host ứng dụng Next.js miễn phí trọn đời đối với tài khoản cá nhân.

### Bước 2.1: Chuẩn bị tài khoản
1.  Truy cập [Vercel.com](https://vercel.com) và đăng ký một tài khoản miễn phí (bằng GitHub, Google hoặc Email).

### Bước 2.2: Chạy lệnh triển khai thử nghiệm
1.  Tại terminal ở thư mục dự án (Ví dụ: `C:\ats-web`), chạy lệnh:
    ```bash
    npx vercel
    ```
2.  Lần đầu chạy, Vercel sẽ yêu cầu bạn đăng nhập. Hãy làm theo hướng dẫn trên màn hình (chọn đăng nhập bằng tài khoản bạn vừa tạo).
3.  Trả lời các câu hỏi cấu hình dự án của Vercel CLI:
    *   *Set up and deploy “C:\ats-web”?* **y** (Có)
    *   *Which scope do you want to deploy to?* **[Tên tài khoản của bạn]** (Bấm Enter)
    *   *Link to existing project?* **N** (Không)
    *   *What’s your project’s name?* **crm-ats-web** (Hoặc tên bất kỳ bạn thích)
    *   *In which directory is your code located?* **./** (Bấm Enter)
    *   *Want to modify these settings?* **N** (Không, chọn mặc định)
4.  CLI sẽ upload source code và cấp cho bạn một link Preview dự án. *Lưu ý: Lúc này trang web sẽ báo lỗi 500 khi load dữ liệu vì chưa cấu hình biến môi trường kết nối Database.*

### Bước 2.3: Cấu hình biến môi trường kết nối database
1.  Đăng nhập vào [Vercel Dashboard](https://vercel.com/dashboard).
2.  Nhấp vào dự án **crm-ats-web** vừa được tạo.
3.  Chọn tab **Settings** ở menu trên cùng -> chọn tiếp mục **Environment Variables** ở cột bên trái.
4.  Thêm biến môi trường mới:
    *   **Key**: `DATABASE_URL`
    *   **Value**: `postgresql://neondb_owner:npg_YIrKspcNA2R7@ep-winter-waterfall-ax7g86y5-pooler.c-4.us-east-2.aws.neon.tech/neondb?sslmode=require`
5.  Nhấp **Save** để lưu lại.

### Bước 2.4: Triển khai chính thức (Production)
1.  Quay trở lại terminal, chạy lệnh:
    ```bash
    npx vercel --prod
    ```
2.  Hệ thống Vercel sẽ tự động build lại dự án của bạn (sử dụng biến môi trường database vừa cấu hình).
3.  Sau khoảng 30s-1 phút, Vercel sẽ cấp cho bạn một đường dẫn URL chính thức hoạt động 24/7 (Ví dụ: `https://crm-ats-web.vercel.app`).
4.  **Hoàn tất!** Giờ đây bạn có thể mở đường dẫn này từ điện thoại hoặc bất kỳ máy tính nào khác để quản lý hồ sơ ứng viên trực tuyến.
