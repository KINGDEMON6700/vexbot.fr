import { PanelPageHeader } from "./PanelPageHeader.js";

/** Carte vide (structure sans texte « Chargement… »). */
export function CardSkeleton({ className = "" }: { className?: string }) {
  return <div className={`ui-card min-h-[8rem] ${className}`.trim()} aria-hidden />;
}

/** En-tête de page + une carte — auth / guild en attente. */
export function PageAuthSkeleton({
  title,
  description,
}: {
  title: string;
  description?: string;
}) {
  return (
    <div className="flex flex-col gap-6">
      <PanelPageHeader title={title} description={description} />
      <CardSkeleton className="min-h-[12rem]" />
    </div>
  );
}

export function OverviewPageSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <PanelPageHeader
        title="Vue d'ensemble"
        description={"Votre serveur Discord et l'activité de Vex sur ce serveur."}
      />
      <div className="flex flex-col gap-6 lg:flex-row lg:items-stretch">
        <section className="min-w-0 flex-1 rounded-xl border border-vex-border bg-vex-surface p-5">
          <div className="h-3.5 w-28 rounded bg-vex-bg/70" />
          <div className="mt-4 flex gap-4">
            <div className="h-16 w-16 shrink-0 rounded-xl bg-vex-bg/60" />
            <div className="min-w-0 flex-1 space-y-3">
              <div className="h-5 w-40 rounded bg-vex-bg/70" />
              <div className="grid gap-2 sm:grid-cols-2">
                <div className="h-14 rounded-lg border border-vex-border/80 bg-vex-bg/40" />
                <div className="h-14 rounded-lg border border-vex-border/80 bg-vex-bg/40" />
              </div>
            </div>
          </div>
        </section>
        <section className="w-full shrink-0 rounded-xl border border-vex-border bg-vex-surface p-5 lg:max-w-sm">
          <div className="h-3.5 w-32 rounded bg-vex-bg/70" />
          <div className="mt-4 space-y-2">
            <div className="h-14 rounded-lg border border-vex-border/80 bg-vex-bg/40" />
            <div className="h-14 rounded-lg border border-vex-border/80 bg-vex-bg/40" />
          </div>
        </section>
      </div>
      <section className="rounded-xl border border-vex-border bg-vex-surface p-5">
        <div className="h-3.5 w-36 rounded bg-vex-bg/70" />
        <div className="mt-4 h-24 max-w-md rounded-lg border border-vex-border/80 bg-vex-bg/40" />
      </section>
    </div>
  );
}

export function EmbedsPageSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <CardSkeleton className="min-h-[5.5rem]" />
      <CardSkeleton className="min-h-[4.5rem]" />
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(280px,400px)]">
        <CardSkeleton className="min-h-[22rem]" />
        <CardSkeleton className="min-h-[22rem] lg:sticky lg:top-4" />
      </div>
    </div>
  );
}

export function TicketsPageSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <CardSkeleton className="min-h-[14rem]" />
      <CardSkeleton className="min-h-[20rem]" />
    </div>
  );
}

export function TicketListRowsSkeleton() {
  return (
    <ul className="divide-y divide-vex-border border-t border-vex-border bg-vex-bg/40" aria-hidden>
      {[0, 1, 2, 3].map((i) => (
        <li key={i} className="flex items-center gap-3 px-4 py-3.5">
          <div className="h-8 w-8 shrink-0 rounded-full bg-vex-bg/60" />
          <div className="min-w-0 flex-1 space-y-1.5">
            <div className="h-3.5 w-40 rounded bg-vex-bg/70" />
            <div className="h-3 w-24 rounded bg-vex-bg/50" />
          </div>
        </li>
      ))}
    </ul>
  );
}

export function CommandsPageSkeleton() {
  return (
    <div className="space-y-6">
      <section>
        <div className="mb-3 h-4 w-40 rounded bg-vex-bg/70" />
        <div className="h-3 w-full max-w-md rounded bg-vex-bg/50" />
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <CardSkeleton className="min-h-[7rem]" />
          <CardSkeleton className="min-h-[7rem]" />
          <CardSkeleton className="min-h-[7rem]" />
        </div>
      </section>
      <section>
        <div className="mb-3 h-4 w-52 rounded bg-vex-bg/70" />
        <div className="grid gap-4 lg:grid-cols-[260px_minmax(0,1fr)]">
          <CardSkeleton className="min-h-[12rem]" />
          <CardSkeleton className="min-h-[16rem]" />
        </div>
      </section>
    </div>
  );
}

export function ModulesPageSkeleton() {
  return (
    <div className="space-y-3" aria-busy="true">
      <CardSkeleton className="min-h-[12rem]" />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <CardSkeleton className="min-h-[8rem] sm:col-span-2 lg:col-span-2" />
        <CardSkeleton />
        <CardSkeleton />
      </div>
    </div>
  );
}

export function TemplatesPageSkeleton() {
  return (
    <div className="space-y-5">
      <CardSkeleton className="min-h-[10rem]" />
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(280px,360px)]">
        <CardSkeleton className="min-h-[16rem]" />
        <CardSkeleton className="min-h-[16rem]" />
      </div>
    </div>
  );
}

export function MarketplacePageSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <CardSkeleton className="min-h-[5rem]" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <CardSkeleton className="min-h-[10rem]" />
        <CardSkeleton className="min-h-[10rem]" />
        <CardSkeleton className="min-h-[10rem]" />
        <CardSkeleton className="min-h-[10rem]" />
        <CardSkeleton className="min-h-[10rem]" />
        <CardSkeleton className="min-h-[10rem]" />
      </div>
    </div>
  );
}
