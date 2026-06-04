import express, { Express, Request, Response, NextFunction } from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import prisma from './lib/prisma';
import authRoutes from './routes/auth';
import planRoutes from './routes/plan';
import trackerRoutes from './routes/tracker';
import shoppingRoutes from './routes/shopping';
import profileRoutes from './routes/profile';
import aiRoutes from './routes/ai';
import weightRoutes from './routes/weight';
import foodRoutes from './routes/food';
import mealsRoutes from './routes/meals';
import waterRoutes from './routes/water';
import pagesRoutes from './routes/pages';

// ---------------------------------------------------------------------------
// Startup env-var check — missing JWT_SECRET is fatal in production.
// ---------------------------------------------------------------------------
const REQUIRED_ENV = ['DATABASE_URL', 'JWT_SECRET'] as const;
const OPTIONAL_ENV = [
  'DIRECT_URL', 'CLIENT_URL', 'FRONTEND_URL',
  'ANTHROPIC_API_KEY', 'OPENROUTER_API_KEY', 'CLAUDE_MODEL',
  'GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'GOOGLE_CALLBACK_URL',
  'USDA_API_KEY', 'AI_FOOD_ESTIMATE_DAILY_LIMIT',
  'NODE_ENV'
] as const;

(function checkEnv() {
  const isProd = process.env.NODE_ENV === 'production';
  const missing = REQUIRED_ENV.filter(k => !process.env[k]);
  if (missing.length > 0) {
    const msg = `[env] MISSING required env vars: ${missing.join(', ')}`;
    console.error(msg);
    if (isProd) {
      // Log loudly but do NOT call process.exit() in a serverless context.
      // process.exit() kills the Lambda worker and makes every request return 500
      // until a new cold start occurs — which will also die if the var is still missing.
      // The auth middleware falls back to a legacy secret with its own warning.
      console.error('[env] Set these vars in Vercel Project → Settings → Environment Variables.');
    }
  }
  const unset = OPTIONAL_ENV.filter(k => !process.env[k]);
  if (unset.length > 0) {
    console.warn(`[env] Unset optional env vars: ${unset.join(', ')}`);
  }
})();

/**
 * Build a CORS allowlist from environment variables. In production we accept:
 *  - the explicit CLIENT_URL / FRONTEND_URL
 *  - any preview deploy for *this* Vercel project (e.g. diet-app-*.vercel.app
 *    for project "diet-app" or ai-dpt-*.vercel.app for "ai-dpt")
 *  - localhost (so the dev frontend can talk to a deployed API if needed)
 *
 * NOT allowed in production:
 *  - capacitor://localhost / http://localhost (universal iOS/Android WebView
 *    origins — would let any installed Capacitor app call this API)
 *  - a regex matching *.vercel.app (would let ANY Vercel user call the API)
 */
function buildCorsOptions(): cors.CorsOptions {
  const isProd = process.env.NODE_ENV === 'production';

  const explicit = new Set<string>([
    'http://localhost:5173',
    'http://127.0.0.1:5173',
  ]);
  if (process.env.CLIENT_URL) explicit.add(process.env.CLIENT_URL);
  if (process.env.FRONTEND_URL) explicit.add(process.env.FRONTEND_URL);

  // Optional Capacitor custom URL (configured in capacitor.config.ts as
  // `server.url`). If set, that exact origin is allowed so the WebView can
  // be pinned to your backend. If unset, capacitor:// and http://localhost
  // are *not* allowed (in production).
  if (process.env.VITE_API_URL) explicit.add(process.env.VITE_API_URL);

  // Per-project preview regex. VERCEL_PROJECT_NAME is automatically set by
  // Vercel on every deploy. Production stays strict.
  const vercelPreviewRegex = process.env.VERCEL_PROJECT_NAME
    ? new RegExp(`^https:\\/\\/${process.env.VERCEL_PROJECT_NAME}-[a-z0-9-]+\\.vercel\\.app$`, 'i')
    : null;

  return {
    credentials: true,
    origin: (origin, callback) => {
      // Same-origin (no Origin header) — always allow.
      if (!origin) return callback(null, true);
      if (explicit.has(origin)) return callback(null, true);
      if (vercelPreviewRegex?.test(origin)) return callback(null, true);
      // In dev, allow common origins freely.
      if (!isProd && /localhost|127\.0\.0\.1|192\.168\./.test(origin)) return callback(null, true);
      return callback(new Error(`Origin ${origin} not allowed by CORS`));
    }
  };
}

export function createApp(): Express {
  const app = express();

  app.set('trust proxy', 1);

  // ── HTTP Security Headers (Helmet) ────────────────────────────────────────
  // Helmet sets safe defaults: X-Frame-Options, X-Content-Type-Options, HSTS,
  // Referrer-Policy, X-DNS-Prefetch-Control, etc.
  // Content-Security-Policy is omitted here because the API only serves JSON
  // and the React SPA is served separately by Vite/Vercel static hosting.
  app.use(helmet({
    contentSecurityPolicy: false, // API-only server, no HTML to protect
    crossOriginResourcePolicy: { policy: 'same-site' },
  }));

  app.use(cors(buildCorsOptions()));
  app.use(express.json({ limit: '2mb' })); // Reduced from 10mb — no endpoint needs >2mb
  app.use(cookieParser());

  // ── HTTP Request Logging (Morgan) ─────────────────────────────────────────
  // 'combined' in prod (structured for log aggregators), 'dev' locally.
  if (process.env.NODE_ENV === 'production') {
    app.use(morgan('combined'));
  } else {
    app.use(morgan('dev'));
  }

  // Health check (used by Vercel + monitoring)
  app.get('/api/health', async (_req: Request, res: Response) => {
    let dbStatus = 'unknown';
    try {
      await prisma.$queryRaw`SELECT 1`;
      dbStatus = 'connected';
    } catch {
      dbStatus = 'error';
    }
    res.json({
      status: 'ok',
      env: process.env.NODE_ENV || 'development',
      time: new Date().toISOString(),
      db: dbStatus,
    });
  });
  // Legacy alias
  app.get('/health', (_req: Request, res: Response) => res.json({ status: 'ok' }));

  app.use('/api/auth', authRoutes);
  app.use('/api/plan', planRoutes);
  app.use('/api/tracker', trackerRoutes);
  app.use('/api/shopping', shoppingRoutes);
  app.use('/api/profile', profileRoutes);
  app.use('/api/ai', aiRoutes);
  app.use('/api/weight', weightRoutes);
  app.use('/api/food', foodRoutes);
  app.use('/api/meals', mealsRoutes);
  app.use('/api/water', waterRoutes);
  app.use(pagesRoutes);

  // 404 for unknown /api routes
  app.use('/api', (_req: Request, res: Response) => {
    res.status(404).json({ error: 'not_found' });
  });

  // Production-safe error middleware: never leak stack traces.
  // This also catches async errors forwarded via next(err).
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const isProd = process.env.NODE_ENV === 'production';
    console.error('[server error]', err instanceof Error ? err.stack || err.message : err);
    if (res.headersSent) return; // avoid double-write
    if (isProd) {
      res.status(500).json({ error: 'server_error' });
    } else {
      res.status(500).json({
        error: 'server_error',
        message: err instanceof Error ? err.message : String(err),
        stack: err instanceof Error ? err.stack : undefined
      });
    }
  });

  return app;
}

// Global unhandled promise rejection handler — prevents the serverless
// function from crashing silently on unexpected async errors.
process.on('unhandledRejection', (reason) => {
  console.error('[unhandledRejection]', reason instanceof Error ? reason.stack || reason.message : reason);
});

const app = createApp();
export default app;
