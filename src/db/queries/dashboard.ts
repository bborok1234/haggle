import type { PrismaClient } from '../../generated/prisma/client.js';

export type DashboardSection = 'all' | 'listings' | 'offers_received' | 'offers_sent' | 'watches';

export interface DashboardResult {
  my_listings?: Array<Record<string, unknown>>;
  offers_received?: Array<Record<string, unknown>>;
  offers_sent?: Array<Record<string, unknown>>;
  my_watches?: Array<Record<string, unknown>>;
}

export async function getDashboard(
  prisma: PrismaClient,
  userId: string,
  section: DashboardSection = 'all',
  limit = 10,
): Promise<DashboardResult> {
  const include = section === 'all';
  const result: DashboardResult = {};

  const queries: Array<Promise<void>> = [];

  if (include || section === 'listings') {
    queries.push(
      prisma.listing
        .findMany({ where: { sellerId: userId }, take: limit, orderBy: { createdAt: 'desc' } })
        .then((rows) => {
          result.my_listings = rows as unknown as Array<Record<string, unknown>>;
        }),
    );
  }

  if (include || section === 'offers_received') {
    queries.push(
      prisma.offer
        .findMany({
          where: { listing: { sellerId: userId } },
          include: { listing: { select: { id: true, title: true } } },
          take: limit,
          orderBy: { createdAt: 'desc' },
        })
        .then((rows) => {
          result.offers_received = rows as unknown as Array<Record<string, unknown>>;
        }),
    );
  }

  if (include || section === 'offers_sent') {
    queries.push(
      prisma.offer
        .findMany({
          where: { buyerId: userId },
          include: { listing: { select: { id: true, title: true } } },
          take: limit,
          orderBy: { createdAt: 'desc' },
        })
        .then((rows) => {
          result.offers_sent = rows as unknown as Array<Record<string, unknown>>;
        }),
    );
  }

  if (include || section === 'watches') {
    queries.push(
      prisma.watch
        .findMany({
          where: { userId, isActive: true },
          take: limit,
          orderBy: { createdAt: 'desc' },
        })
        .then((rows) => {
          result.my_watches = rows as unknown as Array<Record<string, unknown>>;
        }),
    );
  }

  await Promise.all(queries);
  return result;
}
