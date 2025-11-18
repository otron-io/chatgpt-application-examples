import { promises as fs } from "fs";
import path from "path";
import { randomUUID } from "crypto";
import seedBookingsData from "@/data/bookings.seed.json";

export type BookingStatus =
  | "pending"
  | "confirmed"
  | "checked_in"
  | "checked_out"
  | "cancelled";

export type Booking = {
  id: string;
  confirmationCode: string;
  guestName: string;
  email: string;
  phone: string;
  roomType: string;
  status: BookingStatus;
  checkIn: string; // ISO date (yyyy-mm-dd)
  checkOut: string; // ISO date
  specialRequests?: string;
  createdAt: string;
  updatedAt: string;
};

export type BookingFilters = {
  status?: BookingStatus | BookingStatus[];
  guestName?: string;
  confirmationCode?: string;
  upcomingOnly?: boolean;
};

export type CreateBookingInput = {
  guestName: string;
  email: string;
  phone: string;
  roomType: string;
  checkIn: string;
  checkOut: string;
  specialRequests?: string;
  status?: BookingStatus;
};

export type UpdateBookingInput = Partial<
  Omit<Booking, "id" | "confirmationCode" | "createdAt">
>;

const DATA_PATH = path.join(process.cwd(), "data", "bookings.json");

async function ensureStore() {
  try {
    await fs.access(DATA_PATH);
  } catch {
    await seedBookings();
  }
}

async function readBookings(): Promise<Booking[]> {
  await ensureStore();
  const raw = await fs.readFile(DATA_PATH, "utf-8");
  return JSON.parse(raw) as Booking[];
}

async function writeBookings(bookings: Booking[]) {
  await fs.writeFile(DATA_PATH, JSON.stringify(bookings, null, 2), "utf-8");
}

function normalizeName(value?: string) {
  return (value ?? "").trim().toLowerCase();
}

function generateConfirmationCode(): string {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  return Array.from({ length: 6 })
    .map(() => alphabet[Math.floor(Math.random() * alphabet.length)])
    .join("");
}

function buildBooking(payload: CreateBookingInput): Booking {
  const now = new Date().toISOString();
  return {
    id: randomUUID(),
    confirmationCode: generateConfirmationCode(),
    guestName: payload.guestName.trim(),
    email: payload.email.trim(),
    phone: payload.phone.trim(),
    roomType: payload.roomType.trim(),
    status: payload.status ?? "pending",
    checkIn: payload.checkIn,
    checkOut: payload.checkOut,
    specialRequests: payload.specialRequests?.trim(),
    createdAt: now,
    updatedAt: now,
  };
}

export async function getBookings(
  filters?: BookingFilters
): Promise<Booking[]> {
  const bookings = await readBookings();
  if (!filters) {
    return bookings;
  }

  return bookings.filter((booking) => {
    if (filters.status) {
      const statuses = Array.isArray(filters.status)
        ? filters.status
        : [filters.status];
      if (!statuses.includes(booking.status)) {
        return false;
      }
    }

    if (filters.confirmationCode) {
      if (
        booking.confirmationCode.toLowerCase() !==
        filters.confirmationCode.toLowerCase()
      ) {
        return false;
      }
    }

    if (filters.guestName) {
      const search = normalizeName(filters.guestName);
      if (!normalizeName(booking.guestName).includes(search)) {
        return false;
      }
    }

    if (filters.upcomingOnly) {
      const today = new Date().toISOString().slice(0, 10);
      if (booking.checkOut < today) {
        return false;
      }
    }

    return true;
  });
}

export async function getBookingById(
  id: string
): Promise<Booking | null> {
  const bookings = await readBookings();
  return bookings.find((booking) => booking.id === id) ?? null;
}

export async function getBookingByConfirmation(
  confirmationCode: string
): Promise<Booking | null> {
  const bookings = await readBookings();
  const normalized = confirmationCode.trim().toLowerCase();
  return (
    bookings.find(
      (booking) => booking.confirmationCode.toLowerCase() === normalized
    ) ?? null
  );
}

export async function createBooking(
  payload: CreateBookingInput
): Promise<Booking> {
  const bookings = await readBookings();
  const booking = buildBooking(payload);
  bookings.push(booking);
  await writeBookings(bookings);
  return booking;
}

export async function updateBooking(
  id: string,
  updates: UpdateBookingInput
): Promise<Booking> {
  const bookings = await readBookings();
  const index = bookings.findIndex((booking) => booking.id === id);
  if (index === -1) {
    throw new Error("Booking not found");
  }

  const updated: Booking = {
    ...bookings[index],
    ...updates,
    updatedAt: new Date().toISOString(),
  };

  bookings[index] = updated;
  await writeBookings(bookings);
  return updated;
}

export async function deleteBooking(id: string): Promise<void> {
  const bookings = await readBookings();
  const filtered = bookings.filter((booking) => booking.id !== id);
  await writeBookings(filtered);
}

export async function seedBookings(): Promise<{ inserted: number }> {
  const now = new Date().toISOString();
  const normalized = (seedBookingsData as Booking[]).map((booking) => ({
    ...booking,
    createdAt: booking.createdAt ?? now,
    updatedAt: booking.updatedAt ?? now,
  }));
  await writeBookings(normalized);
  return { inserted: normalized.length };
}

export type BookingStats = {
  total: number;
  pending: number;
  confirmed: number;
  checked_in: number;
  checked_out: number;
  cancelled: number;
  upcoming: number;
};

export async function getBookingStats(): Promise<BookingStats> {
  const bookings = await readBookings();
  const today = new Date().toISOString().slice(0, 10);

  const summary: BookingStats = bookings.reduce(
    (acc, booking) => {
      acc.total += 1;
      acc[booking.status] += 1;
      if (booking.status === "confirmed" && booking.checkIn >= today) {
        acc.upcoming += 1;
      }
      return acc;
    },
    {
      total: 0,
      pending: 0,
      confirmed: 0,
      checked_in: 0,
      checked_out: 0,
      cancelled: 0,
      upcoming: 0,
    }
  );

  return summary;
}

