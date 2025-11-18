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
      description:
        "Submit a guest support issue to receive possible resolutions and next steps.",
      inputSchema: {
        requestText: z
          .string()
          .min(5)
          .describe("Description of the support issue."),
        bookingId: z.string().describe("Internal booking ID").optional(),
        confirmationCode: z
          .string()
          .describe("Guest-facing confirmation code.")
          .optional(),
        contactEmail: z.string().email().optional(),
      },
      _meta: meta,
    },
    async ({ requestText, bookingId, confirmationCode, contactEmail }) => {
      const result = await analyzeSupportRequest({
        requestText,
        bookingId,
        confirmationCode,
        contactEmail,
      });

      const content: Array<{ type: "text"; text: string }> = [
        {
          type: "text",
          text: `Prepared support guidance for ${
            result.booking?.guestName ?? "the guest"
          }.`,
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
