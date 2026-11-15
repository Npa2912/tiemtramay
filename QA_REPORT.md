# QA_REPORT · Tiệm Trà Mây

**Trạng thái: NOT RELEASE READY theo toàn bộ brief gốc.** Gameplay và các kiểm thử thực hiện dưới đây đã đạt. Chưa có ảnh tham chiếu để đối chiếu và xác nhận bố cục/độ chi tiết theo yêu cầu; quầy hiện có cuộn dọc ở màn hình thấp, chưa chứng nhận trải nghiệm vừa toàn bộ một khung 9:16. Không coi thiếu kiểm chứng là đạt tiêu chí.

## Môi trường và thời gian

- Kết thúc lượt kiểm thử nguồn: 2026-11-15 16:26:53 UTC+07:00 (Asia/Bangkok).
- Managed Linux Debian 13, Node v24.22.1, npm 11.9.0, Chromium 156.0.8078.79 headless, Playwright.
- React/TypeScript/Vite, Phaser Canvas, Zustand, Dexie IndexedDB. Phiên bản chính xác trong package-lock.json.
- Các lần kiểm thử là chạy lệnh và điều khiển browser bằng Playwright. Không có playtest độc lập bởi con người và không có thiết bị iOS/Android vật lý.

## Lệnh và kết quả đã thực hiện

| Lệnh | Kết quả | Bằng chứng |
| --- | --- | --- |
| npm run typecheck | PASS | evidence/typecheck.log |
| npm run lint | PASS | evidence/lint.log |
| npm run test | 27/27 PASS, 0 fail | evidence/unit.log |
| npm run test:e2e | 14/14 PASS, 0 fail, 0 skip | evidence/e2e.log; evidence/e2e-results.json |
| npm run build | PASS | evidence/build.log |
| npm run test:smoke | PASS trên dist production | evidence/smoke.log |

Tổng **41 test tự động đạt, 0 test hỏng** trong lượt cuối, cộng 1 smoke script production. Không cộng các lệnh lint/build thành test. Kết quả cài sạch và build sau giải nén được bổ sung trong PACKAGE_VERIFICATION.md sau bước đóng gói; thông tin hash của ZIP cuối nằm trong tệp kiểm chứng bàn giao ngoài ZIP.

## Nội dung kiểm thử

Unit/integration (27): catalog 36 công thức/20 khách; vốn khởi đầu; mua thật/capacity/spam mua/thiếu tiền; vốn vay và nợ; hết hạn; nâng cấp; chưa đủ ly không giao; giao liên tục không cộng tiền hai lần; rót theo thời gian và dừng khi không có thao tác giữ; hết ly/trà/topping; thiếu topping/thiếu trà/chưa dán nắp; chấm sai trà/size/rót thiếu/rót quá; tạm dừng và khách rời hàng; bỏ ly không hoàn vật tư; đơn chỉ dùng lựa chọn đã mở; đúng/sai ảnh hưởng thu nhập và danh tiếng; deterministic seed; 35 ngày; stress 1000 thao tác; chặn input không hợp lệ; nhân viên thực sự rút ngắn thời gian nắp và nhận lương; khôi phục từ vốn 0; IndexedDB ghi/đọc ly đang pha; ghi tuần tự giữ snapshot mới nhất; migration thật v1→v2; từ chối save hỏng.

E2E (14): mua 8 loại nguyên liệu, mở cửa, pha bằng pointer hold/release, dán nắp và giao; 2 khách rồi đóng sớm, tổng kết, nâng máy, sang ngày và reload; 6 viewport mở/đóng tất cả 5 cửa sổ quản lý, kiểm tra không tràn ngang, asset HTTP errors và uncaught exceptions; pause/reload ly đang pha; xuất JSON, reset xác nhận, nhập lại JSON và từ chối file hỏng; trang trí được lưu; rót bằng bàn phím; mô phỏng sự kiện ẩn tab; phục vụ đủ 5 khách ngày đầu và tự đóng ngày; touchStart/touchEnd thật qua Chromium CDP và multitouch; 35 ngày trong browser với mỗi ngày ghi/đọc IndexedDB, reload ngày 36 rồi nhập bù nguyên liệu hết hạn và mở cửa tiếp. Hook của suite bắt console.error và pageerror trên page fixture.

