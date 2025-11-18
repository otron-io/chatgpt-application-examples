import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { analyzeSupportRequest } from "@/server/support";

const supportSchema = z.object({
  requestText: z.string().min(5, "Please describe the support issue."),
  bookingId: z.string().optional(),
  confirmationCode: z.string().optional(),
  contactEmail: z.string().email().optional(),
});

export async function POST(request: NextRequest) {
  const payload = supportSchema.parse(await request.json());

  const response = await analyzeSupportRequest(payload);
  return NextResponse.json({ result: response });
}

