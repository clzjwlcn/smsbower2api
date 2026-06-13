import { getSmsBowerBalance } from "@/lib/smsbower";
import { ok, requireAdmin } from "@/lib/server";

export async function POST(request: Request) {
  const adminError = await requireAdmin(request);
  if (adminError) return adminError;

  try {
    const balance = await getSmsBowerBalance();
    return ok({
      ok: true,
      message: "SMSBower 通讯正常。",
      balance,
      raw: balance.raw,
      checkedAt: new Date().toISOString(),
    });
  } catch (error) {
    return ok({
      ok: false,
      message: "SMSBower 通讯失败。",
      error: error instanceof Error ? error.message : "未知错误",
      checkedAt: new Date().toISOString(),
    });
  }
}

