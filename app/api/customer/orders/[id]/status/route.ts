import { and, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { activationOrders } from "@/db/schema";
import { getCardContext } from "@/lib/cards";
import { getSmsBowerStatus } from "@/lib/smsbower";
import {
  cleanInt,
  cleanText,
  errorMessage,
  fail,
  nowIso,
  ok,
  readJson,
} from "@/lib/server";

type StatusPayload = {
  cardCode: string;
};

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  try {
    const payload = await readJson<StatusPayload>(request);
    const code = cleanText(payload.cardCode).toUpperCase();
    const { id } = await context.params;
    const orderId = cleanInt(id);

    if (!code || !orderId) {
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

    const status = await getSmsBowerStatus(order.activationId);
    const update =
      status.state === "received"
        ? {
            status: "received",
            upstreamStatus: status.raw,
            smsCode: status.code,
            updatedAt: nowIso(),
          }
        : {
            status: status.state,
            upstreamStatus: status.raw,
            updatedAt: nowIso(),
          };

    const [updated] = await db
      .update(activationOrders)
      .set(update)
      .where(eq(activationOrders.id, order.id))
      .returning();

    return ok({ order: updated });
  } catch (error) {
    return fail(errorMessage(error, "刷新状态失败。"), 502);
  }
}
