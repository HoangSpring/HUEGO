# HUEGO — Technical Architecture v0.1

> Version: 0.1  
> Status: Approved for MVP Development

## 1. Architecture Goal

Build a simple, maintainable architecture suitable for an academic MVP while keeping a realistic path toward production.

## 2. High-Level Architecture

```text
Browser
  ↓
React + TypeScript Frontend
  ↓
Application/API Layer
  ├── Trip Planning Service
  ├── Recommendation Service
  ├── AI Service
  ├── Routing/Maps Service
  └── Authentication Service
  ↓
Supabase
  ├── PostgreSQL Database
  └── Auth
```

## 3. Frontend

Recommended:
- React.
- TypeScript.
- Vite.
- React Router.
- CSS/Tailwind according to the approved UI implementation.

Responsibilities:
- Rendering UI.
- Navigation.
- Form handling.
- Client-side validation.
- Calling application services.
- Managing UI state.

The frontend MUST NOT contain secret API keys.

## 4. Supabase

Supabase is the approved backend platform for the MVP.

Use it for:
- PostgreSQL database.
- Authentication when required.
- Persistent trip data.
- Destination data.
- Favorites.
- Other structured application data.

## 5. AI Layer

The AI layer should receive structured information rather than relying on unrestricted generation.

Conceptual flow:

```text
User Preferences
      ↓
Destination Query
      ↓
Candidate Places
      ↓
AI Itinerary Generation
      ↓
Route Optimization
      ↓
Cost Estimation
      ↓
Validation
      ↓
Final Itinerary
```

## 6. Destination Data

Destination records should contain, where available:
- Name.
- Description.
- Category.
- Coordinates.
- Address.
- Opening hours.
- Price.
- Suggested duration.
- Tags.
- Images.
- Local tips.

The database is the factual source for destination information.

## 7. Maps / Routing

Maps/routing functionality should be isolated behind a service interface.

Responsibilities:
- Distance.
- Estimated travel time.
- Route ordering support.

Do not spread map-provider-specific logic throughout UI components.

## 8. Location

Browser Geolocation API may be used for HUEGO NOW.

Rules:
- Request permission only when useful.
- Explain why location is needed.
- Permission is optional.
- Provide manual location fallback.
- Do not store precise location unnecessarily.

## 9. Authentication

Authentication is not required for basic browsing/planning.

Use authentication for persistent personal features such as:
- Saved trips.
- Favorites.

## 10. Security

- Secrets only in server-side environment variables.
- Never commit `.env` files containing secrets.
- Validate user input.
- Apply database access policies.
- Do not trust client-provided authorization state.
- Avoid exposing unnecessary database fields.

## 11. Error Handling

Every external service should have:
- Timeout/failure handling.
- User-friendly error message.
- Retry where appropriate.
- Fallback where practical.

## 12. Recommended Project Structure

```text
HUEGO/
├── docs/
├── public/
├── src/
│   ├── components/
│   ├── pages/
│   ├── layouts/
│   ├── routes/
│   ├── services/
│   ├── hooks/
│   ├── types/
│   ├── lib/
│   └── utils/
├── .env.example
├── package.json
└── README.md
```

## 13. Development Principle

Implement the P0 critical path first.

Do not build every advanced feature before the main trip-planning journey works end-to-end.
