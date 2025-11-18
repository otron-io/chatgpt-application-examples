import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  createBooking,
  deleteBooking,
  getBookings,
  updateBooking,
  type BookingStatus,
} from "@/server/bookings";

const createSchema = z.object({
  guestName: z.string().min(1),
  email: z.string().email(),
  phone: z.string().min(5),
  roomType: z.string().min(1),
  checkIn: z.string().min(8),
  checkOut: z.string().min(8),
  specialRequests: z.string().optional(),
  status: z
    .enum(["pending", "confirmed", "checked_in", "checked_out", "cancelled"])
    .optional(),
});

const updateSchema = z.object({
  id: z.string().min(1),
  updates: z
    .object({
      guestName: z.string().optional(),
      email: z.string().email().optional(),
      phone: z.string().optional(),
      roomType: z.string().optional(),
      checkIn: z.string().optional(),
      checkOut: z.string().optional(),
      specialRequests: z.string().optional(),
      status: z
        .enum(["pending", "confirmed", "checked_in", "checked_out", "cancelled"])
        .optional(),
    })
    .refine((obj) => Object.keys(obj).length > 0, {
      message: "Provide at least one field to update.",
    }),
});

const deleteSchema = z.object({
  id: z.string().min(1),
});

function parseStatusParam(value: string | null): BookingStatus | undefined {
  if (!value) return undefined;
  const status = value.toLowerCase() as BookingStatus;
  if (
    ["pending", "confirmed", "checked_in", "checked_out", "cancelled"].includes(
      status
    )
  ) {
    return status;
  }
  return undefined;
}

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const status = parseStatusParam(params.get("status"));
  const guestName = params.get("guestName") ?? undefined;
  const confirmationCode = params.get("confirmationCode") ?? undefined;
  const upcomingOnly = params.get("upcomingOnly") === "true";

  const bookings = await getBookings({
    status,
    guestName,
    confirmationCode,
    upcomingOnly,
  });

  return NextResponse.json({ bookings });
}

export async function POST(request: NextRequest) {
  const body = createSchema.parse(await request.json());
  const booking = await createBooking(body);
  return NextResponse.json({ booking }, { status: 201 });
}

export async function PUT(request: NextRequest) {
  const { id, updates } = updateSchema.parse(await request.json());
  try {
    const booking = await updateBooking(id, updates);
    return NextResponse.json({ booking });
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 404 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  const { id } = deleteSchema.parse(await request.json());
  await deleteBooking(id);
  return NextResponse.json({ success: true });
}

