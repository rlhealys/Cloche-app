# Cloche — App Build Spec (Web / PWA)

Prerequisite: read cloche-overview.md in full first — it contains the shared architecture, database schema, glossary, and foundation setup steps. This document assumes the foundation phases (F1–F5) are already complete.

Platform note: this was originally scoped as a React Native/Expo native app. It has been re-scoped to a Progressive Web App (PWA) — a responsive website, built with Next.js, accessible via a direct URL on both phone and desktop from one codebase. Install-to-home-screen is optional, not required. This change was made to get real user testing of the core "can a text-only reel format hold attention" assumption faster and cheaper, without app-store friction or maintaining two parallel codebases. Native app remains a possible future direction post-validation, not abandoned.

---

## 1. Scope & Goal

- Build the consumer-facing feed experience as a responsive website: a full-screen, vertically swipeable feed of confirmed menu items, defaulting to the tiered distance-shuffle discovery model (see Section 4.3), with a tap-through to a full restaurant menu view. No filter/sort UI in the MVP — see Section 6 and Section 9.
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
- getFeedItems(sort, userLat, userLng, offset, limit) — queries the confirmed_menu_items view, never menu_items directly. In the MVP, this is always called with the tiered-shuffle default — there is no filter/sort UI exposed to the user (see Section 6). The function's price_low/price_high branches (already built in Step 6) remain in the code but are unused/dormant for now — not exposed anywhere — kept for when price filtering returns as a New Step (see Section 9).
- The default (and only, for MVP) mode is tiered shuffle, matching the original "infinite city menu" discovery intent, not a leaderboard. Behavior:
  - Bucket items into distance tiers: 0–1 mi, 1–3 mi, 3–5 mi, 5–10 mi, 10+ mi.
  - Shuffle items randomly within each tier.
  - Concatenate tiers in order (nearest tier first), so the feed still generally favors closer restaurants, but never deterministically shows the exact same single "best" item every time.
  - The shuffle is computed once per page load and held stable while scrolling/paginating within that same load — it does not re-shuffle every time more items are fetched. A fresh page load computes a new shuffle.
  - To make this actually work across multiple separate pagination calls (each fetch is a fresh server request, not a continuation of previous state): the client generates one random seed value when the feed first loads, and passes that same seed to every subsequent getFeedItems call, including paginated ones. getFeedItems uses this seed to produce a deterministic shuffle order — same seed always yields the same tier-bucketed, shuffled order — so slicing by offset/limit across multiple calls never duplicates or skips items. A page reload generates a new seed, producing a fresh shuffle.
  - This reuses the same client-side distance-computation approach already noted as a known limitation in Step 6 (pull candidate rows, compute haversine, process client-side) — tiering and shuffling slot into that same code path.
- getRestaurantMenu(restaurantId) — queries confirmed_menu_items filtered by restaurant_id, grouped by category on the client side. Not affected by any of the above — a restaurant's full menu is always shown complete and unshuffled.

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
- This direction applies to the Feed Screen cards (5.1) and should extend visually to the Menu Viewer Screen (5.2) so the whole app feels like one continuous menu, not two different design languages.
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
  - No filter icon in the MVP — the feed always uses the default tiered distance-shuffle; see Section 6 and Section 9
- Swipe/scroll down moves to the next item; swipe/scroll up moves to the previous item.
- Infinite-scroll pagination: fetch next batch (~20 items) as user nears the end of the loaded set.

### 5.2 Menu Viewer Screen (app/restaurant/[id]/page.tsx)
- Header: restaurant name, address, hero image.
- Body: all confirmed items for that restaurant, grouped under category headers; items with category = null grouped under an "Other" heading.
- Visually consistent with the Section 4.5 design system — same typography roles, same feel as the feed cards.
- Simple scrollable list — no swipe/paging mechanics needed here.

---

## 6. Explicitly Out of Scope for MVP

- No filter/sort UI — the feed always uses the default tiered distance-shuffle (Section 4.3). A "Distance" filter option specifically would be redundant, since it's already the always-on default — there's nothing for it to switch to. Price and/or cuisine filtering may return later as a New Step (see Section 9), but "Distance" as a selectable filter will not be added.
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

