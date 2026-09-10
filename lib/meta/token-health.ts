type DebugTokenResponse = {
  data?: {
    app_id?: string;
    is_valid?: boolean;
    expires_at?: number;
    data_access_expires_at?: number;
    type?: string;
  };
  error?: { message?: string };
};

export type MetaTokenHealth = {
  available: boolean;
  valid: boolean | null;
  expiresAt: number | null;
  dataAccessExpiresAt: number | null;
  message: string;
};

const graphVersion = process.env.META_GRAPH_API_VERSION || "v26.0";

function formatExpiry(timestamp: number | null) {
  if (!timestamp) return null;
  return new Date(timestamp * 1000).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
}

export async function getMetaTokenHealth(): Promise<MetaTokenHealth> {
  const appId = process.env.META_FACEBOOK_APP_ID?.trim();
  const appSecret = process.env.META_FACEBOOK_APP_SECRET?.trim();
  const pageToken = process.env.META_PAGE_ACCESS_TOKEN?.trim();

  if (!appId || !appSecret || !pageToken) {
    return {
      available: false,
      valid: null,
      expiresAt: null,
      dataAccessExpiresAt: null,
      message: "Diagnóstico de validade indisponível: configure App ID, App Secret e Page Access Token.",
    };
  }

  try {
    const url = new URL(`https://graph.facebook.com/${graphVersion}/debug_token`);
    url.searchParams.set("input_token", pageToken);
    url.searchParams.set("access_token", `${appId}|${appSecret}`);

    const response = await fetch(url, { method: "GET", cache: "no-store" });
    const payload = (await response.json().catch(() => ({}))) as DebugTokenResponse;

    if (!response.ok || payload.error || !payload.data) {
      return {
        available: true,
        valid: false,
        expiresAt: null,
        dataAccessExpiresAt: null,
        message: payload.error?.message || "A Meta não conseguiu validar o Page Access Token.",
      };
    }

    const expiresAt = payload.data.expires_at || null;
    const dataAccessExpiresAt = payload.data.data_access_expires_at || null;
    const valid = Boolean(payload.data.is_valid);
    const appMatches = !payload.data.app_id || payload.data.app_id === appId;

    if (!valid || !appMatches) {
      return {
        available: true,
        valid: false,
        expiresAt,
        dataAccessExpiresAt,
        message: !appMatches ? "O token foi emitido para outro aplicativo Meta." : "O Page Access Token está inválido ou expirado.",
      };
    }

    if (expiresAt) {
      const days = Math.ceil((expiresAt * 1000 - Date.now()) / 86_400_000);
      if (days <= 7) {
        return {
          available: true,
          valid: true,
          expiresAt,
          dataAccessExpiresAt,
          message: `Token válido, mas expira em ${Math.max(days, 0)} dia(s) (${formatExpiry(expiresAt)}). Renove antes do vencimento.`,
        };
      }
      return {
        available: true,
        valid: true,
        expiresAt,
        dataAccessExpiresAt,
        message: `Token válido até ${formatExpiry(expiresAt)}.`,
      };
    }

    return {
      available: true,
      valid: true,
      expiresAt: null,
      dataAccessExpiresAt,
      message: "Token válido. A Meta não informou uma data de expiração para este token.",
    };
  } catch {
    return {
      available: true,
      valid: null,
      expiresAt: null,
      dataAccessExpiresAt: null,
      message: "Não foi possível consultar a validade do token agora.",
    };
  }
}
