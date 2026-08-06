import { getSql } from "./db";

const WINDOW_MINUTES = 15;

function clientAddress(request: Request) {
  return request.headers.get("x-vercel-forwarded-for")?.split(",")[0]?.trim()
    || request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    || "unknown";
}

// A contagem fica no banco, portanto continua valendo mesmo quando o Vercel
// cria outra instância do site.
export async function limited(request: Request, scope: string, maximum: number) {
  const sql = getSql();
  const key = `${scope}:${clientAddress(request)}`;
  await sql`CREATE TABLE IF NOT EXISTS request_limits (key text PRIMARY KEY, attempts integer NOT NULL DEFAULT 0, expires_at timestamptz NOT NULL)`;
  const rows = await sql`
    INSERT INTO request_limits (key, attempts, expires_at)
    VALUES (${key}, 1, NOW() + (${WINDOW_MINUTES} * INTERVAL '1 minute'))
    ON CONFLICT (key) DO UPDATE SET
      attempts = CASE WHEN request_limits.expires_at < NOW() THEN 1 ELSE request_limits.attempts + 1 END,
      expires_at = CASE WHEN request_limits.expires_at < NOW() THEN NOW() + (${WINDOW_MINUTES} * INTERVAL '1 minute') ELSE request_limits.expires_at END
    RETURNING attempts
  `;
  return Number(rows[0]?.attempts ?? 0) > maximum;
}
