import { z } from "zod";
import type { Booking } from "./bookings";
import {
  getBookingByConfirmation,
  getBookingById,
} from "./bookings";

const OPENROUTER_ENDPOINT = "https://openrouter.ai/api/v1/chat/completions";
const OPENROUTER_MODEL =
  process.env.OPENROUTER_MODEL ?? "anthropic/claude-3.5-sonnet";

export type ResolutionOption = {
  title: string;
  summary: string;
  actions: string[];
  impact: string;
  escalationLevel: "self_service" | "agent" | "manager";
  recommendedFor?: string;
};

export type SupportRequest = {
  requestText: string;
  bookingId?: string;
  confirmationCode?: string;
  contactEmail?: string;
};

export type SupportResponse = {
  requestText: string;
  requestId?: string;
  status?: "pending" | "resolved" | "closed";
  booking?: BookingSummary | null;
  needsMoreInfo: boolean;
  infoRequired: Array<{ label: string; reason: string }>;
  resolutionOptions: ResolutionOption[];
  recommendedNextAction: string;
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
};

export type BookingSummary = Pick<
  Booking,
  | "id"
  | "guestName"
  | "confirmationCode"
  | "roomType"
  | "status"
  | "checkIn"
  | "checkOut"
>;

const supportSchema = z.object({
  requestText: z.string().min(1),
  bookingId: z.string().optional(),
  confirmationCode: z.string().optional(),
  contactEmail: z.string().email().optional(),
});

const llmResponseSchema = z.object({
  needsMoreInfo: z.boolean(),
  infoRequired: z
    .array(
      z.object({
        label: z.string(),
        reason: z.string(),
      })
    )
    .default([]),
  resolutionOptions: z
    .array(
      z.object({
        title: z.string(),
        summary: z.string(),
        actions: z.array(z.string()).min(1),
        impact: z.string(),
        escalationLevel: z.enum(["self_service", "agent", "manager"]),
        recommendedFor: z.string().optional(),
      })
    )
    .min(1)
    .max(4),
  recommendedNextAction: z.string(),
});

export async function analyzeSupportRequest(
  payload: SupportRequest
): Promise<SupportResponse> {
  const input = supportSchema.parse(payload);
  const booking = await resolveBooking(input.bookingId, input.confirmationCode);
  const bookingSummary = booking ? summarizeBooking(booking) : null;

  const apiKey = process.env.OPENROUTER_API_KEY;
  let llmResult: z.infer<typeof llmResponseSchema> | null = null;

  if (apiKey) {
    try {
      llmResult = await callOpenRouter(apiKey, input.requestText, bookingSummary);
    } catch (error) {
      console.error("OpenRouter support analysis failed", error);
      llmResult = null;
    }
  }

  const fallback =
    llmResult ??
    buildFallbackResponse(input.requestText, bookingSummary ?? undefined);

  return {
    requestText: input.requestText.trim(),
    booking: bookingSummary,
    needsMoreInfo: fallback.needsMoreInfo,
    infoRequired: fallback.infoRequired ?? [],
    resolutionOptions: fallback.resolutionOptions,
    recommendedNextAction: fallback.recommendedNextAction,
    createdAt: new Date().toISOString(),
  };
}

async function resolveBooking(
  bookingId?: string,
  confirmationCode?: string
): Promise<Booking | null> {
  if (bookingId) {
    const booking = await getBookingById(bookingId);
    if (booking) {
      return booking;
    }
  }

  if (confirmationCode) {
    return getBookingByConfirmation(confirmationCode);
  }

  return null;
}

async function callOpenRouter(
  apiKey: string,
  requestText: string,
  booking: BookingSummary | null
) {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
  };

  const referer = process.env.OPENROUTER_REFERRER ?? process.env.VERCEL_URL;
  if (referer) {
    headers["HTTP-Referer"] = referer;
  }

  if (process.env.OPENROUTER_TITLE) {
    headers["X-Title"] = process.env.OPENROUTER_TITLE;
  }

  const systemMessage = `You are a hotel support coordinator. Use the provided booking details (if any) to craft tailored responses.
Focus on cancellations and stay modifications. When you need missing data (like confirmation codes or new dates), clearly ask for it.
Return JSON matching the schema you are given.`;

  const userPayload = {
    requestText,
    booking,
    policyReminders: [
      "Standard cancellation: full refund if more than 48 hours before check-in.",
      "Flexible change: one complimentary date change if room type is available.",
      "Agent escalation: only if refund exceptions or third-party payments are involved.",
    ],
  };

  const response = await fetch(OPENROUTER_ENDPOINT, {
    method: "POST",
    headers,
    body: JSON.stringify({
      model: OPENROUTER_MODEL,
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "hotel_support_response",
          schema: {
            type: "object",
            additionalProperties: false,
            required: [
              "needsMoreInfo",
              "resolutionOptions",
              "recommendedNextAction",
              "infoRequired",
            ],
            properties: {
              needsMoreInfo: { type: "boolean" },
              infoRequired: {
                type: "array",
                items: {
                  type: "object",
                  required: ["label", "reason"],
                  properties: {
                    label: { type: "string" },
                    reason: { type: "string" },
                  },
                },
              },
              resolutionOptions: {
                type: "array",
                minItems: 1,
                maxItems: 4,
                items: {
                  type: "object",
                  required: [
                    "title",
                    "summary",
                    "actions",
                    "impact",
                    "escalationLevel",
                  ],
                  properties: {
                    title: { type: "string" },
                    summary: { type: "string" },
                    actions: {
                      type: "array",
                      items: { type: "string" },
                    },
                    impact: { type: "string" },
                    escalationLevel: {
                      type: "string",
                      enum: ["self_service", "agent", "manager"],
                    },
                    recommendedFor: { type: "string" },
                  },
                },
              },
              recommendedNextAction: { type: "string" },
            },
          },
        },
      },
      messages: [
        { role: "system", content: systemMessage },
        {
          role: "user",
          content: JSON.stringify(userPayload),
        },
      ],
      temperature: 0.3,
    }),
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`OpenRouter responded with ${response.status}`);
  }

  const data = await response.json();
  const content = extractContent(data);
  return llmResponseSchema.parse(JSON.parse(content));
}

