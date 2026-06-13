import { desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { activationOrders } from "@/db/schema";
import {
  getCardContext,
  getCardProblem,
  remainingQuota,
} from "@/lib/cards";
import { cleanText, fail, ok, readJson } from "@/lib/server";

type SessionPayload = {
  cardCode: string;
};

export async function POST(request: Request) {
  const payload = await readJson<SessionPayload>(request);
  const code = cleanText(payload.cardCode).toUpperCase();

  if (!code) {
    return fail("请输入卡密。");
  }

  const row = await getCardContext(code);

  if (!row) {
    return fail("卡密不存在。", 404);
  }

  const db = getDb();
  const orders = await db
    .select()
    .from(activationOrders)
    .where(eq(activationOrders.cardId, row.card.id))
    .orderBy(desc(activationOrders.createdAt))
    .limit(10);

  return ok({
    card: {
      code: row.card.code,
      status: row.card.status,
      quotaTotal: row.card.quotaTotal,
      quotaUsed: row.card.quotaUsed,
      remaining: remainingQuota(row.card),
      expiresAt: row.card.expiresAt,
      problem: getCardProblem(row),
    },
    config: {
      serviceCode: row.config.serviceCode,
      serviceName: row.config.serviceName,
      countryCode: row.config.countryCode,
      countryName: row.config.countryName,
      enabled: Boolean(row.config.enabled),
      note: row.config.note,
    },
    orders,
  });
}

