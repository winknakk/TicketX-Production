/**
 * Resolves the origin the frontend should send API requests to.
 *
 * `VITE_API_URL` wins whenever it is set. What changed is the fallback.
 *
 * It used to be a literal `http://127.0.0.1:3000`, repeated at ten call sites.
 * Vite inlines these at build time, so a production build made without the
 * variable shipped a page that asks *the visitor's own machine* for the API.
 * Browsers refuse that on two counts — a page on `https://<host>` reaching
 * `http://127.0.0.1` is both mixed content and a private-network request — and
 * the console fills with:
 *
 *   Access to fetch at 'http://127.0.0.1:3000/api/v1/auth/login' from origin
 *   'https://ticket.centerapp.io' has been blocked by CORS policy: Permission
 *   was denied for this request to access the `loopback` address space.
 *
 * Every call fails, including login, and it looks like rejected credentials.
 *
 * The fallback is now same-origin, which matches how the app is deployed:
 * ops/nginx.conf proxies /api/ to the backend on the same host. Loopback is
 * used only when the page itself is served locally — that is, in development.
 */

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]', '']);
const DEV_BACKEND = 'http://127.0.0.1:3000';

function stripTrailingSlash(url: string): string {
  return url.replace(/\/$/, '');
}

export function resolveApiBaseUrl(): string {
  const env = typeof import.meta !== 'undefined' ? (import.meta as any).env : undefined;
  const configured = env?.VITE_API_URL || env?.VITE_API_BASE_URL;
  if (configured) return stripTrailingSlash(String(configured));

  // No window means no origin to borrow (tests, any non-browser evaluation).
  if (typeof window === 'undefined' || !window.location) return DEV_BACKEND;

  const { hostname, origin } = window.location;
  if (LOCAL_HOSTS.has(hostname)) return DEV_BACKEND;

  return stripTrailingSlash(origin);
}

/**
 * Evaluated once. window.location.origin does not change for the life of the
 * page, and the previous code also captured the value at module scope.
 */
export const API_BASE_URL = resolveApiBaseUrl();