- Phase A5 — Distance
  - Add browser geolocation permission/location (tested against the real deployed HTTPS URL, not a local IP), and the distance-to-restaurant calculation.
  - Done when: cards show a real "X min away" badge based on your actual location on a real phone.

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
- Step 2 [A1] — Install @supabase/supabase-js and your chosen styling library. Create .env.local with empty placeholders for NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY — do not fill in real values; the user will paste in the actual credentials manually from cloche-overview.md Section 5.7 (the anon key, not the service role key — the app only ever reads, never writes). Add .env.local to .gitignore.
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
- Step 14 [A6] — Build app/restaurant/[id]/page.tsx calling getRestaurantMenu, rendering items grouped by category under a restaurant header, styled consistently with the Section 4.5 design system.
- Step 15 [A6] — Wire restaurant-name clicks on FeedCard to navigate to the corresponding restaurant/[id] route.
- Step 16 [A7] — Add loading states (feed loading, menu viewer loading) and empty states (no items found, no items for a restaurant).
- Step 17 [A7] — Add error handling for failed Supabase queries and denied/failed location permission (with a sensible fallback, e.g. keep using the last known/placeholder location if denied).
- Step 18 [A7] — Add a web app manifest (public/manifest.json) and Apple meta tags in the root layout for optional "Add to Home Screen" support. No service worker / offline caching needed.
- Step 19 [A7] — Verify responsive behavior on a wide desktop viewport: the card should stay centered at a sensible max-width, not stretch edge-to-edge. The location/item-count pills are now a permanent UI feature (see Section 9) and should be left in place. Then do a final visual polish pass: typography, spacing, contrast, icon consistency.

---

## 9. New Steps

This is not a changelog. This is where new steps go when a decision made later — after the original Phases/Steps above were already planned — needs the AI to actually do something. Whenever a new decision comes up, it gets discussed and turned into a step here first, then handed to the AI later in its own session, the same one-at-a-time way as the original Steps section.

Each entry should be self-contained enough to copy directly into a prompt on its own, without needing the rest of this conversation for context.

Addition: Feed Card Layout Overhaul (Restaurant Link, Category, Directions Badge)

  New Step [card-layout-1] — On FeedCard, combine the restaurant's hero image (hero_image_url) and restaurant name into a single clickable unit: small framed restaurant image directly next to the restaurant name, both wrapped in one tap/click target navigating to restaurant/[id] (same destination as the current restaurant-name link). Add a small visual indicator (e.g. a chevron or arrow icon) next to the name signaling that this element opens the full menu, styled per the Section 4.5 utility-face treatment. This combined unit replaces the current separate placement of restaurant name and item image accent. Status: done.

  New Step [card-layout-2] — In the position directly under the item name (currently occupied by the restaurant name, per the pre-existing layout), display the item's category instead, styled in the Section 4.5 utility-face treatment (same small-caps/monospace tag style already used for category elsewhere). If category is null, omit this element entirely rather than showing an empty or placeholder label, consistent with the design system's "never look like something is missing" principle. Status: done.

  New Step [card-layout-3] — Enlarge the distance badge and change its content to read "Get Directions" combined with the car icon and the estimated drive time (e.g. "🚗 Get Directions · 8 min"), exact copy/format left to implementation but must combine all three elements (label, icon, time) into one visually cohesive badge. Reposition it centered at the bottom of the card, below the price line. This is display-only for now — no click/tap behavior yet (that will be wired up in a future step to open real directions). Status: done.

--- (end of addition: feed card layout overhaul)

