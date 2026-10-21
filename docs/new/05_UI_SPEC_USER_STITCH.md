# HUEGO --- UI Specification for Stitch: User App

Use this document to generate a coherent, editable multi-screen design.
Design is not proof of backend behavior.

## Product

HUEGO is a bilingual AI trip planner focused on Huế, Vietnam. It creates
day-by-day itineraries based on time, budget, interests and local
destination data.

## Visual direction

Premium but approachable local travel product; editorial destination
photography; calm surfaces, strong typography and readable hierarchy.
Avoid generic chatbot styling. Use one consistent accent color and
shared design tokens. Use authentic/licensed Huế imagery where
available; placeholders must be clearly replaceable. Responsive desktop
and mobile. Support Vietnamese and English.

## Global shell

HUEGO wordmark; navigation: Plan Trip, Explore, HUEGO NOW, My Trips;
VI/EN switcher. Guest mode is complete; sign-in is not the primary CTA.
Shared components: header, buttons, fields, chips, place cards,
itinerary timeline, badges, modal, toast, skeleton and empty states.

## Screen 1 --- Language Selection

Brand, concise introduction, Vietnamese/English options, primary
Continue CTA; default/selected states.

## Screen 2 --- Home

Headline about planning a personal Huế trip; primary Plan My Trip CTA;
secondary Explore and HUEGO NOW; featured destination cards; concise
benefits (local knowledge, personalized schedule, budget awareness).
Avoid an excessively long marketing page.

## Screen 3 --- Plan Trip

Grouped/step form: trip duration, budget, traveler count, travel style,
interests, transportation, special constraints, optional start location.
Interests as selectable chips. Make location visibly optional. CTA
Generate My Trip. Show validation and pending states.

## Screen 4 --- AI Generating

Calm progress indicator with stages like preparing local places,
arranging schedule, checking plan. Never fake a percentage. Error state
includes Retry and Back.

## Screen 5 --- Trip Result

Summary for days/travelers/budget/interests; day tabs; timeline cards
with time, image, place, activity, visit duration, travel estimate and
cost when available. Label estimates. Show warnings for missing
facts/tight schedules. Actions: View Place, Edit/Re-plan, Save. Desktop
may include map panel; mobile prioritizes timeline.

## Screen 6 --- Trip Edit/Re-plan

Editable itinerary with reorder affordance, add/remove/change day and
preferences where supported. Keep current schedule visible. Re-plan CTA,
unsaved-change warning and confirmation for destructive actions.

## Screen 7 --- Explore

Search, category chips, tag filters, sort/filter controls, responsive
cards with cover, localized name, category, duration, price only when
known, tags. No-results state suggests clearing filters. Missing image
uses branded fallback.

## Screen 8 --- Place Detail

Cover/gallery; localized name, category, tags, description; address/map;
opening hours, price and duration only if data exists; local tips if
available. Actions Favorite, Add to Trip, View on Map. Hide empty
metadata rows.

## Screen 9 --- HUEGO NOW

Explain nearby suggestions. Ask location only after user action and
explain why. If denied/unavailable, offer manual location search/map
selection. Show proximity only when supported by coordinates/routing.
Denial never blocks use.

## Screen 10 --- My Trips

Saved trip cards with date/duration/budget when available;
open/edit/delete; empty state Plan My First Trip; delete confirmation.
Explain sign-in only if required for persistence.

## States and accessibility

Buttons default/hover/focus/disabled/loading; fields
default/focus/invalid/disabled; cards hover/focus/image fallback; data
skeleton/populated/empty/error/partial; toast and confirmation modal.
High contrast, visible keyboard focus, labeled controls, meaningful alt
text, no color-only state, reduced-motion support.

## Stitch output expectations

Generate linked screens and a reusable system, not isolated mockups.
Keep header, spacing, typography, buttons and cards consistent. Treat
sample data as replaceable until connected to Supabase. Do not fabricate
factual prices, ratings, hours or distances.
