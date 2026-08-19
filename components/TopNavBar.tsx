import Link from "next/link";

// The menu button opens the sidebar (navbar-2/3) and — while it's open — is
// the sidebar's own close control, so it stays visible/clickable above the
// sidebar (z-[70] beats Sidebar's z-[60]) instead of being covered by it.
// Search navigates to the Search Screen (search-1/2) and is hidden entirely
// while the sidebar is open, per "no other buttons should be clickable or
// visible" — the sidebar has full touch/visual priority over the rest of the
// top bar when active. The filter button (New Step [navbar-4]) was removed
// entirely in ui-refresh-3 — filtering is not part of the app's scope.
//
// ui-refresh-4: menu and search share one glass-chip capsule (the Reels-style
// grouped top-icon treatment) instead of rendering as two separate floating
// buttons. The glass background lives on the shared wrapper only — the
// buttons themselves are transparent — so it reads as one continuous pill.
// When the sidebar is open, search unmounts and the wrapper collapses down
// to just the menu button, still perfectly circular.
//
// ui-refresh-5: `navVisible` (driven by Feed's scroll-direction handler)
// toggles a transform/opacity transition on this fixed <nav> element only —
// nothing about the feed's own card sizing or scroll-snap is touched by it.
export default function TopNavBar({
  navVisible,
  menuOpen,
  onMenuClick,
}: {
  navVisible: boolean;
  menuOpen: boolean;
  onMenuClick: () => void;
}) {
  return (
    <nav
      className={`fixed inset-x-4 top-4 z-[70] flex items-center transition-[transform,opacity] duration-300 ease-out ${
        navVisible ? "translate-y-0 opacity-100" : "-translate-y-20 opacity-0 pointer-events-none"
      }`}
    >
      <div className="glass-chip flex h-11 items-center rounded-full shadow-sm">
        <button
          type="button"
          aria-label="Menu"
          aria-expanded={menuOpen}
          onClick={onMenuClick}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-ink/70 transition-colors hover:text-accent"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-5 w-5"
            aria-hidden="true"
          >
            <line x1="4" y1="7" x2="20" y2="7" />
            <line x1="4" y1="12" x2="20" y2="12" />
            <line x1="4" y1="17" x2="20" y2="17" />
          </svg>
        </button>

        {!menuOpen && (
          <>
            <span className="h-5 w-px shrink-0 bg-ink/15" aria-hidden="true" />
            <Link
              href="/search"
              aria-label="Search"
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-ink/70 transition-colors hover:text-accent"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-5 w-5"
                aria-hidden="true"
              >
                <circle cx="11" cy="11" r="7" />
                <line x1="20" y1="20" x2="15.5" y2="15.5" />
              </svg>
            </Link>
          </>
        )}
      </div>
    </nav>
  );
}
