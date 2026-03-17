import { z } from 'zod';

const envSchema = z.object({
  DATABASE_URL: z.string(),
  MEILISEARCH_HOST: z.string().default('http://localhost:7700'),
  MEILISEARCH_API_KEY: z.string(),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(3000),
  KAKAO_CHANNEL_TOKEN: z.string().optional(),
});

export type Config = z.infer<typeof envSchema>;

let _config: Config | null = null;

export function getConfig(): Config {
  if (_config) return _config;

  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    const missing = result.error.issues.map((i) => i.path.join('.')).join(', ');
    // config 초기화 실패는 프로세스 시작 시 발생하므로 throw 허용
    throw new Error(`Missing or invalid environment variables: ${missing}`);
  }

  _config = result.data;
  return _config;
}
