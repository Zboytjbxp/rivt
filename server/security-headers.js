import { createHash, randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import helmet from "helmet";

const organizationStructuredDataHash = "'sha256-6yKDQeNrNUkW3vBOdrnMpM9gZ8zYJzclJKLq7WgcMQw='";
const moduleDirectory = path.dirname(fileURLToPath(import.meta.url));
const inlineStyleFiles = [
  "landing.html",
  "legal/privacy.html",
  "legal/security.html",
  "legal/subcontractor-agreement.html",
  "legal/terms.html",
];

function inlineStyleHashes() {
  const hashes = new Set();
  for (const relativePath of inlineStyleFiles) {
    try {
      const html = readFileSync(path.join(moduleDirectory, "..", "public", relativePath), "utf8");
      for (const match of html.matchAll(/<style(?:\s[^>]*)?>([\s\S]*?)<\/style>/gi)) {
        hashes.add(`'sha256-${createHash("sha256").update(match[1]).digest("base64")}'`);
      }
    } catch {
      // Missing optional static pages remain untrusted and their inline styles stay blocked.
    }
  }
  return [...hashes];
}

function connectOrigins(endpoints) {
  const origins = new Set();
  for (const endpoint of endpoints) {
    if (!endpoint) continue;
    try {
      const parsed = new URL(endpoint);
      const isLocalDevelopment = parsed.protocol === "http:"
        && ["localhost", "127.0.0.1", "::1"].includes(parsed.hostname);
      if (parsed.protocol === "https:" || isLocalDevelopment) {
        origins.add(parsed.origin);
      }
    } catch {
      // Invalid analytics configuration does not widen the browser connection policy.
    }
  }
  return [...origins];
}

export function createSecurityHeadersMiddleware({
  analyticsEndpoints = [
    process.env.VITE_PRODUCT_ANALYTICS_ENDPOINT,
    process.env.PRODUCT_ANALYTICS_ENDPOINT,
  ],
} = {}) {
  const analyticsOrigins = connectOrigins(analyticsEndpoints);
  const middleware = helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        baseUri: ["'self'"],
        connectSrc: ["'self'", "https://api.open-meteo.com", ...analyticsOrigins],
        fontSrc: ["'self'", "data:"],
        frameSrc: ["'none'"],
        formAction: ["'self'"],
        frameAncestors: ["'none'"],
        imgSrc: ["'self'", "data:", "blob:", "https:"],
        manifestSrc: ["'self'"],
        mediaSrc: ["'self'", "blob:", "https:"],
        objectSrc: ["'none'"],
        scriptSrc: [
          "'self'",
          organizationStructuredDataHash,
          (_request, response) => `'nonce-${response.locals.cspNonce}'`,
        ],
        scriptSrcAttr: ["'none'"],
        styleSrc: ["'self'", ...inlineStyleHashes()],
        styleSrcAttr: ["'unsafe-inline'"],
        workerSrc: ["'self'", "blob:"],
      },
    },
    crossOriginEmbedderPolicy: false,
    frameguard: { action: "deny" },
    hsts: {
      maxAge: 31_536_000,
      includeSubDomains: true,
      preload: true,
    },
    referrerPolicy: { policy: "strict-origin-when-cross-origin" },
  });

  return function securityHeaders(request, response, next) {
    response.locals.cspNonce = randomBytes(18).toString("base64");
    response.setHeader(
      "Permissions-Policy",
      "camera=(self), geolocation=(self), microphone=(), payment=(), usb=()",
    );
    middleware(request, response, next);
  };
}
