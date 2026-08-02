import helmet from "helmet";

export function createSecurityHeadersMiddleware() {
  const helmetMiddleware = helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        baseUri: ["'self'"],
        connectSrc: ["'self'", "https://api.open-meteo.com", "https://*.sentry.io", "wss:"],
        fontSrc: ["'self'", "data:"],
        formAction: ["'self'"],
        frameAncestors: ["'none'"],
        imgSrc: ["'self'", "data:", "blob:", "https:"],
        manifestSrc: ["'self'"],
        mediaSrc: ["'self'", "blob:", "https:"],
        objectSrc: ["'none'"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
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

  return (request, response, next) => {
    response.setHeader(
      "Permissions-Policy",
      "browsing-topics=(), camera=(self), geolocation=(self), microphone=(), payment=(), serial=(), usb=()",
    );
    helmetMiddleware(request, response, next);
  };
}
