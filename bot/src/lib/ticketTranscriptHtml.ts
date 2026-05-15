function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function buildHtmlTranscript(
  messages: {
    id: string;
    authorId: string;
    authorTag: string;
    authorAvatar: string | null;
    createdAt: string;
    content: string;
  }[],
): string {
  const lines = messages
    .map((m) => {
      const aid = escapeHtml(m.authorId);
      const av = m.authorAvatar ? escapeHtml(m.authorAvatar) : "";
      return `<div class="m" data-author-id="${aid}" data-author-avatar="${av}"><span class="t">${escapeHtml(m.createdAt)}</span> <b>${escapeHtml(m.authorTag)}</b><br/><span class="c">${escapeHtml(m.content || "(pièce jointe ou embed)")}</span></div>`;
    })
    .join("\n");
  return `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>Transcript</title>
<style>body{font-family:sans-serif;background:#1e1e2e;color:#cdd6f4;padding:1rem;} .m{border-bottom:1px solid #313244;margin:.5rem 0;padding:.5rem 0;} .t{color:#6c7086;font-size:.85rem;}</style></head><body>${lines}</body></html>`;
}
