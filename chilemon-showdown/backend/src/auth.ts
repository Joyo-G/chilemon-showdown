import { getCookie, setCookie, deleteCookie } from "hono/cookie";
import { sign, verify } from "hono/jwt";
import type { Context, Next } from "hono";
import type { Bindings, User, Variables } from "./types";

type TokenPayload = {
  id: string;
  csrf: string;
  username?: string;
  exp: number;
};

export type AppContext = Context<{ Bindings: Bindings; Variables: Variables }>;

export const authenticate = async (c: AppContext, next: Next) => {
  const token = getCookie(c, "token");
  if (!token) {
    return c.json({ error: "missing token" }, 401);
  }

  const csrfHeader = c.req.header("x-csrf-token");

  try {
    const decoded = (await verify(token, c.env.JWT_SECRET, "HS256")) as
      | TokenPayload
      | string;

    if (
      typeof decoded === "object" &&
      decoded.id &&
      decoded.csrf &&
      csrfHeader === decoded.csrf
    ) {
      c.set("userId", decoded.id);
      c.set("csrf", decoded.csrf);
      return next();
    }

    return c.json({ error: "Invalid token or CSRF" }, 401);
  } catch (err) {
    console.error("JWT verify failed", err);
    return c.json({ error: "Invalid token" }, 401);
  }
};

export const issueSession = async (c: AppContext, user: User) => {
  const csrf = crypto.randomUUID();
  const payload: TokenPayload = {
    id: user.id,
    username: user.username,
    csrf,
    exp: Math.floor(Date.now() / 1000) + 60 * 60,
  };

  const token = await sign(payload, c.env.JWT_SECRET, "HS256");

  setCookie(c, "token", token, {
    httpOnly: true,
    secure: true,
    sameSite: "Lax",
    path: "/",
  });

  c.header("X-CSRF-Token", csrf);
  c.set("userId", user.id);
  return token;
};

export const clearSession = (c: AppContext) => {
  deleteCookie(c, "token", { path: "/" });
};
