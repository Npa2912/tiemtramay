# Tiệm Trà Mây

Game single-player tiếng Việt, React 19 + TypeScript + Vite + Phaser 3. Zustand quản lý trạng thái, Dexie lưu IndexedDB. Không backend, không CDN lúc chơi, không API key.

## Chạy trong VS Code

Cài Node.js 22 LTS trở lên. Giải nén ZIP, mở thư mục `TiemTraMay` trong VS Code, mở Terminal:

```sh
npm install
npm run dev
```

Mở địa chỉ Vite in ra (thường `http://localhost:5173`). Bản production: `npm run build` rồi `npm run preview`. Không mở `dist/index.html` bằng `file://`.

## Chơi

1. Nếu bấm Mở cửa khi thiếu hàng, game sẽ mở Kho và liệt kê chính xác vật tư cần nhập. Ngày đầu mở Kho, mua mỗi loại một gói: trà sữa, hồng trà, sữa, đường, đá, trân châu, ly M, nắp. Tổng 178.000đ; vốn ban đầu 400.000đ.
2. Đóng Kho, mở tiệm. Đọc loại trà, size, topping, hương, đường, đá trong đơn khách.
3. Chọn ly, chọn bình, **nhấn giữ** “Giữ để rót”. Thả ở **77–93%**, lý tưởng 85%. Cảm ứng và bàn phím Space/Enter đều được hỗ trợ. Chỉ chọn bình không tự rót.
4. Thêm topping, chọn hương (kể cả Nguyên vị), chọn đường và đá. Dán nắp, chờ máy hoàn tất rồi giao.
5. Không đúng đơn sẽ nhận ít tiền và giảm đánh giá. Khách chờ quá lâu sẽ bỏ đi. Bỏ ly không hoàn lại vật tư.
6. Phục vụ hết khách để tự tổng kết; có thể kết sổ sớm. Xem giá vốn, phí và lợi nhuận. Nâng cấp, nhập kho rồi sang ngày mới.
7. Trà, topping và hương mới cần mua nâng cấp khi tới ngày mở. Size L cũng cần nâng cấp. Từ ngày 21 có nhóm công thức cuối. Sau ngày 30 vẫn tiếp tục.
8. Kho có sức chứa và hạn dùng. Đá hết hạn sau 2 ngày, tủ lạnh kéo dài hạn dùng cho các lô nhập sau khi nâng cấp. Chi phí ngày gồm thuê quầy, điện nước, lương nếu thuê người hỗ trợ.
9. Khi dưới 20.000đ có thể vay 200.000đ không lãi, một lần/ngày. Nợ được ghi sổ và tự hoàn từ phần tiền vượt 100.000đ khi sang ngày nếu ví trên 120.000đ. Nếu chuẩn bị sai, nút “Nghỉ hôm nay & kết sổ” cho phép tiếp tục ngày khác.

## Lưu / âm thanh

Tự lưu mỗi khoảng 500ms khi có thay đổi, lưu thủ công, xuất/nhập JSON và reset có bước xác nhận. Lưu cả ly đang pha và hàng chờ; reload không làm mới kiên nhẫn. Tạm dừng khi mất hiển thị tab. Cửa sổ quản lý tạm dừng phục vụ. Save gắn với origin/trình duyệt; xuất JSON để chuyển máy hoặc địa chỉ web. Không đồng bộ tài khoản. Âm thanh tổng hợp bằng Web Audio, bắt đầu sau tương tác người dùng theo chính sách browser.

## Kiểm thử

```sh
npm run typecheck
npm run lint
npm run test
npx playwright install chromium
npm run test:e2e
npm run build
npm run test:smoke
```

Playwright tự dùng `/usr/bin/chromium` nếu có, hoặc browser do Playwright cài. Có thể đặt biến môi trường `CHROMIUM_PATH` trỏ tới Chrome/Chromium riêng. `test:smoke` mở production build trên cổng loopback tạm. Kiểm thử Chromium đã thực hiện được mô tả trong QA_REPORT.md; không suy diễn sang Safari thật hay thiết bị vật lý.

## Kiến trúc

```text
src/
  catalog.ts        36 công thức, 20 khách, nguyên liệu, nâng cấp
  engine.ts         Reducer thuần, kinh tế, hàng chờ, chấm điểm, kiểm tra save
  persistence.ts    Dexie schema 1 → 2, ghi tuần tự, import validation
  store.ts          Zustand, autosave
  Counter.tsx       Phaser, ly / trà / topping / đá / máy nắp / nhân viên
  audio.ts          Âm thanh và giai điệu tự tạo bằng Web Audio
  App.tsx           Giao diện tiếng Việt, cửa sổ quản lý và input
  style.css         Responsive, giao diện pastel
  qa/               Bot seed cố định và bridge chỉ dùng development
public/assets/      SVG gốc: cửa tiệm, bình trà, mây, khách và biểu cảm
scripts/            Bộ sinh artwork, smoke test production
tests/             Unit, persistence integration, Playwright E2E
screenshots/        Ảnh chụp từ các lần kiểm thử thật
QA_REPORT.md
GAMEPLAY_TEST_REPORT.md
THIRD_PARTY_NOTICES.md
LICENSE
package-lock.json
```

## QA controller

Chỉ bản dev có `?qa=1` mới nạp `window.mayQA`. Có reset(seed), act(action), brew(wrong), simulateDays(count), reload() dùng IndexedDB thật, inspect(). Bot nằm riêng khỏi gameplay production. Production smoke xác nhận bridge không tồn tại kể cả khi thêm query này. Bộ test dài hạn dùng seed 1234, bot pha chính xác và không tiêu tốn thời gian thao tác của người chơi; không thay thế playtest con người.

## Phạm vi và giới hạn

Đọc trạng thái chính thức và chi tiết còn thiếu trong QA_REPORT.md. Không có ảnh tham chiếu trong tệp yêu cầu nên không thể đối chiếu ảnh với game tham khảo. Giao diện ưu tiên dọc nhưng có cuộn trên màn hình thấp; chưa đạt trải nghiệm quầy vừa hoàn toàn trong một khung 9:16 ở mọi kích thước. Chưa chứng nhận Android/iOS vật lý, Safari hoặc khả năng chơi offline khi chưa từng tải trang. Không có service worker. Cân bằng kinh tế đang khá dễ khi bot phục vụ hoàn hảo; cần playtest con người trước phát hành thương mại.
