import { Hono } from "hono";
import { hash } from "bcryptjs";
import { authenticate } from "../auth";
import { dbUsers } from "../db";
import type { Bindings, Variables } from "../types";

const router = new Hono<{ Bindings: Bindings; Variables: Variables }>();

router.get("/", authenticate, async (c) => {
  const users = await dbUsers.list(c.env.DB);
  return c.json(users);
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
      if (
        typeof err?.message === "string" &&
        err.message.includes("UNIQUE constraint failed")
      ) {
        return c.json({ error: "username already exists" }, 409);
      }
      throw err;
    }
  } catch (error) {
    console.error("Error creating user:", error);
    return c.json({ error: "internal error" }, 500);
  }
});

export default router;
