type Props = {
  title: string;
  description?: string;
};

/** En-tête de page du panel — titre + description + ligne d’accent (cohérence entre les pages). */
export function PanelPageHeader({ title, description }: Props) {
  return (
    <header className="ui-page-header">
      <h1>{title}</h1>
      {description ? <p>{description}</p> : null}
      <div className="ui-page-header-accent" aria-hidden />
    </header>
  );
}
