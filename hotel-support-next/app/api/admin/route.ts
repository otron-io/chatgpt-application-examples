import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  getBookingStats,
  getBookings,
  seedBookings,
} from "@/server/bookings";

const postSchema = z.object({
  action: z.enum(["seed"]),
});

export async function GET(request: NextRequest) {
  const resource = request.nextUrl.searchParams.get("resource") ?? "stats";

  if (resource === "bookings") {
    const bookings = await getBookings();
    return NextResponse.json({ bookings });
  }

  const stats = await getBookingStats();
  return NextResponse.json({ stats });
}

export async function POST(request: NextRequest) {
  const { action } = postSchema.parse(await request.json());
  if (action === "seed") {
    const result = await seedBookings();
    return NextResponse.json(
      { message: "Database reset to demo state.", ...result },
      { status: 201 }
    );
  }

  return NextResponse.json(
    { error: "Unsupported action." },
    { status: 400 }
  );
}

