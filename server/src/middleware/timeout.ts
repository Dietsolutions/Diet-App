import { Request, Response, NextFunction } from 'express';

export function requestTimeout(ms: number) {
  return (req: Request, res: Response, next: NextFunction) => {
    const timer = setTimeout(() => {
      if (!res.headersSent) {
        res.status(503).json({ error: 'Request timed out' });
      }
    }, ms);
    res.on('finish', () => clearTimeout(timer));
    next();
  };
}
