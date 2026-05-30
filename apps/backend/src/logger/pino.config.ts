import type { Params } from 'nestjs-pino';
import { randomUUID } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';

const DEFAULT_LOG_FILE_PATH = '../../logs/app.log';
const DEFAULT_LOG_FILE_MAX_SIZE = '50M';
const DEFAULT_LOG_FILE_KEEP_FILES = 7;

const buildTargets = (level: string) => {
  const fileTarget = {
    target: 'pino-roll',
    level,
    options: {
      file: process.env.LOG_FILE_PATH ?? DEFAULT_LOG_FILE_PATH,
      size: process.env.LOG_FILE_MAX_SIZE ?? DEFAULT_LOG_FILE_MAX_SIZE,
      limit: {
        count: Number(
          process.env.LOG_FILE_KEEP_FILES ?? DEFAULT_LOG_FILE_KEEP_FILES,
        ),
      },
      mkdir: true,
    },
  };

  if (process.env.NODE_ENV === 'production') return [fileTarget];

  const prettyTarget = {
    target: 'pino-pretty',
    level,
    options: {
      colorize: true,
      translateTime: 'SYS:HH:MM:ss.l',
      ignore: 'pid,hostname',
      singleLine: false,
    },
  };

  return [prettyTarget, fileTarget];
};

export const buildPinoConfig = (): Params => {
  const level = process.env.LOG_LEVEL ?? 'info';
  return {
    pinoHttp: {
      level,
      genReqId: (req: IncomingMessage, _res: ServerResponse): string => {
        const existing = req.headers['x-request-id'];
        if (typeof existing === 'string' && existing.length > 0) return existing;
        return randomUUID();
      },
      redact: {
        paths: [
          'req.headers.authorization',
          'req.headers.cookie',
          'res.headers["set-cookie"]',
        ],
        censor: '[REDACTED]',
      },
      transport: {
        targets: buildTargets(level),
      },
    },
  };
};
