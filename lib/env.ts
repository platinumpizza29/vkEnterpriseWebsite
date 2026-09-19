/**
 * Next.js loads root `.env*` files into `process.env` before evaluating the
 * application and `next.config.ts`. Keep environment access in one place so
 * server configuration can reuse the same API URL and fallback behavior.
 */
export function getApiServerUrl(): string {
  return (
    process.env.API_SERVER_URL ||
    process.env.NEXT_PUBLIC_API_URL ||
    "http://localhost:8080"
  ).replace(/\/$/, "");
}
