# N8N VPS Management & Maintenance Guide (ATS 3.0)

Tài liệu này lưu trữ toàn bộ thông tin kiến trúc, cấu hình tuỳ chỉnh, và quy trình vận hành (SOP) cho hệ thống n8n Automation của dự án ATS đang chạy trên VPS TinoHost.
**Mục tiêu:** Đảm bảo khả năng bảo trì, nâng cấp an toàn, và khôi phục sự cố (Rollback) mà không phụ thuộc vào nền tảng.

---

## 1. Thông Tin Kiến Trúc Hạ Tầng (Infrastructure)

* **Nhà cung cấp VPS:** TinoHost
* **Đường dẫn cài đặt gốc:** `/opt/n8n/`
* **Công nghệ cốt lõi:** Docker Compose
* **Các Services (Containers) đang chạy:**
  1. `n8n` (Application Core) - Custom Image (Bao gồm Chromium & Playwright)
  2. `n8n-worker` (Worker Nodes for queue execution) - Custom Image
  3. `postgres` (Database) - Lưu trữ toàn bộ Workflows, Credentials và Execution logs.
  4. `redis` (Queue) - Quản lý queue cho Workers.
  5. `nocodb` - Bảng điều khiển Database (Tích hợp sẵn bởi TinoHost)

### ⚠️ CẢNH BÁO BẢO MẬT TỐI QUAN TRỌNG
1. **KHÔNG BAO GIỜ SỬ DỤNG NÚT "NÂNG CẤP" TRÊN WEB PANEL TINOHOST.** 
   * TinoHost có cài sẵn một Agent (`/opt/n8n-agent/`) chạy ngầm, nút nâng cấp trên Web sẽ gọi script ghi đè hoàn toàn file `/opt/n8n/docker-compose.yml` về mặc định. 
   * Việc này sẽ **xóa sổ toàn bộ** tuỳ chỉnh môi trường (Chromium, Poppler) phục vụ tool Facebook Auto Posting.
2. Mật khẩu và Credentials **không được lưu trữ plaintext** tại đây. Mọi mật khẩu Database nằm trong file `/opt/n8n/.env` trên VPS.

---

## 2. Kiến Trúc Tuỳ Chỉnh (Custom Dockerfile Inline)

Do nhu cầu chạy tool tự động (Playwright/Puppeteer) và xử lý PDF, n8n mặc định không đáp ứng được. Chúng ta đã tuỳ chỉnh `docker-compose.yml` bằng cách chèn `dockerfile_inline` để cài thêm thư viện vào OS (Alpine Linux Hardened).

**Đoạn code build tuỳ chỉnh (Bắt buộc giữ lại khi nâng cấp):**
```yaml
    build:
      context: .
      dockerfile_inline: |
        FROM docker.io/n8nio/n8n:2.37.6
        USER root
        # Fix lỗi thiếu apk-tools trên Hardened Alpine của n8n mới
        RUN if ! command -v apk >/dev/null 2>&1; then \
                echo "Installing apk-tools for Hardened Alpine"; \
                mkdir -p /tmp/apkstage && cd /tmp/apkstage; \
                wget -qO apk-tools-static.apk https://dl-cdn.alpinelinux.org/alpine/v3.20/main/x86_64/apk-tools-static-2.14.4-r1.apk; \
                tar -xzf apk-tools-static.apk sbin/apk.static; \
                ./sbin/apk.static add --no-cache --initdb --root / --allow-untrusted apk-tools; \
                cd / && rm -rf /tmp/apkstage; \
            fi
        # Cài đặt trình duyệt và công cụ đọc PDF
        RUN apk update && apk add --no-cache poppler-utils chromium nss freetype harfbuzz ca-certificates ttf-freefont
        USER node
```

---

## 3. Quy Trình Vận Hành & Bảo Trì (SOP)

### 3.1. Quy trình nâng cấp n8n an toàn (Safe Upgrade)
Khi cần lên phiên bản mới, **BẮT BUỘC** thực hiện qua SSH với các bước sau:

**Bước 1:** Kết nối SSH vào VPS.
**Bước 2:** Chỉnh sửa file Docker Compose:
```bash
nano /opt/n8n/docker-compose.yml
```
*Tìm dòng `FROM docker.io/n8nio/n8n:2.37.6` trong cả 2 block `n8n` và `n8n-worker`, sửa thành phiên bản mới nhất (VD: `2.38.0`).*

**Bước 3:** Rebuild lại Image không dùng cache và khởi động lại:
```bash
cd /opt/n8n
docker compose build --no-cache n8n n8n-worker
docker compose rm -sf n8n n8n-worker  # Bắt buộc xóa container cũ để tránh xung đột tên
docker compose up -d
```

### 3.2. Quản lý Tool Facebook Auto Posting (Local Script)
Script Facebook nằm ở phân vùng mount của Docker (`n8n_data`).
* **Vị trí trên VPS (Host):** `/var/lib/docker/volumes/n8n_n8n_data/_data/facebook auto posting 2.0`
* **Vị trí bên trong n8n (Container):** `/home/node/.n8n/facebook auto posting 2.0`

**Quy trình xử lý khi script báo thiếu thư viện (NPM Missing Module):**
Vào thẳng container và chạy `npm install`:
```bash
docker exec -it n8n-n8n-1 sh -c 'cd "/home/node/.n8n/facebook auto posting 2.0" && npm install'
```

### 3.3. Truy cập CSDL Postgres (Emergency Rollback)
Nếu cần sửa trực tiếp dữ liệu (VD: Lỗi sai folder, crash schema), truy cập Database:
```bash
# Lấy user/password trong file .env
cat /opt/n8n/.env | grep POSTGRES

# Truy cập Postgres (Thay user tương ứng)
docker exec -it n8n-postgres-1 psql -U [user_trong_env] -d n8n
```
*Ghi chú: Toàn bộ workflow nằm trong bảng `workflow_entity`. Cấu trúc thư mục nằm ở `project` và liên kết thông qua `parentFolderId`.*

---

## 4. Nhật Ký Sự Cố (Troubleshooting Logs)

* **Sự cố ngày 31/08/2026 (Nâng cấp thất bại do xung đột container):** Khi rebuild Docker Compose, Docker daemon không thể thay thế container do lỗi conflict name (container cũ bị giữ lại dạng zombie hoặc trùng alias). *Khắc phục:* Phải dùng lệnh `docker compose rm -sf` và `docker rm -f` để ép xóa toàn bộ container liên quan trước khi `docker compose up -d`.
* **Sự cố ngày 31/08/2026 (Lỗi `apk not found`):** Các bản n8n mới (từ 1.x trở đi) sử dụng Hardened Alpine image bị loại bỏ hoàn toàn Package Manager (`apk`). *Khắc phục:* Đã áp dụng script chèn tải file `apk-tools-static` tĩnh (đã được bọc trong file `docker-compose.yml` hiện tại).

---
*Tài liệu này được tạo vào: 31/08/2026 bởi AI Agent. Bất kỳ sự thay đổi cấu trúc nào trên VPS cần được cập nhật ngay vào đây.*
