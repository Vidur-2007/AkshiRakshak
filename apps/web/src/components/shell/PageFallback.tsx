/** Suspense fallback shaped like a page header, so nothing jumps when the page arrives. */
export function PageFallback() {
  return (
    <div className="mx-auto w-full max-w-5xl px-4 pt-8 sm:px-6 lg:pt-12" aria-hidden>
      <div className="h-4 w-28 animate-pulse rounded-full bg-overlay/6" />
      <div className="mt-4 h-9 w-2/3 max-w-md animate-pulse rounded-chip bg-overlay/6" />
      <div className="mt-3 h-5 w-full max-w-xl animate-pulse rounded-chip bg-overlay/5" />
      <div className="surface mt-8 h-56 animate-pulse" />
    </div>
  );
}
