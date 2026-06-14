import { getSmsBowerSettings } from "./settings";

type SmsBowerParams = Record<string, string | number | undefined>;

const REQUEST_TIMEOUT_MS = 20000;

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

async function buildUrl(action: string, params: SmsBowerParams = {}) {
  const { apiBaseUrl, apiKey } = await getSmsBowerSettings();

  if (!apiKey) {
    throw new Error("SMSBower API Key 尚未配置，请先到后台设置。");
  }

  const url = new URL(apiBaseUrl);
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
  const settings = await getSmsBowerSettings();
  const url = await buildUrl(action, params);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  let response: Response;

  try {
    const fetchOptions: RequestInit & { dispatcher?: unknown } = {
      headers: {
        accept: "application/json, text/plain;q=0.9, */*;q=0.8",
        "user-agent": "smsbower2api/0.1",
      },
      signal: controller.signal,
    };

    if (settings.httpProxyUrl) {
      const { ProxyAgent } = await import("undici");
      fetchOptions.dispatcher = new ProxyAgent(settings.httpProxyUrl);
    }

    response = await fetch(url, {
      ...fetchOptions,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error(`SMSBower 请求超时：${action}`);
    }

    throw error;
  } finally {
    clearTimeout(timeout);
  }

  const text = (await response.text()).trim();

  if (!response.ok) {
    throw new Error(`SMSBower HTTP ${response.status}: ${text}`);
  }

  return text;
}

function assertNotError(raw: string) {
  const normalized = raw.trim();
  const lower = normalized.toLowerCase();

  if (lower.startsWith("internal error")) {
    throw new Error(
      `SMSBower 上游返回内部错误：${normalized}。这不是本地数据库错误，通常需要联系 SMSBower 客服处理 reference，或确认 API Key/服务器 IP 是否被上游限制。`
    );
  }

  if (
    normalized.startsWith("BAD_") ||
    normalized.startsWith("NO_") ||
    normalized.startsWith("ERROR") ||
    normalized === "BANNED" ||
    normalized === "WRONG_SERVICE" ||
    normalized === "WRONG_COUNTRY"
  ) {
    throw new Error(`SMSBower 返回错误：${normalized}`);
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
