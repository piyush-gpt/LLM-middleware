import pino from 'pino';
import { config, isProd } from './config';

export const logger = pino({
  level: config.LOG_LEVEL,
  transport: isProd
    ? undefined
    : {
        target: 'pino-pretty',
        options: { colorize: true, translateTime: 'SYS:HH:MM:ss' },
      },
});
