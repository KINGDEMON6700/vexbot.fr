import { useSearchParams } from "react-router-dom";

/** Suffixe `?guild=…` pour préserver la sélection dans les liens du menu. */
export function useGuildQuerySuffix(): string {
  const [searchParams] = useSearchParams();
  const id = searchParams.get("guild");
  return id ? `?guild=${encodeURIComponent(id)}` : "";
}
