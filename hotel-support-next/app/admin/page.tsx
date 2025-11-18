"use client";

import { useEffect, useState, useCallback } from "react";

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
};

type SupportRequest = {
  id: string;
  requestText: string;
  confirmationCode?: string;
  contactEmail?: string;
  booking?: BookingSummary | null;
  status: "pending" | "resolved" | "closed";
  resolutionOptions?: ResolutionOption[];
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

type Stats = {
  total: number;
  pending: number;
  resolved: number;
  closed: number;
};

export default function AdminDashboard() {
  const [requests, setRequests] = useState<SupportRequest[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedRequest, setSelectedRequest] = useState<SupportRequest | null>(null);
  const [resolving, setResolving] = useState(false);
  const [resolvedBy, setResolvedBy] = useState("");

  const fetchRequests = useCallback(async () => {
    try {
      const [requestsRes, statsRes] = await Promise.all([
        fetch("/api/support-requests?status=pending"),
        fetch("/api/support-requests?stats=true"),
      ]);
      const requestsData = await requestsRes.json();
      const statsData = await statsRes.json();
      setRequests(requestsData.requests || []);
      setStats(statsData.stats || null);
    } catch (error) {
      console.error("Failed to fetch requests:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRequests();
    const interval = setInterval(fetchRequests, 5000); // Refresh every 5 seconds
    return () => clearInterval(interval);
  }, [fetchRequests]);

  const handleResolve = async (request: SupportRequest, option: ResolutionOption) => {
    if (!resolvedBy.trim()) {
      alert("Please enter your name");
      return;
    }

    setResolving(true);
    try {
      const response = await fetch("/api/support-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requestId: request.id,
          outcome: {
            ...option,
            resolvedBy: resolvedBy.trim(),
          },
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to resolve request");
      }

      await fetchRequests();
      setSelectedRequest(null);
      setResolvedBy("");
    } catch (error) {
      console.error("Failed to resolve:", error);
      alert("Failed to resolve request. Please try again.");
    } finally {
      setResolving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 dark:bg-slate-950">
        <div className="text-center">
          <div className="mb-4 h-8 w-8 animate-spin rounded-full border-2 border-blue-500 border-t-transparent mx-auto" />
          <p className="text-slate-600 dark:text-slate-400">Loading requests...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 py-8 px-4">
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-50">
            Hotel Support Admin Dashboard
          </h1>
          {stats && (
            <div className="mt-4 grid grid-cols-4 gap-4">
              <div className="rounded-lg bg-slate-100 p-3 dark:bg-slate-800">
                <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Total
                </p>
                <p className="mt-1 text-2xl font-semibold text-slate-900 dark:text-slate-50">
                  {stats.total}
                </p>
              </div>
              <div className="rounded-lg bg-amber-100 p-3 dark:bg-amber-900/30">
                <p className="text-xs uppercase tracking-wide text-amber-700 dark:text-amber-300">
                  Pending
                </p>
                <p className="mt-1 text-2xl font-semibold text-amber-900 dark:text-amber-50">
                  {stats.pending}
                </p>
              </div>
              <div className="rounded-lg bg-emerald-100 p-3 dark:bg-emerald-900/30">
                <p className="text-xs uppercase tracking-wide text-emerald-700 dark:text-emerald-300">
                  Resolved
                </p>
                <p className="mt-1 text-2xl font-semibold text-emerald-900 dark:text-emerald-50">
                  {stats.resolved}
                </p>
              </div>
              <div className="rounded-lg bg-slate-100 p-3 dark:bg-slate-800">
                <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Closed
                </p>
                <p className="mt-1 text-2xl font-semibold text-slate-900 dark:text-slate-50">
                  {stats.closed}
                </p>
              </div>
            </div>
          )}
        </header>

        <section className="space-y-4">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-50">
            Pending Requests ({requests.length})
          </h2>

          {requests.length === 0 ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm dark:border-slate-700 dark:bg-slate-900">
              <p className="text-slate-500 dark:text-slate-400">
                No pending support requests
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {requests.map((request) => (
                <div
                  key={request.id}
                  className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3">
                        <span className="inline-flex items-center rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
                          Pending
                        </span>
                        {request.confirmationCode && (
                          <span className="font-mono text-sm text-slate-600 dark:text-slate-400">
                            {request.confirmationCode}
                          </span>
                        )}
                        <span className="text-xs text-slate-500 dark:text-slate-400">
                          {new Date(request.createdAt).toLocaleString()}
                        </span>
                      </div>
                      <h3 className="mt-2 text-base font-semibold text-slate-900 dark:text-slate-50">
                        {request.requestText}
                      </h3>
                      {request.booking && (
                        <div className="mt-3 grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
                          <div>
                            <span className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                              Guest:{" "}
                            </span>
                            <span className="font-medium text-slate-900 dark:text-slate-50">
                              {request.booking.guestName}
                            </span>
                          </div>
                          <div>
                            <span className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                              Stay:{" "}
                            </span>
                            <span className="text-slate-900 dark:text-slate-50">
                              {request.booking.checkIn} → {request.booking.checkOut}
                            </span>
                          </div>
                          <div>
                            <span className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                              Room:{" "}
                            </span>
                            <span className="text-slate-900 dark:text-slate-50">
                              {request.booking.roomType}
                            </span>
                          </div>
                          <div>
                            <span className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                              Status:{" "}
                            </span>
                            <span className="capitalize text-slate-900 dark:text-slate-50">
                              {request.booking.status.replace("_", " ")}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                    <button
                      onClick={() => setSelectedRequest(request)}
                      className="ml-4 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500 dark:bg-blue-500 dark:hover:bg-blue-400"
                    >
                      Resolve
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {selectedRequest && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="w-full max-w-3xl rounded-2xl border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-700 dark:bg-slate-900">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-50">
                  Resolve Request
                </h2>
                <button
                  onClick={() => {
                    setSelectedRequest(null);
                    setResolvedBy("");
                  }}
                  className="text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
                >
                  ✕
                </button>
              </div>

              <div className="mb-4 space-y-2">
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  <strong>Request:</strong> {selectedRequest.requestText}
                </p>
                {selectedRequest.booking && (
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    <strong>Guest:</strong> {selectedRequest.booking.guestName}
                  </p>
                )}
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                  Your name
                </label>
                <input
                  type="text"
                  value={resolvedBy}
                  onChange={(e) => setResolvedBy(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-50"
                  placeholder="Enter your name"
                />
              </div>

              <div className="mb-4">
                <p className="mb-2 text-sm font-medium text-slate-700 dark:text-slate-300">
                  Select resolution:
                </p>
                {!selectedRequest.resolutionOptions ||
                selectedRequest.resolutionOptions.length === 0 ? (
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    No resolution options available for this request.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {selectedRequest.resolutionOptions.map((option) => {
                    const tone =
                      option.escalationLevel === "self_service"
                        ? "border-emerald-200 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-900/30"
                        : option.escalationLevel === "agent"
                        ? "border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-900/30"
                        : "border-purple-200 bg-purple-50 dark:border-purple-800 dark:bg-purple-900/30";

                    return (
                      <button
                        key={option.title}
                        onClick={() => handleResolve(selectedRequest, option)}
                        disabled={resolving}
                        className={`w-full rounded-lg border p-4 text-left transition hover:shadow-md ${tone} ${
                          resolving ? "opacity-50 cursor-not-allowed" : ""
                        }`}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <h3 className="font-semibold text-slate-900 dark:text-slate-50">
                              {option.title}
                            </h3>
                            <p className="mt-1 text-sm text-slate-700 dark:text-slate-200">
                              {option.summary}
                            </p>
                            <p className="mt-2 text-xs text-slate-600 dark:text-slate-400">
                              <strong>Impact:</strong> {option.impact}
                            </p>
                          </div>
                        </div>
                      </button>
                    );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

