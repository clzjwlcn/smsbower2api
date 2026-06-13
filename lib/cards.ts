import { and, desc, eq } from "drizzle-orm";
import { ensureSchema, getDb } from "@/db";
import { accessCards, activationOrders, serviceConfigs } from "@/db/schema.mysql";

export function remainingQuota(card: {
  quotaTotal: number;
  quotaUsed: number;
}) {
  return Math.max(card.quotaTotal - card.quotaUsed, 0);
}

export async function getCardContext(code: string) {
  await ensureSchema();

  const db = getDb();
  const [row] = await db
    .select({
      card: accessCards,
      config: serviceConfigs,
    })
    .from(accessCards)
    .innerJoin(serviceConfigs, eq(accessCards.serviceConfigId, serviceConfigs.id))
    .where(eq(accessCards.code, code))
    .limit(1);

  return row ?? null;
}

export function getCardProblem(
  row: Awaited<ReturnType<typeof getCardContext>>
) {
  if (!row) return "卡密不存在。";
  if (row.card.status !== "active") return "卡密已停用。";
  if (!row.config.enabled) return "此卡密对应的服务/国家配置已停用。";
  if (row.card.expiresAt && new Date(row.card.expiresAt).getTime() < Date.now()) {
    return "卡密已过期。";
  }
  if (remainingQuota(row.card) <= 0) return "卡密额度已用完。";
  return "";
}

export async function getRecentOrdersForCard(cardId: number) {
  await ensureSchema();

  const db = getDb();
  return db
    .select()
    .from(activationOrders)
    .where(and(eq(activationOrders.cardId, cardId)))
    .orderBy(desc(activationOrders.createdAt))
    .limit(10);
}
