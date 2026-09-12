import { Response } from 'express';
import { Expo } from 'expo-server-sdk';
import { z } from 'zod';
import { prisma } from '../db.js';
import { AuthRequest } from '../middleware/auth.js';

const expo = new Expo();

const registerTokenSchema = z.object({
  token: z.string().min(10),
  platform: z.enum(['android', 'ios']).default('android'),
});

const sendTestPushSchema = z.object({
  title: z.string(),
  body: z.string(),
});

export async function registerPushToken(req: AuthRequest, res: Response): Promise<void> {
  const userId = req.userId!;
  const parse = registerTokenSchema.safeParse(req.body);

  if (!parse.success) {
    res.status(400).json({ error: 'Invalid push token payload' });
    return;
  }

  const { token, platform } = parse.data;

  if (!Expo.isExpoPushToken(token)) {
    // Note: In dev client or custom push, still record or warn
    console.warn(`[PUSH] Token is not a standard Expo push token: ${token}`);
  }

  await prisma.pushToken.upsert({
    where: { token },
    update: {
      userId,
      platform,
    },
    create: {
      userId,
      token,
      platform,
    },
  });

  res.json({ success: true, message: 'Push token registered successfully' });
}

export async function sendPushToUser(
  userId: string,
  title: string,
  body: string,
  data?: Record<string, any>
): Promise<void> {
  const tokens = await prisma.pushToken.findMany({
    where: { userId },
  });

  const messages = tokens
    .filter((t) => Expo.isExpoPushToken(t.token))
    .map((t) => ({
      to: t.token,
      sound: 'default' as const,
      title,
      body,
      data,
    }));

  if (messages.length === 0) return;

  const chunks = expo.chunkPushNotifications(messages);
  for (const chunk of chunks) {
    try {
      await expo.sendPushNotificationsAsync(chunk);
    } catch (error) {
      console.error('[PUSH] Error sending chunk notification:', error);
    }
  }
}

export async function testPush(req: AuthRequest, res: Response): Promise<void> {
  const userId = req.userId!;
  const parse = sendTestPushSchema.safeParse(req.body);

  if (!parse.success) {
    res.status(400).json({ error: 'Invalid payload' });
    return;
  }

  await sendPushToUser(userId, parse.data.title, parse.data.body);
  res.json({ success: true, message: 'Test notification triggered' });
}
