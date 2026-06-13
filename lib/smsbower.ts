import { getRuntimeEnv } from "@/db";

const DEFAULT_API_BASE_URL = "https://smsbower.page/stubs/handler_api.php";

type SmsBowerParams = Record<string, string | number | undefined>;

export type SmsBowerNumber = {
  activationId: string;
  phoneNumber: string;
  activationCost?: string;
  raw: unknown;
};

export type SmsBowerStatus = {
  state:
    | "waiting_sms"
    | "received"
    | "waiting_retry"
    | "cancelled"
    | "unknown";
  code: string;
  raw: string;
};

function getApiKey() {
  return String(getRuntimeEnv().SMSBOWER_API_KEY ?? "").trim();
}

function getBaseUrl() {
  return (
    String(getRuntimeEnv().SMSBOWER_API_BASE_URL ?? "").trim() ||
    DEFAULT_API_BASE_URL
  );
}

function buildUrl(action: string, params: SmsBowerParams = {}) {
  const apiKey = getApiKey();

  if (!apiKey) {
    throw new Error("SMSBOWER_API_KEY 尚未配置。");
  }

  const url = new URL(getBaseUrl());
  url.searchParams.set("api_key", apiKey);
  url.searchParams.set("action", action);

  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && String(value).trim() !== "") {
      url.searchParams.set(key, String(value));
    }
  }

  return url;
}

async function callText(action: string, params?: SmsBowerParams) {
  const response = await fetch(buildUrl(action, params), {
    headers: { accept: "application/json, text/plain;q=0.9, */*;q=0.8" },
  });
  const text = (await response.text()).trim();

  if (!response.ok) {
    throw new Error(`SMSBower HTTP ${response.status}: ${text}`);
  }

  return text;
}

function assertNotError(raw: string) {
  if (
    raw.startsWith("BAD_") ||
    raw.startsWith("NO_") ||
    raw.startsWith("ERROR") ||
    raw === "BANNED" ||
    raw === "WRONG_SERVICE" ||
    raw === "WRONG_COUNTRY"
  ) {
    throw new Error(`SMSBower 返回错误：${raw}`);
  }
}

export async function getSmsBowerBalance() {
  const raw = await callText("getBalance");
  assertNotError(raw);

  if (raw.startsWith("ACCESS_BALANCE:")) {
    return { balance: raw.replace("ACCESS_BALANCE:", ""), raw };
  }

  return { balance: raw, raw };
}

export async function requestSmsBowerNumber(params: {
  service: string;
  country: string;
}) {
  const raw = await callText("getNumberV2", {
    service: params.service,
    country: params.country,
  });
  assertNotError(raw);

  try {
    const parsed = JSON.parse(raw) as {
      activationId?: string | number;
      id?: string | number;
      phoneNumber?: string | number;
      number?: string | number;
      activationCost?: string | number;
    };

    const activationId = parsed.activationId ?? parsed.id;
    const phoneNumber = parsed.phoneNumber ?? parsed.number;

    if (activationId && phoneNumber) {
      return {
        activationId: String(activationId),
        phoneNumber: String(phoneNumber),
        activationCost:
          parsed.activationCost === undefined
            ? undefined
            : String(parsed.activationCost),
        raw: parsed,
      } satisfies SmsBowerNumber;
    }
  } catch {
    // Fall through to the legacy ACCESS_NUMBER parser.
  }

  if (raw.startsWith("ACCESS_NUMBER:")) {
    const [, activationId, phoneNumber] = raw.split(":");
    if (activationId && phoneNumber) {
      return { activationId, phoneNumber, raw } satisfies SmsBowerNumber;
    }
  }

  throw new Error(`无法解析 SMSBower 取号响应：${raw}`);
}

export async function getSmsBowerStatus(activationId: string) {
  const raw = await callText("getStatus", { id: activationId });
  const normalized = raw.trim();

  if (normalized.startsWith("STATUS_OK:")) {
    return {
      state: "received",
      code: normalized.replace("STATUS_OK:", "").replace(/^'|'$/g, ""),
      raw: normalized,
    } satisfies SmsBowerStatus;
  }

  if (normalized === "STATUS_WAIT_CODE") {
    return { state: "waiting_sms", code: "", raw: normalized };
  }

  if (normalized === "STATUS_WAIT_RETRY") {
    return { state: "waiting_retry", code: "", raw: normalized };
  }

  if (normalized === "STATUS_CANCEL") {
    return { state: "cancelled", code: "", raw: normalized };
  }

  return { state: "unknown", code: "", raw: normalized };
}

export async function setSmsBowerStatus(activationId: string, status: number) {
  const raw = await callText("setStatus", { id: activationId, status });
  assertNotError(raw);
  return raw;
}

