import { writeFileSync } from "node:fs";

const defaults = {
  ADMIN_USERNAME: "admin",
  ADMIN_PASSWORD: "asd123321",
  ADMIN_TOKEN: "",
  SMSBOWER_API_KEY: "",
  SMSBOWER_API_BASE_URL: "https://smsbower.page/stubs/handler_api.php",
  SMSBOWER_WEBHOOK_SECRET: "",
  SMSBOWER_WEBHOOK_ALLOWED_IPS: "167.235.198.205",
};

const content = Object.entries(defaults)
  .map(([key, fallback]) => {
    const value = process.env[key] ?? fallback;
    return `${key}=${JSON.stringify(String(value).replace(/\r?\n/g, ""))}`;
  })
  .join("\n");

writeFileSync(".dev.vars", `${content}\n`);
