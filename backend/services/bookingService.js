const prisma = require("../db/prisma");

// ─── Time helpers (v1: anchor slot grid to IST midnight) ─────────────────────
// We store absolute UTC instants in the DB. The slot grid is anchored to
// 00:00 IST of the requested date. IST is UTC+5:30 with no DST.
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

// Midnight IST for a "YYYY-MM-DD" date, as a UTC Date.
const istMidnightUtc = (dateStr) => {
  const [y, m, d] = dateStr.split("-").map(Number);
  // 00:00 IST == 18:30 UTC on the previous day
  return new Date(Date.UTC(y, m - 1, d, 0, 0, 0) - IST_OFFSET_MS);
};

// ─── Public: venue list / search ─────────────────────────────────────────────

const listVenues = async ({ city, sport, q } = {}) => {
  const where = { isActive: true };
  if (city) where.city = city;
  if (q) {
    where.OR = [
      { name: { contains: q, mode: "insensitive" } },
      { area: { contains: q, mode: "insensitive" } },
      { city: { contains: q, mode: "insensitive" } },
    ];
  }

  const venues = await prisma.venue.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: {
      courts: {
        where: { isActive: true, ...(sport ? { sport } : {}) },
        select: { sport: true, pricePerSlot: true },
      },
    },
  });

  // When filtering by sport, drop venues that have no matching active court.
  return venues
    .filter((v) => (sport ? v.courts.length > 0 : true))
    .map((v) => ({
      _id: v.id,
      name: v.name,
      city: v.city,
      area: v.area,
      photos: v.photos,
      amenities: v.amenities,
      sports: [...new Set(v.courts.map((c) => c.sport))],
      minPrice: v.courts.length ? Math.min(...v.courts.map((c) => c.pricePerSlot)) : null,
    }));
};

const getVenue = async ({ venueId }) => {
  const v = await prisma.venue.findUnique({
    where: { id: venueId },
    include: {
      courts: {
        where: { isActive: true },
        orderBy: { createdAt: "asc" },
        select: {
          id: true, name: true, sport: true, pricePerSlot: true,
          slotMinutes: true, openMinute: true, closeMinute: true,
        },
      },
    },
  });
  if (!v) throw new Error("Venue not found");
  return {
    _id: v.id, name: v.name, description: v.description, address: v.address,
    city: v.city, area: v.area, photos: v.photos, amenities: v.amenities,
    phone: v.phone,
    courts: v.courts.map((c) => ({ ...c, _id: c.id })),
  };
};

// ─── Public: availability grid for a court on a date ─────────────────────────

const getAvailability = async ({ courtId, date }) => {
  const court = await prisma.court.findUnique({ where: { id: courtId } });
  if (!court || !court.isActive) throw new Error("Court unavailable");

  const dayStart = istMidnightUtc(date);
  const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);
  const now = new Date();

  // Build the fixed grid.
  const slots = [];
  for (let m = court.openMinute; m + court.slotMinutes <= court.closeMinute; m += court.slotMinutes) {
    const start = new Date(dayStart.getTime() + m * 60000);
    const end = new Date(start.getTime() + court.slotMinutes * 60000);
    slots.push({
      startTime: start.toISOString(),
      endTime: end.toISOString(),
      price: court.pricePerSlot,
      status: start < now ? "past" : "available",
    });
  }

  // Mark booked slots.
  const booked = await prisma.booking.findMany({
    where: {
      courtId,
      status: "confirmed",
      startTime: { gte: dayStart, lt: dayEnd },
    },
    select: { startTime: true },
  });
  const bookedSet = new Set(booked.map((b) => b.startTime.getTime()));
  for (const s of slots) {
    if (bookedSet.has(new Date(s.startTime).getTime()) && s.status !== "past") {
      s.status = "booked";
    }
  }

  return { courtId, date, slotMinutes: court.slotMinutes, slots };
};

// ─── Public: create booking (one row per slot; DB unique = double-book guard) ─

const createBooking = async ({ courtId, slotStarts, customerName, customerPhone, userId }) => {
  const court = await prisma.court.findUnique({ where: { id: courtId } });
  if (!court || !court.isActive) throw new Error("Court unavailable");
  if (!Array.isArray(slotStarts) || slotStarts.length === 0) throw new Error("No slots selected");

  const now = new Date();
  const starts = slotStarts.map((s) => new Date(s));
  for (const start of starts) {
    if (isNaN(start.getTime())) throw new Error("Invalid slot time");
    if (start < now) { const e = new Error("Cannot book a past slot"); e.status = 400; throw e; }
  }

  const rows = starts.map((start) => ({
    courtId,
    userId: userId ?? null,
    customerName: customerName ?? null,
    customerPhone: customerPhone ?? null,
    startTime: start,
    endTime: new Date(start.getTime() + court.slotMinutes * 60000),
    price: court.pricePerSlot,
    status: "confirmed",
  }));

  try {
    const created = await prisma.$transaction(async (tx) => {
      // Friendly pre-check (NOT the guard — the unique constraint is).
      const clash = await tx.booking.findFirst({
        where: { courtId, status: "confirmed", startTime: { in: starts } },
        select: { startTime: true },
      });
      if (clash) { const e = new Error("SLOT_TAKEN"); e.code = "SLOT_TAKEN"; throw e; }

      await tx.booking.createMany({ data: rows });
      return tx.booking.findMany({
        where: { courtId, startTime: { in: starts } },
        orderBy: { startTime: "asc" },
      });
    });
    return { bookings: created, total: created.reduce((sum, b) => sum + b.price, 0) };
  } catch (err) {
    if (err.code === "P2002" || err.code === "SLOT_TAKEN") {
      const e = new Error("One or more of those slots were just booked. Please pick again.");
      e.status = 409;
      throw e;
    }
    throw err;
  }
};

