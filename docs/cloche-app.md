# Cloche — App Build Spec (Web / PWA)

Prerequisite: read cloche-overview.md in full first — it contains the shared architecture, database schema, glossary, and foundation setup steps. This document assumes the foundation phases (F1–F5) are already complete.

Platform note: this was originally scoped as a React Native/Expo native app. It has been re-scoped to a Progressive Web App (PWA) — a responsive website, built with Next.js, accessible via a direct URL on both phone and desktop from one codebase. Install-to-home-screen is optional, not required. This change was made to get real user testing of the core "can a text-only reel format hold attention" assumption faster and cheaper, without app-store friction or maintaining two parallel codebases. Native app remains a possible future direction post-validation, not abandoned.

---

## 1. Scope & Goal

- Build the consumer-facing feed experience as a responsive website: a full-screen, vertically swipeable feed of confirmed menu items, filterable by distance and price, with a tap-through to a full restaurant menu view.
- Works on phone (the primary target) and desktop (secondary, from the same codebase) via a browser — no app store, no install required to use it.
- This document covers only the app/web repo. It does not cover the pipeline (see cloche-pipeline.md) or shared schema (see cloche-overview.md).

---

## 2. Tech Stack & Tools

- Next.js (App Router) + TypeScript — website/PWA framework.
- @supabase/supabase-js — database client, queries the confirmed_menu_items view only.
- Browser Geolocation API (navigator.geolocation) — device location for distance calculation. Requires a secure context (HTTPS) in production, or localhost during local development — this is why an early deployment matters (see Phase A1).
- CSS scroll-snap (scroll-snap-type, scroll-snap-align) — native browser feature providing full-screen swipe/paging mechanics; no external pager library needed.
- Tailwind CSS (or plain CSS) — styling, consistent with the Visual Design System in Section 4.5.
- Zustand or React Context — lightweight state management for filter state.
- Web App Manifest + Apple meta tags — enables optional "Add to Home Screen"; no offline caching / service worker complexity needed for this MVP.
- Deployment: Vercel (or similar) — needed early, not just at the end, since real-device testing (geolocation, genuine touch/swipe feel) requires a real HTTPS URL, not just a local network address.

---

## 3. Glossary / Key Terms (app-specific)

- Feed Screen — the root page; the swipeable list of cards.
- Card — one rendered menu item plus restaurant metadata.
- Filter Sheet — modal/panel controlling sort order (distance/price).
- Menu Viewer Screen — page listing all confirmed items for one restaurant, grouped by category.
- Distance badge — UI element on each card showing a car icon plus estimated minutes away.
- PWA (Progressive Web App) — a website built to behave like an app: installable to a home screen, responsive, usable full-screen — without requiring an app store.

---

## 4. Architectural Outline

### 4.1 File / Folder Structure
- Note: the "app/" folder below is a Next.js routing convention (the "App Router"), same as in cloche-pipeline.md — not a reference to a native mobile app. This entire project is a website.
- cloche-app/
  - app/
    - page.tsx — Feed Screen (root route)
    - restaurant/[id]/page.tsx — Menu Viewer Screen
    - layout.tsx — root layout; includes manifest link and viewport meta tags
    - globals.css
  - components/
    - FeedCard.tsx
    - FilterSheet.tsx
    - DistanceBadge.tsx
    - MenuItemRow.tsx
  - lib/
    - supabase.ts — Supabase client init
    - queries.ts — all DB query functions
    - distance.ts — haversine / ETA calculation helpers
  - store/
    - filterStore.ts — Zustand store (or Context) for sort/filter state
  - types/
    - index.ts — shared TS types (MenuItem, Restaurant)
  - public/
    - manifest.json — web app manifest for optional install-to-home-screen
  - .env.local — NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY (gitignored)
- Important: Next.js only exposes environment variables to browser-side code if their name is prefixed with NEXT_PUBLIC_. Since the feed is interactive (client-side swiping, live queries), the Supabase URL and anon key must use this prefix, unlike a plain server-only variable. The anon key is meant to be public-safe regardless — this is expected, not a security gap.

### 4.2 Data Types (types/index.ts)
- ConfirmedMenuItem type fields:
  - id — string
  - restaurant_id — string
  - name — string
  - description — string or null
  - price — number or null
  - image_url — string or null
  - category — string or null
  - restaurant_name — string
  - lat — number
  - lng — number
  - hero_image_url — string or null
  - address — string
- SortMode type — one of: "distance", "price_low", "price_high"

### 4.3 Query Layer (lib/queries.ts)
- getFeedItems(sort, userLat, userLng, offset, limit) — queries the confirmed_menu_items view, never menu_items directly.
- getRestaurantMenu(restaurantId) — queries confirmed_menu_items filtered by restaurant_id, grouped by category on the client side.

