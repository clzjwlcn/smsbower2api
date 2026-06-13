import { desc, eq } from "drizzle-orm";
import { ensureSchema, getDb } from "@/db";
import {
  accessCards,
  activationOrders,
  serviceConfigs,
} from "@/db/schema.mysql";
import { getSmsBowerBalance } from "@/lib/smsbower";
import { ok, requireAdmin } from "@/lib/server";

export async function GET(request: Request) {
  const adminError = await requireAdmin(request);
  if (adminError) return adminError;

  await ensureSchema();

  const db = getDb();
  const configs = await db
    .select()
    .from(serviceConfigs)
    .orderBy(desc(serviceConfigs.createdAt));

  const cards = await db
    .select({
      id: accessCards.id,
      code: accessCards.code,
      quotaTotal: accessCards.quotaTotal,
      quotaUsed: accessCards.quotaUsed,
      status: accessCards.status,
      label: accessCards.label,
      expiresAt: accessCards.expiresAt,
      createdAt: accessCards.createdAt,
      serviceName: serviceConfigs.serviceName,
      serviceCode: serviceConfigs.serviceCode,
      countryName: serviceConfigs.countryName,
      countryCode: serviceConfigs.countryCode,
    })
    .from(accessCards)
    .innerJoin(serviceConfigs, eq(accessCards.serviceConfigId, serviceConfigs.id))
    .orderBy(desc(accessCards.createdAt))
    .limit(100);

  const orders = await db
    .select()
    .from(activationOrders)
    .orderBy(desc(activationOrders.createdAt))
    .limit(100);

  let upstreamBalance: Awaited<ReturnType<typeof getSmsBowerBalance>> | null =
    null;
  let upstreamError = "";

  try {
    upstreamBalance = await getSmsBowerBalance();
  } catch (error) {
    upstreamError = error instanceof Error ? error.message : "查询上游余额失败。";
  }

  return ok({ configs, cards, orders, upstreamBalance, upstreamError });
}
