import pino from "pino";
import pinoHttp from "pino-http";
import crypto from "node:crypto";

export const logger = pino({
  level: process.env.LOG_LEVEL || "info",
  transport:
    process.env.NODE_ENV !== "production"
      ? { target: "pino/file", options: { destination: 1 } }
      : undefined,
});

export const httpLogger = pinoHttp({
  logger,
  genReqId: () => crypto.randomUUID().slice(0, 8),
  autoLogging: {
    ignore: (req) => {
      const url = (req as any).url ?? "";
      return url === "/healthz" || url === "/readyz";
    },
  },
  serializers: {
    req: (req) => ({
      method: req.method,
      url: req.url,
    }),
    res: (res) => ({
      statusCode: res.statusCode,
    }),
  },
});
