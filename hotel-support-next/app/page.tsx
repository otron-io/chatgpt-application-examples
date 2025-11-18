"use client";

import {
  Suspense,
  useCallback,
  useMemo,
  useState,
  type FormEvent,
} from "react";
import { useOpenAIGlobal, useWidgetProps } from "./hooks";

const IS_DEVELOPMENT = process.env.NODE_ENV === "development";

type BookingSummary = {
  id: string;
  guestName: string;
  confirmationCode: string;
  roomType: string;
  status: string;
  checkIn: string;
  checkOut: string;
};

type ResolutionOption = {
  title: string;
  summary: string;
  actions: string[];
  impact: string;
  escalationLevel: "self_service" | "agent" | "manager";
  recommendedFor?: string;
};

type SupportResponse = {
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

type ToolOutputShape =
  | SupportResponse
  | { result?: SupportResponse }
  | { structuredContent?: SupportResponse };

const MOCK_RESPONSE: SupportResponse = {
  requestText: "Guest wants to cancel stay due to a delayed flight.",
  booking: {
    id: "bkg_1001",
    guestName: "Alicia Perez",
    confirmationCode: "QF8N2A",
    roomType: "Deluxe King",
    status: "confirmed",
    checkIn: "2025-11-20",
    checkOut: "2025-11-24",
  },
  needsMoreInfo: false,
  infoRequired: [],
  resolutionOptions: [
    {
      title: "Standard cancellation",
      summary:
        "Cancel with the standard policy and refund to the original payment method.",
      actions: [
        "Verify booking ownership and ID",
        "Confirm cancellation falls within the 48-hour window",
        "Trigger refund minus any fees",
      ],
      impact: "Full refund if compliant with policy.",
      escalationLevel: "self_service",
    },
    {
      title: "Escalate for fee waiver",
      summary:
        "If the guest cites an emergency, escalate for a single-use waiver of fees.",
      actions: [
        "Capture reason for cancellation",
        "Send escalation note to supervisor",
        "Supervisor decides on refund exception",
      ],
      impact: "Protects NPS during travel disruptions.",
      escalationLevel: "agent",
    },
  ],
  recommendedNextAction: "Confirm the cancellation with the guest and send the refund confirmation email.",
  createdAt: new Date().toISOString(),
};

function LoadingState() {
  return (
    <div className="w-full max-w-4xl mx-auto p-6">
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-8 dark:bg-slate-900 dark:border-slate-700">
        <div className="flex flex-col items-center gap-4 py-6">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
          <h2 className="text-lg font-semibold text-gray-900 dark:text-slate-50">
            Preparing support guidance…
          </h2>
          <p className="text-sm text-gray-500 dark:text-slate-400">
            Analyzing the booking details and selected policies.
          </p>
        </div>
      </div>
    </div>
  );
}

function InfoNeeded({ info }: { info: Array<{ label: string; reason: string }> }) {
  if (!info.length) return null;
  return (
    <section className="w-full rounded-2xl border border-amber-200 bg-amber-50/70 p-4 text-left dark:border-amber-600/50 dark:bg-amber-900/30">
      <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">
        Need the following details before acting:
      </p>
      <ul className="mt-2 space-y-1 text-sm text-amber-900 dark:text-amber-50">
        {info.map((item) => (
          <li key={item.label} className="flex flex-col">
            <span className="font-medium">{item.label}</span>
            <span className="text-xs opacity-90 dark:opacity-80">{item.reason}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function BookingCard({ booking }: { booking?: BookingSummary | null }) {
  if (!booking) return null;
  return (
    <section className="w-full rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm dark:border-slate-700 dark:bg-slate-900">
      <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-50">Booking details</h3>
      <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
        <div>
          <dt className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Guest
          </dt>
          <dd className="font-medium text-slate-900 dark:text-slate-50">{booking.guestName}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Confirmation
          </dt>
          <dd className="font-mono text-sm text-slate-900 dark:text-slate-50">{booking.confirmationCode}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Stay
          </dt>
          <dd className="text-slate-900 dark:text-slate-50">
            {booking.checkIn} → {booking.checkOut}
          </dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Room
          </dt>
          <dd className="text-slate-900 dark:text-slate-50">{booking.roomType}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Status
          </dt>
          <dd className="capitalize text-slate-900 dark:text-slate-50">{booking.status.replace("_", " ")}</dd>
        </div>
      </dl>
    </section>
  );
}

function ResolutionCard({ option }: { option: ResolutionOption }) {
  const tone =
    option.escalationLevel === "self_service"
      ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
      : option.escalationLevel === "agent"
      ? "bg-blue-50 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300"
      : "bg-purple-50 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300";

  return (
    <article className="flex h-full flex-col rounded-2xl border border-slate-200 bg-white p-5 text-left shadow-sm transition hover:-translate-y-0.5 dark:border-slate-700 dark:bg-slate-900">
      <div className={`inline-flex w-fit items-center rounded-full px-3 py-1 text-xs font-semibold ${tone}`}>
        {option.escalationLevel.replace("_", " ")}
      </div>
      <h3 className="mt-3 text-base font-semibold text-slate-900 dark:text-slate-50">
        {option.title}
      </h3>
      <p className="mt-2 text-sm text-slate-700 dark:text-slate-200">{option.summary}</p>
      <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-slate-700 dark:text-slate-200">
        {option.actions.map((action) => (
          <li key={action}>{action}</li>
        ))}
      </ul>
      <p className="mt-3 text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
        Impact
      </p>
      <p className="text-sm text-slate-700 dark:text-slate-200">{option.impact}</p>
    </article>
  );
}

function DevSupportTester({ onResult }: { onResult: (data: SupportResponse) => void }) {
  const [requestText, setRequestText] = useState(
    "Guest needs to move the stay by two days due to flight changes."
  );
  const [confirmationCode, setConfirmationCode] = useState("QF8N2A");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      setLoading(true);
      setError(null);
      try {
        const response = await fetch("/api/support", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ requestText, confirmationCode }),
        });
        const payload = (await response.json()) as { result?: SupportResponse; error?: string };
        if (!response.ok || !payload.result) {
          throw new Error(payload.error ?? "Unable to analyze request.");
        }
        onResult(payload.result);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong.");
      } finally {
        setLoading(false);
      }
    },
    [requestText, confirmationCode, onResult]
  );

  return (
    <section className="w-full rounded-2xl border border-dashed border-blue-400/40 bg-blue-50/60 p-4 text-left shadow-sm dark:border-blue-500/50 dark:bg-blue-900/30">
      <h2 className="text-sm font-semibold text-blue-900 dark:text-blue-50">
        Local support tester
      </h2>
      <p className="mt-1 text-xs text-blue-800 dark:text-blue-100">
        Calls the Next.js API route directly without going through ChatGPT.
      </p>
      <form className="mt-3 space-y-2" onSubmit={handleSubmit}>
        <textarea
          value={requestText}
          onChange={(event) => setRequestText(event.target.value)}
          rows={3}
          className="w-full rounded-xl border border-blue-200 bg-white/90 px-3 py-2 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 dark:border-blue-600/50 dark:bg-slate-800 dark:text-slate-50 dark:placeholder:text-slate-400 dark:focus:border-blue-400"
          placeholder="Describe the guest issue…"
        />
        <input
          value={confirmationCode}
          onChange={(event) => setConfirmationCode(event.target.value.toUpperCase())}
          className="w-full rounded-xl border border-blue-200 bg-white/90 px-3 py-2 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 dark:border-blue-600/50 dark:bg-slate-800 dark:text-slate-50 dark:placeholder:text-slate-400 dark:focus:border-blue-400"
          placeholder="Confirmation code"
        />
        <button
          type="submit"
          disabled={loading || requestText.trim().length < 5}
          className="inline-flex items-center rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-blue-500 dark:hover:bg-blue-400"
        >
          {loading ? "Analyzing…" : "Generate guidance"}
        </button>
        {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}
      </form>
    </section>
  );
}

function SupportView() {
  const toolOutput = useWidgetProps<ToolOutputShape>({} as ToolOutputShape);
  const theme = useOpenAIGlobal("theme") ?? "light";
  const data = useMemo(() => {
    if (!toolOutput || Object.keys(toolOutput).length === 0) return null;
    if ("result" in toolOutput && toolOutput.result) {
      return toolOutput.result;
    }
    if ("structuredContent" in toolOutput && toolOutput.structuredContent) {
      return toolOutput.structuredContent;
    }
    if ("requestText" in (toolOutput as SupportResponse)) {
      return toolOutput as SupportResponse;
    }
    return null;
  }, [toolOutput]);

  const [devData, setDevData] = useState<SupportResponse | null>(null);
  const response = data ?? devData ?? (IS_DEVELOPMENT ? MOCK_RESPONSE : null);

  if (!response) {
    return <LoadingState />;
  }

  return (
    <div className={`flex w-full justify-center px-3 ${theme === "dark" ? "bg-slate-950" : "bg-slate-50"}`}>
      <div className="w-full max-w-5xl space-y-4 py-4">
        {IS_DEVELOPMENT && <DevSupportTester onResult={setDevData} />}

        <section className="w-full rounded-3xl border border-slate-200 bg-white p-5 text-left shadow dark:border-slate-700 dark:bg-slate-900">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-300">
            Support request
          </p>
          <h1 className="mt-2 text-xl font-semibold text-slate-900 dark:text-slate-50">
            {response.requestText}
          </h1>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
            Generated {new Date(response.createdAt).toLocaleString()}
          </p>
        </section>

        <BookingCard booking={response.booking} />
        <InfoNeeded info={response.infoRequired} />

        {response.outcome ? (
          <section className="w-full text-left">
            <div className="mb-3">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-300">
                Resolution outcome
              </p>
              <p className="text-sm text-slate-600 dark:text-slate-300">
                The hotel has reviewed your request and provided the following resolution
              </p>
            </div>
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 shadow-sm dark:border-emerald-600/50 dark:bg-emerald-900/30">
              <div className="mb-3 flex items-center gap-2">
                <span className="inline-flex items-center rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-800 dark:bg-emerald-800 dark:text-emerald-200">
                  Resolved
                </span>
                {response.outcome.resolvedBy && (
                  <span className="text-xs text-slate-600 dark:text-slate-400">
                    by {response.outcome.resolvedBy}
                  </span>
                )}
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  {new Date(response.outcome.resolvedAt).toLocaleString()}
                </span>
              </div>
              <h3 className="text-lg font-semibold text-emerald-900 dark:text-emerald-50">
                {response.outcome.title}
              </h3>
              <p className="mt-2 text-sm text-emerald-800 dark:text-emerald-100">
                {response.outcome.summary}
              </p>
              <div className="mt-4 space-y-2">
                <p className="text-xs font-medium uppercase tracking-wide text-emerald-700 dark:text-emerald-300">
                  Next steps
                </p>
                <ul className="list-disc space-y-1 pl-5 text-sm text-emerald-800 dark:text-emerald-100">
                  {response.outcome.actions.map((action) => (
                    <li key={action}>{action}</li>
                  ))}
                </ul>
              </div>
              <div className="mt-4">
                <p className="text-xs font-medium uppercase tracking-wide text-emerald-700 dark:text-emerald-300">
                  Impact
                </p>
                <p className="mt-1 text-sm text-emerald-800 dark:text-emerald-100">
                  {response.outcome.impact}
                </p>
              </div>
              {response.outcome.notes && (
                <div className="mt-4 rounded-lg bg-emerald-100/50 p-3 dark:bg-emerald-900/20">
                  <p className="text-xs font-medium uppercase tracking-wide text-emerald-700 dark:text-emerald-300">
                    Notes
                  </p>
                  <p className="mt-1 text-sm text-emerald-800 dark:text-emerald-100">
                    {response.outcome.notes}
                  </p>
                </div>
              )}
            </div>
          </section>
        ) : response.status === "pending" ? (
          <section className="w-full rounded-2xl border border-amber-200 bg-amber-50 p-4 text-left dark:border-amber-600/50 dark:bg-amber-900/30">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-amber-700 dark:text-amber-300">
              Request status
            </p>
            <p className="mt-2 text-sm text-amber-900 dark:text-amber-50">
              Your request has been submitted and is being reviewed by our support team. We&apos;ll provide a resolution shortly.
            </p>
          </section>
        ) : (
          <>
            <section className="w-full text-left">
              <div className="mb-3 flex items-baseline justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-300">
                    Resolution options
                  </p>
                  <p className="text-sm text-slate-600 dark:text-slate-300">
                    {response.resolutionOptions.length} recommendation(s) to review with the guest
                  </p>
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                {response.resolutionOptions.map((option) => (
                  <ResolutionCard key={option.title} option={option} />
                ))}
              </div>
            </section>

            <section className="w-full rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-left dark:border-emerald-600/50 dark:bg-emerald-900/30">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-emerald-700 dark:text-emerald-300">
                Recommended next action
              </p>
              <p className="mt-2 text-sm text-emerald-900 dark:text-emerald-50">
                {response.recommendedNextAction}
              </p>
            </section>
          </>
        )}
      </div>
    </div>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<LoadingState />}>
      <SupportView />
    </Suspense>
  );
}
