const block = "animate-pulse rounded-lg bg-muted";

/** Skeleton for the recipe detail and edit pages. */
export default function Loading() {
  return (
    <main
      className="mx-auto w-full max-w-6xl space-y-6 px-4 pt-4 pb-16 sm:pt-8"
      aria-busy="true"
    >
      <span className="sr-only" role="status">
        Cargando receta…
      </span>
      <div className={`${block} h-11 w-28`} />
      <div className="mx-auto max-w-3xl space-y-6">
        <div className={`${block} h-10 w-3/4`} />
        <div className={`${block} h-5 w-full`} />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {Array.from({ length: 3 }, (_, i) => (
            <div key={i} className={`${block} h-16 rounded-xl`} />
          ))}
        </div>
        <div className={`${block} h-72 rounded-xl`} />
      </div>
    </main>
  );
}
