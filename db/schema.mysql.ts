import { sql } from "drizzle-orm";
import {
  index,
  int,
  mysqlTable,
  text,
  uniqueIndex,
  varchar,
} from "drizzle-orm/mysql-core";

export const serviceConfigs = mysqlTable(
  "service_configs",
  {
    id: int("id").autoincrement().primaryKey(),
    serviceCode: varchar("service_code", { length: 64 }).notNull(),
    serviceName: varchar("service_name", { length: 255 }).notNull(),
    countryCode: varchar("country_code", { length: 64 }).notNull(),
    countryName: varchar("country_name", { length: 255 }).notNull(),
    enabled: int("enabled").notNull().default(1),
    priceHint: varchar("price_hint", { length: 255 }).notNull().default(""),
    note: text("note").notNull().default(""),
    createdAt: varchar("created_at", { length: 64 })
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
    updatedAt: varchar("updated_at", { length: 64 })
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("service_configs_service_country_idx").on(
      table.serviceCode,
      table.countryCode
    ),
  ]
);

export const accessCards = mysqlTable(
  "access_cards",
  {
    id: int("id").autoincrement().primaryKey(),
    code: varchar("code", { length: 255 }).notNull(),
    serviceConfigId: int("service_config_id")
      .notNull()
      .references(() => serviceConfigs.id),
    quotaTotal: int("quota_total").notNull().default(1),
    quotaUsed: int("quota_used").notNull().default(0),
    status: varchar("status", { length: 64 }).notNull().default("active"),
    label: varchar("label", { length: 255 }).notNull().default(""),
    expiresAt: varchar("expires_at", { length: 64 }),
    createdAt: varchar("created_at", { length: 64 })
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
    updatedAt: varchar("updated_at", { length: 64 })
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("access_cards_code_idx").on(table.code),
    index("access_cards_service_config_idx").on(table.serviceConfigId),
  ]
);

export const activationOrders = mysqlTable(
  "activation_orders",
  {
    id: int("id").autoincrement().primaryKey(),
    cardId: int("card_id")
      .notNull()
      .references(() => accessCards.id),
    activationId: varchar("activation_id", { length: 255 }).notNull(),
    phoneNumber: varchar("phone_number", { length: 255 }).notNull(),
    serviceCode: varchar("service_code", { length: 64 }).notNull(),
    serviceName: varchar("service_name", { length: 255 }).notNull(),
    countryCode: varchar("country_code", { length: 64 }).notNull(),
    countryName: varchar("country_name", { length: 255 }).notNull(),
    activationCost: varchar("activation_cost", { length: 64 })
      .notNull()
      .default(""),
    status: varchar("status", { length: 64 }).notNull().default("waiting_sms"),
    upstreamStatus: text("upstream_status").notNull().default(""),
    smsText: text("sms_text").notNull().default(""),
    smsCode: varchar("sms_code", { length: 255 }).notNull().default(""),
    receivedAt: varchar("received_at", { length: 64 }),
    chargedUnits: int("charged_units").notNull().default(1),
    refundedAt: varchar("refunded_at", { length: 64 }),
    createdAt: varchar("created_at", { length: 64 })
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
    updatedAt: varchar("updated_at", { length: 64 })
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("activation_orders_activation_id_idx").on(table.activationId),
    index("activation_orders_card_idx").on(table.cardId),
    index("activation_orders_status_idx").on(table.status),
  ]
);

export const webhookEvents = mysqlTable(
  "webhook_events",
  {
    id: int("id").autoincrement().primaryKey(),
    activationId: varchar("activation_id", { length: 255 }).notNull(),
    payload: text("payload").notNull(),
    processed: int("processed").notNull().default(0),
    error: text("error").notNull().default(""),
    sourceIp: varchar("source_ip", { length: 255 }).notNull().default(""),
    createdAt: varchar("created_at", { length: 64 })
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [index("webhook_events_activation_idx").on(table.activationId)]
);

export const appSettings = mysqlTable("app_settings", {
  key: varchar("key", { length: 191 }).primaryKey(),
  value: text("value").notNull().default(""),
  updatedAt: varchar("updated_at", { length: 64 })
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
});
