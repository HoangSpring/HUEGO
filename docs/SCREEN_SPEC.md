# HUEGO — Screen Specification v0.1

> Version: 0.1  
> Status: Approved for MVP Development

## SCR-01 — Language Selection

Purpose:
- Select Vietnamese or English.

Actions:
- Choose language.
- Continue to Home.

States:
- Default.
- Selected.
- Saved.

Flow:
`SCR-01 → SCR-02`

## SCR-02 — Home

Purpose:
- Main entry point.

Primary CTA:
- Plan My Trip.

Navigation:
- Explore.
- HUEGO NOW.
- My Trips.

Flow:
- Plan → SCR-03.
- Explore → SCR-07.
- HUEGO NOW → SCR-09.
- My Trips → SCR-10.

## SCR-03 — Plan Trip

Purpose:
- Collect trip preferences.

Inputs:
- Duration.
- Budget.
- Travelers.
- Travel style.
- Interests.
- Transportation.
- Special constraints.
- Optional starting location.

Primary action:
- Generate My Trip.

States:
- Default.
- Validation error.
- Submitting.

Flow:
`SCR-03 → SCR-04`

## SCR-04 — AI Generating

Purpose:
- Communicate that itinerary generation is in progress.

Stages may include:
- Preparing Huế destinations.
- Creating itinerary.
- Optimizing route.
- Calculating estimated cost.

Success:
`SCR-04 → SCR-05`

Error:
- Retry.
- Back to Plan Trip.

## SCR-05 — Trip Result

Purpose:
- Show complete itinerary.

Content:
- Trip summary.
- Day sections.
- Time.
- Place.
- Activity.
- Duration.
- Travel time/distance.
- Estimated cost.
- Notes.

Actions:
- Open Place Detail → SCR-08.
- Edit/Re-plan → SCR-06.
- Save Trip.

## SCR-06 — Trip Edit / Re-plan

Purpose:
- Modify generated itinerary.

Actions:
- Add place.
- Remove place.
- Reorder.
- Change day.
- Change preferences.
- Re-plan.

Flow:
`SCR-06 → SCR-04 → SCR-05`

## SCR-07 — Explore

Purpose:
- Browse Huế places.

Features:
- Search.
- Categories.
- Filters.
- Place cards.

Flow:
`SCR-07 → SCR-08`

## SCR-08 — Place Detail

Purpose:
- Show complete place information.

Content:
- Images.
- Name.
- Description.
- Category.
- Address.
- Opening hours.
- Price.
- Suggested duration.
- Local tips.
- Map/location.

Actions:
- Back.
- Favorite.
- Add to Trip.

## SCR-09 — HUEGO NOW

Purpose:
- Recommend nearby places.

Flow:
`SCR-09 → Location Permission → Nearby Places`

Allow:
- Get location.
- Search nearby.
- Rank results.

Deny:
- Manual location fallback.

Location permission MUST remain optional.

## SCR-10 — My Trips

Purpose:
- Manage saved trips.

Content:
- Trip cards.
- Duration.
- Budget.
- Date.
- Thumbnail.

Actions:
- Open.
- Edit.
- Delete.

Empty state:
- Plan My First Trip.
