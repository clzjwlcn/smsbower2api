import { env } from "cloudflare:workers";
import { drizzle } from "drizzle-orm/d1";
import * as schema from "./schema";

export type RuntimeEnv = typeof env & {
  DB?: D1Database;
  SMSBOWER_API_KEY?: string;
  SMSBOWER_API_BASE_URL?: string;
  ADMIN_TOKEN?: string;
  SMSBOWER_WEBHOOK_SECRET?: string;
  SMSBOWER_WEBHOOK_ALLOWED_IPS?: string;
};

export function getRuntimeEnv() {
  return env as RuntimeEnv;
}

let schemaReady: Promise<void> | null = null;

async function initializeSchema(db: D1Database) {
  await db.batch([
    db.prepare(`CREATE TABLE IF NOT EXISTS service_configs (
      id integer PRIMARY KEY AUTOINCREMENT NOT NULL,
      service_code text NOT NULL,
      service_name text NOT NULL,
      country_code text NOT NULL,
      country_name text NOT NULL,
      enabled integer DEFAULT 1 NOT NULL,
      price_hint text DEFAULT '' NOT NULL,
      note text DEFAULT '' NOT NULL,
      created_at text DEFAULT CURRENT_TIMESTAMP NOT NULL,
      updated_at text DEFAULT CURRENT_TIMESTAMP NOT NULL
    )`),
    db.prepare(
      "CREATE UNIQUE INDEX IF NOT EXISTS service_configs_service_country_idx ON service_configs (service_code, country_code)"
    ),
    db.prepare(`CREATE TABLE IF NOT EXISTS access_cards (
      id integer PRIMARY KEY AUTOINCREMENT NOT NULL,
      code text NOT NULL,
      service_config_id integer NOT NULL,
      quota_total integer DEFAULT 1 NOT NULL,
      quota_used integer DEFAULT 0 NOT NULL,
      status text DEFAULT 'active' NOT NULL,
      label text DEFAULT '' NOT NULL,
      expires_at text,
      created_at text DEFAULT CURRENT_TIMESTAMP NOT NULL,
      updated_at text DEFAULT CURRENT_TIMESTAMP NOT NULL,
      FOREIGN KEY (service_config_id) REFERENCES service_configs(id) ON UPDATE no action ON DELETE no action
    )`),
    db.prepare(
      "CREATE UNIQUE INDEX IF NOT EXISTS access_cards_code_idx ON access_cards (code)"
    ),
    db.prepare(
      "CREATE INDEX IF NOT EXISTS access_cards_service_config_idx ON access_cards (service_config_id)"
    ),
    db.prepare(`CREATE TABLE IF NOT EXISTS activation_orders (
      id integer PRIMARY KEY AUTOINCREMENT NOT NULL,
      card_id integer NOT NULL,
      activation_id text NOT NULL,
      phone_number text NOT NULL,
      service_code text NOT NULL,
      service_name text NOT NULL,
      country_code text NOT NULL,
      country_name text NOT NULL,
      activation_cost text DEFAULT '' NOT NULL,
      status text DEFAULT 'waiting_sms' NOT NULL,
      upstream_status text DEFAULT '' NOT NULL,
      sms_text text DEFAULT '' NOT NULL,
      sms_code text DEFAULT '' NOT NULL,
      received_at text,
      charged_units integer DEFAULT 1 NOT NULL,
      refunded_at text,
      created_at text DEFAULT CURRENT_TIMESTAMP NOT NULL,
      updated_at text DEFAULT CURRENT_TIMESTAMP NOT NULL,
      FOREIGN KEY (card_id) REFERENCES access_cards(id) ON UPDATE no action ON DELETE no action
    )`),
    db.prepare(
      "CREATE UNIQUE INDEX IF NOT EXISTS activation_orders_activation_id_idx ON activation_orders (activation_id)"
    ),
    db.prepare(
      "CREATE INDEX IF NOT EXISTS activation_orders_card_idx ON activation_orders (card_id)"
    ),
    db.prepare(
      "CREATE INDEX IF NOT EXISTS activation_orders_status_idx ON activation_orders (status)"
    ),
    db.prepare(`CREATE TABLE IF NOT EXISTS webhook_events (
      id integer PRIMARY KEY AUTOINCREMENT NOT NULL,
      activation_id text NOT NULL,
      payload text NOT NULL,
      processed integer DEFAULT 0 NOT NULL,
      error text DEFAULT '' NOT NULL,
      source_ip text DEFAULT '' NOT NULL,
      created_at text DEFAULT CURRENT_TIMESTAMP NOT NULL
    )`),
    db.prepare(
      "CREATE INDEX IF NOT EXISTS webhook_events_activation_idx ON webhook_events (activation_id)"
    ),
  ]);
}

export async function ensureSchema() {
  const runtimeEnv = getRuntimeEnv();

  if (!runtimeEnv.DB) {
    throw new Error(
      "Cloudflare D1 binding `DB` is unavailable. Set the `d1` field in .openai/hosting.json to `DB` or let your control plane inject the real binding values before using the database."
    );
  }

  schemaReady ??= initializeSchema(runtimeEnv.DB).catch((error) => {
    schemaReady = null;
    throw error;
  });

  await schemaReady;
}

export function getDb() {
  const runtimeEnv = getRuntimeEnv();

  if (!runtimeEnv.DB) {
    throw new Error(
      "Cloudflare D1 binding `DB` is unavailable. Set the `d1` field in .openai/hosting.json to `DB` or let your control plane inject the real binding values before using the database."
    );
  }

  return drizzle(runtimeEnv.DB, { schema });
}