Addition: Fix Inaccurate/Stale Geolocation (Safari)

  New Step [geo-fix-1] — Locate the placeholder/dummy location introduced in Step 9 [A4] (used before real geolocation was wired up in Step 12) and confirm it is not being used as a silent fallback anywhere post-Step-12. If any code path still falls back to this dummy coordinate on error, timeout, or permission-denied, that fallback must be replaced with an explicit error/empty state (see geo-fix-4), never a silent hardcoded location.

  New Step [geo-fix-2] — Update the navigator.geolocation.getCurrentPosition call to explicitly pass { enableHighAccuracy: true, maximumAge: 0, timeout: 10000 }. Without enableHighAccuracy, Safari (particularly iOS) commonly returns a fast, coarse, cell-tower/IP-triangulated position rather than a real GPS fix — which often lands near a city's general center rather than the user's actual location. maximumAge: 0 ensures a fresh fix is requested each time rather than serving a cached one.

  New Step [geo-fix-3] — Confirm location is requested fresh on every page load/visit — not persisted or cached across sessions via localStorage, cookies, or similar — so that a user who has physically moved and reopens the site gets an updated position, not a stored one from a previous visit.

  New Step [geo-fix-4] — Add an explicit handled state for geolocation permission-denied or timeout: show a clear message/state in the UI rather than silently defaulting to any hardcoded or placeholder coordinate. The feed should not pretend to have an accurate location when it doesn't.

  New Step [geo-fix-5] — Using the restored debug pills (restore-debug-pills-1), verify on a real iPhone in Safari that the displayed lat/lng matches actual physical location, and that it changes appropriately when physically moving to a different location and reloading.

--- (end of addition: fix inaccurate/stale geolocation)

Addition: Get Directions Button — Export to Google Maps

  New Step [get-directions-1] — Wire the "Get Directions" badge (added display-only in card-layout-3) to open a Google Maps directions link on click: https://www.google.com/maps/dir/?api=1&destination=<restaurant lat>,<restaurant lng>&destination_place_id=<restaurant place_id>. No origin parameter is passed — Google Maps automatically uses the device's own current location as the starting point. Both lat/lng and place_id are already stored on the restaurant from the existing Google Places lookup; no schema change or new data needed.

  New Step [get-directions-2] — Open the link via window.open(url, '_blank') so it opens in a new tab, keeping the feed alive in the background rather than navigating away from the PWA.

--- (end of addition: get directions button — export to google maps)

Addition: Widen Distance Tier Boundaries

  New Step [wide-tiers-1] — In lib/queries.ts, change getFeedItems' distance tier boundaries (Section 4.3) from 0–1 mi, 1–3 mi, 3–5 mi, 5–10 mi, 10+ mi to 0–5 mi, 5–15 mi, 15–30 mi, 30–50 mi. The tiered-shuffle mechanic itself (haversine-based, shuffle within tier, concatenate nearest-tier-first, seeded/stable across pagination) is unchanged — only the boundary values are updated, to better span Houston's actual geographic footprint at launch. No change to distance calculation method (haversine) or the DistanceBadge display logic.

--- (end of addition: widen distance tier boundaries)

Addition: Glassmorphic Overlay Styling for Pills/Badges/Buttons

  New Step [glass-ui-1] — Add a reusable glassmorphic style treatment to the Section 4.5 design system: semi-transparent background (low-opacity fill) combined with backdrop-filter: blur(Npx), and a subtle 1px border/highlight for edge definition against varied card backgrounds — the frosted, translucent look used for overlay UI in apps like Instagram Reels. Apply this treatment to all pill/badge/button-style overlay elements sitting on top of feed cards: the "Get Directions" badge, the category label, and the restaurant name/image clickable unit. Exact blur radius, opacity, and border values are left to implementation to tune visually — expect this to need follow-up refinement passes.

--- (end of addition: glassmorphic overlay styling for pills/badges/buttons)

Addition: Approximation Symbol on Get Directions Time

  New Step [approx-symbol-1] — In the "Get Directions" badge, add a squiggly equals sign (≈) immediately before the time expression, to visually convey that the time is an estimate, not exact (e.g. "🚗 Get Directions · ≈ 3 min"). Keep "≈" and the time value (e.g. "3 min") glued together as one non-breaking unit (e.g. wrapped together with white-space: nowrap or joined by a non-breaking space) so that if the badge's text wraps across two lines, the ≈ stays attached to the time expression it modifies rather than being stranded alone on the line above it.

