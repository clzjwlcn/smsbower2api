"use client";

import type { FormEvent, ReactNode } from "react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type Order = {
  id: number;
  activationId: string;
  phoneNumber: string;
  serviceCode: string;
  serviceName: string;
  countryCode: string;
  countryName: string;
  activationCost: string;
  status: string;
  upstreamStatus: string;
  smsText: string;
  smsCode: string;
  receivedAt: string | null;
  refundedAt: string | null;
  createdAt: string;
};

type Session = {
  card: {
    code: string;
    status: string;
    quotaTotal: number;
    quotaUsed: number;
    remaining: number;
    expiresAt: string | null;
    problem: string;
  };
  config: {
    serviceCode: string;
    serviceName: string;
    countryCode: string;
    countryName: string;
    enabled: boolean;
    note: string;
  };
  orders: Order[];
};

type Config = {
  id: number;
  serviceCode: string;
  serviceName: string;
  countryCode: string;
  countryName: string;
  enabled: number;
  priceHint: string;
  note: string;
  createdAt: string;
};

type AdminCard = {
  id: number;
  code: string;
  quotaTotal: number;
  quotaUsed: number;
  status: string;
  label: string;
  expiresAt: string | null;
  createdAt: string;
  serviceName: string;
  serviceCode: string;
  countryName: string;
  countryCode: string;
};

type AdminOverview = {
  configs: Config[];
  cards: AdminCard[];
  orders: Order[];
  upstreamBalance: { balance: string; raw: string } | null;
  upstreamError: string;
};

type AdminSettings = {
  apiBaseUrl: string;
  apiKeyConfigured: boolean;
  apiKeyPreview: string;
  apiKeySource: string;
  httpProxyUrl: string;
  httpProxyConfigured: boolean;
  httpProxyPreview: string;
  httpProxySource: string;
  defaultApiBaseUrl: string;
  announcementEnabled: boolean;
  announcementTitle: string;
  announcementBody: string;
};

type AdminAccount = {
  username: string;
  usernameSource: string;
  passwordSource: string;
};

type UpstreamTest = {
  ok: boolean;
  message: string;
  balance?: { balance: string; raw: string };
  raw?: string;
  error?: string;
  checkedAt: string;
};

type Announcement = {
  enabled: boolean;
  title: string;
  body: string;
};

type ApiOptions = RequestInit & {
  adminAuth?: {
    username: string;
    password: string;
  };
  timeoutMs?: number;
};

const statusLabels: Record<string, string> = {
  waiting_sms: "等待短信",
  waiting_retry: "等待下一条",
  received: "已收到",
  completed: "已完成",
  cancelled: "已取消",
  unknown: "未知状态",
};

