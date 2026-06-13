import { eq } from "drizzle-orm";
import { ensureSchema, getDb } from "@/db";
import { serviceConfigs } from "@/db/schema";
import {
  cleanInt,
  cleanText,
  fail,
  nowIso,
  ok,
  readJson,
  requireAdmin,
} from "@/lib/server";

type ConfigPayload = {
  serviceName?: string;
  countryName?: string;
  priceHint?: string;
  note?: string;
  enabled?: boolean | number;
};

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  const adminError = requireAdmin(request);
  if (adminError) return adminError;

  const { id } = await context.params;
  const payload = await readJson<ConfigPayload>(request);
  const updates: Partial<typeof serviceConfigs.$inferInsert> = {
    updatedAt: nowIso(),
  };

  await ensureSchema();

  if (payload.serviceName !== undefined) {
    updates.serviceName = cleanText(payload.serviceName);
  }
  if (payload.countryName !== undefined) {
    updates.countryName = cleanText(payload.countryName);
  }
  if (payload.priceHint !== undefined) {
    updates.priceHint = cleanText(payload.priceHint);
  }
  if (payload.note !== undefined) {
    updates.note = cleanText(payload.note);
  }
  if (payload.enabled !== undefined) {
    updates.enabled = payload.enabled ? 1 : 0;
  }

  const [config] = await getDb()
    .update(serviceConfigs)
    .set(updates)
    .where(eq(serviceConfigs.id, cleanInt(id)))
    .returning();

  if (!config) return fail("配置不存在。", 404);
  return ok({ config });
}