--- (end of addition: approximation symbol on get directions time)


Addition: Top Navigation Bar (Menu, Filter, Search)

  New Step [navbar-1] — Add a persistent top navigation bar to the Feed Screen, styled per the established design system (Section 4.5) and the glassmorphic treatment from glass-ui-1 for visual consistency with the overlay UI already sitting on top of reel content. Layout: a hamburger menu button (three horizontal lines) at the far left; a filter button and a search button (magnifying glass icon) at the far right, consecutive to each other and evenly spaced — one gap between filter and search, one gap between search and the screen edge, matching spacing.

  New Step [navbar-2] — Build a slide-in sidebar triggered by the hamburger button: enters from the left edge, occupies 85% of screen width, leaving a 15% sliver of the underlying feed visible on the right. Mostly empty for now — place the two existing monitoring pills (location coordinates, item/scroll load count) at the top of the sidebar; this is their permanent home going forward (remove them from wherever they currently render on the feed card itself, per restore-debug-pills-1).

  New Step [navbar-3] — Make the sidebar dismissible three ways: (1) swipe gesture on the sidebar itself, (2) tapping the 15% visible sliver of underlying content (not the sidebar itself) — this area should have a touchable-opacity feel (slight dimming/response on tap), and (3) an explicit exit/close button in the top-right corner of the sidebar.

  New Step [navbar-4] — Wire the filter button to open/toggle a placeholder state — no actual filtering functionality yet, matching the app's current no-filter-UI MVP scope. Button exists and is visually functional (tappable, shows some empty/placeholder state) but has no real behavior.

  New Step [navbar-5] — Wire the search button (magnifying glass icon) to the same placeholder treatment as navbar-4 — visually present and tappable, no real search functionality yet.

--- (end of addition: top navigation bar)

Addition: Approximation Symbol on Prices

  New Step [approx-price-1] — On both the Feed Screen (reel cards) and the Restaurant Menu Screen (restaurant/[id], the cumulative menu view), add a squiggly equals sign (≈) immediately before the dollar sign on every price display (e.g. "≈$14"), in the same font as the price text itself, to indicate prices are approximate. Apply consistently everywhere a price renders in both screens.

--- (end of addition: approximation symbol on prices)

Addition: Pull-to-Refresh on First Reel

  New Step [pull-refresh-1] — Detect a downward drag (finger swipe down / pull gesture, i.e. attempting to scroll up past the top) while the user is positioned on the very first card of the feed. This is the standard reel-app pull-to-refresh trigger (Instagram/TikTok-style) — it should only activate when already at the top of the feed, not from any other scroll position.

  New Step [pull-refresh-2] — On a successful pull-to-refresh trigger, regenerate the session's shuffle seed and refetch page 1 fresh — re-running the tiered-shuffle logic with new randomization within each tier — and reset pagination state back to the start. Include a simple visual loading affordance during the refresh (exact treatment left to implementation, consistent with the existing design system).

--- (end of addition: pull-to-refresh on first reel)

