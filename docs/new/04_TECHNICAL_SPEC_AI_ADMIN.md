# HUEGO --- Technical Specification: Admin MVP

Version 1.0 \| Phạm vi: quản trị dữ liệu địa điểm dùng cho Explore và AI
planning.

## 1. Mục tiêu

Quản lý places, categories, tags, ảnh; tìm kiếm/lọc; kiểm soát
active/verified; phát hiện dữ liệu thiếu. Đây là admin CMS gọn cho MVP,
không phải hệ thống quản lý tour.

## 2. Routes gợi ý

`/admin/login`, `/admin`, `/admin/places`, `/admin/places/new`,
`/admin/places/:id`, `/admin/categories`, `/admin/tags`, `/admin/media`
(optional). Điều chỉnh theo router hiện tại.

Route guard chỉ hỗ trợ UX. Quyền admin phải được enforce bằng
RLS/trusted server. Không cho người dùng tự nâng role.

## 3. Schema đã xác nhận

`place_categories`: `id`, `name_vi`, `name_en`, `slug`,
`description_vi`, `description_en`, `icon`, `sort_order`, `is_active`,
`created_at`. `places`: `id`, `category_id`, `name_vi`, `name_en`,
`slug`, `description_vi`, `description_en`, `address`, `latitude`,
`longitude`, `opening_time`, `closing_time`, `duration_minutes`,
`price_min`, `price_max`, `rating`, `review_count`, `is_verified`,
`is_active`, `created_at`, `updated_at`. `place_images`: `id`,
`place_id`, `storage_path`, `alt_text_vi`, `alt_text_en`, `is_cover`,
`sort_order`, `created_at`. `tags`: `id`, `name_vi`, `name_en`, `slug`,
`created_at`. `place_tags`: `place_id`, `tag_id`. Inspect live schema
and migrations before implementation; do not assume constraints or extra
columns.

## 4. Places list

-   Search VI/EN name or slug.
-   Filters: category, active/inactive, verified/unverified.
-   Table/card: thumbnail status, names, category, active/verified.
-   Pagination or bounded result set.
-   Actions: edit, activate/deactivate.
-   Loading, empty, error, no-results.

## 5. Create/edit place

Sections: basic info (names, slug, category), bilingual descriptions,
address/GPS, opening/closing time, suggested duration, price min/max,
verified/active, tags, images/alt text/cover/order. Validation: latitude
-90..90; longitude -180..180; duration positive integer when present;
price_min \<= price_max if both set; no silent conversion of missing
price to zero; slug collision check. Use existing category ID.
Deactivation hides from public discovery without deleting historical
references.

## 6. Categories and tags

Categories: bilingual names/descriptions, slug, icon, sort order and
active state if schema supports them. Do not delete a category
referenced by places; prefer deactivation or reassignment. Tags: CRUD
`name_vi`, `name_en`, `slug`; load from DB; assign/unassign via
`place_tags`; avoid duplicate associations. Confirm impact before
deleting used tags. Verify constraints before relying on `ON CONFLICT`.

## 7. Images and Storage

-   Intended public bucket: `place-images`, but verify current bucket
    and object state at runtime.
-   `storage_path` must match a real Storage object path.
-   A DB reference does not prove the file exists.
-   Upload to approved bucket; save bilingual alt text and sort order.
-   Intended UX: one cover per place. If selecting a new cover, unset
    old cover safely via approved RPC/transaction if available; do not
    assume constraint.
-   If Storage has zero objects or object missing, show warning and
    re-upload flow.
-   Public bucket is only for public destination images; never store
    private user media there.

## 8. Overview dashboard

Derive live metrics: active places, missing coordinates, missing
descriptions, missing cover/object, unverified places, category
distribution. No hardcoded metrics or decorative charts.

## 9. Security

-   No service-role key in frontend.
-   Admin authorization enforced beyond UI.
-   Normal user cannot mutate place/category/tag catalog unless
    explicitly allowed.
-   Validate all inputs at trusted boundary.
-   Avoid exposing private trips/favorites to admin without approved
    need.
-   Do not create migrations/RPC/audit tables without approval.

## 10. Acceptance

-   [ ] Non-admin cannot read/mutate admin data by direct request.
-   [ ] Place/category/tag CRUD works with real schema.
-   [ ] Storage object exists before saving reference.
-   [ ] Activate/deactivate works.
-   [ ] Validation and async states complete.
-   [ ] Mobile usable, desktop optimized for data entry.
-   [ ] Security/RLS tests documented.
-   [ ] Lint/typecheck/build pass; stop and report after phase.
