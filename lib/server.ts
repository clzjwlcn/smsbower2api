import { getRuntimeEnv } from "@/db";

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

export function requireAdmin(request: Request) {
  const token = cleanText(getRuntimeEnv().ADMIN_TOKEN);

  if (!token) {
    return fail("后台 ADMIN_TOKEN 尚未配置。", 500);
  }

  const supplied =
    request.headers.get("x-admin-token") ??
    new URL(request.url).searchParams.get("admin_token") ??
    "";

  if (supplied !== token) {
    return fail("后台 token 不正确。", 401);
  }

  return null;
}

export function getClientIp(request: Request) {
  return (
    request.headers.get("cf-connecting-ip") ??
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    ""
  );
}