function extractContent(payload: unknown): string {
  if (
    payload &&
    typeof payload === "object" &&
    "choices" in payload &&
    Array.isArray((payload as any).choices)
  ) {
    const first = (payload as any).choices[0];
    if (first?.message?.content) {
      return first.message.content;
    }
  }
  throw new Error("OpenRouter payload missing content");
}

function summarizeBooking(booking: Booking): BookingSummary {
  return {
    id: booking.id,
    guestName: booking.guestName,
    confirmationCode: booking.confirmationCode,
    roomType: booking.roomType,
    status: booking.status,
    checkIn: booking.checkIn,
    checkOut: booking.checkOut,
  };
}

function buildFallbackResponse(
  requestText: string,
  booking?: BookingSummary
) {
  const lowered = requestText.toLowerCase();
  const isCancellation =
    lowered.includes("cancel") || lowered.includes("refund");
  const isDateChange =
    lowered.includes("change") ||
    lowered.includes("modify") ||
    lowered.includes("extend");

  const infoRequired =
    booking || lowered.includes("confirmation")
      ? []
      : [
          {
            label: "Confirmation code",
            reason: "Needed to locate the reservation before taking action.",
          },
        ];

  const resolutionOptions: ResolutionOption[] = [];

  if (isCancellation) {
    resolutionOptions.push({
      title: "Standard cancellation",
      summary:
        "Cancel the stay with the regular 48-hour policy and refund to the original payment method.",
      actions: [
        "Verify guest identity and booking details.",
        "Confirm request is more than 48 hours before check-in.",
        "Process refund minus any applicable fees.",
      ],
      impact: "Immediate refund if policy criteria are met.",
      escalationLevel: "self_service",
    });
    resolutionOptions.push({
      title: "Escalate for fee waiver",
      summary:
        "If the guest cites emergencies, escalate to an agent for a one-time courtesy waiver.",
      actions: [
        "Collect proof of the emergency if possible.",
        "Create an escalation note for the on-duty supervisor.",
        "Supervisor decides on refund exception.",
      ],
      impact: "Possible goodwill recovery for distressed guests.",
      escalationLevel: "agent",
    });
  } else if (isDateChange) {
    resolutionOptions.push({
      title: "Complimentary date change",
      summary:
        "Offer a one-time complimentary date move if the new dates have availability in the same room type.",
      actions: [
        "Check availability for requested dates.",
        "Update booking details and send confirmation.",
      ],
      impact: "Keeps the booking revenue while helping the guest.",
      escalationLevel: "self_service",
    });
    resolutionOptions.push({
      title: "Rebook with rate difference",
      summary:
        "Rebook into the closest available room and charge or refund the rate difference.",
      actions: [
        "Quote the new nightly rate to the guest.",
        "Collect approval before adjusting payment.",
        "Send updated confirmation email.",
      ],
      impact: "Ensures billing accuracy when plans change.",
      escalationLevel: "agent",
    });
  } else {
    resolutionOptions.push({
      title: "Clarify the request",
      summary:
        "Ask the guest for more context (cancellation vs. modification) to route correctly.",
      actions: [
        "Acknowledge the inquiry.",
        "Request specific details about the desired change.",
      ],
      impact: "Prevents incorrect actions and repeat contacts.",
      escalationLevel: "self_service",
    });
  }

  if (resolutionOptions.length === 0) {
    resolutionOptions.push({
      title: "General support follow-up",
      summary:
        "Gather details about the issue (dates, confirmation, reason) before routing to an agent.",
      actions: [
        "Thank the guest for reaching out.",
        "Ask for confirmation code and desired outcome.",
        "Promise a follow-up within 24 hours.",
      ],
      impact: "Ensures the request is properly triaged.",
      escalationLevel: "self_service",
    });
  }

  const recommendedNextAction = infoRequired.length
    ? "Request the missing booking details before continuing."
    : resolutionOptions[0]?.summary ??
      "Provide the guest with the outlined support options.";

  return {
    needsMoreInfo: infoRequired.length > 0,
    infoRequired,
    resolutionOptions,
    recommendedNextAction,
  };
}

