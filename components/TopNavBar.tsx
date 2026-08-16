// The menu button opens the sidebar (navbar-2/3). The filter and search
// buttons (New Steps [navbar-4]/[navbar-5]) each toggle a placeholder
// dropdown only — no real filtering/search yet, matching the app's current
// no-filter-UI MVP scope.
export default function TopNavBar({
  menuOpen,
  onMenuClick,
  filterOpen,
  onFilterClick,
  searchOpen,
  onSearchClick,
}: {
  menuOpen: boolean;
  onMenuClick: () => void;
  filterOpen: boolean;
  onFilterClick: () => void;
  searchOpen: boolean;
  onSearchClick: () => void;
}) {
  return (
    <nav className="fixed inset-x-4 top-4 z-50 flex items-center justify-between">
      <button
        type="button"
        aria-label="Menu"
        aria-expanded={menuOpen}
        onClick={onMenuClick}
        className="glass-chip flex h-11 w-11 items-center justify-center rounded-full text-ink/70 shadow-sm transition-colors hover:text-accent"
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

      <div className="flex items-center gap-4">
        <div className="relative">
          <button
            type="button"
            aria-label="Filter"
            aria-expanded={filterOpen}
            onClick={onFilterClick}
            className="glass-chip flex h-11 w-11 items-center justify-center rounded-full text-ink/70 shadow-sm transition-colors hover:text-accent"
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
              <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
            </svg>
          </button>

          {filterOpen && (
            <div
              role="dialog"
              aria-label="Filters"
              className="glass-chip font-body absolute top-full right-0 mt-3 w-48 rounded-2xl px-4 py-3 text-sm text-ink/70 shadow-sm"
            >
              Filters coming soon.
            </div>
          )}
        </div>

        <div className="relative">
          <button
            type="button"
            aria-label="Search"
            aria-expanded={searchOpen}
            onClick={onSearchClick}
            className="glass-chip flex h-11 w-11 items-center justify-center rounded-full text-ink/70 shadow-sm transition-colors hover:text-accent"
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
          </button>

          {searchOpen && (
            <div
              role="dialog"
              aria-label="Search"
              className="glass-chip font-body absolute top-full right-0 mt-3 w-48 rounded-2xl px-4 py-3 text-sm text-ink/70 shadow-sm"
            >
              Search coming soon.
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}
