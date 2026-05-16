import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import { SaveChangesBar } from "../ui/SaveChangesBar.js";
import { patchBotMember } from "../../lib/overviewApi.js";
import type { OverviewResponse } from "../../types/overview.js";

type BotInfo = NonNullable<OverviewResponse["bot"]>;

const MAX_BYTES = 8 * 1024 * 1024;

/** Nom affiché sur ce serveur : surnom Discord ou, à défaut, nom du compte. */
function effectiveNicknameDisplay(bot: BotInfo): string {
  return (bot.nickname ?? bot.accountUsername).slice(0, 32);
}

/** Ce qu’on envoie à l’API : null = pas de surnom serveur (Discord affiche le nom du compte). */
function nicknameForApi(trimmedInput: string, accountUsername: string): string | null {
  const t = trimmedInput.trim();
  if (t === "" || t === accountUsername) return null;
  return t.slice(0, 32);
}

function readFileAsDataUri(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => {
      const s = r.result;
      if (typeof s === "string") resolve(s);
      else reject(new Error("read"));
    };
    r.onerror = () => reject(new Error("read"));
    r.readAsDataURL(file);
  });
}

type Props = {
  discordGuildId: string;
  bot: BotInfo;
  onSaved: () => Promise<void>;
};

export function BotAppearanceCard({ discordGuildId, bot, onSaved }: Props) {
  const [nickDraft, setNickDraft] = useState(() => effectiveNicknameDisplay(bot));
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saved">("idle");
  const [message, setMessage] = useState<string | null>(null);

  const [pendingAvatar, setPendingAvatar] = useState<string | null>(null);
  const [pendingBanner, setPendingBanner] = useState<string | null>(null);
  const [removeAvatar, setRemoveAvatar] = useState(false);
  const [removeBanner, setRemoveBanner] = useState(false);

  const avatarInputRef = useRef<HTMLInputElement>(null);
  const bannerInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setNickDraft(effectiveNicknameDisplay(bot));
    setPendingAvatar(null);
    setPendingBanner(null);
    setRemoveAvatar(false);
    setRemoveBanner(false);
    setMessage(null);
  }, [
    bot.nickname,
    bot.guildAvatarUrl,
    bot.guildBannerUrl,
    bot.defaultAvatarUrl,
    bot.defaultBannerUrl,
    bot.accountUsername,
  ]);

  /** Aperçu : image serveur si définie, sinon logo du bot par défaut. */
  const previewAvatar =
    pendingAvatar ??
    (removeAvatar ? bot.defaultAvatarUrl : bot.guildAvatarUrl ?? bot.defaultAvatarUrl);

  /** Aperçu : bannière serveur si définie, sinon bannière par défaut du bot. */
  const previewBanner =
    pendingBanner ??
    (removeBanner ? bot.defaultBannerUrl : bot.guildBannerUrl ?? bot.defaultBannerUrl);

  const handleAvatarPick = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setMessage("Choisissez une image (PNG, JPEG, GIF ou WebP).");
      return;
    }
    if (file.size > MAX_BYTES) {
      setMessage("L’image fait plus de 8 Mo. Choisissez un fichier plus léger.");
      return;
    }
    try {
      const data = await readFileAsDataUri(file);
      setPendingAvatar(data);
      setRemoveAvatar(false);
      setMessage(null);
    } catch {
      setMessage("Impossible de lire ce fichier.");
    }
  };

  const handleBannerPick = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setMessage("Choisissez une image (PNG, JPEG, GIF ou WebP).");
      return;
    }
    if (file.size > MAX_BYTES) {
      setMessage("L’image fait plus de 8 Mo. Choisissez un fichier plus léger.");
      return;
    }
    try {
      const data = await readFileAsDataUri(file);
      setPendingBanner(data);
      setRemoveBanner(false);
      setMessage(null);
    } catch {
      setMessage("Impossible de lire ce fichier.");
    }
  };

  const isDirty = useMemo(() => {
    const nickResolved = nicknameForApi(nickDraft, bot.accountUsername);
    const nickChanged = nickResolved !== (bot.nickname ?? null);
    const avatarChanged = pendingAvatar !== null || (removeAvatar && Boolean(bot.guildAvatarUrl));
    const bannerChanged = pendingBanner !== null || (removeBanner && Boolean(bot.guildBannerUrl));
    return nickChanged || avatarChanged || bannerChanged;
  }, [
    nickDraft,
    bot.nickname,
    bot.accountUsername,
    bot.guildAvatarUrl,
    bot.guildBannerUrl,
    pendingAvatar,
    pendingBanner,
    removeAvatar,
    removeBanner,
  ]);

  useEffect(() => {
    if (isDirty && saveStatus === "saved") setSaveStatus("idle");
  }, [isDirty, saveStatus]);

  function handleDiscard() {
    setNickDraft(effectiveNicknameDisplay(bot));
    setPendingAvatar(null);
    setPendingBanner(null);
    setRemoveAvatar(false);
    setRemoveBanner(false);
    setSaveStatus("idle");
    setMessage(null);
  }

  const handleSave = async () => {
    setSaving(true);
    setSaveStatus("idle");
    setMessage(null);
    try {
      const patch: {
        nickname?: string | null;
        avatar?: string | null;
        banner?: string | null;
      } = {};

      const nickResolved = nicknameForApi(nickDraft, bot.accountUsername);
      if (nickResolved !== (bot.nickname ?? null)) {
        patch.nickname = nickResolved;
      }

      if (removeAvatar && bot.guildAvatarUrl) {
        patch.avatar = null;
      } else if (pendingAvatar) {
        patch.avatar = pendingAvatar;
      }

      if (removeBanner && bot.guildBannerUrl) {
        patch.banner = null;
      } else if (pendingBanner) {
        patch.banner = pendingBanner;
      }

      if (Object.keys(patch).length === 0) {
        setMessage("Rien à enregistrer.");
        return;
      }

      await patchBotMember(discordGuildId, patch);
      setMessage(null);
      setSaveStatus("saved");
      setPendingAvatar(null);
      setPendingBanner(null);
      setRemoveAvatar(false);
      setRemoveBanner(false);
      await onSaved();
    } catch {
      setMessage(
        "Impossible d’enregistrer. Vérifie les droits du bot, la taille des images, ou si ce serveur autorise les bannières de profil.",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mt-4 flex flex-col gap-5">
      <p className="text-sm leading-relaxed text-zinc-400">
        Photo, bannière et nom affichés sur <span className="text-zinc-300">ce serveur</span> uniquement — comme le
        profil du bot sur Discord.
      </p>

      <div>
        <p className="mb-1.5 text-xs font-medium text-zinc-500">Nom</p>
        <input
          type="text"
          maxLength={32}
          value={nickDraft}
          onChange={(e) => setNickDraft(e.target.value)}
          className="ui-input max-w-md"
          aria-label="Nom du bot"
        />
      </div>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
        <div className="flex flex-col gap-2">
          <p className="text-xs font-medium text-zinc-500">Photo</p>
          <div className="flex h-20 w-20 shrink-0 overflow-hidden rounded-xl border border-vex-border bg-vex-bg">
            {previewAvatar ? (
              <img
                src={previewAvatar}
                alt=""
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-lg font-semibold text-zinc-600">
                {bot.accountUsername.slice(0, 1).toUpperCase()}
              </div>
            )}
          </div>
          <input
            ref={avatarInputRef}
            type="file"
            accept="image/png,image/jpeg,image/jpg,image/gif,image/webp"
            className="sr-only"
            onChange={(e) => void handleAvatarPick(e)}
          />
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => avatarInputRef.current?.click()}
              className="ui-btn-secondary px-3 py-1.5 text-xs font-medium text-zinc-200"
            >
              Choisir une image
            </button>
            {(bot.guildAvatarUrl || pendingAvatar) && (
              <button
                type="button"
                onClick={() => {
                  setPendingAvatar(null);
                  if (bot.guildAvatarUrl) setRemoveAvatar(true);
                }}
                className="ui-btn-secondary px-3 py-1.5 text-xs text-zinc-400 hover:text-zinc-200"
              >
                Retirer la photo
              </button>
            )}
          </div>
        </div>

        <div className="min-w-0 flex-1">
          <p className="mb-1.5 text-xs font-medium text-zinc-500">Bannière</p>
          <div className="mb-2 h-24 w-full max-w-md overflow-hidden rounded-lg border border-vex-border bg-vex-bg">
            {previewBanner ? (
              <img
                src={previewBanner}
                alt=""
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full items-center justify-center text-xs text-zinc-600">
                Aucune bannière
              </div>
            )}
          </div>
          <input
            ref={bannerInputRef}
            type="file"
            accept="image/png,image/jpeg,image/jpg,image/gif,image/webp"
            className="sr-only"
            onChange={(e) => void handleBannerPick(e)}
          />
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => bannerInputRef.current?.click()}
              className="ui-btn-secondary px-3 py-1.5 text-xs font-medium text-zinc-200"
            >
              Choisir une bannière
            </button>
            {(bot.guildBannerUrl || pendingBanner) && (
              <button
                type="button"
                onClick={() => {
                  setPendingBanner(null);
                  if (bot.guildBannerUrl) setRemoveBanner(true);
                }}
                className="ui-btn-secondary px-3 py-1.5 text-xs text-zinc-400 hover:text-zinc-200"
              >
                Retirer la bannière
              </button>
            )}
          </div>
          <p className="mt-2 text-xs text-zinc-500">
            La bannière de profil serveur dépend des options Discord (ex. niveau de boost du serveur).
          </p>
        </div>
      </div>

      {message ? <p className="text-sm text-zinc-400">{message}</p> : null}

      <SaveChangesBar
        visible={isDirty || saveStatus === "saved"}
        saving={saving}
        status={saveStatus === "saved" && !isDirty ? "saved" : "dirty"}
        onSave={() => void handleSave()}
        onDiscard={handleDiscard}
        zIndexClass="z-50"
      />
    </div>
  );
}

