/**
 * Resolves the server base URL for HTTP fetch requests.
 * In browser contexts, returns window.location.origin (e.g. http://192.168.x.x:3000)
 * so Next.js proxies API requests internally.
 */
export function getServerUrl(): string {
  if (typeof window !== 'undefined') {
    return window.location.origin;
  }
  return process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:3001';
}

/**
 * Resolves the WebSocket URL directly to the backend.
 * Supports NEXT_PUBLIC_SOCKET_URL / NEXT_PUBLIC_SERVER_URL overrides,
 * auto-detects HTTPS/HTTP, and supports production reverse proxies.
 */
export function getSocketUrl(): string {
  if (process.env.NEXT_PUBLIC_SOCKET_URL) {
    return process.env.NEXT_PUBLIC_SOCKET_URL;
  }
  if (process.env.NEXT_PUBLIC_SERVER_URL) {
    return process.env.NEXT_PUBLIC_SERVER_URL;
  }
  if (typeof window !== 'undefined') {
    const isHttps = window.location.protocol === 'https:';
    const proto = isHttps ? 'https' : 'http';
    const hostname = window.location.hostname;
    const port = window.location.port;

    // In local development (e.g. localhost:3000 or 192.168.x.x:3000), backend is on 3001
    if (port === '3000' || hostname === 'localhost' || hostname === '127.0.0.1') {
      return `${proto}://${hostname}:3001`;
    }
    // In production behind reverse proxy (e.g. https://snapsync.com), use same origin
    return window.location.origin;
  }
  return 'http://localhost:3001';
}

const SERVER_PORT_MARKER = ':3001/';

/**
 * Resolves an image/media URL so that it uses relative paths (/uploads/..., /renders/...)
 * working seamlessly across HTTP, HTTPS, localhost, and LAN mobile IPs.
 */
export function resolveMediaUrl(url?: string): string {
  if (!url) return '';
  if (url.includes(SERVER_PORT_MARKER)) {
    const idx = url.indexOf(SERVER_PORT_MARKER);
    // Preserves the leading slash of the path (e.g. "/uploads/...")
    return url.substring(idx + SERVER_PORT_MARKER.length - 1);
  }
  return url;
}
