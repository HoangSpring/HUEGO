# HUEGO — Database Schema v0.1

> Database: Supabase PostgreSQL  
> Version: 0.1  
> Status: MVP Schema

## 1. Main Entities

```text
profiles
trips
trip_days
trip_items
places
place_images
categories
favorites
```

## 2. Relationships

```text
profiles
   │
   ├── trips
   │      └── trip_days
   │             └── trip_items
   │                    └── places
   │                           └── place_images
   │
   └── favorites
            └── places

categories
    └── places
```

## 3. profiles

Purpose: application-level user profile linked to Supabase Auth.

Fields:
- id UUID PK, references auth.users.
- display_name.
- preferred_language.
- created_at.
- updated_at.

## 4. categories

Purpose: destination categories.

Suggested fields:
- id UUID PK.
- name_vi.
- name_en.
- slug.
- created_at.

## 5. places

Purpose: verified Huế destination data.

Suggested fields:
- id UUID PK.
- name_vi.
- name_en.
- slug.
- description_vi.
- description_en.
- address.
- latitude.
- longitude.
- category_id FK.
- price_min.
- price_max.
- opening_hours.
- suggested_duration_minutes.
- rating.
- is_active.
- created_at.
- updated_at.

## 6. place_images

A place MAY have one or many images.

Suggested fields:
- id UUID PK.
- place_id FK.
- image_url.
- alt_text.
- sort_order.
- is_cover.
- created_at.

Recommended rule:
- One place can have multiple images.
- One image is optionally marked as the cover image.
- Image URLs should point to a managed storage/CDN location.

## 7. trips

Purpose: user's planned trips.

Suggested fields:
- id UUID PK.
- user_id FK nullable for guest/draft behavior where applicable.
- title.
- duration_days.
- budget.
- travelers_count.
- travel_style.
- transportation.
- interests JSONB.
- constraints JSONB.
- start_latitude.
- start_longitude.
- status.
- created_at.
- updated_at.

## 8. trip_days

Suggested fields:
- id UUID PK.
- trip_id FK.
- day_number.
- date nullable.
- title.
- estimated_cost.
- created_at.

Unique:
- trip_id + day_number.

## 9. trip_items

Suggested fields:
- id UUID PK.
- trip_day_id FK.
- place_id FK.
- start_time.
- end_time.
- order_index.
- activity_type.
- notes.
- estimated_cost.
- travel_minutes_from_previous.
- distance_from_previous.
- created_at.

## 10. favorites

Suggested fields:
- id UUID PK.
- user_id FK.
- place_id FK.
- created_at.

Unique:
- user_id + place_id.

## 11. Data Principles

- Destination facts belong in the database.
- AI should consume structured destination data.
- Coordinates must be stored for route calculations.
- Multiple images per place are supported.
- Soft deactivation via `is_active` is preferred over deleting useful historical destination data.

## 12. Security

Supabase Row Level Security should ensure:
- Users can access their own trips.
- Users can manage their own favorites.
- Public destination data is readable as intended.
- Administrative writes are restricted.

## 13. Seed Data

Seed data is intentionally separate from the schema.

The MVP can initially operate with an empty destination database while the schema and application are developed.
