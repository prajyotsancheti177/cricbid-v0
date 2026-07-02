// Seed one venue + a couple of courts for cricbook testing.
// Run from backend/: node scripts/seedBooking.js
const prisma = require("../db/prisma");

(async () => {
  const owner = await prisma.user.findFirst();
  if (!owner) { console.error("No user found to own the venue"); process.exit(1); }

  const venue = await prisma.venue.create({
    data: {
      name: "Green Turf Arena",
      description: "Premium floodlit turf in the heart of Baner. Book by the hour.",
      city: "Pune",
      area: "Baner",
      address: "Baner Road, near Balewadi",
      amenities: ["Parking", "Washroom", "Floodlights", "Drinking Water", "Seating"],
      photos: [],
      phone: "9999999999",
      ownerId: owner.id,
    },
  });

  await prisma.court.createMany({
    data: [
      { venueId: venue.id, name: "Turf A", sport: "cricket",  pricePerSlot: 800, slotMinutes: 60, openMinute: 360, closeMinute: 1380 },
      { venueId: venue.id, name: "Turf B", sport: "football", pricePerSlot: 700, slotMinutes: 60, openMinute: 360, closeMinute: 1380 },
    ],
  });

  console.log("Seeded venue", venue.id, "with 2 courts (owner:", owner.email || owner.id, ")");
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
