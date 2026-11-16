# Tài khoản, an ninh và sự cố trong quán

## Hành vi mới

Trang đầu là màn hình đăng nhập/đăng ký theo bố cục ảnh: nền quán minh họa riêng, bảng hiệu HTML, Mây, thẻ kem và các ô nhập/nút thật. Nền và nhân vật dùng artwork mới; không đặt vùng bấm giả lên ảnh form. Asset được nén WebP (nền khoảng 319KB, nhân vật khoảng 350KB).

Đăng nhập/đăng ký có phiên thành công tự tải game từ server; reload khôi phục phiên và tiến trình. Cùng tài khoản dùng cùng dữ liệu trên thiết bị/mạng khác, không gắn với IP. Dữ liệu server được kiểm soát bằng user ID đã xác thực, revision và giao dịch server; browser không tự gửi số tiền để ghi đè. Lỗi mạng/xung đột dừng giao dịch và yêu cầu tải lại bản server, không âm thầm chơi bằng save guest. Guest là lựa chọn riêng, giữ nguyên dữ liệu IndexedDB cũ.

## Quy tắc sự cố

| Hạng mục | Quy tắc |
| --- | --- |
| Trộm | 35% mỗi ngày; tối đa một lần/ngày. Có thể xảy ra hai ngày liên tiếp. Lấy 10% số dư lúc xảy ra, làm tròn xuống đồng. |
| Khóa chống trộm | 20.000đ, chặn toàn bộ mất tiền trong ngày mua; hết hạn khi sang ngày tiếp theo, cần mua lại. |
| Camera | 50.000đ, dùng đúng 10 ngày gồm ngày mua. Ví dụ mua ngày 4 dùng hết ngày 13; ngày 14 cần mua lại. Chỉ thu hồi một lần cho vụ trộm trong ngày mà camera đang ghi hình; mua camera sau sự cố không tạo lại hình ảnh trước đó. |
| Két tiền | 70.000đ, vĩnh viễn; khi không có khóa thì thiệt hại tối đa 5% số dư lúc bị trộm. |
| Mất điện | 20% mỗi ngày, một lần lúc đang pha. Quán tối, có đếm ngược 60 giây hoạt động; ly và khách được giữ nguyên. Hết đếm ngược quầy hoạt động lại. Tạm dừng game cũng tạm dừng đếm ngược. |
| Máy phát | 60.000đ, vĩnh viễn; quầy vẫn hoạt động khi mất điện. Có thể mua ngay trong thông báo sự cố nếu đủ tiền. |
| Hỏng máy | Xác suất mặc định 15% mỗi ngày, tối đa một lần khi đang pha. Người dùng chưa chỉ định tỷ lệ, nên chọn mức này và ghi rõ tại đây. |
| Sửa máy | 50.000đ/lần, khôi phục máy chính và giữ ly đang làm; bấm lại không trừ thêm tiền nếu máy đã sửa. |
| Máy dán nắp dự phòng | 25.000đ, vĩnh viễn; mua lúc máy hỏng để tiếp tục hoặc mua trước để tự tiếp quản. |

Mỗi rủi ro được rút riêng cho ngày đó và lưu vào save; reload không rút lại để né sự cố hoặc gây mất tiền hai lần. Game mới sử dụng seed ngẫu nhiên riêng; seed cố định chỉ phục vụ QA. Các câu chuyện ngẫu nhiên khác vẫn hoạt động theo lịch riêng, không sinh thêm bản trộm/mất điện/hỏng máy trùng với hệ thống mới.

Chi phí trộm/sửa được ghi sổ và phản ánh trong lợi nhuận ngày. Khóa/camera/máy là khoản đầu tư mua thiết bị trong nhật ký. Thiếu tiền không trừ một phần; có thể kết sổ để dùng cơ chế vay vốn khôi phục ở ngày tiếp theo.

## Âm thanh

Rót trà dùng chuỗi tiếng bọt nước và nhiễu lọc cộng hưởng để tạo âm “ọt ọt”, chạy trong thời gian giữ rót và dừng khi thả/tạm dừng/mất điện/tắt âm. Dán nắp dùng bốn tiếng ma sát lọc tạo âm “két két”. Đây là âm tổng hợp Web Audio, không phải bản thu máy thực tế.

## Save và backend

Save cũ giữ số tiền, kho và tiến trình; trường `incidents` là phần mở rộng có validation. Người đã sở hữu khóa/camera cũ được chuyển sang thời hạn mới từ ngày hiện tại khi nạp lần đầu; két/máy phát/máy dự phòng giữ quyền sở hữu. Không reset dữ liệu. Bộ reducer dùng chung cho frontend và Edge Function cần được cập nhật cùng phiên bản:

