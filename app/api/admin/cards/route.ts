import { ensureSchema, getDb } from "@/db";
import { accessCards } from "@/db/schema";
import {
  cleanInt,
  cleanText,
  fail,
  nowIso,
  ok,
  readJson,
  requireAdmin,
} from "@/lib/server";

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

type CardPayload = {
  serviceConfigId: number;
  quotaTotal: number;
  count: number;
  prefix?: string;
  label?: string;
  expiresAt?: string;
};

function randomToken(length: number) {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => ALPHABET[byte % ALPHABET.length]).join("");
}

function makeCardCode(prefix: string) {
  const normalizedPrefix = prefix.replace(/[^A-Z0-9]/g, "").slice(0, 8) || "SB";
  return `${normalizedPrefix}-${randomToken(4)}-${randomToken(4)}-${randomToken(4)}`;
}

export async function POST(request: Request) {
  const adminError = await requireAdmin(request);
  if (adminError) return adminError;

  const payload = await readJson<CardPayload>(request);
  const serviceConfigId = cleanInt(payload.serviceConfigId);
  const quotaTotal = Math.min(Math.max(cleanInt(payload.quotaTotal, 1), 1), 9999);
  const count = Math.min(Math.max(cleanInt(payload.count, 1), 1), 100);
  const prefix = cleanText(payload.prefix).toUpperCase() || "SB";
  const label = cleanText(payload.label);
  const expiresAt = cleanText(payload.expiresAt) || null;

  if (!serviceConfigId) {
    return fail("请选择服务/国家配置。");
  }

  await ensureSchema();

  const now = nowIso();
  const db = getDb();
  const rows = Array.from({ length: count }, () => ({
    code: makeCardCode(prefix),
    serviceConfigId,
    quotaTotal,
    quotaUsed: 0,
    status: "active",
    label,
    expiresAt,
    createdAt: now,
    updatedAt: now,
  }));

  const cards = await db.insert(accessCards).values(rows).returning();
  return ok({ cards }, { status: 201 });
}
