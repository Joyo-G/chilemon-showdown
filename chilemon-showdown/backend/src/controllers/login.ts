import { Hono } from "hono";
import { compare } from "bcryptjs";
import { authenticate, clearSession, issueSession } from "../auth";
import { dbUsers } from "../db";
import type { Bindings, Variables } from "../types";

const router = new Hono<{ Bindings: Bindings; Variables: Variables }>();

router.post("/", async (c) => {
  const { username, password } = await c.req.json<{
    username?: string;
    password?: string;
  }>();
  if (!username || !password)
    return c.json({ error: "username and password are required" }, 400);

  const user = await dbUsers.getWithPassword(c.env.DB, username);
  if (!user?.password)
    return c.json({ error: "invalid username or password" }, 401);

  const ok = await compare(password, user.password);
  if (!ok) return c.json({ error: "invalid username or password" }, 401);

  await issueSession(c, user);
  return c.json({ id: user.id, username: user.username });
});

router.get("/me", authenticate, async (c) => {
  const userId = c.get("userId");
  if (!userId) return c.json({ error: "not authenticated" }, 401);
  const user = await dbUsers.findById(c.env.DB, userId);
  if (!user) return c.json({ error: "user not found" }, 404);
  return c.json(user);
});

router.post("/logout", (c) => {
  clearSession(c);
  return c.json({ message: "Logged out successfully" });
});

export default router;
