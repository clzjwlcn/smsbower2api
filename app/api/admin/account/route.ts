import { getAdminCredentials, updateAdminCredentials } from "@/lib/admin-auth";
import { cleanText, fail, ok, readJson, requireAdmin } from "@/lib/server";

type AccountPayload = {
  username?: string;
  password?: string;
  confirmPassword?: string;
};

function toAccountResponse(
  credentials: Awaited<ReturnType<typeof getAdminCredentials>>
) {
  return {
    username: credentials.username,
    usernameSource: credentials.usernameSource,
    passwordSource: credentials.passwordSource,
  };
}

export async function GET(request: Request) {
  const adminError = await requireAdmin(request);
  if (adminError) return adminError;

  return ok({ account: toAccountResponse(await getAdminCredentials()) });
}

export async function PATCH(request: Request) {
  const adminError = await requireAdmin(request);
  if (adminError) return adminError;

  const payload = await readJson<AccountPayload>(request);
  const username = cleanText(payload.username);
  const password = cleanText(payload.password);
  const confirmPassword = cleanText(payload.confirmPassword);

  if (!username) {
    return fail("管理员账号不能为空。");
  }

  if (username.length < 3 || username.length > 40) {
    return fail("管理员账号长度需要在 3 到 40 个字符之间。");
  }

  if (password || confirmPassword) {
    if (password.length < 6) {
      return fail("新密码至少需要 6 个字符。");
    }

    if (password !== confirmPassword) {
      return fail("两次输入的新密码不一致。");
    }
  }

  const credentials = await updateAdminCredentials({
    username,
    password: password || undefined,
  });

  return ok({ account: toAccountResponse(credentials) });
}

