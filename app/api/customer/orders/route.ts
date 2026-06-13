import { eq, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { accessCards, activationOrders } from "@/db/schema";
import {
  getCardContext,
  getCardProblem,
  remainingQuota,
} from "@/lib/cards";
import { requestSmsBowerNumber } from "@/lib/smsbower";
import {
  cleanText,
  errorMessage,
  fail,
  nowIso,
  ok,
  readJson,
} from "@/lib/server";

type OrderPayload = {
  cardCode: string;
};

export async function POST(request: Request) {
  try {
    const payload = await readJson<OrderPayload>(request);
    const code = cleanText(payload.cardCode).toUpperCase();

    if (!code) {
      return fail("请输入卡密。");
    }

    const row = await getCardContext(code);
    const problem = getCardProblem(row);

    if (problem) {
      return fail(problem, row ? 403 : 404);
    }

    if (!row) {
      return fail("卡密不存在。", 404);
    }

    const number = await requestSmsBowerNumber({
      service: row.config.serviceCode,
      country: row.config.countryCode,
    });

    const db = getDb();
    const now = nowIso();
    const [order] = await db
      .insert(activationOrders)
      .values({
        cardId: row.card.id,
        activationId: number.activationId,
        phoneNumber: number.phoneNumber,
        serviceCode: row.config.serviceCode,
        serviceName: row.config.serviceName,
        countryCode: row.config.countryCode,
        countryName: row.config.countryName,
        activationCost: number.activationCost ?? "",
        status: "waiting_sms",
        upstreamStatus: "ACCESS_NUMBER",
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    await db
      .update(accessCards)
      .set({
        quotaUsed: sql`${accessCards.quotaUsed} + 1`,
        updatedAt: now,
      })
      .where(eq(accessCards.id, row.card.id));

    return ok(
      {
        order,
        remaining: remainingQuota({
          quotaTotal: row.card.quotaTotal,
          quotaUsed: row.card.quotaUsed + 1,
        }),
      },
      { status: 201 }
    );
  } catch (error) {
    return fail(errorMessage(error, "取号失败。"), 502);
  }
}
