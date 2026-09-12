import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

export interface AuthRequest extends Request {
  userId?: string;
  phone?: string;
}

const ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || 'cashto-access-secret-default';

export function authenticateJwt(req: AuthRequest, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Unauthorized: Missing or invalid token format' });
    return;
  }

  const token = authHeader.split(' ')[1];
  try {
    const payload = jwt.verify(token, ACCESS_SECRET) as { userId: string; phone: string };
    req.userId = payload.userId;
    req.phone = payload.phone;
    next();
  } catch (err) {
    res.status(401).json({ error: 'Unauthorized: Invalid or expired access token' });
  }
}
