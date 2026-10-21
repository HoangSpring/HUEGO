# HUEGO --- Tài liệu yêu cầu nghiệp vụ (BRD)

Version 1.0 \| MVP \| Nguồn chuẩn nghiệp vụ cho agent, thiết kế và kiểm
thử.

## 1. Tầm nhìn

HUEGO là AI Trip Planner tập trung vào Huế. Sản phẩm biến thời gian,
ngân sách, sở thích và giới hạn của khách tự túc thành lịch trình theo
ngày có thứ tự hợp lý, dựa trên dữ liệu địa điểm địa phương, thời gian
tham quan và thông tin tuyến đường.

## 2. Vấn đề

-   Thông tin du lịch phân tán ở nhiều nguồn.
-   Khó sắp xếp điểm đến theo khoảng cách, giờ mở cửa và thời gian có
    hạn.
-   Gợi ý chung chung khó cân bằng ngân sách, sở thích và trải nghiệm
    địa phương.
-   Giá, giờ mở cửa và thông tin địa điểm có thể lỗi thời.

## 3. Người dùng

**Khách du lịch:** cá nhân, cặp đôi, nhóm bạn; muốn lên lịch trình Huế
thực tế, có thể dùng web trước khi đăng nhập. **Admin:** duy trì địa
điểm, danh mục, tags và ảnh; không mặc nhiên có quyền xem dữ liệu cá
nhân của khách.

## 4. Mục tiêu và tiêu chí thành công

Người dùng có thể chọn VI/EN, tạo lịch trình, xem lịch theo ngày, hiểu
chi phí ước tính, chỉnh sửa/tạo lại, khám phá địa điểm, dùng HUEGO NOW
mà không bắt buộc chia sẻ vị trí và lưu chuyến đi khi tính năng tài
khoản sẵn sàng. Mọi thao tác bất đồng bộ có loading/error/empty/success
state.

## 5. Phạm vi

### P0 --- Lập kế hoạch

Language Selection, Home, Plan Trip, AI Generating, Trip Result, Trip
Edit/Re-plan. \### P1 --- Khám phá Explore, Place Detail, HUEGO NOW với
vị trí tùy chọn và fallback nhập vị trí thủ công. \### P2 --- Lưu dữ
liệu cá nhân Auth, My Trips, Favorites. \### Admin MVP Đăng nhập admin;
dashboard chất lượng dữ liệu; CRUD places; quản lý categories, tags,
ảnh; tìm kiếm/lọc; bật/tắt trạng thái hiển thị.

## 6. Quy tắc nghiệp vụ

-   AI chỉ đề xuất các địa điểm có thật trong dữ liệu được phép sử dụng.
-   Tọa độ, giờ mở cửa, giá vé và trạng thái xác minh lấy từ DB/nguồn
    đáng tin; AI không được tự bịa.
-   Phân biệt dữ liệu xác minh với dữ liệu chưa xác minh; ước tính phải
    được ghi rõ.
-   `is_active = true` là điều kiện thông thường để xuất hiện công khai.
-   Vị trí là tùy chọn. Từ chối quyền không chặn website; phải có
    fallback thủ công.
-   Guest được xem Home, Explore và Place Detail; không bắt buộc đăng
    nhập ngay khi vào.
-   Dữ liệu riêng tư chỉ chủ sở hữu/quyền hợp lệ được đọc hoặc sửa;
    RLS/server là bảo mật thật.
-   Giao diện hỗ trợ tiếng Việt và tiếng Anh.

## 7. Schema thực tế đã biết

Dự án dùng React + TypeScript + Vite + Supabase. Các bảng liên quan:
`place_categories`, `places`, `place_images`, `tags`, `place_tags`,
`trips`, `trip_days`, `trip_activities`, `favorites`, `profiles`,
`user_preferences`. Danh mục thực tế là `place_categories` (không tự giả
định bảng `categories`). `place_images.storage_path` là đường dẫn object
trong Storage, không tự động là URL. Không tự đổi schema/RLS hoặc tên
cột khi chưa được phê duyệt. Kiểm tra schema hiện tại trước khi viết
migration.

## 8. Nguyên tắc AI

AI tạo lịch trình, giải thích gợi ý và hỗ trợ re-plan. AI không tạo
place ID giả, không sửa DB trực tiếp, không bỏ qua validation, không
được gọi từ frontend bằng secret key. Kết quả phải được parse,
schema-validate và business-validate trước khi hiển thị/lưu.

## 9. Ngoài phạm vi

Đặt tour/vé, thanh toán, phủ sóng toàn quốc, custom foundation model,
cộng tác phức tạp, quảng cáo/sponsored ranking và CRM du lịch.

## 10. Nghiệm thu

Đúng user flow đã duyệt; không có blank screen; dữ liệu cá nhân được bảo
vệ; không có secrets trong bundle; responsive desktop/mobile; có kiểm
thử và báo cáo PASS/FAIL từng phase. Agent phải dừng sau mỗi phase để
chủ dự án duyệt.
