import Image from "next/image";
import EmptyState from "@/components/EmptyState";
import MenuItemRow from "@/components/MenuItemRow";
import { getRestaurantMenu } from "@/lib/queries";

// Menu contents change as the pipeline confirms new items — fetch per request.
export const dynamic = "force-dynamic";

const OTHER_CATEGORY = "Other";

export default async function RestaurantMenuPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const items = await getRestaurantMenu(id);

  if (items.length === 0) {
    return (
      <main className="flex min-h-dvh w-full items-center justify-center bg-parchment px-8">
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
