import { Router } from "express";
import { eq, and } from "drizzle-orm";
import { requireUser } from "../middleware/auth.js";
import { db } from "../db.js";
import { userWishlist } from "@mhp/shared";

const router = Router();

router.use(requireUser);

router.get("/", async (req, res, next) => {
  try {
    const items = await db
      .select({ programCode: userWishlist.programCode })
      .from(userWishlist)
      .where(eq(userWishlist.userId, req.session.userId!));
    res.json(items.map((i) => i.programCode));
  } catch (err) {
    next(err);
  }
});

router.post("/:code", async (req, res, next) => {
  try {
    const code = (req.params.code as string).trim();
    if (!code || code.length > 100) {
      res.status(400).json({ error: "Invalid program code" });
      return;
    }
    await db
      .insert(userWishlist)
      .values({
        userId: req.session.userId!,
        programCode: code,
      })
      .onConflictDoNothing();
    res.status(201).json({ ok: true });
  } catch (err) {
    next(err);
  }
});

router.delete("/:code", async (req, res, next) => {
  try {
    await db
      .delete(userWishlist)
      .where(
        and(
          eq(userWishlist.userId, req.session.userId!),
          eq(userWishlist.programCode, req.params.code as string)
        )
      );
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

export default router;