// ─── Public: my bookings + cancel ────────────────────────────────────────────

const myBookings = async ({ userId }) => {
  const bookings = await prisma.booking.findMany({
    where: { userId, status: "confirmed" },
    orderBy: { startTime: "desc" },
    include: {
      court: {
        select: { name: true, sport: true, venue: { select: { name: true, city: true, area: true } } },
      },
    },
  });
  return bookings.map((b) => ({
    _id: b.id,
    court: { name: b.court.name, sport: b.court.sport, venue: b.court.venue },
    startTime: b.startTime,
    endTime: b.endTime,
    price: b.price,
    status: b.status,
  }));
};

const cancelBooking = async ({ bookingId, userId }) => {
  const booking = await prisma.booking.findUnique({ where: { id: bookingId } });
  if (!booking) throw new Error("Booking not found");
  if (booking.userId && booking.userId !== userId) {
    const e = new Error("Not your booking"); e.status = 403; throw e;
  }
  // Hard-delete frees the slot immediately (frees the @@unique row).
  await prisma.booking.delete({ where: { id: bookingId } });
  return { ok: true };
};

// ─── Admin: venue + court management ─────────────────────────────────────────

const assertOwnsVenue = async (venueId, ownerId) => {
  const venue = await prisma.venue.findUnique({ where: { id: venueId }, select: { ownerId: true } });
  if (!venue) throw new Error("Venue not found");
  if (venue.ownerId !== ownerId) { const e = new Error("Not your venue"); e.status = 403; throw e; }
};

const VENUE_FIELDS = ["name", "description", "address", "city", "area", "phone", "photos", "amenities", "latitude", "longitude", "isActive"];
const pick = (obj, fields) => Object.fromEntries(fields.filter((k) => obj[k] !== undefined).map((k) => [k, obj[k]]));

const createVenue = async ({ ownerId, ...fields }) => {
  if (!fields.name) throw new Error("Venue name required");
  return prisma.venue.create({ data: { ownerId, ...pick(fields, VENUE_FIELDS) } });
};

const updateVenue = async ({ ownerId, venueId, ...fields }) => {
  await assertOwnsVenue(venueId, ownerId);
  return prisma.venue.update({ where: { id: venueId }, data: pick(fields, VENUE_FIELDS) });
};

const listOwnerVenues = async ({ ownerId }) => {
  return prisma.venue.findMany({
    where: { ownerId },
    orderBy: { createdAt: "desc" },
    include: { courts: { select: { id: true } } },
  }).then((vs) => vs.map((v) => ({ ...v, _id: v.id, courtCount: v.courts.length })));
};

const COURT_FIELDS = ["name", "sport", "pricePerSlot", "slotMinutes", "openMinute", "closeMinute", "isActive"];

const createCourt = async ({ ownerId, venueId, ...fields }) => {
  await assertOwnsVenue(venueId, ownerId);
  if (!fields.name || fields.pricePerSlot == null) throw new Error("Court name and price required");
  return prisma.court.create({ data: { venueId, ...pick(fields, COURT_FIELDS) } });
};

const updateCourt = async ({ ownerId, courtId, ...fields }) => {
  const court = await prisma.court.findUnique({ where: { id: courtId }, select: { venueId: true } });
  if (!court) throw new Error("Court not found");
  await assertOwnsVenue(court.venueId, ownerId);
  return prisma.court.update({ where: { id: courtId }, data: pick(fields, COURT_FIELDS) });
};

const venueBookings = async ({ ownerId, venueId, date }) => {
  await assertOwnsVenue(venueId, ownerId);
  const where = { court: { venueId }, status: "confirmed" };
  if (date) {
    const dayStart = istMidnightUtc(date);
    where.startTime = { gte: dayStart, lt: new Date(dayStart.getTime() + 24 * 60 * 60 * 1000) };
  }
  const bookings = await prisma.booking.findMany({
    where,
    orderBy: { startTime: "asc" },
    include: { court: { select: { name: true, sport: true } } },
  });
  return bookings.map((b) => ({
    _id: b.id,
    court: b.court.name,
    sport: b.court.sport,
    customerName: b.customerName,
    customerPhone: b.customerPhone,
    startTime: b.startTime,
    endTime: b.endTime,
    price: b.price,
    status: b.status,
  }));
};

module.exports = {
  listVenues, getVenue, getAvailability, createBooking, myBookings, cancelBooking,
  createVenue, updateVenue, listOwnerVenues, createCourt, updateCourt, venueBookings,
};
