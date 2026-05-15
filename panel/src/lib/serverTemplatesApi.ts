import { apiFetch } from "./api.js";
import type {
  ServerTemplateDetail,
  ServerTemplatePreviewResult,
  ServerTemplateSnapshot,
  ServerTemplateSummary,
} from "../types/serverTemplate.js";

export type GuildStructureResult = {
  snapshot: ServerTemplateSnapshot;
  capturedAt: string;
};

type ApiErrorShape = { error?: { message?: string; code?: string } };

async function readApiError(res: Response): Promise<Error & { status: number; code?: string }> {
  let message = "Erreur";
  let code: string | undefined;
  try {
    const j = (await res.json()) as ApiErrorShape;
    if (j.error?.message) message = j.error.message;
    code = j.error?.code;
  } catch {
    /* ignore */
  }
  const e = new Error(message) as Error & { status: number; code?: string };
  e.status = res.status;
  e.code = code;
  return e;
}

export async function fetchGuildStructure(
  discordGuildId: string,
  options: { refresh?: boolean } = {},
): Promise<GuildStructureResult> {
  const qs = options.refresh ? "?refresh=1" : "";
  const res = await apiFetch(
    `/api/guilds/${encodeURIComponent(discordGuildId)}/structure${qs}`,
  );
  if (!res.ok) throw await readApiError(res);
  return (await res.json()) as GuildStructureResult;
}

export async function fetchServerTemplates(discordGuildId: string): Promise<ServerTemplateSummary[]> {
  const res = await apiFetch(`/api/guilds/${encodeURIComponent(discordGuildId)}/server-templates`);
  if (!res.ok) throw await readApiError(res);
  const data = (await res.json()) as { templates: ServerTemplateSummary[] };
  return data.templates;
}

export async function fetchServerTemplateDetail(
  discordGuildId: string,
  templateId: string,
): Promise<ServerTemplateDetail> {
  const res = await apiFetch(
    `/api/guilds/${encodeURIComponent(discordGuildId)}/server-templates/${encodeURIComponent(templateId)}`,
  );
  if (!res.ok) throw await readApiError(res);
  const data = (await res.json()) as { template: ServerTemplateDetail };
  return data.template;
}

export async function createServerTemplate(
  discordGuildId: string,
  body: { name: string; description?: string | null; snapshot?: ServerTemplateSnapshot },
): Promise<ServerTemplateDetail> {
  const res = await apiFetch(`/api/guilds/${encodeURIComponent(discordGuildId)}/server-templates`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw await readApiError(res);
  const data = (await res.json()) as { template: ServerTemplateDetail };
  return data.template;
}

export async function updateServerTemplate(
  discordGuildId: string,
  templateId: string,
  body: Partial<{ name: string; description: string | null }>,
): Promise<ServerTemplateSummary> {
  const res = await apiFetch(
    `/api/guilds/${encodeURIComponent(discordGuildId)}/server-templates/${encodeURIComponent(templateId)}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
  );
  if (!res.ok) throw await readApiError(res);
  const data = (await res.json()) as { template: ServerTemplateSummary };
  return data.template;
}

export async function deleteServerTemplate(
  discordGuildId: string,
  templateId: string,
): Promise<void> {
  const res = await apiFetch(
    `/api/guilds/${encodeURIComponent(discordGuildId)}/server-templates/${encodeURIComponent(templateId)}`,
    { method: "DELETE" },
  );
  if (!res.ok && res.status !== 204) throw await readApiError(res);
}

export async function previewServerTemplateApply(
  discordGuildId: string,
  templateId: string,
): Promise<ServerTemplatePreviewResult> {
  const res = await apiFetch(
    `/api/guilds/${encodeURIComponent(discordGuildId)}/server-templates/${encodeURIComponent(templateId)}/preview`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    },
  );
  if (!res.ok) throw await readApiError(res);
  return (await res.json()) as ServerTemplatePreviewResult;
}

export type ApplyProgressEvent =
  | { type: "start"; totalSteps: number }
  | { type: "step"; index: number; total: number; label: string; status: "doing" }
  | {
      type: "step";
      index: number;
      total: number;
      label: string;
      status: "done" | "error" | "skipped";
      detail?: string;
    }
  | { type: "done"; appliedSteps: number; failedSteps: number }
  | { type: "fatal"; error: string };

/**
 * Lance l'application d'un template et consomme le flux SSE.
 * Le callback reçoit chaque événement en temps réel.
 */
export async function applyServerTemplate(
  discordGuildId: string,
  templateId: string,
  onEvent: (event: ApplyProgressEvent) => void,
  signal?: AbortSignal,
): Promise<void> {
  const res = await apiFetch(
    `/api/guilds/${encodeURIComponent(discordGuildId)}/server-templates/${encodeURIComponent(templateId)}/apply`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
      signal,
    },
  );
  if (!res.ok) {
    // Si erreur avant d'entrer en mode SSE (ex. permissions manquantes), on lit le JSON d'erreur.
    throw await readApiError(res);
  }
  const reader = res.body?.getReader();
  if (!reader) throw new Error("Impossible de lire la réponse du serveur.");
  const decoder = new TextDecoder();
  let buffer = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    // SSE : événements séparés par "\n\n"
    let idx = buffer.indexOf("\n\n");
    while (idx >= 0) {
      const chunk = buffer.slice(0, idx);
      buffer = buffer.slice(idx + 2);
      // Chaque chunk peut contenir "data: <json>" éventuellement multi-lignes.
      const dataLine = chunk.split("\n").find((l) => l.startsWith("data:"));
      if (dataLine) {
        const payload = dataLine.slice(5).trim();
        if (payload) {
          try {
            const ev = JSON.parse(payload) as ApplyProgressEvent;
            onEvent(ev);
          } catch {
            /* ignore malformed */
          }
        }
      }
      idx = buffer.indexOf("\n\n");
    }
  }
}