Smoke production: dùng dist, nhập kho, chọn trà, giữ/thả, thêm topping/hương/đường/đá, dán nắp, giao, reload giữ ví; chỉ cho phép tải từ local origin; QA bridge không tồn tại kể cả với ?qa=1.

## Responsive và quan sát ảnh

Đã chạy thực tế ở **360×640, 375×667, 390×844, 412×915, 768×1024, 1366×768**. Không tràn ngang; nút đóng cửa sổ vẫn trong viewport, nội dung cửa sổ cuộn được. Đã xem ảnh thực tế để sửa vị trí nhãn mực trà khỏi vùng ly. Đây là responsive browser, không phải chứng nhận thiết bị vật lý. Có cuộn dọc của trang trên màn hình thấp.

Ảnh đã tạo:

- [screenshots/1366x768.png](screenshots/1366x768.png)
- [screenshots/360x640.png](screenshots/360x640.png)
- [screenshots/375x667.png](screenshots/375x667.png)
- [screenshots/390x844.png](screenshots/390x844.png)
- [screenshots/412x915.png](screenshots/412x915.png)
- [screenshots/768x1024.png](screenshots/768x1024.png)
- [screenshots/day1-summary.png](screenshots/day1-summary.png)
- [screenshots/day36-after-longrun.png](screenshots/day36-after-longrun.png)
- [screenshots/drink-sealed.png](screenshots/drink-sealed.png)
- [screenshots/gameplay-day2.png](screenshots/gameplay-day2.png)
- [screenshots/open-empty-shop-guidance.png](screenshots/open-empty-shop-guidance.png)

## Mô phỏng dài hạn và bộ nhớ

Seed 1234, 35 ngày, bot pha đúng, không mô phỏng thời gian tay người. Mỗi ngày kiểm tra finite values, kho không âm, đơn không trùng, hàng chờ không kẹt, thanh toán không lặp; lưu và đọc IndexedDB thật. Sau reload ngày 36 có thể nhập hàng và mở cửa.

Chromium JSHeapUsedSize sau GC: trước **9,549,408 byte**, sau **10,585,432 byte**, chênh **1,036,024 byte**. Test giới hạn tăng dưới 16 MiB đã đạt. Đây là một cửa sổ 35 ngày, không chứng minh tuyệt đối không leak hoặc bao gồm GPU memory.

## Lỗi phát hiện và cách sửa

| Vấn đề | Tái hiện / nguyên nhân | Cách sửa và kiểm chứng |
| --- | --- | --- |
| Bot mua đồ chưa mở, thiếu tiền mua ly/nắp | Chuẩn bị kho ngày 1, mua toàn bộ catalog | Lọc theo mở khóa và giữ dự trữ phù hợp; 35 ngày qua |
| Bot dự trữ ít khi khách tăng | Các ngày sau 12 khách, thiếu vật tư, có khách rời hàng | Nhập khi dưới 20 phần; giữ nguyên test đủ target khách |
| Autosave bị trì hoãn mãi | Tick liên tục reset debounce; reload quay về ngày 1 | Throttle lưu snapshot mới nhất mỗi ~500ms, no-op tick không tạo state mới; E2E reload qua |
| Nhật ký quá giới hạn làm save bị từ chối ở ngày 26 | Giao dịch đã chạm 600 mục, hết hạn thêm bản ghi bằng push riêng | Dùng cùng hàm log có cắt giới hạn; unit regression tái hiện trước sửa tại evidence/regression-before-ledger-fix.log; kiểm tra validate sau mỗi next; browser 35 ngày qua |
| Test persistence đóng DB giữa các case | Cleanup disable auto-open | Đặt cleanup delete với disableAutoOpen:false; migration/roundtrip qua |
| Vitest thu nhầm Playwright spec | Discovery mặc định nhận tests/e2e | Tách vitest.config.ts chỉ nhận *.test.ts; không xóa test |
| Test multitouch giả định 2 ngón đồng thời sinh một click | Browser không tổng hợp click từ cử chỉ 2 ngón | Chọn ly bằng tap thật rồi stress multitouch, kiểm tra chỉ trừ đúng một ly; giữ test input cảm ứng |
| Test mở ngày 36 không nhập lại trà hết hạn | Kho ngày 36 đã loại bỏ lô cũ, game chặn mở đúng thiết kế | Thêm thao tác mua bù vật tư thiếu qua UI trước mở cửa, không bỏ chặn kho |
| Nhãn phần trăm nằm trên đáy ly | Quan sát screenshot ly đã dán | Dời nhãn sang vùng trống bên trái và chụp lại |