Addition: Crowd Support Upvotes (Direct + Post-Directions Review Queue)

  New Step [upvotes-1] — Add a votes table (id, menu_item_id FK, user_id FK, created_at) with a unique constraint on (menu_item_id, user_id) — enforces one vote per person per dish, server-side. Add a denormalized upvote_count column on menu_items, kept in sync via a Postgres trigger on votes insert. This is a schema change that belongs in cloche-overview.md first, since it's shared with the pipeline. Status: done — schema documented in cloche-overview.md Sections 5.2/5.4/5.5 and its Documentation Log (08/18/26); SQL provided to the user to run manually in the Supabase SQL Editor, not yet confirmed applied to the live project.

  New Step [upvotes-2] — Add Supabase anonymous auth: a silent session created on app load, no login screen or user-facing auth UI of any kind. This provides the stable user_id per browser/device used by the unique constraint in upvotes-1. Status: done — lib/auth.ts's ensureAnonymousSession() checks for an existing session and calls supabase.auth.signInAnonymously() if none exists; mounted via the no-render components/AnonymousAuthInit.tsx in app/layout.tsx so it runs on every app load. Supabase persists the session in localStorage by default, so the same anonymous user_id is reused across visits on the same browser. Requires "Allow anonymous sign-ins" to be enabled in the Supabase project's Authentication settings (dashboard toggle, not SQL) — not yet confirmed enabled on the live project.

  New Step [upvotes-3] — Implement direct double-tap upvoting: double-tapping a card while scrolling upvotes that dish immediately, with a brief burst animation on tap. Passive, optional, available any time, zero friction. Enforced server-side via the unique constraint from upvotes-1, not just client-side. Status: done — FeedCard.tsx detects a double-tap (two clicks within 300ms) and immediately plays a fading heart-burst animation (new animate-upvote-burst keyframe in globals.css) regardless of network outcome; lib/queries.ts's upvoteMenuItem() inserts { menu_item_id, user_id } into votes using the current anonymous session's user id (upvotes-2) and silently swallows a unique-violation (Postgres code 23505) rather than erroring, so a repeat double-tap on an already-upvoted dish still bursts but never adds a second row — the unique constraint from upvotes-1 is the actual enforcement, not the client. The restaurant-link and Get-Directions badge now stopPropagation on click so taps on those nested controls don't also register as card double-taps.

  New Step [upvotes-4] — Change getFeedItems' shuffle within a distance tier from uniform random to weighted-random using weight = 1 + log(1 + upvote_count). This gives upvoted items a statistically higher chance of surfacing within their tier — a soft weighting, not a hard sort override. Status: done — lib/queries.ts's per-tier shuffle now uses an Efraimidis-Spirakis weighted shuffle (weightedShuffleWithRandom, replacing the old uniform shuffleWithRandom): each item draws key = random()^(1/weight) with weight = 1 + log(1 + upvote_count) from the same seeded PRNG, then tiers are ordered by key descending — higher-upvote items skew toward earlier keys on average without ever being guaranteed to sort first. upvote_count added to the ConfirmedMenuItem type (types/index.ts) to support this.

  New Step [upvotes-5] — No visible upvote count below a threshold; above it, show a subtle "Local/Crowd Favorite" badge styled per the Section 4.5 design system — no arrows, ratio bars, or star ratings, no downvotes or any negative public signal, ever. Set the threshold to 10 upvotes — intentionally low so it's achievable and testable at current traffic levels. Implement this as a named, easily-tunable constant, since it will need revisiting once real usage data exists. Status: done — FeedCard.tsx defines CROWD_FAVORITE_UPVOTE_THRESHOLD = 10 and, when item.upvote_count meets it, renders a "Crowd Favorite" pill (glass-chip, font-utility, accent-colored text) alongside the existing category chip in the row under the item name; below the threshold nothing upvote-related renders at all — the raw count is never shown, and there is no downvote or negative-signal UI anywhere. No icon, arrow, ratio, or star used, per spec.

  New Step [upvotes-6] — Implement the post-directions review queue write: tapping "Get Directions" appends { itemId, timestamp, userId } to a pendingReviews array in localStorage — a real array/queue, not a single overwritable flag, so multiple direction-taps across a session all get queued. Status: done — new lib/pendingReviews.ts exports appendPendingReview(itemId), which reads the current anonymous session's user id, reads+parses the existing "pendingReviews" localStorage array (tolerating missing/corrupt data by falling back to []), pushes { itemId, timestamp: Date.now(), userId }, and writes the array back — so every tap adds a new entry rather than overwriting. DistanceBadge.tsx (now requiring an itemId prop, passed as item.id from FeedCard.tsx) calls it in the Get Directions link's onClick, alongside the existing stopPropagation. No read/prune/surface logic yet — that's upvotes-7/8/9.

  New Step [upvotes-7] — On every feed mount (returning from backgrounding, or a fresh reload after time away), check the pendingReviews array. Discard any entries older than 24 hours silently, with no banner or notification for the discard itself. Enforce a soft cap of ~5–10 entries — beyond that, silently drop the oldest unanswered entries rather than letting the queue grow unbounded. Status: done — lib/pendingReviews.ts's new prunePendingReviews() filters out entries older than PENDING_REVIEW_MAX_AGE_MS (24h), then keeps only the newest PENDING_REVIEW_MAX_QUEUE_SIZE (8, within the 5-10 spec range) of what remains — both named, tunable constants — writing back to localStorage only when something actually changed, with no banner/notification for the discard. Feed.tsx calls it in a useEffect on mount (covers a fresh reload, since Feed remounts then) and again on every `visibilitychange` to "visible" (covers returning from backgrounding, since a backgrounded tab doesn't unmount/remount). No queue is read into UI state yet — surfacing/answering it is upvotes-8/9.

  New Step [upvotes-8] — If valid entries remain after the check in upvotes-7, surface the oldest one (FIFO) as a single dismissible, non-blocking banner — "How was [dish name]? 👍 / ✕" — pinned near the top of the screen, never dimming or blocking scroll/interaction underneath it. Only one banner shows at a time; the next pending item (if any) surfaces at a later natural trigger, never stacked back-to-back with the current one. Status: done — new components/PendingReviewBanner.tsx, rendered in Feed.tsx's loaded-feed branch. On mount and on every `visibilitychange` to "visible" it calls prunePendingReviews() (from upvotes-7) and, if a `bannerActiveRef` guard shows no banner is already up, takes queue[0] (the oldest, since entries are appended oldest-first), looks up its dish name via the new getMenuItemName() query (lib/queries.ts; returns null and the entry is skipped if the item's gone/unconfirmed), and shows a small glass-chip pill fixed near the top ("How was [dish name]? 👍 ✕") — compact and centered, not a full-width overlay, so it never dims or blocks the feed underneath. The ref guard means a second trigger while one's already showing (or a name lookup still in flight) never stacks a second banner; the next pending entry only gets picked up on a later mount/visibilitychange. Both buttons currently just dismiss the banner from view — writing a vote and removing the entry from the queue is upvotes-9, not implemented yet. Fix (same day): a dish removed/unconfirmed between the "Get Directions" tap and the banner check made getMenuItemName resolve to null; the original code correctly never rendered a broken "How was null?" banner, but it also left that stale entry stuck at the head of the queue forever, silently blocking every valid entry behind it. PendingReviewBanner now walks the queue oldest-first, and on a null name calls the new lib/pendingReviews.ts removePendingReview() to discard that one entry outright (no banner, matching a normal dismiss's removal) and tries the next entry instead.

  New Step [upvotes-9] — Wire the banner's two actions: tapping 👍 writes a vote to the votes table (subject to the same unique constraint as upvotes-1) and removes that entry from the queue. Tapping ✕ (dismiss) simply removes the entry from the queue with no write to votes at all — a dismiss is not treated as a negative signal, since it doesn't reliably mean "disliked it," only "no data," and must never affect upvote_count. Status: done — PendingReviewBanner.tsx now keeps the full PendingReviewEntry (not just itemId) in its banner state, so both actions can remove the exact queued entry via removePendingReview() (lib/pendingReviews.ts, added during the upvotes-8 stale-entry fix). 👍 (handleGood) calls the existing upvoteMenuItem() from upvotes-3 — same (menu_item_id, user_id) unique constraint, same silent-swallow of an already-voted duplicate — then removes the entry and clears the banner. ✕ (handleDismiss) only removes the entry and clears the banner; it never calls upvoteMenuItem or touches votes/upvote_count in any way, so a dismiss carries no signal, positive or negative.

  Note (not a step) — Known, accepted fragility: localStorage-based queueing can be cleared by private browsing, manual data clearing, or iOS ITP purging after inactivity. Worst case is a silently missed prompt, not a broken experience — this tradeoff is accepted as-is for MVP, not something to engineer around right now.

--- (end of addition: crowd support upvotes (direct + post-directions review queue))
