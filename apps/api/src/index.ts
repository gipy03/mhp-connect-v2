import express from "express";
import { validateEnv } from "@mhp/integrations/env";

const env = validateEnv();
const app = express();
const port = parseInt(env.PORT, 10);

app.use(express.json());

// ---------------------------------------------------------------------------
// Health checks
// ---------------------------------------------------------------------------

app.get("/healthz", (_req, res) => {
  res.json({ status: "ok" });
});

app.get("/readyz", async (_req, res) => {
  // TODO: add DB connectivity check
  res.json({ status: "ok" });
});

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------

app.listen(port, () => {
  console.log(`mhp | connect API listening on port ${port}`);
});

export default app;
