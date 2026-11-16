# Triển khai bằng Supabase Dashboard

`game.ts` là bản tạo tự động, chứa đầy đủ mã của hàm `game` và game engine trong một file, không cần import file khác. Không sửa trực tiếp; tạo lại bằng `npm run build:dashboard` sau khi thay đổi engine hoặc backend.

1. Trong Supabase, mở **Edge Functions → Deploy a new function → Via Editor**.
2. Đặt tên hàm là **game**.
3. Thay toàn bộ nội dung file `index.ts` trong editor bằng nội dung `game.ts` tại thư mục này, rồi deploy.
4. Trong **Edge Functions → Secrets**, thêm `APP_ORIGIN` = `https://tiemtramay.vercel.app` (không có dấu `/` cuối).
5. Nếu trang quản lý hàm có mục **Verify JWT with legacy secret**, tắt riêng bước kiểm tra JWT cũ của gateway cho hàm `game`. Mã hàm vẫn bắt buộc xác thực phiên bằng Supabase Auth `/auth/v1/user` trước khi đọc/ghi dữ liệu; request không đăng nhập bị trả về 401. Điều này hỗ trợ publishable API keys và cơ chế ký JWT hiện tại.
6. Supabase cung cấp `SUPABASE_URL` và `SUPABASE_SERVICE_ROLE_KEY` cho môi trường Edge Function. Không đưa service-role/secret key vào Vercel frontend.
7. Redeploy frontend Vercel sau khi lưu hai biến public `VITE_SUPABASE_URL` và `VITE_SUPABASE_ANON_KEY`.

File SQL migration phải được áp dụng trước. Kiểm tra lại bằng tài khoản thử nghiệm, đăng nhập hai trình duyệt và đọc Function Logs khi lỗi. Bundle đã được kiểm tra cục bộ: không còn import ngoài, CORS theo APP_ORIGIN và từ chối request chưa xác thực; điều đó chưa xác nhận Supabase production đã triển khai thành công.
