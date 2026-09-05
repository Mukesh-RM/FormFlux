import { Skeleton } from "@/components/ui/skeleton";

/** App-shell loading state: mirrors the real page rhythm so nothing jumps. */
export default function Loading() {
  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-8">
      <Skeleton className="h-8 w-52" />
      <Skeleton className="mt-3 h-4 w-full max-w-lg" />
      <div className="mt-10 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <div key={index} className="panel space-y-4 rounded-2xl p-5 shadow-card">
            <Skeleton className="h-5 w-2/3" />
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-9 w-full" />
          </div>
        ))}
      </div>
    </div>
  );
}
