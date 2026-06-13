import { getRuntimeEnv } from "@/db";
import { getStoredSetting, setStoredSetting } from "./settings";

const ADMIN_USERNAME_KEY = "admin_username";
const ADMIN_PASSWORD_KEY = "admin_password";

function cleanText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export type AdminCredentials = {
  username: string;
  password: string;
  usernameSource: "settings" | "environment" | "default";
  passwordSource: "settings" | "environment" | "default";
};

export async function getAdminCredentials(): Promise<AdminCredentials> {
  const env = getRuntimeEnv();
  const storedUsername = cleanText(await getStoredSetting(ADMIN_USERNAME_KEY));
  const storedPassword = cleanText(await getStoredSetting(ADMIN_PASSWORD_KEY));
  const envUsername = cleanText(env.ADMIN_USERNAME);
  const envPassword = cleanText(env.ADMIN_PASSWORD);

  return {
    username: storedUsername || envUsername || "admin",
    password: storedPassword || envPassword || "asd123321",
    usernameSource: storedUsername
      ? "settings"
      : envUsername
        ? "environment"
        : "default",
    passwordSource: storedPassword
      ? "settings"
      : envPassword
        ? "environment"
        : "default",
  };
}

export async function updateAdminCredentials(values: {
  username?: string;
  password?: string;
}) {
  const username = cleanText(values.username);
  const password = cleanText(values.password);

  if (username) {
    await setStoredSetting(ADMIN_USERNAME_KEY, username);
  }

  if (password) {
    await setStoredSetting(ADMIN_PASSWORD_KEY, password);
  }

  return getAdminCredentials();
}
