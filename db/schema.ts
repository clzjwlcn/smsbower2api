import { sql } from "drizzle-orm";
import {
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

export const serviceConfigs = sqliteTable(
  "service_configs",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    serviceCode: text("service_code").notNull(),
    serviceName: text("service_name").notNull(),
    countryCode: text("country_code").notNull(),
    countryName: text("country_name").notNull(),
    enabled: integer("enabled").notNull().default(1),
    priceHint: text("price_hint").notNull().default(""),
    note: text("note").notNull().default(""),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("service_configs_service_country_idx").on(
      table.serviceCode,
      table.countryCode
    ),
  ]
);

export const accessCards = sqliteTable(
  "access_cards",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    code: text("code").notNull(),
    serviceConfigId: integer("service_config_id")
      .notNull()
      .references(() => serviceConfigs.id),
    quotaTotal: integer("quota_total").notNull().default(1),
    quotaUsed: integer("quota_used").notNull().default(0),
    status: text("status").notNull().default("active"),
    label: text("label").notNull().default(""),
    expiresAt: text("expires_at"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("access_cards_code_idx").on(table.code),
    index("access_cards_service_config_idx").on(table.serviceConfigId),
  ]
);

export const activationOrders = sqliteTable(
  "activation_orders",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    cardId: integer("card_id")
      .notNull()
      .references(() => accessCards.id),
    activationId: text("activation_id").notNull(),
    phoneNumber: text("phone_number").notNull(),
    serviceCode: text("service_code").notNull(),
    serviceName: text("service_name").notNull(),
    countryCode: text("country_code").notNull(),
    countryName: text("country_name").notNull(),
    activationCost: text("activation_cost").notNull().default(""),
    status: text("status").notNull().default("waiting_sms"),
    upstreamStatus: text("upstream_status").notNull().default(""),
    smsText: text("sms_text").notNull().default(""),
    smsCode: text("sms_code").notNull().default(""),
    receivedAt: text("received_at"),
    chargedUnits: integer("charged_units").notNull().default(1),
    refundedAt: text("refunded_at"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("activation_orders_activation_id_idx").on(table.activationId),
    index("activation_orders_card_idx").on(table.cardId),
    index("activation_orders_status_idx").on(table.status),
  ]
);

export const webhookEvents = sqliteTable(
  "webhook_events",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    activationId: text("activation_id").notNull(),
    payload: text("payload").notNull(),
    processed: integer("processed").notNull().default(0),
    error: text("error").notNull().default(""),
    sourceIp: text("source_ip").notNull().default(""),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [index("webhook_events_activation_idx").on(table.activationId)]
);
