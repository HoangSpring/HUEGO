# HUEGO --- Technical Specification: AI Frontend

Version 1.0 \| Phạm vi: frontend tích hợp tạo và lập lại lịch trình AI.

## 1. Kiến trúc

`React UI → typed frontend service → trusted server endpoint → AI + dữ liệu địa điểm đã chọn → schema/business validation → response → UI`.

Nếu repository đã chọn Supabase Edge Functions hoặc backend khác, giữ
kiến trúc được duyệt. Không tạo backend thứ hai chỉ vì ví dụ trong tài
liệu. Frontend không gọi AI bằng secret key.

## 2. Trách nhiệm frontend

-   Thu thập và validate input.
-   Gửi dữ liệu tối thiểu đến endpoint tin cậy.
-   Hiển thị loading, success, error, retry và partial-data.
-   Validate response shape lần nữa trước khi render.
-   Hiển thị itinerary, cảnh báo và nhãn ước tính.
-   Cho phép re-plan mà không làm mất kết quả hợp lệ cũ.
-   Không lưu secret hoặc log token/prompt nhạy cảm.

## 3. Module gợi ý

Điều chỉnh theo cấu trúc hiện có, không ép refactor:

``` text
src/features/trips/
  components/
  pages/
  schemas/
  services/
  types/
```

Service gợi ý: `generateItinerary`, `replanItinerary`, `getTrip`,
`saveTrip`. UI component không chứa logic gọi provider.

## 4. Request contract minh họa

``` ts
type GenerateItineraryRequest = {
  durationDays: number;
  travelerCount: number;
  budgetLevel: string;
  travelStyle: string;
  interests: string[];
  transportation: string;
  specialConstraints?: string;
  startLocation?: { latitude: number; longitude: number; label?: string };
  language: "vi" | "en";
};
```

Đây chỉ là contract minh họa; map sang schema hiện tại trước khi code.
Không dùng nó làm lý do sửa database.

## 5. Response contract minh họa

``` ts
type ItineraryResponse = {
  summary: {
    title: string;
    durationDays: number;
    estimatedTotalCost?: number;
    currency?: "VND";
    assumptions?: string[];
  };
  days: Array<{
    dayNumber: number;
    items: Array<{
      placeId: string;
      startTime?: string;
      endTime?: string;
      visitDurationMinutes?: number;
      activity: string;
      estimatedTravelMinutes?: number;
      estimatedDistanceMeters?: number;
      estimatedCost?: number;
      notes?: string;
    }>;
  }>;
  warnings?: string[];
};
```

Chốt contract thật sau khi kiểm tra backend hiện có. Mọi `placeId` phải
được xác minh là tồn tại và được phép sử dụng.

## 6. State model

`idle → validating → submitting → success | error | rate_limited`. Hỗ
trợ partial-data nếu thiếu giờ mở cửa, giá hoặc routing. Không hiển thị
kết quả JSON sai cấu trúc. Retry không được tạo trip trùng; dùng
idempotency nếu backend hỗ trợ, nếu không thì disable submit khi pending
và xử lý duplicate-save.

## 7. Re-plan

Gửi itinerary hiện tại/ID và yêu cầu thay đổi theo contract thật. Giữ
preferences không thay đổi. Khi re-plan thất bại, giữ lịch trình hợp lệ
cũ. Chỉ ghi đè dữ liệu đã lưu sau validation và theo quy tắc đã duyệt.

## 8. Error mapping

-   400/422: input hoặc result không hợp lệ.
-   401: session hết hạn; yêu cầu đăng nhập nếu thao tác cần auth.
-   403: không có quyền.
-   404: trip/place không tồn tại.
-   429: giới hạn request.
-   5xx/network: lỗi tạm thời, cho phép retry. Không hiển thị stack
    trace, SQL detail, raw provider response hay prompt.

## 9. Security/privacy

-   Chỉ public Supabase URL và anon/publishable key ở client.
-   Không đặt AI/service-role key trong `VITE_*`.
-   Server xác minh Supabase token; RLS kiểm tra quyền dữ liệu.
-   Location chỉ được yêu cầu sau hành động chủ động.
-   Gửi dữ liệu cá nhân tối thiểu.
-   AI output và user text là untrusted input.

## 10. Acceptance checklist

-   [ ] Service/types/schema validation.
-   [ ] Không có AI secret trong bundle.
-   [ ] Loading/error/retry/success/partial states.
-   [ ] Invalid output không render như lịch trình hợp lệ.
-   [ ] Re-plan giữ kết quả cũ khi lỗi.
-   [ ] VI/EN, mobile, keyboard.
-   [ ] Lint/typecheck/build pass.
-   [ ] Phase report và dừng chờ duyệt.
