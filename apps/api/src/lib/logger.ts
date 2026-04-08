import pino from "pino";
import type { Options, HttpLogger } from "pino-http";
import type { IncomingMessage, ServerResponse } from "node:http";
import { createRequire } from "node:module";
import crypto from "node:crypto";

const require = createRequire(import.meta.url);

export const logger = pino({
  level: process.env.LOG_LEVEL || "info",
  transport:
    process.env.NODE_ENV !== "production"
      ? { target: "pino/file", options: { destination: 1 } }
      : undefined,
});

const pinoHttpFn = require("pino-http") as (
  opts?: Options<IncomingMessage, ServerResponse>
) => HttpLogger<IncomingMessage, ServerResponse>;

export const httpLogger = pinoHttpFn({
  logger,
  genReqId: () => crypto.randomUUID().slice(0, 8),
  autoLogging: {
    ignore: (req: IncomingMessage) => {
      const url = req.url ?? "";
      return url === "/healthz" || url === "/readyz";
    },
  },
  serializers: {
    req: (req: IncomingMessage) => ({
      method: req.method,
      url: req.url,
    }),
    res: (res: ServerResponse) => ({
      statusCode: res.statusCode,
    }),
  },
});
