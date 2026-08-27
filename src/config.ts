import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();


const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  LOG_LEVEL: z
    .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
    .default('info'),

  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),

  OPENAI_API_KEY: z.string().min(1, 'OPENAI_API_KEY is required'),
  OPENAI_BASE_URL: z.string().url().default('https://api.openai.com/v1'),
  PROVIDER_TIMEOUT_MS: z.coerce.number().int().positive().default(20_000),
  PROVIDER_MAX_ATTEMPTS: z.coerce.number().int().min(1).max(5).default(2),

  ADMIN_TOKEN: z.string().min(1, 'ADMIN_TOKEN is required'),
});

export type AppConfig = z.infer<typeof EnvSchema>;

function loadConfig(): AppConfig {
  const parsed = EnvSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join('.') || '(root)'}: ${i.message}`)
      .join('\n');
     console.error(`Invalid environment configuration:\n${issues}`);
    process.exit(1);
  }
  return parsed.data;
}

export const config = loadConfig();

export const isProd = config.NODE_ENV === 'production';
