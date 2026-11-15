# Kiểm chứng gói nguồn và bản sửa mở tiệm

Bản gốc đã được kiểm tra ZIP, giải nén sạch, npm ci, build và smoke thành công. Các log ban đầu nằm ở evidence/clean-*.log.

Bản cập nhật này sửa hướng dẫn thiếu nguyên liệu khi bấm mở cửa. Nguồn đã qua typecheck, lint, 27 unit/integration, 14 E2E hồi quy và 1 E2E riêng tái hiện tình huống ngày 2 thiếu trân châu.

ZIP cập nhật được kiểm tra CRC và giải nén vào thư mục mới, chạy lại npm ci, production build và production smoke trước khi thay tệp trên trang tải. Kết quả cuối và hash của ZIP nằm trong PACKAGE_VERIFICATION_FINAL.md đặt cạnh archive trong workspace, để tránh nhúng hash tự tham chiếu.

Trạng thái toàn bộ brief vẫn NOT RELEASE READY theo các giới hạn trong QA_REPORT.md.
