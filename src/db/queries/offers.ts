import type { PrismaClient, Offer } from '../../generated/prisma/client.js';
import type { Result } from '../../lib/result.js';
import { ok, err } from '../../lib/result.js';
import { logger } from '../../lib/logger.js';

export interface CreateOfferInput {
  listingId: string;
  buyerId: string;
  offeredPrice: number;
  message?: string;
  buyerContact: string;
}

export async function createOffer(
  prisma: PrismaClient,
  input: CreateOfferInput,
): Promise<Result<Offer, string>> {
  const listing = await prisma.listing.findUnique({ where: { id: input.listingId } });
  if (!listing) return err('NOT_FOUND');
  if (listing.status !== 'active') return err('LISTING_NOT_ACTIVE');
  if (listing.sellerId === input.buyerId) return err('SELF_OFFER');

  const offer = await prisma.offer.create({
    data: {
      listingId: input.listingId,
      buyerId: input.buyerId,
      offeredPrice: input.offeredPrice,
      message: input.message,
      buyerContact: input.buyerContact,
    },
  });

  await prisma.offerEvent.create({
    data: {
      offerId: offer.id,
      eventType: 'created',
      newStatus: 'pending',
      actorId: input.buyerId,
    },
  });

  logger.info('Notification: offer created', {
    sellerId: listing.sellerId,
    offerId: offer.id,
    listingId: listing.id,
  });

  return ok(offer);
}

export async function findOfferWithListing(
  prisma: PrismaClient,
  offerId: string,
): Promise<Result<Offer & { listing: { id: string; sellerId: string; status: string } }, string>> {
  const offer = await prisma.offer.findUnique({
    where: { id: offerId },
    include: { listing: { select: { id: true, sellerId: true, status: true } } },
  });
  if (!offer) return err('NOT_FOUND');
  return ok(offer);
}

export async function acceptOffer(
  prisma: PrismaClient,
  offerId: string,
  actorId: string,
): Promise<Result<Offer, string>> {
  const result = await prisma.$transaction(async (tx) => {
    const updated = await tx.offer.updateMany({
      where: { id: offerId, status: 'pending' },
      data: { status: 'accepted' },
    });
    if (updated.count === 0) return null;

    const offer = await tx.offer.findUnique({ where: { id: offerId } });
    if (!offer) return null;

    await tx.listing.updateMany({
      where: { id: offer.listingId, status: 'active' },
      data: { status: 'reserved' },
    });

    await tx.offerEvent.create({
      data: {
        offerId,
        eventType: 'accepted',
        oldStatus: 'pending',
        newStatus: 'accepted',
        actorId,
      },
    });

    await tx.listingEvent.create({
      data: {
        listingId: offer.listingId,
        eventType: 'reserved',
        oldStatus: 'active',
        newStatus: 'reserved',
        actorId,
      },
    });

    logger.info('Notification: offer accepted', {
      buyerId: offer.buyerId,
      offerId: offer.id,
    });

    return offer;
  });

  if (!result) return err('CONFLICT');
  return ok(result);
}

export async function declineOffer(
  prisma: PrismaClient,
  offerId: string,
  actorId: string,
): Promise<Result<Offer, string>> {
  const updated = await prisma.offer.updateMany({
    where: { id: offerId, status: 'pending' },
    data: { status: 'declined' },
  });
  if (updated.count === 0) return err('CONFLICT');

  const offer = await prisma.offer.findUnique({ where: { id: offerId } });
  if (!offer) return err('NOT_FOUND');

  await prisma.offerEvent.create({
    data: { offerId, eventType: 'declined', oldStatus: 'pending', newStatus: 'declined', actorId },
  });

  logger.info('Notification: offer declined', {
    buyerId: offer.buyerId,
    offerId: offer.id,
  });

  return ok(offer);
}
