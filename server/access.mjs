// This module is server-only. Never bundle it into browser JavaScript.
import {createRemoteJWKSet, jwtVerify} from 'jose';

const keySets = new Map();
export class AccessError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}
export function settings(env) {
  const issuer = env.ACCESS_TEAM_DOMAIN;
  const audience = env.ACCESS_AUD;
  const host = env.ADMIN_HOSTNAME;
  let emails;
  try { emails = JSON.parse(env.ADMIN_EMAILS); } catch { /* Fail closed below. */ }
  if (!/^https:\/\/[a-z0-9-]+\.cloudflareaccess\.com$/.test(issuer || '') ||
      !/^[a-zA-Z0-9_-]{32,128}$/.test(audience || '') ||
      !/^(?=.{1,253}$)[a-z0-9]+(?:[a-z0-9.-]*[a-z0-9])?$/.test(host || '') ||
      !host.includes('.') || host.includes('..') ||
      !Array.isArray(emails) || emails.length !== 2 ||
      emails.some(e => typeof e !== 'string' || !/^[^\s@*<>]+@[^\s@*<>]+\.[^\s@*<>]+$/.test(e)) ||
      new Set(emails.map(e => e.toLowerCase())).size !== 2) {
    throw new AccessError(503, 'Administrative access is not configured.');
  }
  return {issuer, audience, host, emails: emails.map(e => e.toLowerCase())};
}
export async function authorize(request, env) {
  const config = settings(env);
  const url = new URL(request.url);
  // One exact administrative hostname. Alternate pages.dev/preview/custom hosts
  // cannot use a valid token to reach the admin application.
  if (url.protocol !== 'https:' || url.hostname !== config.host || url.port) {
    throw new AccessError(403, 'Administrative access is not available on this hostname.');
  }
  const token = request.headers.get('Cf-Access-Jwt-Assertion');
  if (!token || token.length > 16384) throw new AccessError(401, 'Cloudflare Access sign-in required.');
  if (!keySets.has(config.issuer)) {
    keySets.set(config.issuer, createRemoteJWKSet(new URL(config.issuer + '/cdn-cgi/access/certs'), {
      timeoutDuration: 5000, cooldownDuration: 30000, cacheMaxAge: 600000,
    }));
  }
  let payload;
  try {
    ({payload} = await jwtVerify(token, keySets.get(config.issuer), {
      issuer: config.issuer, audience: config.audience, algorithms: ['RS256'],
      requiredClaims: ['exp', 'iat', 'sub', 'email'], clockTolerance: 0,
    }));
  } catch {
    // Invalid signatures, expired/wrong-audience tokens and JWKS failures all deny.
    throw new AccessError(401, 'Cloudflare Access sign-in required.');
  }
  if (typeof payload.sub !== 'string' || !payload.sub ||
      typeof payload.iat !== 'number' || payload.iat > Date.now()/1000 ||
      typeof payload.email !== 'string' || !config.emails.includes(payload.email.toLowerCase())) {
    throw new AccessError(403, 'This account is not authorized.');
  }
  // Never trust Cf-Access-Authenticated-User-Email or a decoded unsigned JWT.
  return {email: payload.email, subject: payload.sub};
}
