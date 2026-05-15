export type WelcomePlaceholderContext = {
  userId: string;
  userName: string;
  displayName: string;
  serverName: string;
  memberCount: number;
};

/** Remplace les variables du type {user}, {user.mention}, etc. */
export function applyWelcomePlaceholders(template: string, ctx: WelcomePlaceholderContext): string {
  return template
    .replaceAll("{user}", ctx.displayName)
    .replaceAll("{user.mention}", `<@${ctx.userId}>`)
    .replaceAll("{user.name}", ctx.userName)
    .replaceAll("{user.id}", ctx.userId)
    .replaceAll("{server}", ctx.serverName)
    .replaceAll("{guild}", ctx.serverName)
    .replaceAll("{memberCount}", String(ctx.memberCount));
}
