import { getRuntimeEnv } from "@/db";
import { getAdminCredentials } from "./admin-auth";

export function ok<T>(payload: T, init?: ResponseInit) {
  return Response.json(payload, init);
}

export function fail(message: string, status = 400, detail?: unknown) {
  return Response.json({ error: message, detail }, { status });
}

export function errorMessage(error: unknown, fallback = "请求失败。") {
  return error instanceof Error ? error.message : fallback;
}

export async function readJson<T>(request: Request) {
  try {
    return (await request.json()) as Partial<T>;
  } catch {
    return {} as Partial<T>;
  }
}

export function cleanText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export function cleanInt(value: unknown, fallback = 0) {
  const parsed =
    typeof value === "number" ? value : Number.parseInt(String(value ?? ""), 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function nowIso() {
  return new Date().toISOString();
}

export async function requireAdmin(request: Request) {
  const runtimeEnv = getRuntimeEnv();
  const token = cleanText(runtimeEnv.ADMIN_TOKEN);
  const credentials = await getAdminCredentials();
  const expectedUsername = credentials.username;
  const expectedPassword = credentials.password;
  const suppliedUsername = cleanText(request.headers.get("x-admin-username"));
  const suppliedPassword = cleanText(request.headers.get("x-admin-password"));

  if (expectedUsername && expectedPassword) {
    if (
      suppliedUsername === expectedUsername &&
      suppliedPassword === expectedPassword
    ) {
      return null;
    }

    if (suppliedUsername || suppliedPassword) {
      return fail("后台账号或密码不正确。", 401);
    }
  }

  const supplied =
    request.headers.get("x-admin-token") ??
    new URL(request.url).searchParams.get("admin_token") ??
    "";

  if (token && supplied === token) {
    return null;
  }

  if (!expectedUsername && !expectedPassword && !token) {
    return fail("后台账号密码尚未配置。", 500);
  }

  return fail("后台账号或密码不正确。", 401);
}

export function getClientIp(request: Request) {
  return (
    request.headers.get("cf-connecting-ip") ??
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    ""
  );
}
