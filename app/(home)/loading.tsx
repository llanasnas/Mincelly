const block = "animate-pulse rounded-lg bg-muted";

/** Skeleton for the recipe list — mirrors the page layout so nothing jumps when data arrives. */
export default function Loading() {
  return (
    <main
      className="mx-auto w-full max-w-6xl space-y-6 px-4 pt-6 pb-28 sm:py-8"
      aria-busy="true"
    >
      <span className="sr-only" role="status">
        Cargando recetas…
      </span>
      <div className="space-y-2">
        <div className={`${block} h-9 w-48`} />
        <div className={`${block} h-5 w-28`} />
      </div>
      <div className="flex flex-col gap-6 lg:flex-row lg:gap-8">
        <div className="w-full shrink-0 space-y-3 lg:w-72">
          <div className={`${block} h-11 rounded-xl`} />
          <div className={`${block} hidden h-64 rounded-2xl lg:block`} />
        </div>
        <div className="grid flex-1 gap-4 sm:grid-cols-2 sm:gap-6 xl:grid-cols-3">
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className={`${block} h-36 rounded-2xl`} />
          ))}
        </div>
      </div>
    </main>
  );
}
