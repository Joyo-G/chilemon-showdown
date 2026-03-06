import { Hono } from "hono";
import { dbUtil } from "../db";
import type { Bindings, Variables } from "../types";

const router = new Hono<{ Bindings: Bindings; Variables: Variables }>();

router.post("/reset", async (c) => {
  await dbUtil.resetData(c.env.DB);
  return c.json({ message: "Database reset successfully." });
});

export default router;
