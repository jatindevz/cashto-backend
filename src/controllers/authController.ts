import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { prisma } from '../db.js';

const ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || 'cashto-access-secret-default';
const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'cashto-refresh-secret-default';

const requestOtpSchema = z.object({
  phone: z.string().min(10).max(15),
});

const verifyOtpSchema = z.object({
  phone: z.string().min(10).max(15),
  code: z.string().length(6),
  name: z.string().optional(),
});

export async function requestOtp(req: Request, res: Response): Promise<void> {
  const parse = requestOtpSchema.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ error: 'Invalid phone number format' });
    return;
  }

  const { phone } = parse.data;
  // Generate 6 digit OTP (Mock for dev: use '123456' or random in production)
  const code = process.env.NODE_ENV === 'production' 
    ? Math.floor(100000 + Math.random() * 900000).toString() 
    : '123456';

  const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 mins

  // Store OTP
  await prisma.otpCode.create({
    data: {
      phone,
      code,
      expiresAt,
    },
  });

  console.log(`[AUTH] Generated OTP for ${phone}: ${code}`);

  res.json({
    message: 'OTP sent successfully',
    devOtp: process.env.NODE_ENV === 'production' ? undefined : code,
  });
}

export async function verifyOtp(req: Request, res: Response): Promise<void> {
  const parse = verifyOtpSchema.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ error: 'Invalid request parameters' });
    return;
  }

  const { phone, code, name } = parse.data;

  const validOtp = await prisma.otpCode.findFirst({
    where: {
      phone,
      code,
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: 'desc' },
  });

  if (!validOtp) {
    res.status(400).json({ error: 'Invalid or expired OTP code' });
    return;
  }

  // Delete used OTP
  await prisma.otpCode.deleteMany({ where: { phone } });

  // Find or create user
  let user = await prisma.user.findUnique({ where: { phone } });
  if (!user) {
    user = await prisma.user.create({
      data: {
        phone,
        name: name || 'CashTo User',
      },
    });
  }

  // Generate tokens
  const accessToken = jwt.sign(
    { userId: user.id, phone: user.phone },
    ACCESS_SECRET,
    { expiresIn: '15m' }
  );

  const refreshToken = jwt.sign(
    { userId: user.id },
    REFRESH_SECRET,
    { expiresIn: '30d' }
  );

  await prisma.refreshToken.create({
    data: {
      userId: user.id,
      token: refreshToken,
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    },
  });

  res.json({
    user: {
      id: user.id,
      phone: user.phone,
      name: user.name,
    },
    accessToken,
    refreshToken,
  });
}

export async function refreshToken(req: Request, res: Response): Promise<void> {
  const { refreshToken } = req.body;
  if (!refreshToken) {
    res.status(400).json({ error: 'Missing refresh token' });
    return;
  }

  try {
    const payload = jwt.verify(refreshToken, REFRESH_SECRET) as { userId: string };
    const stored = await prisma.refreshToken.findUnique({
      where: { token: refreshToken },
      include: { user: true },
    });

    if (!stored || stored.expiresAt < new Date()) {
      res.status(401).json({ error: 'Expired or invalid session' });
      return;
    }

    const newAccessToken = jwt.sign(
      { userId: stored.user.id, phone: stored.user.phone },
      ACCESS_SECRET,
      { expiresIn: '15m' }
    );

    res.json({ accessToken: newAccessToken });
  } catch (err) {
    res.status(401).json({ error: 'Invalid refresh token' });
  }
}

export async function logout(req: Request, res: Response): Promise<void> {
  const { refreshToken } = req.body;
  if (refreshToken) {
    await prisma.refreshToken.deleteMany({ where: { token: refreshToken } });
  }
  res.json({ message: 'Logged out successfully' });
}
