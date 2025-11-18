import { NextRequest, NextResponse } from "next/server";
import {
  getSupportRequests,
  resolveSupportRequest,
  getSupportRequestStats,
  getSupportRequestById,
} from "@/server/support-requests";
import { z } from "zod";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const id = searchParams.get("id");
  const status = searchParams.get("status");
  const confirmationCode = searchParams.get("confirmationCode");
  const stats = searchParams.get("stats") === "true";

  if (stats) {
    const statistics = await getSupportRequestStats();
    return NextResponse.json({ stats: statistics });
  }

  if (id) {
    const request = await getSupportRequestById(id);
    if (!request) {
      return NextResponse.json({ error: "Request not found" }, { status: 404 });
    }
    return NextResponse.json({ request });
  }

  const filters: {
    status?: ("pending" | "resolved" | "closed")[];
    confirmationCode?: string;
  } = {};

  if (status) {
    filters.status = status.split(",") as ("pending" | "resolved" | "closed")[];
  }

  if (confirmationCode) {
    filters.confirmationCode = confirmationCode;
  }

  const requests = await getSupportRequests(filters);
  return NextResponse.json({ requests });
}

const resolveSchema = z.object({
  requestId: z.string(),
  outcome: z.object({
    title: z.string(),
    summary: z.string(),
    actions: z.array(z.string()),
    impact: z.string(),
    escalationLevel: z.enum(["self_service", "agent", "manager"]),
    resolvedBy: z.string().optional(),
    notes: z.string().optional(),
  }),
});

export async function POST(request: NextRequest) {
  try {
    const payload = await request.json();
    const { requestId, outcome } = resolveSchema.parse(payload);

    const resolved = await resolveSupportRequest(requestId, outcome);
    return NextResponse.json({ request: resolved });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid request payload", details: error.errors },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to resolve request" },
      { status: 500 }
    );
  }
}