### 4.4 Distance Calculation
- MVP approach: straight-line (haversine) distance between device GPS and restaurant lat/lng, converted to an estimated drive time using an assumed average speed (e.g. 30 mph in a city context). This is an approximation, not a real routing engine — acceptable for MVP.
- Geolocation via the browser requires a secure context (HTTPS) or localhost — will silently fail or prompt differently if tested over a plain local-network HTTP address. Test location behavior against the real deployed URL, not a local IP.
- Post-MVP improvement (do not build now): swap in a real directions/ETA API.

### 4.5 Visual Design System

This section exists because the original Cloche concept was explicitly built around not depending on photos for visual appeal — restaurant/dish photo quality is inconsistent and out of your control, so the differentiator is meant to be clean, distinctive typography styled like a real physical menu, not a photo-feed aesthetic. This changes how Section 5.1's card should actually be built: photos become a secondary accent, not the full-bleed background.

- Color — a warm ivory/parchment base (not stark white, not the common AI-default cream), deep warm-charcoal ink for primary text (not pure black), and one accent color for now (final hex to be chosen when this is built). Cuisine-coded rotating accents (a different accent per cuisine type) are deferred — restaurants don't currently have a stored cuisine field, and adding one is a schema change that should start in the pipeline, not the app. When that's ready, it'll come back through Section 9 as a New Step. Build with the single default accent until then.
- Type — three roles, not one uniform font everywhere:
  - Display (item names): a characterful serif or slab serif with some letterpress/printed-menu irregularity to it — this carries the "real menu" feeling and should be the most visually distinctive element on the card.
  - Body (descriptions): a clean, restrained humanist sans, quiet by comparison to the display face, so the display face reads as intentional rather than the whole card looking uniform.
  - Utility (price, distance badge, category labels): a monospace or small-caps treatment, evoking a printed price tag or ticket stub — small, structural, not decorative.
