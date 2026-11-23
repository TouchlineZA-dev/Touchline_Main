# Touchline mobile app implementation guide

## Goal

Build Touchline as a cross-platform iOS and Android app with React Native and Expo. Keep the existing React/TypeScript web app available while the mobile app is built in this separate `mobile-app/` folder. The mobile app will use the existing ASP.NET Core API for Touchline data and fantasy actions.

This is a migration of the client interface, not a restart of the whole system. The ASP.NET API, its fantasy rules, and Supabase remain the intended backend. The Expo app must not connect directly to Postgres or use a Supabase service-role key.

## Current system

- The existing web client is React + TypeScript, built with Vite. It uses browser components, CSS/Tailwind, React Router, and some web-specific libraries.
- A separate Expo/React Native scaffold is now being built in this `mobile-app/` folder. It already has starter routes, Supabase Auth scaffolding, and an API client; extend those files rather than generating a second Expo app.
- The backend is ASP.NET Core 10 in the separate `touchline-api` repository.
- Supabase Auth provides user identity. The app should send the signed-in user's access token to the API as a Bearer token.
- The API owns user-facing football and fantasy operations. The sync service owns importing SportsMonks football data into the database.
- The API's fantasy rules and 174 tests are already in place, but database migrations and Sportmonks event-code confirmation remain prerequisites for end-to-end fantasy scoring.

## What can be reused

- Product requirements, screen designs, branding, team badges, jersey artwork, and football/fantasy terminology.
- TypeScript API request/response types, after checking that they match the current ASP.NET API contract.
- API URL construction, request/response parsing, and non-UI validation helpers if they do not depend on browser APIs or Supabase database access.
- Existing business rules as references. The API remains authoritative for squad validity, transfers, chips, points, league membership, and prices; the client may provide early feedback but must not make the final decision.

Do not import React DOM components, Radix/shadcn components, Tailwind browser styles, Vite configuration, or browser-only storage into React Native. Rebuild the visual components with React Native primitives and Expo-compatible libraries.

## Recommended folder layout

Keep the mobile client separate from `frontend/` and from the ASP.NET repository:

```text
mobile-app/
  app/                         # Expo Router screens and layouts
  src/
    components/                # Reusable native UI components
    features/
      news/
      live-games/
      squad/
      leagues/
      profile/
    lib/
      api/                     # ASP.NET API client and DTOs
      auth/                    # Supabase Auth setup and session handling
      config/                  # Public environment configuration
    theme/                     # Colors, spacing, typography, pitch styling
  assets/                      # App icon, splash screen, badges, jerseys
  app.json
  package.json
  tsconfig.json
  .env.example
  README.md
```

This guide documents the implementation direction for the Expo project in this folder. The app scaffold and the guide are separate files; keep the mobile implementation in this folder and avoid copying the guide over app code.

## Client foundations to implement first

1. **Create the Expo TypeScript app** in this folder. Add navigation, safe-area support, image handling, and gesture support using Expo-compatible packages.
2. **Set app identity and visuals:** app name, bundle identifiers, Touchline icon, splash screen, brand colors, typography, and reusable spacing/card/button styles.
3. **Configure environments:** use a public API base URL such as `EXPO_PUBLIC_API_BASE_URL`. This value is not a secret. Keep private database credentials and service-role keys out of the app bundle.
4. **Build one API client:** attach the current Supabase access token to authenticated requests, handle JSON and error responses, and expose typed methods for the ASP.NET routes. Use the API rather than Supabase table queries for app data.
5. **Set up Supabase Auth for React Native:** support sign-in, sign-up, sign-out, session restoration, and token refresh. Persist the session with a mobile-secure storage adapter. Do not treat a user ID supplied by the screen as authenticated identity.
6. **Add shared app states:** loading, empty, offline, expired-session, validation, and server-error states, with retry actions where appropriate.

## Screens to rebuild

- **News:** feed cards, article image/fallback behavior, category filters, and article details. Make the feed vertical and avoid fixed-width web layouts.
- **My Squad:** player search/selection, 300.0 budget display, roster positions, formation selection, captain/vice-captain, bench ordering, transfers, and chips. Submit actions to the API and display server validation errors.
- **Leagues:** create/join private league, show standings, view permitted team summaries, and display league capacity.
- **PSL Table:** current season selector and standings from API data.
- **Live Games:** current gameweek on entry, previous/newer gameweek navigation, fixtures and scores, scorer names when the API provides them, and suitable loading/empty states.
- **Profile/auth:** sign-in, account details, and sign-out using Supabase Auth.

Use a native bottom tab bar for the main sections. Recreate the pitch and card appearance with native views and styles. Use native scrolling and swipe gestures for gameweek navigation, with accessible buttons as an alternative to swiping.

## Mobile-specific behavior

- Respect notches, status bars, home indicators, and safe areas.
- Use comfortable touch targets and readable text at common phone sizes.
- Ensure forms remain usable when the on-screen keyboard is open.
- Keep screens usable on slow or intermittent mobile connections. Cache read responses where appropriate, but treat API responses as the source of truth and do not queue fantasy writes past a gameweek deadline without revalidation.
- Verify all horizontal content fits the screen; use deliberate carousels only when they help the user.
- Provide text labels and accessibility hints for icons and swipe controls.
- Test app links, back navigation, expired sessions, and returning from background.

## API and backend prerequisites

Before testing fantasy flows end to end, coordinate with the API/database owners to:

- Confirm and apply the required Supabase Auth profile and fantasy schema migrations through the canonical `touchline-sync` migration repo. Do not apply the API's proposed SQL directly to production.
- Confirm the SportsMonks lineup and substitution event codes used by the API. Fantasy scoring and live points depend on these mappings.
- Confirm the API's live base URL, CORS/network settings if relevant, and staging credentials.
- Compare API response shapes with the mobile screens. The API README notes that its player and fixture responses do not yet match every field from the existing web/Netlify client.
- Reconcile `src/lib/api/client.ts` with the ASP.NET routes, which are under `/api/v1/...`. The current client uses shorter paths such as `/players` and `/fantasy/team`; news also needs a confirmed news-service endpoint.

## Suggested delivery order

1. Create the Expo app shell and verify it opens on both Android and iOS simulators/devices.
2. Implement Supabase Auth and the shared API client; test a public route and an authenticated `/api/v1/me` request.
3. Build the News, PSL Table, and Live Games read-only screens.
4. Build My Squad read and save flows, then transfers and chips.
5. Build private league create/join and standings.
6. Test phone layouts, accessibility, weak connectivity, session expiry, and server validation.
7. Use Expo's development workflow for device testing; configure EAS builds and store submission when release is ready. The ASP.NET API must be hosted separately—Expo does not host the backend.

## Completion checks

- The same Expo app runs on Android and iOS with the expected Touchline branding.
- A user can sign in, receive a valid session, and make authenticated API requests.
- News, standings, fixtures, and current gameweek render from the API/database.
- A user can create a valid squad, make permitted changes, use chips, and see server-calculated points and league standings.
- Invalid or late changes show clear API validation messages without corrupting the saved team.
- No database password, service-role key, or privileged credential is included in the mobile bundle.
- The existing web app remains available until the team explicitly decides to replace or retire it.
