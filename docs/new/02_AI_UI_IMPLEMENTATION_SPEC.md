# HUEGO --- AI UI Implementation Specification

Version 1.0 \| Dành cho coding agent thực thi giao diện.

## 1. Quy tắc bắt buộc

1.  Đọc `AGENTS.md`, PRD, USER_FLOW, screen specs, phase instructions và
    code hiện có trước khi sửa.
2.  Thực hiện từng phase nhỏ; không triển khai tất cả màn hình cùng lúc.
3.  Giữ nguyên kiến trúc, route, schema, RLS và UX đã duyệt; nếu tài
    liệu/code mâu thuẫn thì dừng và hỏi.
4.  Tái sử dụng components, design tokens, services và Supabase client
    hiện có.
5.  Không tự tạo tên cột/bảng. Schema thực tế dùng `place_categories`.
6.  Không đưa AI provider secret hoặc Supabase service-role key vào
    frontend/VITE env.
7.  Không dùng fixture/mock như dữ liệu production.
8.  Mọi thao tác async phải có loading, success, error và empty state
    thích hợp.
9.  Cuối phase chạy lint/typecheck/build/test phù hợp, báo kết quả và
    dừng chờ duyệt.

## 2. Luồng UX không được phá vỡ

Language Selection → Home → Plan Trip → AI Generating → Trip Result →
Edit/Re-plan → AI Generating → Trip Result. Explore → Place Detail.
HUEGO NOW → yêu cầu location sau thao tác chủ động; nếu từ chối thì cho
nhập/chọn vị trí thủ công. Không ép đăng nhập khi truy cập ban đầu. Xóa
dữ liệu cần xác nhận. Khi AI lỗi, giữ lại form và lịch trình hợp lệ
trước đó.

## 3. Hệ thống giao diện

-   Tông du lịch địa phương, tin cậy, rõ ràng; không biến sản phẩm thành
    chatbot chung chung.
-   Dùng design tokens hiện có; một accent color nhất quán.
-   Ưu tiên ảnh địa điểm, typography dễ đọc, spacing đều, responsive
    mobile-first.
-   Không lạm dụng gradient, glassmorphism hoặc animation.
-   Dùng semantic HTML, labels, keyboard focus rõ, alt text và
    reduced-motion.
-   Chuỗi giao diện phải có VI/EN.

## 4. Hành vi theo màn hình

**Home:** CTA chính Plan My Trip; lối vào Explore/HUEGO NOW; nội dung
địa điểm chỉ dùng dữ liệu tải được. **Plan Trip:** duration, budget,
travelers, style, interests, transportation, constraints, start location
tùy chọn; validation theo enum/types thực tế; ngăn submit trùng. **AI
Generating:** thông báo tiến trình trung thực; không giả phần trăm;
Retry/Back khi lỗi. **Trip Result:** itinerary theo ngày;
time/place/activity/duration/travel estimate/cost/notes; phân biệt
estimate với verified; actions phải hoạt động. **Edit/Re-plan:** giữ
nguyên lựa chọn cũ; thay đổi có xác nhận khi cần; nếu re-plan lỗi vẫn
giữ itinerary cũ. **Explore:** search/category/tags; chỉ places active;
loading/no results/error; fallback ảnh có chủ đích. **Place Detail:**
tên, ảnh, mô tả, category, address, hours, price, duration, tags và map
khi có dữ liệu; không bịa trường thiếu. **HUEGO NOW:** giải thích quyền
vị trí; deny/unavailable → manual location; không giả khoảng cách. **My
Trips:** loading/empty/populated/error; xác nhận delete.

## 5. Dữ liệu và tích hợp

Dùng services/types hiện có; tránh logic truy vấn lớn trong component.
URL ảnh phải được tạo từ bucket/path đúng sau khi xác nhận object tồn
tại. Bản ghi `place_images` không chứng minh file Storage còn tồn tại.
Không nuốt lỗi âm thầm; không render AI output chưa qua validation. RLS
bảo vệ dữ liệu cá nhân.

## 6. Checklist

-   [ ] Luồng và route được giữ nguyên.
-   [ ] TypeScript/lint/build pass hoặc lỗi có ghi rõ.
-   [ ] Responsive và keyboard accessibility.
-   [ ] Async states đầy đủ.
-   [ ] Không bịa dữ liệu địa điểm.
-   [ ] Không có secrets trong bundle.
-   [ ] Báo cáo file đã sửa, test, kết quả, rủi ro và đề xuất phase tiếp
    theo.
