import {
  cleanText,
  fail,
  ok,
  readJson,
  requireAdmin,
} from "@/lib/server";
import {
  DEFAULT_SMSBOWER_API_BASE_URL,
  getAnnouncementSettings,
  getSmsBowerSettings,
  updateAnnouncementSettings,
  updateSmsBowerSettings,
} from "@/lib/settings";

type SettingsPayload = {
  apiBaseUrl?: string;
  apiKey?: string;
  announcementEnabled?: boolean | number | string;
  announcementTitle?: string;
  announcementBody?: string;
};

function toSettingsResponse(
  settings: Awaited<ReturnType<typeof getSmsBowerSettings>>,
  announcement: Awaited<ReturnType<typeof getAnnouncementSettings>>
) {
  return {
    apiBaseUrl: settings.apiBaseUrl,
    apiKeyConfigured: settings.apiKeyConfigured,
    apiKeyPreview: settings.apiKeyPreview,
    apiKeySource: settings.apiKeySource,
    defaultApiBaseUrl: DEFAULT_SMSBOWER_API_BASE_URL,
    announcementEnabled: announcement.enabled,
    announcementTitle: announcement.title,
    announcementBody: announcement.body,
  };
}

export async function GET(request: Request) {
  const adminError = await requireAdmin(request);
  if (adminError) return adminError;

  const [settings, announcement] = await Promise.all([
    getSmsBowerSettings(),
    getAnnouncementSettings(),
  ]);
  return ok({
    settings: toSettingsResponse(settings, announcement),
  });
}

export async function PATCH(request: Request) {
  const adminError = await requireAdmin(request);
  if (adminError) return adminError;

  const payload = await readJson<SettingsPayload>(request);
  const apiBaseUrl =
    cleanText(payload.apiBaseUrl) || DEFAULT_SMSBOWER_API_BASE_URL;

  try {
    new URL(apiBaseUrl);
  } catch {
    return fail("API 地址格式不正确。");
  }

  const [settings, announcement] = await Promise.all([
    updateSmsBowerSettings({
      apiBaseUrl,
      apiKey: payload.apiKey,
    }),
    updateAnnouncementSettings({
      enabled: payload.announcementEnabled,
      title: payload.announcementTitle,
      body: payload.announcementBody,
    }),
  ]);

  return ok({
    settings: toSettingsResponse(settings, announcement),
  });
}
