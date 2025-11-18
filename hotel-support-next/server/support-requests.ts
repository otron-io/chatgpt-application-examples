import { promises as fs } from "fs";
import path from "path";
import { randomUUID } from "crypto";
import type { BookingSummary } from "./support";

export type SupportRequestStatus = "pending" | "resolved" | "closed";

export type SupportRequestRecord = {
  id: string;
  requestText: string;
  bookingId?: string;
  confirmationCode?: string;
  contactEmail?: string;
  booking?: BookingSummary | null;
  status: SupportRequestStatus;
  resolutionOptions?: Array<{
    title: string;
    summary: string;
    actions: string[];
    impact: string;
    escalationLevel: "self_service" | "agent" | "manager";
  }>;
  outcome?: {
    title: string;
    summary: string;
    actions: string[];
    impact: string;
    escalationLevel: "self_service" | "agent" | "manager";
    resolvedBy?: string;
    resolvedAt: string;
    notes?: string;
  } | null;
  createdAt: string;
  updatedAt: string;
};

const DATA_PATH = path.join(process.cwd(), "data", "support-requests.json");

async function ensureStore() {
  try {
    await fs.access(DATA_PATH);
  } catch {
    await fs.mkdir(path.dirname(DATA_PATH), { recursive: true });
    await fs.writeFile(DATA_PATH, JSON.stringify([], null, 2), "utf-8");
  }
}

async function readSupportRequests(): Promise<SupportRequestRecord[]> {
  await ensureStore();
  const raw = await fs.readFile(DATA_PATH, "utf-8");
  return JSON.parse(raw) as SupportRequestRecord[];
}

async function writeSupportRequests(requests: SupportRequestRecord[]) {
  await ensureStore();
  await fs.writeFile(DATA_PATH, JSON.stringify(requests, null, 2), "utf-8");
}

export async function createSupportRequest(
  payload: {
    requestText: string;
    bookingId?: string;
    confirmationCode?: string;
    contactEmail?: string;
    booking?: BookingSummary | null;
    resolutionOptions?: SupportRequestRecord["resolutionOptions"];
  }
): Promise<SupportRequestRecord> {
  const requests = await readSupportRequests();
  const now = new Date().toISOString();
  const record: SupportRequestRecord = {
    id: randomUUID(),
    requestText: payload.requestText.trim(),
    bookingId: payload.bookingId,
    confirmationCode: payload.confirmationCode,
    contactEmail: payload.contactEmail,
    booking: payload.booking,
    resolutionOptions: payload.resolutionOptions,
    status: "pending",
    createdAt: now,
    updatedAt: now,
  };
  requests.push(record);
  await writeSupportRequests(requests);
  return record;
}

export async function getSupportRequests(
  filters?: {
    status?: SupportRequestStatus | SupportRequestStatus[];
    confirmationCode?: string;
  }
): Promise<SupportRequestRecord[]> {
  const requests = await readSupportRequests();
  if (!filters) {
    return requests;
  }

  return requests.filter((req) => {
    if (filters.status) {
      const statuses = Array.isArray(filters.status)
        ? filters.status
        : [filters.status];
      if (!statuses.includes(req.status)) {
        return false;
      }
    }

    if (filters.confirmationCode) {
      if (
        req.confirmationCode?.toLowerCase() !==
        filters.confirmationCode.toLowerCase()
      ) {
        return false;
      }
    }

    return true;
  });
}

export async function getSupportRequestById(
  id: string
): Promise<SupportRequestRecord | null> {
  const requests = await readSupportRequests();
  return requests.find((req) => req.id === id) ?? null;
}

export async function resolveSupportRequest(
  id: string,
  outcome: {
    title: string;
    summary: string;
    actions: string[];
    impact: string;
    escalationLevel: "self_service" | "agent" | "manager";
    resolvedBy?: string;
    notes?: string;
  }
): Promise<SupportRequestRecord> {
  const requests = await readSupportRequests();
  const index = requests.findIndex((req) => req.id === id);
  if (index === -1) {
    throw new Error("Support request not found");
  }

  const updated: SupportRequestRecord = {
    ...requests[index],
    status: "resolved",
    outcome: {
      ...outcome,
      resolvedAt: new Date().toISOString(),
    },
    updatedAt: new Date().toISOString(),
  };

  requests[index] = updated;
  await writeSupportRequests(requests);
  return updated;
}

export async function getSupportRequestStats(): Promise<{
  total: number;
  pending: number;
  resolved: number;
  closed: number;
}> {
  const requests = await readSupportRequests();
  return requests.reduce(
    (acc, req) => {
      acc.total += 1;
      acc[req.status] += 1;
      return acc;
    },
    {
      total: 0,
      pending: 0,
      resolved: 0,
      closed: 0,
    }
  );
}

