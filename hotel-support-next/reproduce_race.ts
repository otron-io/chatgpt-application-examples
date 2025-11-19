
import { createBooking, seedBookings, getBookings } from "./server/bookings";

async function run() {
  console.log("Seeding database...");
  await seedBookings();
  
  const initialBookings = await getBookings();
  console.log(`Initial bookings: ${initialBookings.length}`);

  const CONCURRENT_REQUESTS = 10;
  console.log(`Launching ${CONCURRENT_REQUESTS} concurrent booking requests...`);

  const promises = [];
  for (let i = 0; i < CONCURRENT_REQUESTS; i++) {
    promises.push(
      createBooking({
        guestName: `Race User ${i}`,
        email: `race${i}@example.com`,
        phone: "555-0123",
        roomType: "Standard",
        checkIn: "2023-12-01",
        checkOut: "2023-12-05",
        status: "confirmed"
      })
    );
  }

  await Promise.all(promises);

  const finalBookings = await getBookings();
  console.log(`Final bookings: ${finalBookings.length}`);
  
  const expected = initialBookings.length + CONCURRENT_REQUESTS;
  console.log(`Expected: ${expected}`);

  if (finalBookings.length < expected) {
    console.log("❌ RACE CONDITION DETECTED!");
    console.log(`Lost ${expected - finalBookings.length} bookings.`);
  } else {
    console.log("✅ No race condition detected (or lucked out).");
  }
}

run().catch(console.error);
