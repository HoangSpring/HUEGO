# HUEGO --- UI Specification for Stitch: Admin App

Generate a coherent, editable admin dashboard for maintaining the
destination data used by HUEGO. This is an internal data-management
interface, not a public travel page.

## Visual direction

Professional, data-first workspace. Light neutral canvas, restrained
accent, compact readable tables, clear form hierarchy, consistent badges
and inline errors. Desktop uses persistent sidebar; mobile uses compact
navigation. Default admin language may be Vietnamese, with room for
English localization.

## Global shell

HUEGO Admin wordmark. Sidebar: Overview, Places, Categories, Tags, Media
(optional), Sign out. Header: breadcrumb, title, language selector,
admin profile. Toasts for success/failure and confirmation dialogs for
destructive operations.

## Screen 1 --- Admin Login

Email/password, Sign in, pending and invalid-credential states. No
self-service create-admin option.

## Screen 2 --- Overview

Live metric cards: active places, missing coordinates, missing cover
images/files, missing translations, unverified places. Attention-needed
list linking to edit records. Loading/error/empty states. Do not
hardcode metrics.

## Screen 3 --- Places List

Table with thumbnail/file status, Vietnamese/English name, category,
active and verified status. Search name/slug. Filters category,
active/inactive, verified/unverified. Add Place CTA; row actions Edit
and Activate/Deactivate. Pagination or bounded result set; no-results
and empty states.

## Screen 4 --- Create/Edit Place

Grouped sections: 1. Basic: name_vi, name_en, slug, category. 2.
Descriptions: VI/EN. 3. Location: address, latitude, longitude, map
preview if available. 4. Visit info: opening/closing time, suggested
duration, price min/max. 5. Quality: verified and active. 6. Tags:
searchable multi-select. 7. Images: upload/preview, alt text VI/EN,
cover and order. Inline validation, Save/Cancel, unsaved-change warning.
Missing price/time remains empty, not zero. Missing Storage object
displays warning and re-upload option.

## Screen 5 --- Categories

List bilingual names, slug, sort order, active state. Create/edit
descriptions/icon only if supported by schema. Prefer
deactivate/reassign over deleting a referenced category.

## Screen 6 --- Tags

List bilingual names, slug and linked-place count. Search/sort,
create/edit, show impact before deleting used tag.

## Screen 7 --- Media (optional)

List image references, preview, storage path, place, cover status and
alt text. Upload/replace/mark cover/remove reference. Clearly
distinguish DB reference from actual Storage object.

## Interaction states

Loading skeleton, empty/no-results, error/retry, inline invalid
coordinates/duration/price range, save pending/success/failure,
confirmation, permission denied for non-admin. Never rely on color alone
for status.

## Responsive and accessibility

Desktop full table and sidebar; tablet collapsible sidebar; mobile
stacked form and adaptive table/card view. Every field labeled, keyboard
navigation and focus visible, dialogs accessible, alt text editable.

## Stitch output expectations

Create consistent linked screens, especially Places List → Create/Edit
Place → Categories/Tags. Ground the UI in known HUEGO schema. Do not
invent booking, payment, ad management or broad user analytics modules.
