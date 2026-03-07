import { Hono } from "hono";
import { hash } from "bcryptjs";
import { authenticate } from "../auth";
import { dbUsers } from "../db";
import type { Bindings, Variables } from "../types";

const router = new Hono<{ Bindings: Bindings; Variables: Variables }>();

router.get("/", async (c) => {
  const username = c.req.query("username");

  // Public check for username availability (no auth required)
  if (username) {
    const user = await dbUsers.findByUsername(c.env.DB, username);
    return c.json(user ? [user] : []);
  }

  // Authenticated list of users
  return authenticate(c, async () => {
    const users = await dbUsers.list(c.env.DB);
    return c.json(users);
  });
});

router.post("/", async (c) => {
  try {
    const { username, password } = await c.req.json<{
      username?: string;
      password?: string;
    }>();
    if (!username || !password) {
      return c.json({ error: "username and password are required" }, 400);
    }

    const passwordHash = await hash(password, 10);
    try {
      const savedUser = await dbUsers.insert(c.env.DB, username, passwordHash);
      return c.json(savedUser, 201);
    } catch (err: any) {
      const msg = String(err?.message ?? "");
      // Handle D1 unique constraint variants
      if (
        msg.includes("UNIQUE constraint") ||
        msg.includes("constraint violation")
      ) {
        return c.json({ error: "username already exists" }, 409);
      }
      console.error("Error inserting user:", err);
      return c.json({ error: "internal error" }, 500);
    }
  } catch (error) {
    console.error("Error creating user:", error);
    return c.json({ error: "internal error" }, 500);
  }
});

export default router;
