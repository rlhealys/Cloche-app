import BackToSearchButton from "@/components/BackToSearchButton";
import EmptyState from "@/components/EmptyState";
import MenuItemDetail from "@/components/MenuItemDetail";
import { getMenuItem } from "@/lib/queries";

// Confirmation/availability can change as the pipeline updates — fetch per
// request, same as the Restaurant Menu Screen.
export const dynamic = "force-dynamic";

export default async function MenuItemDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const item = await getMenuItem(id);

  if (!item) {
    return (
      <main className="flex min-h-dvh w-full items-center justify-center bg-parchment px-8">
        <BackToSearchButton />
        <EmptyState message="This item is no longer available." />
      </main>
    );
  }

  return <MenuItemDetail item={item} />;
}