Các lượt rót dùng chờ mực thực tế tới vạch, vẫn xác nhận mất >2 giây để đạt vạch và thả phải dừng. Không hardcode kết quả hoặc nạp state thay cho các bài gameplay bằng UI. Bridge chỉ dùng cho bài mô phỏng dài hạn và bị loại khỏi production.

## Hạn chế và release gate còn mở

- Không có ảnh tham chiếu trong tệp người dùng gửi; chưa đối chiếu screenshot theo ảnh đó. Không sao chép tài sản gốc.
- Trải nghiệm dọc có cuộn trên màn hình thấp; cần một lượt thiết kế/duyệt bố cục 9:16 theo ảnh thật trước khi xác nhận toàn bộ brief.
- Chưa chạy Safari/iOS hoặc Android vật lý, chưa kiểm tra FPS/âm thanh bằng tai trên thiết bị thật. Bài ẩn tab dùng sự kiện visibilitychange có kiểm soát; không coi đó là toàn bộ hành vi background của mọi hệ điều hành.
- Cân bằng tiền khá dễ với bot hoàn hảo; chưa có playtest con người. Nhạc là loop tổng hợp đơn giản, không phải bản thu dài.
- Build báo bundle Phaser lớn (~1,86 MB JS chưa gzip); build vẫn thành công, không ẩn cảnh báo. Không có backend hoặc đồng bộ nhiều máy.
- Không có blocker/critical runtime đã biết trong phạm vi đã kiểm thử. Các khoảng trống kiểm chứng và yêu cầu bố cục trên ngăn tuyên bố RELEASE READY đầy đủ.

**Kết luận: NOT RELEASE READY cho toàn bộ brief; có bản source chơi được, build được và đã qua các kiểm thử nêu trên.**

## Bản sửa luồng mở tiệm theo phản hồi người dùng

Đã tái hiện bằng browser ngày 2 có trà sữa/hồng trà 40 phần nhưng trân châu 0. Đây là chặn kho có chủ ý, nhưng bản cũ đặt thông báo ở vị trí dễ bị bỏ qua nên trông như nút hỏng.

Đã sửa: khung chuẩn bị hiển thị chính xác các vật tư thiếu; bấm Mở cửa khi thiếu sẽ mở thẳng Kho và có hướng dẫn ngay đầu cửa sổ; danh sách cập nhật khi mua. Khi đủ hàng, khung hiện Nguyên liệu đã sẵn sàng; bấm mở cửa ẩn hoàn toàn khung và bắt đầu hàng chờ. Không bỏ kiểm tra kho hoặc tạo nguyên liệu miễn phí.

Lượt hồi quy chính: 14/14 E2E (evidence/e2e.log). Bài riêng mô phỏng ảnh ngày 2: 1/1 PASS (evidence/opening-day2.log), ảnh screenshots/day2-opening-after-pearl-restock.png. Tổng 15 E2E khác nhau qua hai lượt, cộng 27 unit/integration = 42 test đạt. Không có test fail ở các lượt cuối.
