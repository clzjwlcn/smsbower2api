import mysql from "mysql2/promise";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  console.log("DATABASE_URL is not set. Skipping MySQL initialization.");
  process.exit(0);
}

const pool = mysql.createPool(databaseUrl);

try {
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

  console.log("MySQL schema is ready.");
} finally {
  await pool.end();
}
