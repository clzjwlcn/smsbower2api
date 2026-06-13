import { eq } from "drizzle-orm";
import { ensureSchema, getDb, getRuntimeEnv } from "@/db";
import { activationOrders, webhookEvents } from "@/db/schema";
import { cleanText, fail, getClientIp, nowIso, ok } from "@/lib/server";

type SmsBowerWebhookPayload = {
  activationId?: number | string;
  service?: string;
  text?: string;
  code?: string;
  country?: number | string;
  receivedAt?: string;
};

function isAllowedWebhookRequest(request: Request) {
  const env = getRuntimeEnv();
  const secret = cleanText(env.SMSBOWER_WEBHOOK_SECRET);
  const allowedIps = cleanText(env.SMSBOWER_WEBHOOK_ALLOWED_IPS)
    .split(",")
    .map((ip) => ip.trim())
    .filter(Boolean);

  if (secret) {
    const url = new URL(request.url);
    const supplied =
      url.searchParams.get("secret") ?? request.headers.get("x-webhook-secret");
    if (supplied !== secret) return "Webhook secret 不正确。";
  }

  if (allowedIps.length > 0) {
    const sourceIp = getClientIp(request);
    if (!allowedIps.includes(sourceIp)) {
      return `Webhook 来源 IP 不在白名单：${sourceIp || "unknown"}`;
    }
  }

  return "";
}

export async function POST(request: Request) {
  const denyReason = isAllowedWebhookRequest(request);
  if (denyReason) {
    return fail(denyReason, 401);
  }

  const sourceIp = getClientIp(request);
  let payload: SmsBowerWebhookPayload;

  try {
    payload = (await request.json()) as SmsBowerWebhookPayload;
  } catch {
    return fail("Webhook JSON 无法解析。", 400);
  }

  const activationId = String(payload.activationId ?? "").trim();
  if (!activationId) {
    return fail("Webhook 缺少 activationId。", 400);
  }

  await ensureSchema();

  const db = getDb();
  const now = nowIso();
  const [order] = await db
    .select()
    .from(activationOrders)
    .where(eq(activationOrders.activationId, activationId))
    .limit(1);

  if (!order) {
    await db.insert(webhookEvents).values({
      activationId,
      payload: JSON.stringify(payload),
      processed: 0,
      error: "activationId 未匹配到本地订单",
      sourceIp,
      createdAt: now,
    });

    return ok({ ok: true, processed: false });
  }

  await db
    .update(activationOrders)
    .set({
      status: "received",
      smsText: cleanText(payload.text),
      smsCode: cleanText(payload.code),
      receivedAt: cleanText(payload.receivedAt) || now,
      upstreamStatus: "WEBHOOK_RECEIVED",
      updatedAt: now,
    })
    .where(eq(activationOrders.id, order.id));

  await db.insert(webhookEvents).values({
    activationId,
    payload: JSON.stringify(payload),
    processed: 1,
    sourceIp,
    createdAt: now,
  });

  return ok({ ok: true, processed: true });
}
