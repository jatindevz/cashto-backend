import { Response } from 'express';
import { z } from 'zod';
import { prisma } from '../db.js';
import { AuthRequest } from '../middleware/auth.js';

const syncTransactionSchema = z.object({
  id: z.string(),
  amount: z.number(),
  merchant: z.string(),
  category: z.string(),
  type: z.enum(['debit', 'credit']),
  timestamp: z.number(),
  isManual: z.boolean().default(false),
  isImportant: z.boolean().default(false),
  note: z.string().optional().nullable(),
  source: z.string().default('manual'),
  deleted: z.boolean().optional(),
  updatedAt: z.number(),
});

const pushSyncSchema = z.object({
  transactions: z.array(syncTransactionSchema),
});

export async function pushSync(req: AuthRequest, res: Response): Promise<void> {
  const userId = req.userId!;
  const parse = pushSyncSchema.safeParse(req.body);

  if (!parse.success) {
    res.status(400).json({ error: 'Invalid sync payload', details: parse.error });
    return;
  }

  const { transactions } = parse.data;
  const processedIds: string[] = [];

  for (const item of transactions) {
    const existing = await prisma.transaction.findUnique({
      where: { id: item.id },
    });

    if (existing && existing.userId !== userId) {
      // Collision or unauthorized id
      continue;
    }

    if (item.deleted) {
      if (existing) {
        await prisma.transaction.update({
          where: { id: item.id },
          data: {
            deletedAt: new Date(item.updatedAt || Date.now()),
          },
        });
      }
    } else {
      await prisma.transaction.upsert({
        where: { id: item.id },
        update: {
          amount: item.amount,
          merchant: item.merchant,
          category: item.category,
          type: item.type,
          timestamp: BigInt(item.timestamp),
          isManual: item.isManual,
          isImportant: item.isImportant,
          note: item.note ?? null,
          source: item.source,
          deletedAt: null,
        },
        create: {
          id: item.id,
          userId,
          amount: item.amount,
          merchant: item.merchant,
          category: item.category,
          type: item.type,
          timestamp: BigInt(item.timestamp),
          isManual: item.isManual,
          isImportant: item.isImportant,
          note: item.note ?? null,
          source: item.source,
        },
      });
    }

    processedIds.push(item.id);
  }

  res.json({
    success: true,
    processedCount: processedIds.length,
    syncTimestamp: Date.now(),
  });
}

export async function pullSync(req: AuthRequest, res: Response): Promise<void> {
  const userId = req.userId!;
  const since = Number(req.query.since) || 0;

  const sinceDate = new Date(since);

  const transactions = await prisma.transaction.findMany({
    where: {
      userId,
      updatedAt: { gt: sinceDate },
    },
  });

  const formatted = transactions.map((t) => ({
    id: t.id,
    amount: t.amount,
    merchant: t.merchant,
    category: t.category,
    type: t.type,
    timestamp: Number(t.timestamp),
    isManual: t.isManual,
    isImportant: t.isImportant,
    note: t.note,
    source: t.source,
    deleted: t.deletedAt !== null,
    updatedAt: t.updatedAt.getTime(),
  }));

  res.json({
    transactions: formatted,
    syncTimestamp: Date.now(),
  });
}
