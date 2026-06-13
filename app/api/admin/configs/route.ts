import { ensureSchema, getDb } from "@/db";
import { serviceConfigs } from "@/db/schema";
import {
  cleanText,
  fail,
  nowIso,
  ok,
  readJson,
  requireAdmin,
} from "@/lib/server";

type ConfigPayload = {
  serviceCode: string;
  serviceName: string;
  countryCode: string;
  countryName: string;
  priceHint?: string;
  note?: string;
  enabled?: boolean | number;
};

export async function POST(request: Request) {
  const adminError = await requireAdmin(request);
  if (adminError) return adminError;

  const payload = await readJson<ConfigPayload>(request);
  const serviceCode = cleanText(payload.serviceCode);
  const serviceName = cleanText(payload.serviceName);
  const countryCode = cleanText(payload.countryCode);
  const countryName = cleanText(payload.countryName);

  if (!serviceCode || !serviceName || !countryCode || !countryName) {
    return fail("服务代码、服务名称、国家代码、国家名称都必填。");
  }

  await ensureSchema();

  const now = nowIso();
  const db = getDb();

  try {
    const [config] = await db
      .insert(serviceConfigs)
      .values({
        serviceCode,
        serviceName,
        countryCode,
        countryName,
        priceHint: cleanText(payload.priceHint),
        note: cleanText(payload.note),
        enabled: payload.enabled === false ? 0 : 1,
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    return ok({ config }, { status: 201 });
  } catch (error) {
    return fail(
      "这个服务和国家组合已经存在，或数据库拒绝了写入。",
      409,
      error instanceof Error ? error.message : error
    );
  }
}
