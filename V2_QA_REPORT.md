# Tiệm Trà Mây 2.0 — bằng chứng QA

Ngày kiểm tra: 16/11/2026. Môi trường: Linux, Node.js 24.22.1, npm 11.9.0, Chromium headless `/usr/bin/chromium`. Báo cáo này mô tả đúng phạm vi đã chạy; các báo cáo cũ trong repository phản ánh những lần kiểm tra trước.

## Kiểm tra đã xác minh

- Trước thay đổi: 27 unit/integration test hiện có chạy đạt.
- `npx vitest run tests/v2.test.ts`: 11/11 đạt sau sửa sinh đơn theo kho. Kiểm tra vốn mới đúng 1.000.000đ, import save cũ giữ 456.000đ / ngày 15, không cấp lại vốn khi đổi ngày, chọn đơn không đổi cặp ly/khách đang pha, 40 seed không sinh trà đã mở nhưng hết kho, năm chiến lược 30 ngày và đối soát lợi nhuận/nhật ký khi tip sự kiện nằm trong đơn cuối ngày.
- `npx playwright test tests/e2e/v2.spec.ts`: lần xác minh responsive đầu tiên đạt 6/6, gồm năm viewport và chọn đơn thực tế. Mỗi viewport nhập đủ tám nhóm vật tư qua UI, mở cửa, chọn ly, giữ/thả phím Space để rót trà. Kiểm tra không cuộn trang, bảy nút điều hướng hiện đủ và các nút trà/rót/dán/giao/bỏ ly nằm trong viewport. Không ghi nhận pageerror/console error trong năm luồng này.
- Đã phát hiện và sửa lỗi cascade CSS, nội dung bị cắt ngang, tên truy cập nút bị lẫn emoji và biên nhận cuối ngày thiếu tip sự kiện trong quá trình kiểm tra. Các kết quả trước sửa không được tính là đạt.

Hai E2E tiến trình bổ sung đạt 2/2: nhận thưởng nhiệm vụ đúng một lần, tuyển/đào tạo nhân viên và tải lại giữ cấp độ; sự kiện sinh tự nhiên được xử lý qua UI và ghi nhật ký. Bộ unit/integration đầy đủ: 77/77 đạt, 7 file test, gồm kiểm tra sao lưu trước migration và 15 test tài khoản/transport/store bằng mock. `npm run typecheck`, `npm run lint`, production build và smoke gameplay production đạt trong lần kiểm tra cuối của agent chính. Smoke thực hiện mua, rót, dán nắp, giao, reload IndexedDB, loại QA bridge khỏi production và không cần runtime CDN. Full E2E cuối: **24/24 đạt trong 2,4 phút** (`npx playwright test --reporter=list`), không có test bỏ qua. Luồng phóng to lựa chọn pha chế trên mobile dùng nút cao ít nhất 44px, thao tác hương/đường/đá cập nhật ly thật và giữ nguyên khi đóng modal.

Kiểm tra browser dài hạn chạy 35 ngày với IndexedDB thật: cả 35 ngày hoàn thành, reload tiếp tục ngày 36; sau garbage collection, heap tăng 5.149.216 byte (ngưỡng kiểm thử 16 MiB). Đây là quan sát trên một lần chạy Chromium, chưa chứng minh hiệu năng mọi thiết bị.

## Ảnh giao diện thật

Ảnh từ trình duyệt khi đang chơi, sau nhập kho và rót trà; không phải mockup hoặc ảnh tham chiếu phủ vùng bấm:

| Viewport | Ảnh |
| --- | --- |
| 360 × 800 | [Mobile nhỏ](screenshots/v2-360x800.png) |
| 390 × 844 | [Mobile](screenshots/v2-390x844.png) |
| 430 × 932 | [Mobile lớn](screenshots/v2-430x932.png) |
| 768 × 1024 | [Tablet](screenshots/v2-768x1024.png) |
| 1440 × 900 | [Desktop](screenshots/v2-1440x900.png) |

Ảnh bổ sung: [Lựa chọn pha chế phóng to, 360 × 800](screenshots/v2-brew-options-360x800.png) và [Tài khoản khi chưa cấu hình Supabase, 360 × 800](screenshots/v2-account-360x800.png). Ảnh tài khoản chứng minh giao diện và trạng thái thiếu cấu hình; không phải bằng chứng đăng nhập thành công.

