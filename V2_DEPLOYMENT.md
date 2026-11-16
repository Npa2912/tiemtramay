# Chạy và triển khai Tiệm Trà Mây 2.0

## Local

Yêu cầu Node.js 22 LTS trở lên. Môi trường cloud hiện kiểm thử bằng Node.js 24.22.1 / npm 11.9.0 và Chromium tại `/usr/bin/chromium`.

```sh
cd /workspace/tiemtramay
npm ci
npm run dev -- --port 5173
```

Game có thể chơi ở chế độ khách và lưu IndexedDB khi chưa cấu hình dịch vụ tài khoản. Không xóa dữ liệu site hoặc reset game nếu cần giữ save cũ. Xuất JSON trong Cài đặt để sao lưu hoặc chuyển trình duyệt.

## Build và kiểm thử

```sh
npm run typecheck
npm run lint
npm run test
npm run test:e2e
npm run build
npm run test:smoke
```

Playwright dùng `/usr/bin/chromium` nếu có; trên máy khác chạy `npx playwright install chromium`, hoặc đặt `CHROMIUM_PATH` trỏ đến Chromium đã cài. Bản production phải được phục vụ qua HTTP; không mở trực tiếp `dist/index.html` bằng `file://`.

## Vercel

1. Import repository GitHub vào Vercel, chọn framework Vite.
2. Root Directory: thư mục chứa `package.json` (root repository).
3. Install Command: `npm ci`; Build Command: `npm run build`; Output Directory: `dist`.
4. Chọn Node.js 22 hoặc 24 được Vercel hỗ trợ.
5. Nếu dùng tài khoản online, cấu hình biến public Supabase và dịch vụ backend theo tài liệu tài khoản đi kèm trước khi build.
6. Đặt Site URL và danh sách redirect hợp lệ trong Supabase Auth theo domain Vercel thực tế để xác minh email và đặt lại mật khẩu.
7. Sau deploy, chạy lại các luồng đăng nhập, reset mật khẩu, pha chế, lưu/tải lại và kiểm tra console trên URL triển khai thực tế.

Không đưa `service_role` key vào biến `VITE_*`, source code, GitHub hoặc frontend. Một build local thành công chưa xác nhận Vercel đã được triển khai và kiểm thử.

## Dữ liệu và bảo trì

Vốn 1.000.000đ chỉ áp dụng khi tạo game mới; save cũ giữ số dư. Không reset save để áp dụng vốn mới. IndexedDB gắn với origin, nên hai địa chỉ deploy khác nhau không tự chia sẻ save local.

Đọc báo cáo `V2_QA_REPORT.md` để phân biệt kiểm thử đã chạy với phần cần dịch vụ online thật. Hãy giữ môi trường thử nghiệm và tài khoản kiểm thử tách khỏi dữ liệu người dùng.

## Supabase

Hướng dẫn chi tiết: [`docs/ACCOUNTS.md`](docs/ACCOUNTS.md). Hai biến frontend cần thiết là `VITE_SUPABASE_URL` và `VITE_SUPABASE_ANON_KEY`. Chạy migration `supabase/migrations/202611160001_accounts.sql`, cấu hình `APP_ORIGIN` cho Edge Function, đóng gói reducer dùng chung và deploy function `game` theo tài liệu đó.

Các biến public chỉ cấu hình đường kết nối; chúng không tự tạo database, chính sách RLS, tài khoản thử nghiệm hoặc đảm bảo đồng bộ thành công. Chỉ bật nguồn dữ liệu server cho gameplay sau khi kiểm thử transaction, chống request giả, phân tách hai tài khoản và xung đột hai thiết bị trên dự án Supabase thật. Không chuyển tiền từ save local thành số dư đáng tin cậy trên server mà thiếu chính sách nhập dữ liệu rõ ràng.
