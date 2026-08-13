import LoadingIndicator from "@/components/LoadingIndicator";

export default function FeedLoading() {
  return (
    <main className="flex h-dvh w-full items-center justify-center bg-parchment">
      <LoadingIndicator />
    </main>
  );
}
