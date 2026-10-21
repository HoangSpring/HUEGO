# HUEGO — User Flow v0.1

> Version: 0.1  
> Project: HUEGO — AI Trip Planner for Huế  
> Status: Approved for MVP Development

## 1. Purpose

This document defines the approved user interaction flows for HUEGO.

The Agent MUST follow this document and MUST NOT change the primary UX flow without approval.

## 2. Main Navigation

After Language Selection:

Home
- Plan My Trip
- Explore
- HUEGO NOW
- My Trips

## 3. Screen Mapping

| ID | Screen | Purpose |
|---|---|---|
| SCR-01 | Language Selection | Chọn ngôn ngữ |
| SCR-02 | Home | Trang chủ |
| SCR-03 | Plan Trip | Nhập thông tin chuyến đi |
| SCR-04 | AI Generating | AI tạo lịch trình |
| SCR-05 | Trip Result | Kết quả lịch trình |
| SCR-06 | Trip Edit / Re-plan | Chỉnh sửa/tạo lại |
| SCR-07 | Explore | Khám phá địa điểm |
| SCR-08 | Place Detail | Chi tiết địa điểm |
| SCR-09 | HUEGO NOW | Địa điểm gần người dùng |
| SCR-10 | My Trips | Quản lý chuyến đi |

## 4. Primary Flow

Language Selection
→ Home
→ Plan Trip
→ AI Generating
→ Trip Result
→ Trip Edit / Re-plan
→ AI Generating
→ Trip Result

## 5. First Visit

Open HUEGO
→ Language Selection
→ Choose Vietnamese/English
→ Save preference
→ Home

## 6. Home

Plan My Trip → SCR-03  
Explore → SCR-07  
HUEGO NOW → SCR-09  
My Trips → SCR-10

## 7. Plan Trip

User provides:
- Trip duration.
- Budget.
- Number of people.
- Travel style.
- Interests.
- Transportation.
- Special constraints.
- Optional starting location.

Flow:

Fill form
→ Validate
→ Submit
→ AI Generating

Invalid input must remain on the form with a clear validation message.

## 8. AI Generating

Submit
→ Prepare destination data
→ Generate itinerary
→ Optimize route
→ Estimate cost
→ Validate result
→ Trip Result

Failure:
AI Generating → Error → Retry or Back

## 9. Trip Result

Display:
- Day.
- Time.
- Place.
- Activity.
- Duration.
- Travel time/distance.
- Estimated cost.
- Notes.

Actions:
- View Place → Place Detail.
- Edit → Trip Edit.
- Save → My Trips when authentication/persistence is available.

## 10. Trip Edit / Re-plan

User can:
- Add place.
- Remove place.
- Change order.
- Change day.
- Modify preferences.
- Request re-plan.

Re-plan:
Trip Edit → AI Generating → Trip Result

The current trip preferences must be preserved when editing.

## 11. Explore

Home → Explore → Search/Filter → Place → Place Detail

Possible categories:
- History & Culture.
- Food.
- Nature.
- Photography.
- Relaxation.
- Local Experience.

## 12. Place Detail

Can be reached from Explore, Trip Result, or HUEGO NOW.

Display:
- Name.
- Images.
- Description.
- Category.
- Address.
- Coordinates.
- Opening hours where available.
- Price where available.
- Suggested visit duration.
- Highlights.
- Local tips.
- Tags.

Actions:
- Back.
- Favorite.
- Add to Trip.
- View location.

## 13. HUEGO NOW

HUEGO NOW
→ Request Location Permission

If Allow:
→ Get current location
→ Find nearby places
→ Rank/filter
→ Display recommendations
→ Place Detail

If Don't Allow:
→ Explain that location is optional
→ Offer manual location search
→ Find nearby places from selected location

Location denial MUST NOT block the website.

## 14. My Trips

Home → My Trips → Saved Trips → Trip Detail

Actions:
- Open.
- Edit.
- Delete.

Delete requires confirmation.

If no trips exist:
My Trips → Empty State → Plan My First Trip

## 15. Authentication

Guest users can:
- Browse.
- Explore.
- View place details.
- Create a trip.

Authentication may be requested for:
- Persistent saved trips.
- Favorites.
- Other personal data.

Do not force login at initial entry.

## 16. Global States

Every asynchronous operation should provide:
- Loading state.
- Success state.
- Error state where relevant.
- Empty state where relevant.

## 17. Location Rules

Location is optional.

Possible states:
- Permission not requested.
- Permission granted.
- Permission denied.
- Location unavailable.
- Manual location selected.

## 18. Core Journey

Open HUEGO
→ Choose language
→ Home
→ Plan My Trip
→ Enter preferences
→ Generate
→ Review itinerary
→ Edit if necessary
→ Re-plan
→ Save if desired

## 19. MVP Priority

P0:
SCR-01, SCR-02, SCR-03, SCR-04, SCR-05, SCR-06

P1:
SCR-07, SCR-08, SCR-09

P2:
SCR-10, Authentication, Favorites

## 20. User Flow Integrity

The Agent MUST preserve:
1. Language Selection → Home.
2. Home → Plan Trip.
3. Plan Trip → AI Generating.
4. AI Generating → Trip Result.
5. Trip Result → Trip Edit/Re-plan.
6. Re-plan → AI Generating.
7. Explore → Place Detail.
8. HUEGO NOW → Location Permission.
9. Location denial does not block usage.
10. My Trips → Saved Trip.