Ảnh được đối chiếu bằng mắt với ảnh người dùng cung cấp trong cuộc hội thoại. Bố cục giữ bảng gỗ, mái hiên hồng kem, Mây, mục tiêu, sáu món, hai cột phục vụ, topping, banner sự kiện và thanh điều hướng đáy. Không xác nhận mức tương đồng 90%: minh họa SVG đơn giản hơn ảnh mẫu; ảnh mẫu có độ chi tiết, ánh sáng, cây hoa và đồ uống phong phú hơn. Các lựa chọn hương/đường/đá được dời xuống ngăn topping để vừa viewport. Ở màn hình nhỏ, chữ và một số nút trên quầy vẫn nhỏ; nút **Phóng to lựa chọn** mở bảng topping/hương/đường/đá có nút cao ít nhất 44px. Cần đánh giá thêm khả năng đọc và thao tác bằng tay trên thiết bị thật.

## Mô phỏng cân bằng: năm chiến lược × 30 ngày

Dùng seed 1234, reducer thật và kho thật. Bot không đại diện thao tác của người thật. Mỗi chiến lược giải quyết sự kiện có lựa chọn miễn phí phù hợp; reload JSON giữa ngày để kiểm tra trạng thái hợp lệ. Mọi ngày kiểm tra invariant, không âm kho và dữ liệu lưu hợp lệ.

| Chiến lược | Phục vụ / bỏ lỡ | Tiền cuối ngày 30 | Tiền thấp nhất | Lợi nhuận/ngày trung bình | Sự kiện đã xử lý |
| --- | ---: | ---: | ---: | ---: | ---: |
| Người mới: chậm 120 giây mỗi 3 đơn | 220 / 155 | 4.468.300đ | 847.700đ | 122.271đ | 6 |
| Tiết kiệm: giữ menu cơ bản | 375 / 0 | 8.352.000đ | 929.600đ | 252.024đ | 6 |
| Ưu tiên nâng cấp: mua thiết bị và mở menu | 375 / 0 | 10.179.200đ | 599.500đ | 347.678đ | 6 |
| Hay mắc lỗi: sai trà xen kẽ | 375 / 0 | 5.908.940đ | 860.960đ | 169.105đ | 6 |
| Nhiệm vụ: mở menu, nhận thưởng đủ điều kiện | 375 / 0 | 7.560.600đ | 950.500đ | 230.928đ | 6 |

Chiến lược nhiệm vụ nhận 76 phần thưởng, không nhận trùng; chiến lược sai trà có 195 đơn chính xác và uy tín về 1. Không chiến lược nào phá sản trong mô phỏng này. Kinh tế vẫn rộng rãi: ngay cả người chơi bỏ lỡ nhiều hoặc pha sai vẫn tích lũy tiền đáng kể. Đây là giới hạn cân bằng cần playtest và điều chỉnh thêm; không chứng nhận cân bằng phát hành thương mại. Thời gian rót chuẩn của bot khoảng 2,66 giây cộng thời gian máy dán; phần lớn thời gian chọn nguyên liệu không được bot mô phỏng.

## Tài khoản, bảo mật và triển khai

Có kiểm thử local cho validation, cấu hình chưa sẵn sàng, transport/server command bằng mock và luồng store online bằng mock. Những kiểm thử này không thay thế Supabase thật.

Chưa có Supabase project/biến cấu hình/tài khoản test được cung cấp trong môi trường. Chưa thực hiện đăng ký, xác minh email, đăng nhập đúng/sai, khôi phục mật khẩu, SQL/RLS thực tế, phân tách hai tài khoản, đồng bộ hai thiết bị hoặc xung đột trên dịch vụ thật. Chưa deploy và kiểm thử trên Vercel. Không tuyên bố tài khoản/lưu online đạt nghiệm thu đầy đủ. Hướng dẫn cấu hình: [docs/ACCOUNTS.md](docs/ACCOUNTS.md), [V2_DEPLOYMENT.md](V2_DEPLOYMENT.md).

Chưa nhập save local cũ vào tài khoản online vì cần chính sách xác minh dữ liệu nhập; save cũ trên thiết bị được giữ nguyên. Không cho phép upload một số dư local tùy ý và coi đó là số dư được server xác minh.

Chưa chứng nhận iOS/Safari, Android vật lý, hiệu năng thiết bị yếu, toàn bộ animation theo ảnh mẫu hoặc chơi offline lần truy cập đầu tiên. Không có service worker.
