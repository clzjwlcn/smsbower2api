import {
  cleanText,
  fail,
  ok,
  readJson,
  requireAdmin,
} from "@/lib/server";
import {
  DEFAULT_SMSBOWER_API_BASE_URL,
  getSmsBowerSettings,
  updateSmsBowerSettings,
} from "@/lib/settings";

type SettingsPayload = {
  apiBaseUrl?: string;
  apiKey?: string;
};

export async function GET(request: Request) {
  const adminError = requireAdmin(request);
  if (adminError) return adminError;

  const settings = await getSmsBowerSettings();
  return ok({
    settings: {
      apiBaseUrl: settings.apiBaseUrl,
      apiKeyConfigured: settings.apiKeyConfigured,
      apiKeyPreview: settings.apiKeyPreview,
      apiKeySource: settings.apiKeySource,
      defaultApiBaseUrl: DEFAULT_SMSBOWER_API_BASE_URL,
    },
  });
}

export async function PATCH(request: Request) {
  const adminError = requireAdmin(request);
  if (adminError) return adminError;

  const payload = await readJson<SettingsPayload>(request);
  const apiBaseUrl =
    cleanText(payload.apiBaseUrl) || DEFAULT_SMSBOWER_API_BASE_URL;

  try {
    new URL(apiBaseUrl);
  } catch {
    return fail("API 地址格式不正确。");
  }

  const settings = await updateSmsBowerSettings({
    apiBaseUrl,
    apiKey: payload.apiKey,
  });

  return ok({
    settings: {
      apiBaseUrl: settings.apiBaseUrl,
      apiKeyConfigured: settings.apiKeyConfigured,
      apiKeyPreview: settings.apiKeyPreview,
      apiKeySource: settings.apiKeySource,
      defaultApiBaseUrl: DEFAULT_SMSBOWER_API_BASE_URL,
    },
  });
}