```sh
npm ci
npm run build:server
npm run typecheck
npm run lint
npm run test
npm run test:e2e
npm run test:accounts
npm run build
npm run test:smoke
```

Thiết lập dịch vụ thật: [docs/ACCOUNTS.md](docs/ACCOUNTS.md). Cần `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, migration và Edge Function đã triển khai. Không đưa service-role key vào frontend.

## Phạm vi xác minh

Các kết quả cuối và ảnh được ghi trong `evidence/account-incidents/`. Kiểm thử tài khoản trình duyệt dùng server mô phỏng; chưa có cấu hình Supabase hoặc quyền Vercel trong môi trường để kiểm thử dịch vụ thật. Không tuyên bố email, RLS triển khai hay đồng bộ production đã đạt khi chưa thực hiện các kiểm tra đó.

Ảnh giao diện ở `screenshots/accounts-login-*`, `screenshots/accounts-register-*`; sự cố ở `screenshots/update-blackout-390x844.png` và `screenshots/update-machine-repair.png`. Artwork nền/nhân vật bám theo ảnh tham chiếu nhưng không khẳng định giống từng pixel; form có thêm nút hiện mật khẩu và thông báo lỗi để thao tác thực tế.

### Kết quả kiểm tra cuối

- TypeScript và ESLint: đạt.
- Unit/integration: **93/93** đạt (9 file), gồm kiểm tra tỷ lệ trộm/mất điện trên 10.000 seed, thời hạn thiết bị, trừ/thu hồi tiền đúng một lần, sự cố, save và âm thanh.
- Toàn bộ gameplay E2E: **27/27** đạt. Sau khi bổ sung nút thu hồi camera trong mục Sự kiện, chạy lại riêng **4/4** E2E sự cố đạt (ba ca đã có và một ca mới); không tính các lần chạy trùng thành ca mới.
- Hợp đồng tài khoản trình duyệt: **6/6** đạt với dịch vụ mô phỏng, gồm cùng tài khoản/hai thiết bị, hai tài khoản độc lập, mất mạng/tải lại, sai mật khẩu và backend lỗi không rơi sang guest; có ảnh responsive 360×800, 390×844, 430×932, 1440×900.
- Production build và smoke test: đạt; smoke mua vật tư, mua thiết bị bảo vệ, rót, dán, giao, reload IndexedDB, không gọi CDN lúc chơi và xác nhận QA bridge không có trong production.
- Bản JavaScript đầu khoảng 432KB (gzip 138KB); Phaser tải ở chunk riêng khoảng 1.49MB. Artwork WebP tải riêng.

Đã sửa lỗi thông báo sự cố che nút kết sổ/đóng modal trong lần kiểm thử đầu. Thông báo hiện ở vùng lời chào, dưới modal và không chặn thao tác qua phần chữ. Đã bổ sung cách thu hồi qua camera trong Sự kiện sau khi người chơi đóng thông báo.

Chưa kiểm thử Supabase thật, email thật, SQL/RLS trên project thật hoặc deploy Vercel vì môi trường không có cấu hình/quyền truy cập các dịch vụ đó. Không coi các test mô phỏng là bằng chứng triển khai online thành công.

## Ảnh chủ tiệm và phản hồi đăng nhập

Đã thay nhân vật trên trang tài khoản bằng chibi chủ tiệm cầm trà sữa tại `public/assets/owner-chibi.webp`, dùng ảnh do người dùng yêu cầu tạo. Ảnh nền trong suốt, tối ưu WebP; ảnh màn hình đăng nhập/đăng ký đã được cập nhật.

Đã sửa nút đăng nhập/đăng ký không phản hồi khi thiếu Supabase: nút không còn bị vô hiệu hóa âm thầm, bấm sẽ hiện giải thích rõ trong thẻ form. Có trạng thái đang đăng nhập/đăng ký, thông báo xác nhận email, lỗi rõ ràng và tự mở game khi xác thực và tải save server đều thành công. Không tạo tài khoản giả trên localStorage hoặc hiển thị đăng ký thành công khi dịch vụ chưa cấu hình.

Xác minh bản sửa: 7/7 E2E tài khoản với server mô phỏng, 1/1 E2E khi chưa cấu hình, typecheck, lint và production build đạt. Log ở `evidence/owner-login/`. Chưa có Supabase project/configuration trong môi trường để kiểm thử đăng ký/email/đồng bộ trên dịch vụ thật; chủ game cần tạo project, chạy migration/function và điền `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` trên Vercel theo `docs/ACCOUNTS.md` rồi redeploy.
