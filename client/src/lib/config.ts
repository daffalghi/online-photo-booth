/**
 * Resolves the server base URL for HTTP fetch requests.
 * In browser contexts, returns window.location.origin (e.g. http://192.168.x.x:3000)
 * so Next.js proxies API requests internally.
 */
export function getServerUrl(): string {
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname;
    const isLocal = hostname === 'localhost' || hostname === '127.0.0.1' || 
                    hostname.startsWith('192.168.') || hostname.startsWith('10.') || 
                    hostname.startsWith('172.') || hostname.endsWith('.local');

    if (!isLocal && process.env.NEXT_PUBLIC_SERVER_URL) {
      return process.env.NEXT_PUBLIC_SERVER_URL;
    }
    return window.location.origin;
  }
  return process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:3001';
}

/**
 * Resolves the WebSocket URL directly to the backend.
 * Supports explicit overrides, localhost direct ports, mobile LAN same-origin proxy,
 * and production cloud domains.
 */
export function getSocketUrl(): string {
  if (process.env.NEXT_PUBLIC_SOCKET_URL) {
    return process.env.NEXT_PUBLIC_SOCKET_URL;
  }
  if (typeof window !== 'undefined') {
    const isHttps = window.location.protocol === 'https:';
    const proto = isHttps ? 'https' : 'http';
    const hostname = window.location.hostname;

    // On local machine (localhost / 127.0.0.1), connect directly to backend on 3001:
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      return `${proto}://${hostname}:3001`;
    }

    // On mobile devices (LAN IP 192.168.x.x):
    // ALWAYS use window.location.origin (same port 3000) so mobile browsers
    // seamlessly reuse the accepted HTTPS certificate without cross-port SSL blocks!
    const isLan = hostname.startsWith('192.168.') || hostname.startsWith('10.') || 
                  hostname.startsWith('172.') || hostname.endsWith('.local');
    if (isLan) {
      return window.location.origin;
    }

    // In production cloud (e.g. Vercel frontend -> Render backend):
    if (process.env.NEXT_PUBLIC_SERVER_URL) {
      return process.env.NEXT_PUBLIC_SERVER_URL;
    }
    return window.location.origin;
  }
  if (process.env.NEXT_PUBLIC_SERVER_URL) {
    return process.env.NEXT_PUBLIC_SERVER_URL;
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
  if (url.startsWith('data:') || url.startsWith('blob:')) return url;

  for (const prefix of ['/uploads/', '/renders/', '/frames/']) {
    const idx = url.indexOf(prefix);
    if (idx !== -1) {
      return url.substring(idx);
    }
  }

  if (url.includes(SERVER_PORT_MARKER)) {
    const idx = url.indexOf(SERVER_PORT_MARKER);
    // Preserves the leading slash of the path (e.g. "/uploads/...")
    return url.substring(idx + SERVER_PORT_MARKER.length - 1);
  }
  return url;
}
