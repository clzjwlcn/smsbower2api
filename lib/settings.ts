import { eq } from "drizzle-orm";
import { ensureSchema, getDb, getRuntimeEnv } from "@/db";
import { appSettings } from "@/db/schema";
import { cleanText, nowIso } from "./server";

export const DEFAULT_SMSBOWER_API_BASE_URL =
  "https://smsbower.page/stubs/handler_api.php";

const API_BASE_URL_KEY = "smsbower_api_base_url";
const API_KEY_KEY = "smsbower_api_key";
const ANNOUNCEMENT_ENABLED_KEY = "announcement_enabled";
const ANNOUNCEMENT_TITLE_KEY = "announcement_title";
const ANNOUNCEMENT_BODY_KEY = "announcement_body";

function maskSecret(value: string) {
  if (!value) return "";
  if (value.length <= 8) return "已设置";
  return `${value.slice(0, 4)}******${value.slice(-4)}`;
}

export async function getStoredSetting(key: string) {
  await ensureSchema();

  const [row] = await getDb()
    .select()
    .from(appSettings)
    .where(eq(appSettings.key, key))
    .limit(1);

  return row?.value ?? "";
}

export async function setStoredSetting(key: string, value: string) {
  await ensureSchema();

  const db = getDb();
  const now = nowIso();
  const existing = await getStoredSetting(key);

  if (existing || existing === "") {
    const [updated] = await db
      .update(appSettings)
      .set({ value, updatedAt: now })
      .where(eq(appSettings.key, key))
      .returning();

    if (updated) return updated;
  }

  const [created] = await db
    .insert(appSettings)
    .values({ key, value, updatedAt: now })
    .returning();

  return created;
}

export async function getSmsBowerSettings() {
  const env = getRuntimeEnv();
  const storedBaseUrl = cleanText(await getStoredSetting(API_BASE_URL_KEY));
  const storedApiKey = cleanText(await getStoredSetting(API_KEY_KEY));
  const envBaseUrl = cleanText(env.SMSBOWER_API_BASE_URL);
  const envApiKey = cleanText(env.SMSBOWER_API_KEY);
  const apiBaseUrl =
    storedBaseUrl || envBaseUrl || DEFAULT_SMSBOWER_API_BASE_URL;
  const apiKey = storedApiKey || envApiKey;

  return {
    apiBaseUrl,
    apiKey,
    apiKeyConfigured: Boolean(apiKey),
    apiKeyPreview: maskSecret(apiKey),
    apiKeySource: storedApiKey ? "后台设置" : envApiKey ? "环境变量" : "未设置",
  };
}

export async function updateSmsBowerSettings(values: {
  apiBaseUrl?: string;
  apiKey?: string;
}) {
  const apiBaseUrl =
    cleanText(values.apiBaseUrl) || DEFAULT_SMSBOWER_API_BASE_URL;
  await setStoredSetting(API_BASE_URL_KEY, apiBaseUrl);

  const apiKey = cleanText(values.apiKey);
  if (apiKey) {
    await setStoredSetting(API_KEY_KEY, apiKey);
  }

  return getSmsBowerSettings();
}

export async function getAnnouncementSettings() {
  const enabled = cleanText(await getStoredSetting(ANNOUNCEMENT_ENABLED_KEY));
  const title = cleanText(await getStoredSetting(ANNOUNCEMENT_TITLE_KEY));
  const body = cleanText(await getStoredSetting(ANNOUNCEMENT_BODY_KEY));

  return {
    enabled: enabled === "1",
    title,
    body,
  };
}

export async function updateAnnouncementSettings(values: {
  enabled?: boolean | number | string;
  title?: string;
  body?: string;
}) {
  const enabled =
    values.enabled === true ||
    values.enabled === 1 ||
    values.enabled === "1" ||
    values.enabled === "true";

  await setStoredSetting(ANNOUNCEMENT_ENABLED_KEY, enabled ? "1" : "0");
  await setStoredSetting(ANNOUNCEMENT_TITLE_KEY, cleanText(values.title));
  await setStoredSetting(ANNOUNCEMENT_BODY_KEY, cleanText(values.body));

  return getAnnouncementSettings();
}