- Layout — the card behaves like a page of a printed menu, not a social-feed photo post: item name in large display type near the top, description in body type below it, price set apart on its own line (consider a dot-leader style connector between name and price, like "...................$14" as seen on real menus, if it doesn't hurt legibility on mobile). If a dish photo exists, it appears as a smaller framed accent (e.g. a corner or side element), not a full-bleed background behind the text. If no dish photo exists, the card should look complete and intentional on its own — never like something is missing.
- Signature element — the dot-leader price line, consistent across every card. Cuisine-coded accents will join this as a second signature device once that schema work happens (see the color note above).
- This direction applies to the Feed Screen cards (5.1) and should extend visually to the Menu Viewer Screen (5.3) so the whole app feels like one continuous menu, not two different design languages.
- Responsive note: since this now runs on desktop too (not just mobile), the full-screen card should remain centered and at a sensible max-width on wide viewports rather than stretching edge-to-edge — this leaves genuine unused space on the sides on desktop, which is expected and fine; nothing needs to fill that space for this build.

---

## 5. Screens (Detailed)

### 5.1 Feed Screen (app/page.tsx)
- Full-screen vertical paging view (CSS scroll-snap), one ConfirmedMenuItem per screen/section.
- Card layout follows the Visual Design System in Section 4.5 — a menu page, not a photo post:
  - Base: ivory/parchment card background (not the dish photo)
  - Item name — large display-face type, top of card
  - Description — body-face type, 2–3 lines, truncate with "more" affordance
  - Price — set apart on its own line, dot-leader style connecting name to price if legible on mobile
  - If image_url or hero_image_url exists, show it as a smaller framed accent (corner or side), not a full-bleed background; if neither exists, the card should still look complete and intentional, not empty
  - Restaurant name — tappable/clickable, navigates to restaurant/[id]
  - Distance badge — utility-face type, car icon + "X min away"
  - Category, if present, shown as a small utility-face label
  - Default accent color applied per Section 4.5 (cuisine-coding deferred — see 4.5)
  - Filter icon (top corner) — opens Filter Sheet
- Swipe/scroll down moves to the next item; swipe/scroll up moves to the previous item.
- Infinite-scroll pagination: fetch next batch (~20 items) as user nears the end of the loaded set.

### 5.2 Filter Sheet
- Modal/panel with sort options: Distance (default), Price low to high, Price high to low.
- Applying a filter re-runs the query and resets feed position to the top.

### 5.3 Menu Viewer Screen (app/restaurant/[id]/page.tsx)
- Header: restaurant name, address, hero image.
- Body: all confirmed items for that restaurant, grouped under category headers; items with category = null grouped under an "Other" heading.
- Visually consistent with the Section 4.5 design system — same typography roles, same feel as the feed cards.
- Simple scrollable list — no swipe/paging mechanics needed here.

---

## 6. Explicitly Out of Scope for MVP

- No native app / app store distribution — web-only for now. Native app remains a possible future direction post-validation, not abandoned.
- No offline support or service worker caching — install-to-home-screen only, not a full offline-capable PWA.
- No login/auth screens — anonymous access only.
- No saved/favorites list.
- No restaurant-submitted content — all data originates from the pipeline.
- No video content — photos only.
- No real-time/live routing ETA — approximation only (see 4.4).
- No crowd/upvote system yet — fully designed (see Section 9) but deferred until this core build is working and confirmed on a real device, to avoid changing the core feed query logic and adding an auth dependency at the same time as the platform rewrite.
- No monetization / sponsored placement / ad rail — not yet actionable without real traffic; not even queued as a New Step yet, just a noted future direction.
- No cuisine-coded accent colors — deferred pending a schema addition that starts in the pipeline (see Section 4.5).

---

## 7. Phases

- Phase A1 — Project Scaffolding & Early Deployment
  - Create the Next.js project, install core dependencies (Supabase client, styling), set up .env.local with NEXT_PUBLIC_-prefixed Supabase credentials.
  - Deploy the bare scaffolded project to Vercel (or similar) immediately — this becomes the real HTTPS URL used for all real-device testing throughout the rest of the build, replacing the local-network-IP approach used in the pipeline project.
  - Done when: the default Next.js starter page loads both locally and at a real public HTTPS URL, and that URL opens correctly in mobile Safari.

- Phase A2 — Data Layer
  - Build the Supabase client connection, the TypeScript types describing a menu item, and the query functions the app will use to fetch feed data and a single restaurant's menu.
  - No visible UI changes yet — this is backend plumbing the screens will call into next.
  - Done when: the query functions exist and compile, even though nothing on screen uses them yet.

- Phase A3 — Feed Screen, Static
  - Build what one card in the feed actually looks like (image accent, name, description, price, distance badge) using fake hardcoded data, styled per the Visual Design System.
  - The goal here is purely visual — get the layout and styling right before wiring in real data or scroll-snap paging.
  - Done when: one full-screen card renders correctly, both locally and on the deployed URL opened on a real phone.

- Phase A4 — Feed Screen, Scroll-Snap & Live Data
  - Replace the mock data with real data pulled from Supabase, and add CSS scroll-snap paging plus infinite loading of more items as the user scrolls.
  - Done when: you can open the deployed URL on your phone and swipe through real confirmed menu items pulled from your database, with a feel comparable to a native reel.

- Phase A5 — Distance & Filtering
  - Add browser geolocation permission/location (tested against the real deployed HTTPS URL, not a local IP), the distance-to-restaurant calculation, and the Filter Sheet letting the user sort the feed by distance or price.
  - Done when: cards show a real "X min away" badge based on your actual location on a real phone, and changing the sort option visibly reorders the feed.

- Phase A6 — Menu Viewer Screen
  - Build the second screen: tapping a restaurant's name on a card opens a full list of everything confirmed for that restaurant, grouped by category.
  - Done when: tapping through from the feed shows a real, correctly grouped menu for that restaurant.

- Phase A7 — Polish, PWA Basics & QA
  - Add loading states, empty-state messages, error handling (failed queries, denied location permission), a web app manifest and Apple meta tags for optional install-to-home-screen, a responsive check on wide desktop viewports, and a final visual pass.
  - Done when: the app handles missing data and failures gracefully, works acceptably on both phone and desktop, and can optionally be added to a home screen.

---

## 8. Steps

Direct the AI through these one at a time, confirming each before proceeding. Each step belongs to the Phase noted in brackets.

- Step 1 [A1] — Initialize a new Next.js (App Router, TypeScript) project. Confirm the default dev server runs locally.
- Step 2 [A1] — Install @supabase/supabase-js and your chosen styling library. Create .env.local with empty placeholders for NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY — do not fill in real values; the user will paste in the actual credentials manually from cloche-overview.md Section 5.5 (the anon key, not the service role key — the app only ever reads, never writes). Add .env.local to .gitignore.
- Step 3 [A1] — Deploy the current bare project to Vercel (or the user's preferred host). Confirm the resulting public HTTPS URL loads the default Next.js page, both on desktop and when opened on a real phone's browser.
- Step 4 [A2] — Create lib/supabase.ts initializing the Supabase client from the NEXT_PUBLIC_ env vars.
- Step 5 [A2] — Create types/index.ts with the ConfirmedMenuItem and SortMode types from Section 4.2.
- Step 6 [A2] — Create lib/queries.ts with getFeedItems and getRestaurantMenu functions querying the confirmed_menu_items view.
- Step 7 [A3] — Build components/FeedCard.tsx rendering a single card's static layout per the Visual Design System (Section 4.5): ivory background, display-face name, body-face description, dot-leader price line, small framed image accent if present, distance badge placeholder — using hardcoded mock data, no live data yet.
- Step 8 [A3] — Render a single FeedCard full-screen on the home page. Confirm layout and styling look correct both locally and on the deployed URL opened on a real phone.
- Step 9 [A4] — Replace mock data with a live call to getFeedItems, defaulting sort to distance (using a placeholder/dummy location if geolocation isn't wired yet).
- Step 10 [A4] — Implement full-screen vertical paging using CSS scroll-snap so multiple cards can be swiped/scrolled through, backed by the live query results.
- Step 11 [A4] — Implement infinite-scroll pagination: fetch the next batch as the user approaches the end of the currently loaded items.
- Step 12 [A5] — Request geolocation permission and retrieve device location via navigator.geolocation. Test this specifically against the deployed HTTPS URL on a real phone, not a local network address, since geolocation requires a secure context.
- Step 13 [A5] — Create lib/distance.ts with the haversine distance and estimated-minutes calculation described in Section 4.4, and wire real distances into DistanceBadge.
- Step 14 [A5] — Build components/FilterSheet.tsx with the three sort options, and a filter store (store/filterStore.ts) holding current sort mode.
- Step 15 [A5] — Wire the Filter Sheet's selected sort mode into getFeedItems, resetting feed position to the top on change.
- Step 16 [A6] — Build app/restaurant/[id]/page.tsx calling getRestaurantMenu, rendering items grouped by category under a restaurant header, styled consistently with the Section 4.5 design system.
- Step 17 [A6] — Wire restaurant-name clicks on FeedCard to navigate to the corresponding restaurant/[id] route.
- Step 18 [A7] — Add loading states (feed loading, menu viewer loading) and empty states (no items found, no items for a restaurant).
- Step 19 [A7] — Add error handling for failed Supabase queries and denied/failed location permission (with a sensible fallback, e.g. sort by price if location is denied).
- Step 20 [A7] — Add a web app manifest (public/manifest.json) and Apple meta tags in the root layout for optional "Add to Home Screen" support. No service worker / offline caching needed.
- Step 21 [A7] — Verify responsive behavior on a wide desktop viewport: the card should stay centered at a sensible max-width, not stretch edge-to-edge. Then do a final visual polish pass: typography, spacing, contrast, icon consistency.

---

## 9. New Steps

This is not a changelog. This is where new steps go when a decision made later — after the original Phases/Steps above were already planned — needs the AI to actually do something. Whenever a new decision comes up, it gets discussed and turned into a step here first, then handed to the AI later in its own session, the same one-at-a-time way as the original Steps section.

Each entry should be self-contained enough to copy directly into a prompt on its own, without needing the rest of this conversation for context.

Format:
- New Step [date or short label] — [exact instruction, written the same way as a numbered Step above]. Status: pending / done.

- New Step (Crowd Support Upvotes — deferred until core PWA is confirmed working on a real device) — Add Supabase anonymous auth (silent session on app load, no login screen). Add a votes table (id, menu_item_id FK, user_id FK, created_at) with a unique constraint on (menu_item_id, user_id) — this is a schema change that belongs in cloche-overview.md first, since it's shared. Add a denormalized upvote_count column on menu_items, kept in sync via a Postgres trigger on votes insert. In the app: a double-tap gesture on a feed card registers an upvote (one per person per dish, enforced server-side via the unique constraint, not just client-side), with a brief burst animation on tap. Change getFeedItems' shuffle within a distance tier from uniform random to weighted-random using weight = 1 + log(1 + upvote_count). No visible count below a threshold (start at 10); above it, show a subtle badge ("Local favorite" or similar) styled per the Section 4.5 design system — no arrows, ratio bars, or star ratings. No downvotes or any negative public signal. Status: pending.

- Note (not a step) — Monetization direction: restaurant-paid sponsored/featured placement within distance tiers, plus a desktop-only ad rail using the unused side space noted in Section 4.5's responsive layout (CSS media query or conditional render above a width breakpoint; mobile never mounts the ad component). Not actionable yet — no real traffic exists to sell placement against or justify ad infrastructure. Revisit as a real conversation once the app has genuine usage, not before.

- Note (not a step) — Cuisine-coded accent colors, per Section 4.5: requires adding a cuisine field to restaurants in cloche-overview.md first (pipeline-side work), then a corresponding app-side step to apply per-cuisine accent colors on feed cards. Revisit once ready to make that schema change.
