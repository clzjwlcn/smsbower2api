import { and, eq, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { accessCards, activationOrders } from "@/db/schema";
import { getCardContext } from "@/lib/cards";
import { setSmsBowerStatus } from "@/lib/smsbower";
import {
  cleanInt,
  cleanText,
  errorMessage,
  fail,
  nowIso,
  ok,
  readJson,
} from "@/lib/server";

const ACTIONS = {
  ready: { upstream: 1, local: "waiting_sms" },
  retry: { upstream: 3, local: "waiting_retry" },
  finish: { upstream: 6, local: "completed" },
  cancel: { upstream: 8, local: "cancelled" },
} as const;

type ActionPayload = {
  cardCode: string;
  action: keyof typeof ACTIONS;
};

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  try {
    const payload = await readJson<ActionPayload>(request);
    const code = cleanText(payload.cardCode).toUpperCase();
    const action = cleanText(payload.action) as keyof typeof ACTIONS;
    const { id } = await context.params;
    const orderId = cleanInt(id);

    if (!code || !orderId || !(action in ACTIONS)) {
      return fail("参数不完整。");
    }

    const row = await getCardContext(code);
    if (!row) {
      return fail("卡密不存在。", 404);
    }

    const db = getDb();
    const [order] = await db
      .select()
      .from(activationOrders)
      .where(
        and(
          eq(activationOrders.id, orderId),
          eq(activationOrders.cardId, row.card.id)
        )
      )
      .limit(1);

    if (!order) {
      return fail("订单不存在。", 404);
    }

    const selected = ACTIONS[action];
    const raw = await setSmsBowerStatus(order.activationId, selected.upstream);
    const now = nowIso();

    const [updated] = await db
      .update(activationOrders)
      .set({
        status: selected.local,
        upstreamStatus: raw,
        refundedAt: action === "cancel" && !order.refundedAt ? now : order.refundedAt,
        updatedAt: now,
      })
      .where(eq(activationOrders.id, order.id))
      .returning();

    if (action === "cancel" && !order.refundedAt) {
      await db
        .update(accessCards)
        .set({
          quotaUsed: sql`MAX(${accessCards.quotaUsed} - ${order.chargedUnits}, 0)`,
          updatedAt: now,
        })
        .where(eq(accessCards.id, row.card.id));
    }

    return ok({ order: updated });
  } catch (error) {
    return fail(errorMessage(error, "订单操作失败。"), 502);
  }
}
