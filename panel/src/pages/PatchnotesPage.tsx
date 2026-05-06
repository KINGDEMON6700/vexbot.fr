import { AuthenticatedSection } from "../components/layout/AuthenticatedSection.js";
import { patchnotes } from "../data/patchnotes.js";

export function PatchnotesPage() {
  return (
    <AuthenticatedSection
      title="Patchnotes"
      description="Retrouve ici les dernières nouveautés et améliorations."
      wrapContent={false}
    >
      <div className="space-y-3">
        {patchnotes.map((note) => (
          <article key={note.version} className="rounded-xl border border-vex-border bg-vex-surface p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-zinc-100">Version {note.version}</h2>
              <span className="text-xs text-zinc-500">{note.date}</span>
            </div>
            <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-zinc-300">
              {note.changes.map((change, idx) => (
                <li key={`${note.version}-${idx}`}>{change}</li>
              ))}
            </ul>
          </article>
        ))}
      </div>
    </AuthenticatedSection>
  );
}
