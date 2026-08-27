import { createApp } from './app';
import { config } from './config';
import { logger } from './logger';
import { migrate } from './db/migrate';

async function main(): Promise<void> {
  // Apply schema on boot so a fresh deploy is immediately usable.
  await migrate();

  const app = createApp();
  app.listen(config.PORT, () => {
    logger.info(`LLM gateway listening on :${config.PORT}`);
  });
}

main().catch((err) => {
  logger.error({ err }, 'Fatal error during startup');
  process.exit(1);
});
