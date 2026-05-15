import type { ReactNode } from "react";

type Props = {
  children: ReactNode;
};

/** Enveloppe du contenu principal (sans bandeau de chargement). */
export function PanelRouteTransition({ children }: Props) {
  return <>{children}</>;
}
