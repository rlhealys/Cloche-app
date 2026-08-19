import Image from "next/image";
import Link from "next/link";
import EmptyState from "@/components/EmptyState";
import MenuItemRow from "@/components/MenuItemRow";
import { getRestaurantMenu } from "@/lib/queries";

// Menu contents change as the pipeline confirms new items — fetch per request.
export const dynamic = "force-dynamic";

const OTHER_CATEGORY = "Other";

// Context-aware back button: this screen is reachable from both the Feed
// Screen (FeedCard's restaurant-name link) and the Search Screen (search-6),
// each of which appends its own `?from=` marker when linking here. `search`
// returns to the Search Screen; anything else — including the marker being
// missing, e.g. a direct link — falls back to the Feed Screen, since that's
// this app's original/default entry point.
function BackButton({ from }: { from?: string }) {
  const toSearch = from === "search";

  return (
    <Link
      href={toSearch ? "/search" : "/"}
      aria-label={toSearch ? "Back to search" : "Back to feed"}
      className="glass-chip fixed top-4 left-4 z-20 flex h-11 w-11 items-center justify-center rounded-full text-ink/70 shadow-sm transition-colors hover:text-accent"
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
        <path d="M15 18l-6-6 6-6" />
      </svg>
    </Link>
  );
}

export default async function RestaurantMenuPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ from?: string }>;
}) {
  const { id } = await params;
  const { from } = await searchParams;
  const items = await getRestaurantMenu(id);

  if (items.length === 0) {
    return (
      <main className="flex min-h-dvh w-full items-center justify-center bg-parchment px-8">
        <BackButton from={from} />
        <EmptyState message="No items found for this restaurant." />
      </main>
    );
  }

  const { restaurant_name, address, hero_image_url } = items[0];

  const itemsByCategory = new Map<string, typeof items>();
  for (const item of items) {
    const category = item.category ?? OTHER_CATEGORY;
    if (!itemsByCategory.has(category)) itemsByCategory.set(category, []);
    itemsByCategory.get(category)!.push(item);
  }
  const categories = [...itemsByCategory.keys()].filter((c) => c !== OTHER_CATEGORY);
  if (itemsByCategory.has(OTHER_CATEGORY)) categories.push(OTHER_CATEGORY);

  return (
    <main className="min-h-dvh bg-parchment text-ink">
      <BackButton from={from} />
      <header className="mx-auto max-w-2xl px-6">
        {hero_image_url && (
          <div className="relative mt-6 h-48 w-full overflow-hidden rounded-sm md:h-64">
            <Image
              src={hero_image_url}
              alt={restaurant_name}
              fill
              sizes="(min-width: 672px) 672px, 100vw"
              className="object-cover"
              priority
            />
          </div>
        )}
        <div className="py-8">
          <h1 className="font-display text-3xl font-semibold tracking-tight">
            {restaurant_name}
          </h1>
          <p className="font-body mt-2 text-sm text-ink/70">{address}</p>
        </div>
      </header>

      <div className="mx-auto max-w-2xl px-6 pb-16">
        {categories.map((category) => (
          <section key={category} className="mt-10 first:mt-0">
            <h2 className="font-utility text-xs font-medium tracking-widest text-ink/70 uppercase">
              {category}
            </h2>
            <div className="mt-4 divide-y divide-ink/10">
              {itemsByCategory.get(category)!.map((item) => (
                <MenuItemRow key={item.id} item={item} />
              ))}
            </div>
          </section>
        ))}
      </div>
    </main>
  );
}
