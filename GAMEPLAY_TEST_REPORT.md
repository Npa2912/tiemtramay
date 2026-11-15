# GAMEPLAY_TEST_REPORT

Thời gian tổng hợp: 2026-11-15 16:26:53 UTC+07:00.

## Phân biệt phương pháp

- **UI browser gameplay:** Playwright dùng pointer, bàn phím, touch/CDP, các nút thực tế. Có bài phục vụ trọn 5 khách ngày 1, tự tổng kết và mở ngày 2; bài riêng phục vụ 2 khách, đóng sớm, nâng cấp, sang ngày, reload giữ dữ liệu. Có screenshot ly hoàn thiện và tổng kết.
- **Automated simulation:** bot seed 1234 gọi cùng reducer gameplay, mở khóa/mua hàng bằng action thật, pha đúng, tự dán/giao, giữ invariant. 35 ngày trong Vitest và 35 ngày trong Chromium có IndexedDB thật mỗi ngày. Bot không phải người chơi và không trải qua áp lực thao tác thật.
- **Không có playtest thủ công của con người ở ngày 5/10/20/30.** Các nhận xét ở các ngày này là phân tích kết quả mô phỏng và dữ liệu thiết kế, không giả nhận là trải nghiệm tay người.

## Các mốc đã ghi nhận từ browser simulation

| Ngày | Ly phục vụ | Tiền cuối ngày (sau nhập/nâng cấp/phí) | Lợi nhuận ngày (doanh thu − tiêu hao − phí − hàng hỏng) |
| --- | --- | --- | --- |
| 1 | 5 | 350,500đ | 105,352.50đ |
| 5 | 7 | 496,500đ | 54,210.00đ |
| 10 | 10 | 839,900đ | 72,620.00đ |
| 20 | 15 | 2,907,700đ | 225,005.00đ |
| 30 | 20 | 6,701,600đ | 424,350.00đ |
| 35 | 20 | 9,042,000đ | 416,356.25đ |

Giá vốn được ghi khi dùng; chi nhập kho và nâng cấp trừ ví riêng nên tiền cuối ngày không bằng tiền đầu ngày cộng riêng lợi nhuận này. Các số lợi nhuận có phần lẻ do tiêu hao trà liên tục; UI làm tròn khi hiển thị tiền. Raw snapshot trong evidence/e2e.log.

## Ngày 1

Đã dùng UI thật mua trà sữa, hồng trà, sữa, đường, đá, trân châu, ly M, nắp; mở tiệm; nhận đơn M đơn giản; giữ/thả rót ở vùng xanh; topping rơi; chọn nguyên vị, 70% đường, ít đá; dán, chờ, giao. Chặn nút giao trước khi máy hoàn tất. Phục vụ đủ 5 khách tự sang tổng kết. Không ghi nhận pageerror/console.error trong lượt cuối. Tutorial tiến theo trạng thái ly.

## Ngày 5

Mô phỏng đạt 7 khách/ngày. Menu có nâng cấp trà và pudding, size L đã có thể mua nhưng công thức L theo đợt mở sau. Khách chỉ gọi lựa chọn đã mua quyền mở. Kho hết hạn và nhập lại có tác dụng thật. Chưa đo độ dễ chơi bằng tay tại ngày 5.

## Ngày 10

Mô phỏng đạt 10 khách/ngày. Các bình trà đã tới ngày mở, menu có hương đào và nhiều mức đường/đá theo công thức. Bot trả đủ chi phí mở nguyên liệu và nhập kho, ví vẫn dương. Không cần vốn cứu trợ trong mô phỏng hoàn hảo này.

## Ngày 20

Mô phỏng đạt 15 khách/ngày, size L và topping/hương mở rộng xuất hiện trong nhóm công thức đã mở. Hàng chờ có tối đa 3 khách hoạt động, hoàn thành một khách đưa khách kế tiếp vào. Mã đơn tăng liên tục, không trùng. Lưu được lịch sử ngày và nhật ký bị giới hạn để tránh tăng không kiểm soát.

## Ngày 30

Mô phỏng đạt 20 khách/ngày; nhóm công thức cuối mở từ ngày 21. Tổng catalog 36 công thức. Chấm điểm xét trà, size, vùng rót, topping, hương, đường, đá. Bot phục vụ hoàn hảo nên 0 khách rời trong bài dài hạn; bài timeout riêng xác minh tất cả khách có thể rời và ngày vẫn kết thúc.

## Sau ngày 30

Đã chạy đến hết ngày 35, reload vào ngày 36, mua bù vật tư hết hạn qua UI, mở cửa và nhận đơn tiếp. Không có giới hạn kết thúc ở ngày 30.

## Độ khó, khách và thời gian

Số khách tăng từ 5 đến tối đa 20; kiên nhẫn giảm dần tối đa 35 giây so với nền của từng khách. Nâng quầy tăng 15 giây/cấp. Khách có tính cách, sở thích, độ khó tính; VIP tip cao hơn, khách khó tính phạt sai đơn mạnh hơn. 20 SVG khách gốc, mỗi khách có biến thể vui, hài lòng, buồn, giận.

Test pause đóng băng kiên nhẫn; test timeout cho khách rời và hoàn tất ngày; sai trà làm giảm doanh thu/danh tiếng; phục vụ đúng tăng đánh giá. Nhân viên giảm thời gian dán 0,5 giây và nhận 8.000đ lương/ngày. Chưa có số đo thời gian thao tác của người chơi thực.

## Cân bằng kinh tế

Không phát hiện âm kho, NaN hoặc nhân đôi tiền trong các kiểm thử đã chạy. Khi bắt đầu từ 0 tiền và rỗng kho, vốn vay 200.000đ đủ mua 8 gói cơ bản (178.000đ), sau đó mở cửa được. Vay được ghi nợ và giới hạn một lần/ngày; có thể kết sổ ngày nghỉ để tránh mắc kẹt vĩnh viễn ở pha chuẩn bị.

Bot hoàn hảo tăng tiền nhanh (xem bảng), nâng cấp tương đối rẻ. Đây là mô hình cozy dễ, chưa đủ dữ liệu để khẳng định đã cân bằng tốt cho thương mại. Không dùng kết quả bot để tuyên bố gameplay hấp dẫn hoặc khó vừa đủ với người thật.

## Trạng thái

Gameplay cốt lõi và vòng nhiều ngày đã xác minh bằng các phương pháp trên. **NOT RELEASE READY theo toàn bộ brief**, vì thiếu đối chiếu ảnh tham chiếu và duyệt trải nghiệm bố cục dọc/thiết bị thật như ghi trong QA_REPORT.md.
