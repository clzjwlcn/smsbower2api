import {
  getCardContext,
  getCardProblem,
  getRecentOrdersForCard,
  remainingQuota,
} from "@/lib/cards";
import { cleanText, errorMessage, fail, ok, readJson } from "@/lib/server";

type SessionPayload = {
  cardCode: string;
};

export async function POST(request: Request) {
  try {
    const payload = await readJson<SessionPayload>(request);
    const code = cleanText(payload.cardCode).toUpperCase();

    if (!code) {
      return fail("请输入卡密。");
    }

    const row = await getCardContext(code);

    if (!row) {
      return fail("卡密不存在。", 404);
    }

    const orders = await getRecentOrdersForCard(row.card.id);

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
  } catch (error) {
    return fail(errorMessage(error, "卡密验证失败。"), 500);
  }
}
