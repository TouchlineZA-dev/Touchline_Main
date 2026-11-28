---
type: project
project: Touchline Mobile App
status: active
tags:
  - touchline
  - mobile
  - release
---

# Touchline Mobile App — Release Checklist

This note tracks work required to release the Expo / React Native app on Android and iOS. Use Obsidian task checkboxes to update progress. The existing web app is outside this release checklist except where the shared API or backend affects mobile.

Related project notes:

- [[IMPLEMENTATION_PLAN]] — system architecture and delivery gates
- [[BACKEND_INTEGRATION]] — database ownership, football data, and scoring constraints
- [[mobile-app/IMPLEMENTATION_GUIDE]] — Expo implementation and mobile acceptance checks

## Current blockers

- [ ] **Restore the production API.** Remove `http://localhost:8085` from the Railway Production `Cors:AllowedOrigins` list. Production validation accepts explicit HTTPS origins only. Set the real app website origin, such as `https://touchlinesa.co.za`, then wait for a successful deployment and verify API health and data routes.
- [ ] **Build and install the Android development app.** The tablet is detected by USB, but local Gradle builds failed in React Native `screens` / `worklets` CMake with `ninja: error: manifest 'build.ninja' still dirty after 100 tries`, including after clearing generated native build caches. Resolve the native build or use an EAS development build, install it, and verify launch.
- [ ] **Verify native sign-in on devices.** Expo Go cannot validate the native OAuth callback flow. Test email sign-in and Google / Apple sign-in with the custom development build on Android and iOS.
- [ ] **Push the current mobile branch.** Commit `8512298` is local on `codex/touchline-mobile`. The push was denied because Git authenticated as `KhanyaChauke-ST10494929` without repository write access. Authenticate as `KhanyaChauke` and ensure that account has Write access to `TouchlineZA-dev/Touchline_Main`, then push the branch.

## 1. API and environment

- [ ] Confirm the Railway API starts in Production with HTTPS-only CORS origins and a healthy database connection.
- [ ] Verify the API can read the current season, players, clubs, fixtures, and gameweeks from Supabase; check sync freshness and useful error reporting.
- [ ] Compare every mobile request and response shape in `mobile-app/src/lib/api/client.ts` with the deployed ASP.NET API contract, including authentication and fantasy routes.
- [ ] Set the release `EXPO_PUBLIC_API_BASE_URL` to the HTTPS Railway API URL in EAS. Confirm the app makes requests to that host on physical devices and never relies on localhost in a release build.
- [ ] Set `EXPO_PUBLIC_SUPABASE_URL` and the public anon / publishable key in the EAS environment. Keep service-role keys, database passwords, and provider secrets out of the mobile bundle.
- [ ] Configure `EXPO_PUBLIC_NEWS_API_BASE_URL` to a reachable HTTPS news service, or move news reads behind the platform API. The current fallback uses `localhost:3000`, which is not reachable as the developer’s server from a released phone.

## 2. Identity and account flows

- [ ] Test sign-up, email confirmation, sign-in, session restore after force-close, token refresh, sign-out, and expired-session recovery on Android and iOS.
- [ ] Test Google and Apple OAuth callbacks using the `touchlinesa` app scheme and the production Supabase provider configuration.
- [ ] Verify the API resolves the authenticated Supabase user to the correct Touchline profile through `/api/v1/me` (or the current agreed profile route).
- [ ] Confirm profile display name, team name, and favourite club save and reload consistently.
- [ ] Implement and verify account deletion / account-data request handling required for store release.

## 3. Mobile screens and football data

- [ ] **Home and news:** load live articles, images, category filters, timestamps, publisher links, and a clear image fallback; handle empty, loading, offline, and retry states.
- [ ] **Live matches:** open on the current gameweek; show kickoff times in SAST, match state, scores, and scorers when available; navigate to older and newer gameweeks and handle postponed or unplayed fixtures.
- [ ] **PSL table and stats:** confirm season selection, club standings, player rankings, and unavailable values agree with API/database data.
- [ ] **Navigation and account:** verify tab state, profile access, sign-in prompts, back navigation, and return-from-background behavior.
- [ ] Check small phones and tablets for safe areas, keyboard overlap, readable type, tap targets, horizontal overflow, and accessible labels.

## 4. Fantasy functionality

- [ ] Confirm canonical fantasy schema migrations have been reviewed and applied through the database-owning repository; do not apply draft SQL directly to production.
- [ ] Confirm SportMonks player/event ID mappings and event codes used for appearances, goals, assists, clean sheets, and substitutions.
- [ ] Build a 15-player squad with the required positions and budget; choose formation, starting XI, bench order, captain, and vice-captain; save it through the API.
- [ ] Force-close and reopen the app and verify the saved squad, prices, budget, gameweek, and selections persist from the database.
- [ ] Test lineup edits, transfers, transfer cost, deadlines, and chip activation. Server validation must reject invalid or late actions without losing the saved squad.
- [ ] Confirm scoring uses only completed valid matches, is repeatable after corrected source data, and produces a visible player-by-player points breakdown.
- [ ] Create and join a league; verify the 20-member cap, invite code, standings, weekly totals, and access to permitted other-user team views.
- [ ] Test the same account on two devices: save or edit on one device and confirm the other sees the authoritative API state and handles conflicting edits clearly.

## 5. Release builds and store readiness

- [ ] Create and verify EAS `development`, `preview`, and `production` build profiles for Android and iOS.
- [ ] Confirm package / bundle IDs, Touchline launcher icon, adaptive Android icon, splash screen, app name, version, and deep-link scheme in installed builds.
- [ ] Configure Android signing and iOS signing / Apple developer credentials in EAS; keep signing material out of Git.
- [ ] Create Android Play internal-testing and iOS TestFlight builds; install each build on a physical device and complete the acceptance journey below.
- [ ] Prepare Play Store and App Store descriptions, screenshots, privacy policy URL, support contact, age rating, data-safety / privacy disclosures, and review notes.
- [ ] Confirm crash reporting and production API monitoring are available before inviting external testers.

## Release acceptance

- [ ] A new user can create or sign into an account on Android and iOS and return to an active session after restarting the app.
- [ ] Football data and news load from reachable HTTPS services with clear empty and failure states.
- [ ] The user can save a valid fantasy team, view points, use permitted actions, and join a league; the saved state persists across devices.
- [ ] A second account sees only data and team views it is authorized to access.
- [ ] No database password, service-role key, or provider secret is present in the app bundle or repository.
- [ ] Android and iOS preview builds pass the real-device checklist and are ready for store review.
