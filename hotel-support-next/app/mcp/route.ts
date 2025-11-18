import { baseURL } from "@/baseUrl";
import { analyzeSupportRequest } from "@/server/support";
import { createMcpHandler } from "mcp-handler";
import { z } from "zod";

const handler = createMcpHandler(async (server) => {
  const templateUri = "ui://hotel-support.html";

  server.registerResource(
    "hotel-support",
    templateUri,
    {
      title: "Hotel Support Desk",
      description: "Self-contained booking support widget",
      mimeType: "text/html+skybridge",
      _meta: {
        "openai/widgetDescription": "Render the hotel support workflow",
        "openai/widgetPrefersBorder": false,
      },
    },
    async (uri) => ({
      contents: [
        {
          uri: uri.href,
          mimeType: "text/html+skybridge",
          text: await fetch(`${baseURL}/`).then((res) => res.text()),
          _meta: {
            "openai/widgetDescription": "Render the hotel support workflow",
            "openai/widgetPrefersBorder": false,
          },
        },
      ],
    })
  );

  const meta = {
    "openai/outputTemplate": templateUri,
    "openai/toolInvocation/invoking": "Reviewing booking support request",
    "openai/toolInvocation/invoked": "Support options prepared",
    "openai/widgetAccessible": true,
    "openai/resultCanProduceWidget": true,
  } as const;

  server.registerTool(
    "submit_support_request",
    {
      title: "Hotel booking support",
      description: `Submit a guest support request to the hotel. 

CRITICAL INSTRUCTIONS:
1. You MUST collect the booking confirmation code from the user before submitting. Ask politely: "May I have your booking confirmation code?" or "What's your confirmation code?"
2. Once you have the confirmation code, help the user formulate their request clearly and in their best interest. For example:
   - If they want to cancel: "Requesting cancellation of booking [CONFIRMATION_CODE]"
   - If they want to change dates: "Requesting date modification for booking [CONFIRMATION_CODE] to [NEW_DATES]"
   - If they have a complaint: "Guest reports [ISSUE] for booking [CONFIRMATION_CODE]"
3. Only call this tool when you have the confirmation code and a clear request from the user.
4. The hotel will review the request and provide an outcome. You should communicate this outcome to the user.`,
      inputSchema: {
        requestText: z
          .string()
          .min(5)
          .describe(
            "A clear, well-formulated description of the support issue written from the guest's perspective and in their best interest."
          ),
        confirmationCode: z
          .string()
          .min(1)
          .describe(
            "REQUIRED: The guest's booking confirmation code. You must obtain this from the user before calling this tool."
          ),
        bookingId: z.string().describe("Internal booking ID").optional(),
        contactEmail: z.string().email().optional(),
      },
      _meta: meta,
    },
    async ({ requestText, bookingId, confirmationCode, contactEmail }) => {
      const { createSupportRequest, getSupportRequests } = await import(
        "@/server/support-requests"
      );

      // Check if there's already a resolved request for this confirmation code
      let existingResolved = null;
      if (confirmationCode) {
        const existing = await getSupportRequests({
          confirmationCode,
          status: ["resolved"],
        });
        // Get the most recent resolved request
        if (existing.length > 0) {
          existingResolved = existing.sort(
            (a, b) =>
              new Date(
                (b.outcome?.resolvedAt || b.updatedAt) ?? b.createdAt
              ).getTime() -
              new Date(
                (a.outcome?.resolvedAt || a.updatedAt) ?? a.createdAt
              ).getTime()
          )[0];
        }
      }

      // If there's an existing resolved outcome, return it
      if (existingResolved?.outcome) {
        const analysis = await analyzeSupportRequest({
          requestText,
          bookingId,
          confirmationCode,
          contactEmail,
        });

        const result = {
          ...analysis,
          requestId: existingResolved.id,
          status: existingResolved.status,
          outcome: existingResolved.outcome,
        };

        return {
          content: [
            {
              type: "text",
              text: `The hotel has resolved your request: ${existingResolved.outcome.summary}`,
            },
          ],
          structuredContent: result,
          _meta: meta,
        };
      }

      // Analyze the request to get resolution options
      const analysis = await analyzeSupportRequest({
        requestText,
        bookingId,
        confirmationCode,
        contactEmail,
      });

      // Store the support request
      const requestRecord = await createSupportRequest({
        requestText,
        bookingId,
        confirmationCode,
        contactEmail,
        booking: analysis.booking,
        resolutionOptions: analysis.resolutionOptions,
      });

      const result = {
        ...analysis,
        requestId: requestRecord.id,
        status: requestRecord.status,
        outcome: requestRecord.outcome,
      };

      const content: Array<{ type: "text"; text: string }> = [
        {
          type: "text",
          text: `Support request submitted for ${
            analysis.booking?.guestName ?? "the guest"
          }. The hotel is reviewing the request and will provide an outcome shortly.`,
        },
      ];

      return {
        content,
        structuredContent: result,
        _meta: meta,
      };
    }
  );
});

export const GET = handler;
export const POST = handler;
