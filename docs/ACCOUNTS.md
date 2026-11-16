# Tài khoản Supabase — cấu hình và giới hạn

## Trạng thái bàn giao

Frontend có đăng ký, đăng nhập, xác minh email theo cấu hình Supabase, khôi phục/đặt lại mật khẩu, duy trì và làm mới phiên, đăng xuất, hồ sơ và đổi tên chủ quán. Không lưu mật khẩu. Token phiên theo cơ chế browser được giữ trên origin hiện tại; cần tránh XSS và bật chính sách mật khẩu/rate limit của Supabase.

**Chưa có dự án Supabase hoặc môi trường Vercel để xác minh thực tế. Không được coi tài khoản, email hay đồng bộ đa thiết bị đã qua kiểm thử tích hợp.** Gameplay mặc định chạy bằng IndexedDB. Sau đăng nhập, nút “Chơi online” chuyển sang tiến trình riêng trên máy chủ; giao dịch chỉ cập nhật sau phản hồi server. Đăng nhập không tự động biến save local thành save server và không tự ghi đè tiến trình cũ.

SQL có RLS, quyền đọc đúng tài khoản, đổi tên riêng và RPC commit chỉ dành cho service-role. Edge Function tạo save server mới đúng 1.000.000đ một lần, chạy reducer từ mã nguồn thay vì tin số dư/snapshot trình duyệt, dùng revision CAS và request ID chống ghi đè/nhận thưởng lặp. Hạ tầng và transport trong store đã kết nối qua chế độ opt-in, nhưng cần triển khai và kiểm thử thật trước khi xác nhận online hoạt động. Không bật đồng bộ snapshot toàn bộ save client: cách đó cho phép sửa tiền tùy ý.

## Thiết lập dự án thử nghiệm

1. Tạo Supabase project riêng cho thử nghiệm. Bật Email Auth, email confirmation, thiết lập Site URL và Redirect URLs cho domain Vercel chính thức và localhost dùng khi phát triển. Dùng SMTP riêng nếu cần email ổn định.
2. Chạy `supabase/migrations/202611160001_accounts.sql` qua migration workflow của Supabase. Kiểm tra trigger tạo hồ sơ.
3. Chỉ cấu hình public URL và anon/publishable browser key vào Vercel và local environment:

   ```dotenv
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_ANON_KEY=your-public-anon-key
   ```

   Không đưa `SUPABASE_SERVICE_ROLE_KEY` vào bất kỳ biến `VITE_` nào. Không commit `.env.local` hoặc key thật. Public key vẫn cần RLS; key không thay thế authorization.
4. Từ `/workspace/tiemtramay`, tạo lại shared reducer sau mọi thay đổi engine/catalog:

   ```sh
   ./node_modules/.bin/esbuild src/engine.ts --bundle --format=esm --platform=neutral --outfile=supabase/functions/_shared/engine.js
   ```

5. Deploy Edge Function `game` bằng Supabase CLI đã đăng nhập vào project thử nghiệm. Đặt secret `APP_ORIGIN` thành origin chính xác của frontend. Supabase cung cấp URL/service-role cho Edge runtime; không chuyển service-role sang browser. Deploy migration và function cùng phiên bản reducer frontend.
6. Khởi động lại Vite hoặc build Vercel sau khi thay đổi `VITE_` variables.

## Kết nối chế độ online an toàn

`src/account/client.ts` cung cấp `cloudAction(action, revision, requestId?)` và `cloudAction(null, null)` để đọc/tạo save server. Response là `{state, revision}`. Chỉ áp dụng state sau phản hồi server thành công; không thực hiện giao dịch tiền local trước rồi coi là thành công. Giữ request ID khi retry cùng lệnh. Gặp HTTP 409 phải tải lại bản server và cho người chơi quyết định tiếp tục; không âm thầm ghi đè. Dùng queue tuần tự, gộp tick/pour phù hợp độ trễ mạng, hiển thị trạng thái sync và khóa giao dịch online khi ngoại tuyến. Tick/pour thời gian do server tính, không dùng dt client làm nguồn tin.

UI mặc định giữ chế độ chơi local. Nút “Chơi online” chỉ khả dụng khi có cấu hình và đăng nhập. Lỗi đồng bộ dừng lệnh mới; nút tải lại online đọc bản server. Thoát online hoặc đăng xuất khôi phục snapshot guest, không ghi đè guest bằng cloud. Cơ chế queue/coalescing có unit test bằng mock, chưa được xác minh với độ trễ máy chủ thật. Legacy save local không có chữ ký nên không thể được nhập thành số dư server đáng tin cậy mà vẫn bảo đảm chống sửa tiền. Cần chính sách xác minh/import rõ ràng; giữ backup, hiển thị preview, xác nhận và không xóa bản local. Chưa triển khai import legacy online.

## Kiểm thử bắt buộc trước phát hành online

- Hai user thử nghiệm: đăng ký/xác minh email, login đúng/sai, reset password, logout và restore session.
- User A không đọc/đổi profile/save B, kể cả request REST thủ công.
- Client không ghi trực tiếp game_saves, không gọi commit RPC bằng anon/access token.
- Save mới đúng 1.000.000đ; reconnect/login không cấp lại vốn.
- Hai request chung revision chỉ một commit; retry chung ID không nhận thưởng lại.
- Request chứa money/state tùy ý không được sử dụng; mua không đủ tiền không đổi kho.
- Hai thiết bị, hết phiên, mất mạng, retry timeout, xung đột và cache tài khoản riêng.
- Đổi tên phải hiện ở toàn bộ giao diện và hội thoại sau khi tích hợp profile vào thanh trạng thái.
- Test timestamp/pour với latency thực; offline progression phải có chính sách server riêng trước khi bật.

Unit tests local (tests/account.test.ts, tests/cloud-security.test.ts, tests/cloud-store.test.ts) xác minh validation tên/mật khẩu, chặn request không có auth, không tin user ID/số dư client, CAS/idempotency ở transport, giữ guest save và dừng khi sync lỗi bằng mock. Các test này không thay thế kiểm thử SQL/RLS/RPC thật trên Supabase/Vercel.