async function api<T>(url: string, options: ApiOptions = {}) {
  const { adminAuth, timeoutMs = 20000, ...fetchOptions } = options;
  const headers = new Headers(fetchOptions.headers);
  headers.set("content-type", "application/json");

  if (adminAuth) {
    headers.set("x-admin-username", adminAuth.username);
    headers.set("x-admin-password", adminAuth.password);
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  let response: Response;

  try {
    response = await fetch(url, {
      ...fetchOptions,
      headers,
      signal: fetchOptions.signal ?? controller.signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error("请求超时，请检查服务器是否正常运行。");
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }

  const data = (await response.json().catch(() => ({}))) as {
    error?: string;
    detail?: unknown;
  };

  if (!response.ok) {
    const detail =
      typeof data.detail === "string"
        ? data.detail
        : data.detail
          ? JSON.stringify(data.detail)
          : "";
    throw new Error(
      `${data.error || "请求失败"}（HTTP ${response.status}${
        detail ? `：${detail}` : ""
      }）`
    );
  }

  return data as T;
}

function StatusBadge({ status }: { status: string }) {
  const tone =
    status === "received" || status === "completed"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : status === "cancelled"
        ? "border-rose-200 bg-rose-50 text-rose-700"
        : "border-amber-200 bg-amber-50 text-amber-700";

  return (
    <span className={`inline-flex rounded border px-2 py-1 text-xs ${tone}`}>
      {statusLabels[status] ?? status}
    </span>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <label className="grid gap-1 text-sm text-slate-600">
      <span>{label}</span>
      <input
        className="h-10 rounded border border-slate-300 bg-white px-3 text-sm text-slate-950 outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
        placeholder={placeholder}
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

function TextArea({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="grid gap-1 text-sm text-slate-600">
      <span>{label}</span>
      <textarea
        className="min-h-28 resize-y rounded border border-slate-300 bg-white px-3 py-2 text-sm text-slate-950 outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
        placeholder={placeholder}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

function Button({
  children,
  onClick,
  type = "button",
  variant = "primary",
  disabled,
}: {
  children: ReactNode;
  onClick?: () => void;
  type?: "button" | "submit";
  variant?: "primary" | "secondary" | "danger" | "ghost";
  disabled?: boolean;
}) {
  const variants = {
    primary: "border-teal-700 bg-teal-700 text-white hover:bg-teal-800",
    secondary: "border-slate-300 bg-white text-slate-900 hover:bg-slate-50",
    danger: "border-rose-600 bg-rose-600 text-white hover:bg-rose-700",
    ghost: "border-transparent bg-transparent text-slate-700 hover:bg-slate-100",
  };

  return (
    <button
      className={`h-10 rounded border px-4 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50 ${variants[variant]}`}
      disabled={disabled}
      type={type}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

export default function DashboardClient({
  adminOnly = false,
}: {
  adminOnly?: boolean;
}) {
  const [tab] = useState<"client" | "admin">(adminOnly ? "admin" : "client");
  const [cardCode, setCardCode] = useState("");
  const [session, setSession] = useState<Session | null>(null);
  const [announcement, setAnnouncement] = useState<Announcement | null>(null);
  const [clientMessage, setClientMessage] = useState("");
  const [clientBusy, setClientBusy] = useState(false);
  const [adminUsername, setAdminUsername] = useState(() =>
    typeof window === "undefined"
      ? ""
      : (sessionStorage.getItem("smsbower-admin-username") ??
        localStorage.getItem("smsbower-admin-username") ??
        "admin")
  );
  const [adminPassword, setAdminPassword] = useState(() =>
    typeof window === "undefined"
      ? ""
      : (sessionStorage.getItem("smsbower-admin-password") ?? "")
  );
  const [admin, setAdmin] = useState<AdminOverview | null>(null);
  const [adminSettings, setAdminSettings] = useState<AdminSettings | null>(null);
  const [adminAccount, setAdminAccount] = useState<AdminAccount | null>(null);
  const [adminMessage, setAdminMessage] = useState("");
  const [adminBusy, setAdminBusy] = useState(false);
  const [upstreamTest, setUpstreamTest] = useState<UpstreamTest | null>(null);
  const [upstreamBusy, setUpstreamBusy] = useState(false);
  const [origin] = useState(() =>
    typeof window === "undefined" ? "" : window.location.origin
  );
  const [configForm, setConfigForm] = useState({
    serviceCode: "tg",
    serviceName: "Telegram",
    countryCode: "0",
    countryName: "Russia",
    priceHint: "",
    note: "",
  });
  const [cardForm, setCardForm] = useState({
    serviceConfigId: "",
    quotaTotal: "1",
    count: "1",
    prefix: "SB",
    label: "",
    expiresAt: "",
  });
  const [settingsForm, setSettingsForm] = useState({
    apiBaseUrl: "https://smsbower.page/stubs/handler_api.php",
    apiKey: "",
    httpProxyUrl: "",
    announcementEnabled: false,
    announcementTitle: "",
    announcementBody: "",
  });
  const [accountForm, setAccountForm] = useState({
    username: "",
    password: "",
    confirmPassword: "",
  });

  const webhookUrl = useMemo(() => {
    if (!origin) return "/api/webhook/smsbower";
    return `${origin}/api/webhook/smsbower`;
  }, [origin]);

  useEffect(() => {
    if (adminOnly) return;

    let cancelled = false;
    fetch("/api/public/announcement")
      .then((response) => response.json())
      .then((data: { announcement?: Announcement }) => {
        if (!cancelled) {
          setAnnouncement(data.announcement ?? null);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setAnnouncement(null);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [adminOnly]);

  useEffect(() => {
    if (!adminOnly || typeof window === "undefined") return;

    const savedUsername = sessionStorage.getItem("smsbower-admin-username");
    const savedPassword = sessionStorage.getItem("smsbower-admin-password");

    if (!savedUsername || !savedPassword) return;

    loadAdmin({
      username: savedUsername,
      password: savedPassword,
      silent: true,
    });
    // Restore-on-refresh should run once from session storage.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adminOnly]);

  async function loadSession(nextCardCode = cardCode) {
    setClientBusy(true);
    setClientMessage("正在验证卡密...");
    try {
      const data = await api<Session>("/api/customer/session", {
        method: "POST",
        body: JSON.stringify({ cardCode: nextCardCode }),
      });
      setSession(data);
      setCardCode(data.card.code);
      setClientMessage(data.card.problem || "卡密验证通过。");
    } catch (error) {
      setSession(null);
      setClientMessage(error instanceof Error ? error.message : "卡密验证失败。");
    } finally {
      setClientBusy(false);
    }
  }

  async function createOrder() {
    setClientBusy(true);
    setClientMessage("");
    try {
      await api<{ order: Order }>("/api/customer/orders", {
        method: "POST",
        body: JSON.stringify({ cardCode }),
      });
      await loadSession(cardCode);
      setClientMessage("手机号已获取。");
    } catch (error) {
      setClientMessage(error instanceof Error ? error.message : "取号失败。");
    } finally {
      setClientBusy(false);
    }
  }

  async function refreshOrder(orderId: number) {
    setClientBusy(true);
    try {
      await api<{ order: Order }>(`/api/customer/orders/${orderId}/status`, {
        method: "POST",
        body: JSON.stringify({ cardCode }),
      });
      await loadSession(cardCode);
    } catch (error) {
      setClientMessage(error instanceof Error ? error.message : "刷新失败。");
    } finally {
      setClientBusy(false);
    }
  }

  async function orderAction(orderId: number, action: string) {
    setClientBusy(true);
    try {
      await api<{ order: Order }>(`/api/customer/orders/${orderId}/action`, {
        method: "POST",
        body: JSON.stringify({ cardCode, action }),
      });
      await loadSession(cardCode);
    } catch (error) {
      setClientMessage(error instanceof Error ? error.message : "操作失败。");
    } finally {
      setClientBusy(false);
    }
  }

  async function copy(value: string) {
    await navigator.clipboard.writeText(value);
    setClientMessage("已复制。");
  }

  function getAdminAuth(override?: { username?: string; password?: string }) {
    return {
      username: (override?.username ?? adminUsername).trim(),
      password: override?.password ?? adminPassword,
    };
  }

  async function loadAdmin(options?: {
    username?: string;
    password?: string;
    silent?: boolean;
  }) {
    setAdminBusy(true);
    if (!options?.silent) {
      setAdminMessage("");
    }
    try {
      const adminAuth = getAdminAuth(options);
      const [overview, settingsData, accountData] = await Promise.all([
        api<AdminOverview>("/api/admin/overview", {
          method: "GET",
          adminAuth,
        }),
        api<{ settings: AdminSettings }>("/api/admin/settings", {
          method: "GET",
          adminAuth,
        }),
        api<{ account: AdminAccount }>("/api/admin/account", {
          method: "GET",
          adminAuth,
        }),
      ]);
      setAdmin(overview);
      setAdminSettings(settingsData.settings);
      setAdminAccount(accountData.account);
      setSettingsForm({
        apiBaseUrl: settingsData.settings.apiBaseUrl,
        apiKey: "",
        httpProxyUrl: settingsData.settings.httpProxyUrl,
        announcementEnabled: settingsData.settings.announcementEnabled,
        announcementTitle: settingsData.settings.announcementTitle,
        announcementBody: settingsData.settings.announcementBody,
      });
      setAccountForm({
        username: accountData.account.username,
        password: "",
        confirmPassword: "",
      });
      setAdminUsername(adminAuth.username);
      setAdminPassword(adminAuth.password);
      if (!options?.silent) {
        setAdminMessage("后台已刷新。");
      }
      localStorage.setItem("smsbower-admin-username", adminAuth.username);
      sessionStorage.setItem("smsbower-admin-username", adminAuth.username);
      sessionStorage.setItem("smsbower-admin-password", adminAuth.password);
    } catch (error) {
      setAdmin(null);
      setAdminSettings(null);
      setAdminAccount(null);
      sessionStorage.removeItem("smsbower-admin-password");
      setAdminMessage(error instanceof Error ? error.message : "后台加载失败。");
    } finally {
      setAdminBusy(false);
    }
  }

  async function saveSettings(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAdminBusy(true);
    try {
      const data = await api<{ settings: AdminSettings }>("/api/admin/settings", {
        method: "PATCH",
        adminAuth: getAdminAuth(),
        body: JSON.stringify(settingsForm),
      });
      setAdminSettings(data.settings);
      setSettingsForm({
        apiBaseUrl: data.settings.apiBaseUrl,
        apiKey: "",
        httpProxyUrl: data.settings.httpProxyUrl,
        announcementEnabled: data.settings.announcementEnabled,
        announcementTitle: data.settings.announcementTitle,
        announcementBody: data.settings.announcementBody,
      });
      await loadAdmin();
      setAdminMessage("API 设置已保存。");
    } catch (error) {
      setAdminMessage(error instanceof Error ? error.message : "API 设置保存失败。");
    } finally {
      setAdminBusy(false);
    }
  }

  async function saveAccount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAdminBusy(true);
    try {
      const data = await api<{ account: AdminAccount }>("/api/admin/account", {
        method: "PATCH",
        adminAuth: getAdminAuth(),
        body: JSON.stringify(accountForm),
      });
      const nextUsername = data.account.username;
      const nextPassword = accountForm.password || adminPassword;

      setAdminAccount(data.account);
      setAdminUsername(nextUsername);
      setAdminPassword(nextPassword);
      setAccountForm({
        username: nextUsername,
        password: "",
        confirmPassword: "",
      });
      localStorage.setItem("smsbower-admin-username", nextUsername);
      sessionStorage.setItem("smsbower-admin-username", nextUsername);
      sessionStorage.setItem("smsbower-admin-password", nextPassword);
      setAdminMessage("管理员账号设置已保存。");
    } catch (error) {
      setAdminMessage(
        error instanceof Error ? error.message : "管理员账号设置保存失败。"
      );
    } finally {
      setAdminBusy(false);
    }
  }

  async function testUpstream() {
    setUpstreamBusy(true);
    setUpstreamTest(null);
    try {
      const data = await api<UpstreamTest>("/api/admin/upstream-test", {
        method: "POST",
        adminAuth: getAdminAuth(),
      });
      setUpstreamTest(data);
      if (data.ok && data.balance) {
        setAdmin((current) =>
          current
            ? {
                ...current,
                upstreamBalance: data.balance ?? null,
                upstreamError: "",
              }
            : current
        );
      }
    } catch (error) {
      setUpstreamTest({
        ok: false,
        message: "SMSBower 通讯失败。",
        error: error instanceof Error ? error.message : "未知错误",
        checkedAt: new Date().toISOString(),
      });
    } finally {
      setUpstreamBusy(false);
    }
  }

  async function createConfig(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAdminBusy(true);
    try {
      await api<{ config: Config }>("/api/admin/configs", {
        method: "POST",
        adminAuth: getAdminAuth(),
        body: JSON.stringify(configForm),
      });
      await loadAdmin();
      setAdminMessage("配置已创建。");
    } catch (error) {
      setAdminMessage(error instanceof Error ? error.message : "配置创建失败。");
    } finally {
      setAdminBusy(false);
    }
  }

  async function toggleConfig(config: Config) {
    setAdminBusy(true);
    try {
      await api<{ config: Config }>(`/api/admin/configs/${config.id}`, {
        method: "PATCH",
        adminAuth: getAdminAuth(),
        body: JSON.stringify({ enabled: config.enabled ? 0 : 1 }),
      });
      await loadAdmin();
    } catch (error) {
      setAdminMessage(error instanceof Error ? error.message : "配置更新失败。");
    } finally {
      setAdminBusy(false);
    }
  }

  async function createCards(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAdminBusy(true);
    try {
      const data = await api<{ cards: AdminCard[] }>("/api/admin/cards", {
        method: "POST",
        adminAuth: getAdminAuth(),
        body: JSON.stringify(cardForm),
      });
      await loadAdmin();
      setAdminMessage(`已生成 ${data.cards.length} 张卡密。`);
    } catch (error) {
      setAdminMessage(error instanceof Error ? error.message : "卡密生成失败。");
    } finally {
      setAdminBusy(false);
    }
  }

  const selectedConfig = admin?.configs.find(
    (config) => String(config.id) === cardForm.serviceConfigId
  );

  return (
    <main className="min-h-screen bg-slate-100 text-slate-950">
      <div className="mx-auto grid max-w-7xl gap-6 px-4 py-6">
        <header className="flex flex-col gap-4 border-b border-slate-300 pb-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm text-slate-500">
              {adminOnly ? "SMSBower 后台" : "SMSBower 接码网关"}
            </p>
            <h1 className="mt-1 text-3xl font-semibold">
              {adminOnly ? "后台管理" : "卡密取号与短信回调"}
            </h1>
          </div>
          {adminOnly ? (
            <Link
              className="inline-flex h-10 w-fit items-center rounded border border-slate-300 bg-white px-4 text-sm font-medium text-slate-900 hover:bg-slate-50"
              href="/"
            >
              返回取号页
            </Link>
          ) : null}
        </header>

        {!adminOnly && announcement?.enabled && announcement.body ? (
          <section className="rounded-lg border border-amber-200 bg-amber-50 px-5 py-4 text-amber-950">
            {announcement.title ? (
              <h2 className="text-sm font-semibold">{announcement.title}</h2>
            ) : null}
            <p className="mt-1 whitespace-pre-wrap text-sm leading-6">
              {announcement.body}
            </p>
          </section>
        ) : null}

        {tab === "client" ? (
          <section className="grid gap-5 lg:grid-cols-[380px_1fr]">
            <aside className="rounded-lg border border-slate-300 bg-white p-5">
              <form
                className="grid gap-4"
                onSubmit={(event) => {
                  event.preventDefault();
                  loadSession(cardCode);
                }}
              >
                <Field
                  label="卡密"
                  placeholder="SB-XXXX-XXXX-XXXX"
                  value={cardCode}
                  onChange={(value) => setCardCode(value.toUpperCase())}
                />
                <Button disabled={clientBusy} type="submit">
                  {clientBusy ? "验证中" : "验证额度"}
                </Button>
              </form>

              {session && (
                <div className="mt-5 grid gap-3 border-t border-slate-200 pt-5 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">服务</span>
                    <strong>{session.config.serviceName}</strong>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">国家</span>
                    <strong>{session.config.countryName}</strong>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">剩余额度</span>
                    <strong>
                      {session.card.remaining}/{session.card.quotaTotal}
                    </strong>
                  </div>
                  <Button
                    disabled={clientBusy || Boolean(session.card.problem)}
                    onClick={createOrder}
                  >
                    获取手机号
                  </Button>
                </div>
              )}

              {clientMessage && (
                <p className="mt-4 rounded border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                  {clientMessage}
                </p>
              )}
            </aside>

            <section className="rounded-lg border border-slate-300 bg-white p-5">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-lg font-semibold">号码与验证码</h2>
                {session && (
                  <span className="text-sm text-slate-500">
                    {session.config.serviceCode} / {session.config.countryCode}
                  </span>
                )}
              </div>

              {!session ? (
                <div className="grid min-h-[320px] place-items-center rounded border border-dashed border-slate-300 text-sm text-slate-500">
                  等待卡密
                </div>
              ) : session.orders.length === 0 ? (
                <div className="grid min-h-[320px] place-items-center rounded border border-dashed border-slate-300 text-sm text-slate-500">
                  暂无取号订单
                </div>
              ) : (
                <div className="grid gap-3">
                  {session.orders.map((order) => (
                    <article
                      className="grid gap-3 rounded-lg border border-slate-200 p-4"
                      key={order.id}
                    >
                      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="font-semibold">{order.phoneNumber}</h3>
                            <StatusBadge status={order.status} />
                          </div>
                          <p className="mt-1 text-sm text-slate-500">
                            激活 ID {order.activationId}
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <Button
                            disabled={clientBusy}
                            onClick={() => copy(order.phoneNumber)}
                            variant="secondary"
                          >
                            复制号码
                          </Button>
                          <Button
                            disabled={clientBusy}
                            onClick={() => refreshOrder(order.id)}
                            variant="secondary"
                          >
                            刷新验证码
                          </Button>
                        </div>
                      </div>

                      <div className="grid gap-2 rounded border border-slate-200 bg-slate-50 p-3 text-sm">
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-slate-500">验证码</span>
                          <strong className="text-base">
                            {order.smsCode || "未收到"}
                          </strong>
                        </div>
                        {order.smsText && (
                          <p className="break-words text-slate-700">{order.smsText}</p>
                        )}
                        {order.upstreamStatus && (
                          <p className="text-xs text-slate-500">
                            {order.upstreamStatus}
                          </p>
                        )}
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <Button
                          disabled={clientBusy}
                          onClick={() => orderAction(order.id, "ready")}
                          variant="ghost"
                        >
                          已发送短信
                        </Button>
                        <Button
                          disabled={clientBusy}
                          onClick={() => orderAction(order.id, "retry")}
                          variant="ghost"
                        >
                          重新接码
                        </Button>
                        <Button
                          disabled={clientBusy}
                          onClick={() => orderAction(order.id, "finish")}
                          variant="secondary"
                        >
                          完成
                        </Button>
                        <Button
                          disabled={clientBusy || Boolean(order.refundedAt)}
                          onClick={() => orderAction(order.id, "cancel")}
                          variant="danger"
                        >
                          取消并退额度
                        </Button>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </section>
          </section>
        ) : !admin ? (
          <section className="grid min-h-[520px] place-items-center">
            <form
              className="grid w-full max-w-md gap-4 rounded-lg border border-slate-300 bg-white p-6"
              onSubmit={(event) => {
                event.preventDefault();
                loadAdmin();
              }}
            >
              <div>
                <h2 className="text-xl font-semibold">后台登录</h2>
                <p className="mt-1 text-sm text-slate-500">
                  输入管理员账号和密码后进入设置。
                </p>
              </div>
              <Field
                label="管理员账号"
                value={adminUsername}
                onChange={setAdminUsername}
              />
              <Field
                label="管理员密码"
                type="password"
                value={adminPassword}
                onChange={setAdminPassword}
              />
              <Button disabled={adminBusy} type="submit">
                登录
              </Button>
              {adminMessage && (
                <p className="rounded border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                  {adminMessage}
                </p>
              )}
            </form>
          </section>
        ) : (
          <section className="grid gap-5 xl:grid-cols-[380px_1fr]">
            <aside className="grid gap-5">
              <section className="grid gap-3 rounded-lg border border-slate-300 bg-white p-5">
                <div>
                  <h2 className="text-lg font-semibold">管理员</h2>
                  <p className="mt-1 text-sm text-slate-500">
                    当前账号：{adminUsername}
                  </p>
                </div>
                <Button
                  disabled={adminBusy}
                  onClick={() => {
                    setAdmin(null);
                    setAdminSettings(null);
                    setAdminAccount(null);
                    setAdminPassword("");
                    sessionStorage.removeItem("smsbower-admin-password");
                    setAdminMessage("已退出后台。");
                  }}
                  variant="secondary"
                >
                  退出登录
                </Button>
                {adminMessage && (
                  <p className="rounded border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                    {adminMessage}
                  </p>
                )}
              </section>

              <form
                className="grid gap-3 rounded-lg border border-slate-300 bg-white p-5"
                onSubmit={saveAccount}
              >
                <div>
                  <h2 className="text-lg font-semibold">账号安全</h2>
                  <p className="mt-1 text-sm text-slate-500">
                    修改后台管理员账号和登录密码。
                  </p>
                </div>
                <Field
                  label="管理员账号"
                  value={accountForm.username}
                  onChange={(value) =>
                    setAccountForm((form) => ({ ...form, username: value }))
                  }
                />
                <Field
                  label="新密码"
                  placeholder="留空则保持当前密码"
                  type="password"
                  value={accountForm.password}
                  onChange={(value) =>
                    setAccountForm((form) => ({ ...form, password: value }))
                  }
                />
                <Field
                  label="确认新密码"
                  placeholder="再次输入新密码"
                  type="password"
                  value={accountForm.confirmPassword}
                  onChange={(value) =>
                    setAccountForm((form) => ({
                      ...form,
                      confirmPassword: value,
                    }))
                  }
                />
                <div className="rounded border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
                  <p>账号来源：{adminAccount?.usernameSource ?? "--"}</p>
                  <p>密码来源：{adminAccount?.passwordSource ?? "--"}</p>
                </div>
                <Button disabled={adminBusy} type="submit">
                  保存账号设置
                </Button>
              </form>

              <form
                className="grid gap-3 rounded-lg border border-slate-300 bg-white p-5"
                onSubmit={saveSettings}
              >
                <div>
                  <h2 className="text-lg font-semibold">接口设置</h2>
                  <p className="mt-1 text-sm text-slate-500">
                    SMSBower API Key、请求地址和上游代理。
                  </p>
                </div>
                <Field
                  label="API 地址"
                  value={settingsForm.apiBaseUrl}
                  onChange={(value) =>
                    setSettingsForm((form) => ({ ...form, apiBaseUrl: value }))
                  }
                />
                <Field
                  label="API Key"
                  type="password"
                  placeholder={
                    adminSettings?.apiKeyConfigured
                      ? "留空则保持当前 API Key"
                      : "请输入 SMSBower API Key"
                  }
                  value={settingsForm.apiKey}
                  onChange={(value) =>
                    setSettingsForm((form) => ({ ...form, apiKey: value }))
                  }
                />
                <div className="rounded border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
                  <p>当前 Key：{adminSettings?.apiKeyPreview || "未设置"}</p>
                  <p>来源：{adminSettings?.apiKeySource || "--"}</p>
                </div>
                <Field
                  label="HTTP 代理"
                  placeholder="例如：http://user:pass@1.2.3.4:7890，留空则直连"
                  value={settingsForm.httpProxyUrl}
                  onChange={(value) =>
                    setSettingsForm((form) => ({
                      ...form,
                      httpProxyUrl: value,
                    }))
                  }
                />
                <div className="rounded border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
                  <p>
                    当前代理：
                    {adminSettings?.httpProxyConfigured
                      ? adminSettings.httpProxyPreview
                      : "未设置，直连"}
                  </p>
                  <p>来源：{adminSettings?.httpProxySource || "--"}</p>
                </div>
                <div className="border-t border-slate-200 pt-3">
                  <h3 className="text-sm font-semibold text-slate-900">首页公告</h3>
                  <label className="mt-3 flex items-center gap-2 text-sm text-slate-700">
                    <input
                      checked={settingsForm.announcementEnabled}
                      className="h-4 w-4 accent-teal-700"
                      type="checkbox"
                      onChange={(event) =>
                        setSettingsForm((form) => ({
                          ...form,
                          announcementEnabled: event.target.checked,
                        }))
                      }
                    />
                    启用公告栏
                  </label>
                </div>
                <Field
                  label="公告标题"
                  placeholder="例如：最新通知"
                  value={settingsForm.announcementTitle}
                  onChange={(value) =>
                    setSettingsForm((form) => ({
                      ...form,
                      announcementTitle: value,
                    }))
                  }
                />
                <TextArea
                  label="公告内容"
                  placeholder="填写要展示在首页的公告内容"
                  value={settingsForm.announcementBody}
                  onChange={(value) =>
                    setSettingsForm((form) => ({
                      ...form,
                      announcementBody: value,
                    }))
                  }
                />
                <Button disabled={adminBusy} type="submit">
                  保存接口设置
                </Button>
              </form>

              <form
                className="grid gap-3 rounded-lg border border-slate-300 bg-white p-5"
                onSubmit={createConfig}
              >
                <h2 className="text-lg font-semibold">服务国家配置</h2>
                <Field
                  label="服务代码"
                  value={configForm.serviceCode}
                  onChange={(value) =>
                    setConfigForm((form) => ({ ...form, serviceCode: value }))
                  }
                />
                <Field
                  label="服务名称"
                  value={configForm.serviceName}
                  onChange={(value) =>
                    setConfigForm((form) => ({ ...form, serviceName: value }))
                  }
                />
                <Field
                  label="国家代码"
                  value={configForm.countryCode}
                  onChange={(value) =>
                    setConfigForm((form) => ({ ...form, countryCode: value }))
                  }
                />
                <Field
                  label="国家名称"
                  value={configForm.countryName}
                  onChange={(value) =>
                    setConfigForm((form) => ({ ...form, countryName: value }))
                  }
                />
                <Field
                  label="价格备注"
                  value={configForm.priceHint}
                  onChange={(value) =>
                    setConfigForm((form) => ({ ...form, priceHint: value }))
                  }
                />
                <Field
                  label="备注"
                  value={configForm.note}
                  onChange={(value) =>
                    setConfigForm((form) => ({ ...form, note: value }))
                  }
                />
                <Button disabled={adminBusy} type="submit">
                  新增配置
                </Button>
              </form>

              <form
                className="grid gap-3 rounded-lg border border-slate-300 bg-white p-5"
                onSubmit={createCards}
              >
                <h2 className="text-lg font-semibold">生成卡密</h2>
                <label className="grid gap-1 text-sm text-slate-600">
                  <span>绑定配置</span>
                  <select
                    className="h-10 rounded border border-slate-300 bg-white px-3 text-sm text-slate-950 outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
                    value={cardForm.serviceConfigId}
                    onChange={(event) =>
                      setCardForm((form) => ({
                        ...form,
                        serviceConfigId: event.target.value,
                      }))
                    }
                  >
                    <option value="">选择配置</option>
                    {admin?.configs.map((config) => (
                      <option key={config.id} value={config.id}>
                        {config.serviceName} / {config.countryName}
                      </option>
                    ))}
                  </select>
                </label>
                {selectedConfig && (
                  <p className="rounded border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
                    {selectedConfig.serviceCode} / {selectedConfig.countryCode}
                  </p>
                )}
                <Field
                  label="每张额度"
                  type="number"
                  value={cardForm.quotaTotal}
                  onChange={(value) =>
                    setCardForm((form) => ({ ...form, quotaTotal: value }))
                  }
                />
                <Field
                  label="生成数量"
                  type="number"
                  value={cardForm.count}
                  onChange={(value) =>
                    setCardForm((form) => ({ ...form, count: value }))
                  }
                />
                <Field
                  label="前缀"
                  value={cardForm.prefix}
                  onChange={(value) =>
                    setCardForm((form) => ({ ...form, prefix: value.toUpperCase() }))
                  }
                />
                <Field
                  label="标签"
                  value={cardForm.label}
                  onChange={(value) =>
                    setCardForm((form) => ({ ...form, label: value }))
                  }
                />
                <Field
                  label="过期时间"
                  type="datetime-local"
                  value={cardForm.expiresAt}
                  onChange={(value) =>
                    setCardForm((form) => ({ ...form, expiresAt: value }))
                  }
                />
                <Button disabled={adminBusy || !admin} type="submit">
                  生成卡密
                </Button>
              </form>
            </aside>

            <section className="grid gap-5">
              <div className="grid gap-5 md:grid-cols-3">
                <section className="rounded-lg border border-slate-300 bg-white p-5">
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-sm text-slate-500">上游余额</p>
                    <button
                      className="rounded border border-slate-300 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                      disabled={upstreamBusy || adminBusy}
                      type="button"
                      onClick={testUpstream}
                    >
                      {upstreamBusy ? "测试中" : "通讯测试"}
                    </button>
                  </div>
                  <strong className="mt-2 block text-2xl">
                    {admin?.upstreamBalance?.balance ?? "--"}
                  </strong>
                  {admin?.upstreamError && (
                    <p className="mt-2 text-sm text-rose-700">{admin.upstreamError}</p>
                  )}
                  {upstreamTest && (
                    <div
                      className={`mt-3 rounded border px-3 py-2 text-xs ${
                        upstreamTest.ok
                          ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                          : "border-rose-200 bg-rose-50 text-rose-800"
                      }`}
                    >
                      <p className="font-medium">{upstreamTest.message}</p>
                      <p className="mt-1 break-words">
                        {upstreamTest.ok
                          ? `响应：${upstreamTest.raw ?? upstreamTest.balance?.raw ?? "--"}`
                          : `错误：${upstreamTest.error ?? "--"}`}
                      </p>
                      <p className="mt-1 text-[11px] opacity-80">
                        {new Date(upstreamTest.checkedAt).toLocaleString()}
                      </p>
                    </div>
                  )}
                </section>
                <section className="rounded-lg border border-slate-300 bg-white p-5">
                  <p className="text-sm text-slate-500">配置数量</p>
                  <strong className="mt-2 block text-2xl">
                    {admin?.configs.length ?? 0}
                  </strong>
                </section>
                <section className="rounded-lg border border-slate-300 bg-white p-5">
                  <p className="text-sm text-slate-500">Webhook</p>
                  <button
                    className="mt-2 max-w-full truncate text-left text-sm font-medium text-teal-700"
                    onClick={() => navigator.clipboard.writeText(webhookUrl)}
                    type="button"
                  >
                    {webhookUrl}
                  </button>
                  <p className="mt-2 text-xs text-slate-500">来源 IP 167.235.198.205</p>
                </section>
              </div>

              <section className="rounded-lg border border-slate-300 bg-white">
                <div className="flex items-center justify-between border-b border-slate-200 p-4">
                  <h2 className="text-lg font-semibold">已配置服务</h2>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[760px] text-left text-sm">
                    <thead className="bg-slate-50 text-slate-500">
                      <tr>
                        <th className="p-3 font-medium">服务</th>
                        <th className="p-3 font-medium">国家</th>
                        <th className="p-3 font-medium">价格备注</th>
                        <th className="p-3 font-medium">状态</th>
                        <th className="p-3 font-medium">操作</th>
                      </tr>
                    </thead>
                    <tbody>
                      {admin?.configs.map((config) => (
                        <tr className="border-t border-slate-100" key={config.id}>
                          <td className="p-3">
                            {config.serviceName}
                            <span className="ml-2 text-slate-500">
                              {config.serviceCode}
                            </span>
                          </td>
                          <td className="p-3">
                            {config.countryName}
                            <span className="ml-2 text-slate-500">
                              {config.countryCode}
                            </span>
                          </td>
                          <td className="p-3">{config.priceHint || "--"}</td>
                          <td className="p-3">
                            <StatusBadge
                              status={config.enabled ? "completed" : "cancelled"}
                            />
                          </td>
                          <td className="p-3">
                            <Button
                              disabled={adminBusy}
                              onClick={() => toggleConfig(config)}
                              variant="secondary"
                            >
                              {config.enabled ? "停用" : "启用"}
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>

              <section className="rounded-lg border border-slate-300 bg-white">
                <div className="flex items-center justify-between border-b border-slate-200 p-4">
                  <h2 className="text-lg font-semibold">卡密列表</h2>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[900px] text-left text-sm">
                    <thead className="bg-slate-50 text-slate-500">
                      <tr>
                        <th className="p-3 font-medium">卡密</th>
                        <th className="p-3 font-medium">服务国家</th>
                        <th className="p-3 font-medium">额度</th>
                        <th className="p-3 font-medium">标签</th>
                        <th className="p-3 font-medium">状态</th>
                      </tr>
                    </thead>
                    <tbody>
                      {admin?.cards.map((card) => (
                        <tr className="border-t border-slate-100" key={card.id}>
                          <td className="p-3 font-mono">{card.code}</td>
                          <td className="p-3">
                            {card.serviceName} / {card.countryName}
                          </td>
                          <td className="p-3">
                            {card.quotaTotal - card.quotaUsed}/{card.quotaTotal}
                          </td>
                          <td className="p-3">{card.label || "--"}</td>
                          <td className="p-3">{card.status}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>

              <section className="rounded-lg border border-slate-300 bg-white">
                <div className="flex items-center justify-between border-b border-slate-200 p-4">
                  <h2 className="text-lg font-semibold">最近订单</h2>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[900px] text-left text-sm">
                    <thead className="bg-slate-50 text-slate-500">
                      <tr>
                        <th className="p-3 font-medium">激活 ID</th>
                        <th className="p-3 font-medium">手机号</th>
                        <th className="p-3 font-medium">服务国家</th>
                        <th className="p-3 font-medium">验证码</th>
                        <th className="p-3 font-medium">状态</th>
                      </tr>
                    </thead>
                    <tbody>
                      {admin?.orders.map((order) => (
                        <tr className="border-t border-slate-100" key={order.id}>
                          <td className="p-3">{order.activationId}</td>
                          <td className="p-3">{order.phoneNumber}</td>
                          <td className="p-3">
                            {order.serviceName} / {order.countryName}
                          </td>
                          <td className="p-3 font-semibold">{order.smsCode || "--"}</td>
                          <td className="p-3">
                            <StatusBadge status={order.status} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            </section>
          </section>
        )}
      </div>
    </main>
  );
}
