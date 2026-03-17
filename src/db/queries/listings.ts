import type {
  PrismaClient,
  Listing,
  ListingStatus,
  Prisma,
} from '../../generated/prisma/client.js';
import type { Result } from '../../lib/result.js';
import { ok, err } from '../../lib/result.js';

export interface CreateListingInput {
  idempotencyKey: string;
  sellerId: string;
  title: string;
  description: string;
  price: number;
  isNegotiable?: boolean;
  location?: { lat: number; lng: number; name: string };
  photos?: string[];
  attributes?: Record<string, unknown>;
}

export async function createListing(
  prisma: PrismaClient,
  input: CreateListingInput,
): Promise<Result<Listing, string>> {
  const existing = await prisma.listing.findFirst({
    where: {
      sellerId: input.sellerId,
      title: input.title,
      description: input.description,
      price: input.price,
    },
  });
  if (existing) return ok(existing);

  const listing = await prisma.listing.create({
    data: {
      sellerId: input.sellerId,
      title: input.title,
      description: input.description,
      price: input.price,
      isNegotiable: input.isNegotiable ?? false,
      location: input.location ?? undefined,
      photos: input.photos ?? [],
      attributes: (input.attributes as Prisma.InputJsonValue) ?? undefined,
    },
  });

  await prisma.listingEvent.create({
    data: {
      listingId: listing.id,
      eventType: 'created',
      newStatus: 'active',
      actorId: input.sellerId,
    },
  });

  return ok(listing);
}

export async function findListingById(
  prisma: PrismaClient,
  id: string,
): Promise<Result<Listing & { seller: { id: string; displayName: string } }, string>> {
  const listing = await prisma.listing.findUnique({
    where: { id },
    include: { seller: { select: { id: true, displayName: true } } },
  });

  if (!listing) return err('NOT_FOUND');
  return ok(listing);
}

export async function updateListingStatus(
  prisma: PrismaClient,
  id: string,
  currentStatus: ListingStatus,
  newStatus: ListingStatus,
  actorId: string,
): Promise<Result<Listing, string>> {
  const [updated] = await prisma.$transaction(async (tx) => {
    const result = await tx.listing.updateMany({
      where: { id, status: currentStatus },
      data: { status: newStatus },
    });

    if (result.count === 0) return [null];

    await tx.listingEvent.create({
      data: {
        listingId: id,
        eventType: newStatus,
        oldStatus: currentStatus,
        newStatus,
        actorId,
      },
    });

    const listing = await tx.listing.findUnique({ where: { id } });
    return [listing];
  });

  if (!updated) return err('CONFLICT');
  return ok(updated);
}
