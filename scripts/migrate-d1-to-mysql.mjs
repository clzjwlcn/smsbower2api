import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import mysql from "mysql2/promise";

const d1Root = process.env.D1_PATH || "/app/.wrangler/state/v3/d1";
const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required for MySQL migration.");
}

function findSqliteFiles(dir) {
  if (!existsSync(dir)) return [];

  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) return findSqliteFiles(fullPath);
    return entry.isFile() && entry.name.endsWith(".sqlite") ? [fullPath] : [];
  });
}

async function openSqliteDatabase() {
  const { DatabaseSync } = await import("node:sqlite");
  const files = findSqliteFiles(d1Root);

  for (const file of files) {
    const db = new DatabaseSync(file, { readOnly: true });
    const table = db
      .prepare(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'service_configs'"
      )
      .get();

    if (table) {
      return { db, file };
    }

    db.close();
  }

  return null;
}

const tables = [
  {
    name: "service_configs",
    columns: [
      "id",
      "service_code",
      "service_name",
      "country_code",
      "country_name",
      "enabled",
      "price_hint",
      "note",
      "created_at",
      "updated_at",
    ],
  },
  {
    name: "access_cards",
    columns: [
      "id",
      "code",
      "service_config_id",
      "quota_total",
      "quota_used",
      "status",
      "label",
      "expires_at",
      "created_at",
      "updated_at",
    ],
  },
  {
    name: "activation_orders",
    columns: [
      "id",
      "card_id",
      "activation_id",
      "phone_number",
      "service_code",
      "service_name",
      "country_code",
      "country_name",
      "activation_cost",
      "status",
      "upstream_status",
      "sms_text",
      "sms_code",
      "received_at",
      "charged_units",
      "refunded_at",
      "created_at",
      "updated_at",
    ],
  },
  {
    name: "webhook_events",
    columns: [
      "id",
      "activation_id",
      "payload",
      "processed",
      "error",
      "source_ip",
      "created_at",
    ],
  },
  {
    name: "app_settings",
    columns: ["key", "value", "updated_at"],
  },
];

function readRows(db, table) {
  const columns = table.columns.map((column) => `"${column}"`).join(", ");
  try {
    return db.prepare(`SELECT ${columns} FROM "${table.name}"`).all();
  } catch {
    return [];
  }
}

async function insertRows(mysqlConn, table, rows) {
  if (rows.length === 0) return 0;

  const columnSql = table.columns.map((column) => `\`${column}\``).join(", ");
  const placeholders = table.columns.map(() => "?").join(", ");
  const sql = `INSERT IGNORE INTO \`${table.name}\` (${columnSql}) VALUES (${placeholders})`;
  let count = 0;

  for (const row of rows) {
    const values = table.columns.map((column) => row[column] ?? null);
    const [result] = await mysqlConn.execute(sql, values);
    count += result.affectedRows ?? 0;
  }

  return count;
}

const sqlite = await openSqliteDatabase();

if (!sqlite) {
  console.log(`No D1 sqlite database found under ${d1Root}.`);
  process.exit(0);
}

console.log(`Migrating D1 data from ${sqlite.file}`);

const mysqlConn = await mysql.createConnection(databaseUrl);

try {
  for (const table of tables) {
    const rows = readRows(sqlite.db, table);
    const inserted = await insertRows(mysqlConn, table, rows);
    console.log(`${table.name}: ${inserted}/${rows.length} rows imported`);
  }
} finally {
  sqlite.db.close();
  await mysqlConn.end();
}
