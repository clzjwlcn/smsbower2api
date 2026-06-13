import { env } from "cloudflare:workers";
import { drizzle as drizzleMysql } from "drizzle-orm/mysql2";
import { drizzle } from "drizzle-orm/d1";
import mysql from "mysql2/promise";
import * as schema from "./schema";
import * as mysqlSchema from "./schema.mysql";

export type RuntimeEnv = typeof env & {
  DB?: D1Database;
  DATABASE_URL?: string;
  SMSBOWER_API_KEY?: string;
  SMSBOWER_API_BASE_URL?: string;
  SMSBOWER_HTTP_PROXY_URL?: string;
  ADMIN_TOKEN?: string;
  ADMIN_USERNAME?: string;
  ADMIN_PASSWORD?: string;
  SMSBOWER_WEBHOOK_SECRET?: string;
  SMSBOWER_WEBHOOK_ALLOWED_IPS?: string;
};

export function getRuntimeEnv() {
  return env as RuntimeEnv;
}

let schemaReady: Promise<void> | null = null;
let mysqlPool: mysql.Pool | null = null;

function getDatabaseUrl() {
  return (
    process.env.DATABASE_URL ||
    (env as RuntimeEnv).DATABASE_URL ||
    ""
  ).trim();
}

function shouldUseMysql() {
  return Boolean(getDatabaseUrl());
}

function getMysqlPool() {
  const databaseUrl = getDatabaseUrl();
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is not configured.");
  }

  mysqlPool ??= mysql.createPool(databaseUrl);
  return mysqlPool;
}

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
    db.prepare(`CREATE TABLE IF NOT EXISTS app_settings (
      key text PRIMARY KEY NOT NULL,
      value text DEFAULT '' NOT NULL,
      updated_at text DEFAULT CURRENT_TIMESTAMP NOT NULL
    )`),
  ]);
}

async function initializeMysqlSchema(pool: mysql.Pool) {
  await pool.query(`CREATE TABLE IF NOT EXISTS service_configs (
    id int NOT NULL AUTO_INCREMENT,
    service_code varchar(64) NOT NULL,
    service_name varchar(255) NOT NULL,
    country_code varchar(64) NOT NULL,
    country_name varchar(255) NOT NULL,
    enabled int NOT NULL DEFAULT 1,
    price_hint varchar(255) NOT NULL DEFAULT '',
    note text NOT NULL,
    created_at varchar(64) NOT NULL DEFAULT '',
    updated_at varchar(64) NOT NULL DEFAULT '',
    PRIMARY KEY (id),
    UNIQUE KEY service_configs_service_country_idx (service_code, country_code)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);

  await pool.query(`CREATE TABLE IF NOT EXISTS access_cards (
    id int NOT NULL AUTO_INCREMENT,
    code varchar(255) NOT NULL,
    service_config_id int NOT NULL,
    quota_total int NOT NULL DEFAULT 1,
    quota_used int NOT NULL DEFAULT 0,
    status varchar(64) NOT NULL DEFAULT 'active',
    label varchar(255) NOT NULL DEFAULT '',
    expires_at varchar(64),
    created_at varchar(64) NOT NULL DEFAULT '',
    updated_at varchar(64) NOT NULL DEFAULT '',
    PRIMARY KEY (id),
    UNIQUE KEY access_cards_code_idx (code),
    KEY access_cards_service_config_idx (service_config_id),
    CONSTRAINT access_cards_service_config_fk FOREIGN KEY (service_config_id) REFERENCES service_configs(id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);

  await pool.query(`CREATE TABLE IF NOT EXISTS activation_orders (
    id int NOT NULL AUTO_INCREMENT,
    card_id int NOT NULL,
    activation_id varchar(255) NOT NULL,
    phone_number varchar(255) NOT NULL,
    service_code varchar(64) NOT NULL,
    service_name varchar(255) NOT NULL,
    country_code varchar(64) NOT NULL,
    country_name varchar(255) NOT NULL,
    activation_cost varchar(64) NOT NULL DEFAULT '',
    status varchar(64) NOT NULL DEFAULT 'waiting_sms',
    upstream_status text NOT NULL,
    sms_text text NOT NULL,
    sms_code varchar(255) NOT NULL DEFAULT '',
    received_at varchar(64),
    charged_units int NOT NULL DEFAULT 1,
    refunded_at varchar(64),
    created_at varchar(64) NOT NULL DEFAULT '',
    updated_at varchar(64) NOT NULL DEFAULT '',
    PRIMARY KEY (id),
    UNIQUE KEY activation_orders_activation_id_idx (activation_id),
    KEY activation_orders_card_idx (card_id),
    KEY activation_orders_status_idx (status),
    CONSTRAINT activation_orders_card_fk FOREIGN KEY (card_id) REFERENCES access_cards(id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);

  await pool.query(`CREATE TABLE IF NOT EXISTS webhook_events (
    id int NOT NULL AUTO_INCREMENT,
    activation_id varchar(255) NOT NULL,
    payload text NOT NULL,
    processed int NOT NULL DEFAULT 0,
    error text NOT NULL,
    source_ip varchar(255) NOT NULL DEFAULT '',
    created_at varchar(64) NOT NULL DEFAULT '',
    PRIMARY KEY (id),
    KEY webhook_events_activation_idx (activation_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);

  await pool.query(`CREATE TABLE IF NOT EXISTS app_settings (
    \`key\` varchar(191) NOT NULL,
    value text NOT NULL,
    updated_at varchar(64) NOT NULL DEFAULT '',
    PRIMARY KEY (\`key\`)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
}

export async function ensureSchema() {
  if (shouldUseMysql()) {
    schemaReady ??= initializeMysqlSchema(getMysqlPool()).catch((error) => {
      schemaReady = null;
      throw error;
    });

    await schemaReady;
    return;
  }

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
  if (shouldUseMysql()) {
    return drizzleMysql(getMysqlPool(), {
      schema: mysqlSchema,
      mode: "default",
    });
  }

  const runtimeEnv = getRuntimeEnv();

  if (!runtimeEnv.DB) {
    throw new Error(
      "Cloudflare D1 binding `DB` is unavailable. Set the `d1` field in .openai/hosting.json to `DB` or let your control plane inject the real binding values before using the database."
    );
  }

  return drizzle(runtimeEnv.DB, { schema });
}
