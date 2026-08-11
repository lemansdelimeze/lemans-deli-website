type TrendyolGoConfig = {
  sellerId: string;
  apiKey: string;
  apiSecret: string;
  baseUrl: string;
  agentName: string;
  executorUser: string;
};

function getConfig(): TrendyolGoConfig {
  const sellerId = process.env.TRENDYOL_SELLER_ID;
  const apiKey = process.env.TRENDYOL_API_KEY;
  const apiSecret = process.env.TRENDYOL_API_SECRET;
  const baseUrl = process.env.TRENDYOL_BASE_URL ?? "https://api.tgoapis.com";
  const agentName = process.env.TRENDYOL_AGENT_NAME ?? "LemansDeli";
  const executorUser = process.env.TRENDYOL_EXECUTOR_USER ?? "info@lemansdeli.com";

  if (!sellerId || !apiKey || !apiSecret) {
    throw new Error(
      "TRENDYOL_SELLER_ID, TRENDYOL_API_KEY veya TRENDYOL_API_SECRET eksik."
    );
  }

  return { sellerId, apiKey, apiSecret, baseUrl, agentName, executorUser };
}

export function getTrendyolGoSellerId() {
  return getConfig().sellerId;
}

export async function trendyolGoRequest<T>(
  path: string,
  init: RequestInit = {}
): Promise<T> {
  const config = getConfig();

  const basicAuth = Buffer.from(
    `${config.apiKey}:${config.apiSecret}`
  ).toString("base64");

  const response = await fetch(`${config.baseUrl}${path}`, {
    ...init,
    headers: {
      Authorization: `Basic ${basicAuth}`,
      "User-Agent": `${config.sellerId} - SelfIntegration`,
      "x-agentname": config.agentName,
      "x-executor-user": config.executorUser,
      Accept: "application/json",
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
    cache: "no-store",
  });

  const raw = await response.text();

  let body: unknown = null;
  try {
    body = raw ? JSON.parse(raw) : null;
  } catch {
    body = raw;
  }

  if (!response.ok) {
    throw new Error(
      `Uber Eats Trendyol Go API ${response.status}: ${
        typeof body === "string" ? body : JSON.stringify(body)
      }`
    );
  }

  return body as T;
}