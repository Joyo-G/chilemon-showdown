export type BattleSummary = {
  _id: string;
  status?: string;
  turn?: number;
  players?: Array<{
    userId: string;
    username?: string;
  }>;
  log?: string[];
};

// Base URL for the battle API. Defaults to `/api` so dev + production (Pages/Workers) work.
const BASE = (import.meta.env.VITE_API_URL || "/api").replace(/\/$/, "");

async function ensureJsonResponse(res: Response, contextMessage = "") {
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${contextMessage} ${res.status} ${text}`);
  }

  const contentType = res.headers.get("content-type") || "";
  if (contentType.includes("text/html")) {
    const text = await res.text();
    const snippet = text.slice(0, 400).replace(/\n/g, " ");
    throw new Error(
      `Expected JSON but received HTML. ${contextMessage} Response snippet: ${snippet}`,
    );
  }
}

function buildFetchOptions(method: string, body?: any) {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "X-CSRF-Token": localStorage.getItem("csrf") || "",
  };
  const opts: RequestInit = {
    method,
    credentials: "include",
    headers,
  };
  if (body !== undefined) opts.body = JSON.stringify(body);
  return opts;
}

export async function getUserBattles(
  userId: string,
): Promise<BattleSummary[]> {
  const res = await fetch(
    `${BASE}/${encodeURIComponent(userId)}/battles`,
    buildFetchOptions("GET"),
  );

  await ensureJsonResponse(res, "Failed to fetch user battles:");
  return (await res.json()) as BattleSummary[];
}

export async function createBattle(
  userId: string,
  teamId: string,
): Promise<BattleSummary> {
  console.log("Creating battle with teamId:", teamId);
  console.log("POSTing to:", `${BASE}/battles`);
  const res = await fetch(
    `${BASE}/battles`,
    buildFetchOptions("POST", { userId, teamId }),
  );

  await ensureJsonResponse(res, "Failed to create battle:");
  return (await res.json()) as BattleSummary;
}

export async function getBattle(
  battleId: string,
  userId?: string,
): Promise<any> {
  const query = userId ? `?userId=${encodeURIComponent(userId)}` : "";
  const res = await fetch(
    `${BASE}/battles/${encodeURIComponent(battleId)}${query}`,
    buildFetchOptions("GET"),
  );

  await ensureJsonResponse(res, "Failed to fetch battle:");
  return await res.json();
}

export async function submitMove(
  battleId: string,
  moveId: number,
  userId?: string,
): Promise<any> {
  const uid = userId ?? localStorage.getItem("userId") ?? undefined;
  const body: any = { moveId };
  if (uid) body.userId = uid;
  const res = await fetch(
    `${BASE}/battles/${encodeURIComponent(battleId)}/move`,
    buildFetchOptions("POST", body),
  );

  await ensureJsonResponse(res, "Failed to submit move:");
  return await res.json();
}

export async function submitSwitch(
  battleId: string,
  toIndex: number,
  userId?: string,
): Promise<any> {
  const uid = userId ?? localStorage.getItem("userId") ?? undefined;
  const body: any = { toIndex };
  if (uid) body.userId = uid;
  const res = await fetch(
    `${BASE}/battles/${encodeURIComponent(battleId)}/switch`,
    buildFetchOptions("POST", body),
  );

  await ensureJsonResponse(res, "Failed to submit switch:");
  return await res.json();
}

export async function forfeitBattle(
  battleId: string,
  userId?: string,
): Promise<any> {
  const uid = userId ?? localStorage.getItem("userId") ?? undefined;
  const body: any = {};
  if (uid) body.userId = uid;
  const res = await fetch(
    `${BASE}/battles/${encodeURIComponent(battleId)}/forfeit`,
    buildFetchOptions("POST", body),
  );

  await ensureJsonResponse(res, "Failed to forfeit battle:");
  return await res.json();
}

export default {
  getUserBattles,
  createBattle,
  getBattle,
  submitMove,
  submitSwitch,
  forfeitBattle,
};
