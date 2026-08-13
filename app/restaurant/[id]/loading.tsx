import LoadingIndicator from "@/components/LoadingIndicator";

export default function RestaurantMenuLoading() {
  return (
    <main className="flex min-h-dvh w-full items-center justify-center bg-parchment">
      <LoadingIndicator />
    </main>
  );
}
