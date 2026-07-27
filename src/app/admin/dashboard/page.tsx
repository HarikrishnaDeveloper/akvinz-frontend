"use client";
import React, { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { adminFetch, clearAdminToken, getAdminToken, UPLOADS_BASE } from "@/lib/adminApi";

interface Customer {
  id: string;
  fullName: string;
  mobileNumber: string;
  email: string;
  addressLine1: string;
  addressLine2: string | null;
  city: string;
  state: string;
  pincode: string;
  planDuration: number;
  houseType: string;
  aadharImageUrl: string | null;
  panImageUrl: string | null;
  residenceDocUrl: string | null;
  paymentStatus: string;
  rentalPlanDuration: number | null;
  rentalAmount: number | null;
  subscriptionStatus: string;
  subscriptionStart: string | null;
  subscriptionEnd: string | null;
  lastPaymentDate: string | null;
  returnRequested: boolean;
  returnRequestedAt: string | null;
  refundAmount: number | null;
  createdAt: string;
}

interface Stats {
  totalCustomers: number;
  activeSubscriptions: number;
  pendingPayments: number;
  completedPayments: number;
  totalReturns: number;
  pendingRefunds: number;
  totalRentalRevenue: number;
}

const PAYMENT_STATUSES = ["PENDING", "COMPLETED", "FAILED", "PENDING_REFUND", "REFUNDED"];
const SUBSCRIPTION_STATUSES = ["INACTIVE", "ACTIVE", "CANCELLED"];

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-[#1a1f30] border border-gray-700/50 rounded-2xl p-5 flex flex-col">
      <p className="text-gray-400 text-sm leading-tight min-h-[2.5rem]">{label}</p>
      <p className="text-2xl font-bold text-white mt-1">{value}</p>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    COMPLETED: "bg-green-500/20 text-green-400",
    ACTIVE: "bg-green-500/20 text-green-400",
    PENDING: "bg-yellow-500/20 text-yellow-400",
    INACTIVE: "bg-gray-500/20 text-gray-400",
    FAILED: "bg-red-500/20 text-red-400",
    CANCELLED: "bg-red-500/20 text-red-400",
    REFUNDED: "bg-blue-500/20 text-blue-400",
    PENDING_REFUND: "bg-orange-500/20 text-orange-400",
    RETURNED: "bg-purple-500/20 text-purple-400",
  };
  return (
    <span className={`px-2 py-1 rounded-lg text-xs font-medium ${colors[status] || "bg-gray-500/20 text-gray-400"}`}>
      {status}
    </span>
  );
}

export default function AdminDashboardPage() {
  const router = useRouter();

  const [stats, setStats] = useState<Stats | null>(null);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [paymentStatus, setPaymentStatus] = useState("");
  const [subscriptionStatus, setSubscriptionStatus] = useState("");
  const [returnRequested, setReturnRequested] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<Customer | null>(null);
  const [editForm, setEditForm] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [copiedLink, setCopiedLink] = useState("");

  useEffect(() => {
    if (!getAdminToken()) {
      router.replace("/admin/login");
    }
  }, [router]);

  const loadStats = useCallback(async () => {
    const res = await adminFetch("/api/admin/stats");
    const data = await res.json();
    if (data.success) setStats(data.stats);
  }, []);

  const loadCustomers = useCallback(async () => {
    setIsLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({ page: String(page), limit: "20" });
      if (search) params.set("search", search);
      if (paymentStatus) params.set("paymentStatus", paymentStatus);
      if (subscriptionStatus) params.set("subscriptionStatus", subscriptionStatus);
      if (returnRequested) params.set("returnRequested", returnRequested);

      const res = await adminFetch(`/api/admin/customers?${params.toString()}`);
      const data = await res.json();
      if (data.success) {
        setCustomers(data.customers);
        setTotalPages(data.pagination.totalPages || 1);
      } else {
        setError(data.message || "Failed to load customers");
      }
    } catch {
      setError("Error connecting to server");
    } finally {
      setIsLoading(false);
    }
  }, [page, search, paymentStatus, subscriptionStatus, returnRequested]);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  useEffect(() => {
    loadCustomers();
  }, [loadCustomers]);

  useEffect(() => {
    setPage(1);
  }, [search, paymentStatus, subscriptionStatus, returnRequested]);

  const handleLogout = () => {
    clearAdminToken();
    router.replace("/admin/login");
  };

  const openEdit = (customer: Customer) => {
    setSelected(customer);
    setEditForm({
      paymentStatus: customer.paymentStatus,
      subscriptionStatus: customer.subscriptionStatus,
      rentalPlanDuration: customer.rentalPlanDuration ? String(customer.rentalPlanDuration) : "",
      rentalAmount: customer.rentalAmount ? String(customer.rentalAmount) : "",
      subscriptionStart: customer.subscriptionStart ? customer.subscriptionStart.slice(0, 10) : "",
      subscriptionEnd: customer.subscriptionEnd ? customer.subscriptionEnd.slice(0, 10) : "",
      returnRequested: String(customer.returnRequested),
      refundAmount: customer.refundAmount !== null ? String(customer.refundAmount) : "",
    });
  };

  const handleSave = async () => {
    if (!selected) return;
    setIsSaving(true);
    try {
      const body: Record<string, string> = {};
      Object.entries(editForm).forEach(([key, value]) => {
        if (value !== "") body[key] = value;
      });
      const res = await adminFetch(`/api/admin/customers/${selected.id}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.success) {
        setSelected(null);
        loadCustomers();
        loadStats();
      } else {
        setError(data.message || "Failed to update customer");
      }
    } catch {
      setError("Error connecting to server");
    } finally {
      setIsSaving(false);
    }
  };

  const copyLink = async (path: string, mobileNumber: string, label: string) => {
    const url = `${window.location.origin}${path}?mobile=${mobileNumber}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopiedLink(label);
      setTimeout(() => setCopiedLink(""), 2000);
    } catch {
      setError("Failed to copy link");
    }
  };

  const handleDelete = async (customer: Customer) => {
    if (!confirm(`Delete customer "${customer.fullName}"? This cannot be undone.`)) return;
    try {
      const res = await adminFetch(`/api/admin/customers/${customer.id}`, { method: "DELETE" });
      const data = await res.json();
      if (data.success) {
        loadCustomers();
        loadStats();
      } else {
        setError(data.message || "Failed to delete customer");
      }
    } catch {
      setError("Error connecting to server");
    }
  };

  return (
    <div className="min-h-screen bg-[#131724] text-white font-sans">
      <header className="bg-[#1a1f30] flex items-center justify-between px-4 sm:px-6 py-3 shadow-md border-b border-gray-800">
        <img src="/logo-footer.svg" alt="AKVINZ Logo" className="h-8 object-contain" />
        <button
          onClick={handleLogout}
          className="text-sm text-gray-300 hover:text-white border border-gray-700 rounded-lg px-3 py-1.5 transition-colors"
        >
          Logout
        </button>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-8">
        <div>
          <h1 className="text-2xl font-bold">Admin Dashboard</h1>
          <p className="text-gray-400 text-sm mt-1">Manage customers and subscriptions</p>
        </div>

        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-7 gap-4">
            <StatCard label="Total Customers" value={stats.totalCustomers} />
            <StatCard label="Active Subscriptions" value={stats.activeSubscriptions} />
            <StatCard label="Pending Payments" value={stats.pendingPayments} />
            <StatCard label="Completed Payments" value={stats.completedPayments} />
            <StatCard label="Product Returns" value={stats.totalReturns} />
            <StatCard label="Pending Refunds" value={stats.pendingRefunds} />
            <StatCard label="Rental Revenue" value={`₹${stats.totalRentalRevenue}`} />
          </div>
        )}

        <div className="bg-[#1a1f30] border border-gray-700/50 rounded-2xl p-4 sm:p-6">
          <div className="flex flex-col sm:flex-row gap-3 mb-4">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, email, or mobile..."
              className="flex-grow px-4 py-2.5 bg-[#131724] border border-gray-700 rounded-xl focus:ring-1 focus:ring-[#f26522] focus:border-[#f26522] text-white text-sm transition-colors"
            />
            <select
              value={paymentStatus}
              onChange={(e) => setPaymentStatus(e.target.value)}
              className="px-4 py-2.5 bg-[#131724] border border-gray-700 rounded-xl text-white text-sm"
            >
              <option value="">All Payment Status</option>
              {PAYMENT_STATUSES.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
            <select
              value={subscriptionStatus}
              onChange={(e) => setSubscriptionStatus(e.target.value)}
              className="px-4 py-2.5 bg-[#131724] border border-gray-700 rounded-xl text-white text-sm"
            >
              <option value="">All Subscription Status</option>
              {SUBSCRIPTION_STATUSES.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
            <select
              value={returnRequested}
              onChange={(e) => setReturnRequested(e.target.value)}
              className="px-4 py-2.5 bg-[#131724] border border-gray-700 rounded-xl text-white text-sm"
            >
              <option value="">All Returns</option>
              <option value="true">Returned</option>
              <option value="false">Not Returned</option>
            </select>
          </div>

          {error && <p className="text-sm text-red-400 mb-4">{error}</p>}

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-400 border-b border-gray-700/50">
                  <th className="py-2 pr-4 font-medium">Name</th>
                  <th className="py-2 pr-4 font-medium">Contact</th>
                  <th className="py-2 pr-4 font-medium">City</th>
                  <th className="py-2 pr-4 font-medium">Payment</th>
                  <th className="py-2 pr-4 font-medium">Subscription</th>
                  <th className="py-2 pr-4 font-medium">Returned</th>
                  <th className="py-2 pr-4 font-medium">Rental</th>
                  <th className="py-2 pr-4 font-medium">Joined</th>
                  <th className="py-2 pr-4 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr>
                    <td colSpan={9} className="py-8 text-center text-gray-400">Loading...</td>
                  </tr>
                ) : customers.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-8 text-center text-gray-400">No customers found</td>
                  </tr>
                ) : (
                  customers.map((c) => (
                    <tr key={c.id} className="border-b border-gray-800 hover:bg-white/5">
                      <td className="py-3 pr-4">{c.fullName}</td>
                      <td className="py-3 pr-4 text-gray-300">
                        <div>{c.mobileNumber}</div>
                        <div className="text-xs text-gray-500">{c.email}</div>
                      </td>
                      <td className="py-3 pr-4 text-gray-300">{c.city}</td>
                      <td className="py-3 pr-4">
                        <StatusBadge status={c.paymentStatus} />
                        {c.refundAmount !== null && (
                          <div className="text-xs text-gray-500 mt-1">Refund: ₹{c.refundAmount}</div>
                        )}
                      </td>
                      <td className="py-3 pr-4"><StatusBadge status={c.subscriptionStatus} /></td>
                      <td className="py-3 pr-4">
                        {c.returnRequested ? (
                          <StatusBadge status="RETURNED" />
                        ) : (
                          <span className="text-gray-500 text-xs">-</span>
                        )}
                      </td>
                      <td className="py-3 pr-4 text-gray-300">{c.rentalAmount ? `₹${c.rentalAmount}` : "-"}</td>
                      <td className="py-3 pr-4 text-gray-400">{new Date(c.createdAt).toLocaleDateString()}</td>
                      <td className="py-3 pr-4 text-right space-x-3 whitespace-nowrap">
                        <button onClick={() => openEdit(c)} className="text-[#f26522] hover:underline">Edit</button>
                        <button onClick={() => handleDelete(c)} className="text-red-400 hover:underline">Delete</button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between mt-4 text-sm text-gray-400">
            <span>Page {page} of {totalPages}</span>
            <div className="space-x-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="px-3 py-1.5 border border-gray-700 rounded-lg disabled:opacity-40"
              >
                Previous
              </button>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="px-3 py-1.5 border border-gray-700 rounded-lg disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      </main>

      {selected && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center px-4 z-50">
          <div className="bg-[#1a1f30] border border-gray-700/50 rounded-2xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-bold mb-1">{selected.fullName}</h2>
            <p className="text-gray-400 text-sm mb-4">{selected.email} · {selected.mobileNumber}</p>

            <div className="text-sm text-gray-300 space-y-1 mb-5">
              <p>{selected.addressLine1}{selected.addressLine2 ? `, ${selected.addressLine2}` : ""}</p>
              <p>{selected.city}, {selected.state} - {selected.pincode}</p>
              <p className="text-gray-500">Plan: {selected.planDuration} months · House: {selected.houseType}</p>
              <div className="flex gap-3 pt-1">
                {selected.aadharImageUrl && (
                  <a href={`${UPLOADS_BASE}/${selected.aadharImageUrl}`} target="_blank" rel="noreferrer" className="text-[#f26522] hover:underline text-xs">Aadhar</a>
                )}
                {selected.panImageUrl && (
                  <a href={`${UPLOADS_BASE}/${selected.panImageUrl}`} target="_blank" rel="noreferrer" className="text-[#f26522] hover:underline text-xs">PAN</a>
                )}
                {selected.residenceDocUrl && (
                  <a href={`${UPLOADS_BASE}/${selected.residenceDocUrl}`} target="_blank" rel="noreferrer" className="text-[#f26522] hover:underline text-xs">Residence Doc</a>
                )}
              </div>
            </div>

            <div className="mb-5">
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Quick Links</h3>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => copyLink("/rentForm", selected.mobileNumber, "rent")}
                  className="px-3 py-1.5 text-xs bg-[#131724] border border-gray-700 rounded-lg text-gray-300 hover:text-white hover:border-gray-500 transition-colors"
                >
                  {copiedLink === "rent" ? "Copied!" : "Copy Rent Link"}
                </button>
                <button
                  type="button"
                  onClick={() => copyLink("/returnForm", selected.mobileNumber, "return")}
                  className="px-3 py-1.5 text-xs bg-[#131724] border border-gray-700 rounded-lg text-gray-300 hover:text-white hover:border-gray-500 transition-colors"
                >
                  {copiedLink === "return" ? "Copied!" : "Copy Return Link"}
                </button>
                {selected.paymentStatus === "PENDING_REFUND" && (
                  <button
                    type="button"
                    onClick={() => copyLink("/closeForm", selected.mobileNumber, "close")}
                    className="px-3 py-1.5 text-xs bg-[#131724] border border-gray-700 rounded-lg text-gray-300 hover:text-white hover:border-gray-500 transition-colors"
                  >
                    {copiedLink === "close" ? "Copied!" : "Copy Close Agreement Link"}
                  </button>
                )}
              </div>
              {selected.paymentStatus === "PENDING_REFUND" && selected.refundAmount === null && (
                <p className="text-xs text-yellow-400 mt-2">
                  Set a refund amount below before sending the close agreement link.
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-400 mb-1">Payment Status</label>
                <select
                  value={editForm.paymentStatus}
                  onChange={(e) => setEditForm({ ...editForm, paymentStatus: e.target.value })}
                  className="w-full px-3 py-2 bg-[#131724] border border-gray-700 rounded-lg text-sm"
                >
                  {PAYMENT_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Subscription Status</label>
                <select
                  value={editForm.subscriptionStatus}
                  onChange={(e) => setEditForm({ ...editForm, subscriptionStatus: e.target.value })}
                  className="w-full px-3 py-2 bg-[#131724] border border-gray-700 rounded-lg text-sm"
                >
                  {SUBSCRIPTION_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Rental Plan (months)</label>
                <input
                  type="number"
                  value={editForm.rentalPlanDuration}
                  onChange={(e) => setEditForm({ ...editForm, rentalPlanDuration: e.target.value })}
                  className="w-full px-3 py-2 bg-[#131724] border border-gray-700 rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Rental Amount</label>
                <input
                  type="number"
                  value={editForm.rentalAmount}
                  onChange={(e) => setEditForm({ ...editForm, rentalAmount: e.target.value })}
                  className="w-full px-3 py-2 bg-[#131724] border border-gray-700 rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Subscription Start</label>
                <input
                  type="date"
                  value={editForm.subscriptionStart}
                  onChange={(e) => setEditForm({ ...editForm, subscriptionStart: e.target.value })}
                  className="w-full px-3 py-2 bg-[#131724] border border-gray-700 rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Subscription End</label>
                <input
                  type="date"
                  value={editForm.subscriptionEnd}
                  onChange={(e) => setEditForm({ ...editForm, subscriptionEnd: e.target.value })}
                  className="w-full px-3 py-2 bg-[#131724] border border-gray-700 rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Product Returned</label>
                <select
                  value={editForm.returnRequested}
                  onChange={(e) => setEditForm({ ...editForm, returnRequested: e.target.value })}
                  className="w-full px-3 py-2 bg-[#131724] border border-gray-700 rounded-lg text-sm"
                >
                  <option value="false">No</option>
                  <option value="true">Yes</option>
                </select>
              </div>
              <div className="col-span-2">
                <label className="block text-xs text-gray-400 mb-1">
                  Refund Amount (₹) &mdash; set after inspecting the returned product for damage
                </label>
                <input
                  type="number"
                  value={editForm.refundAmount}
                  onChange={(e) => setEditForm({ ...editForm, refundAmount: e.target.value })}
                  placeholder="e.g. 2999, or less if damaged"
                  className="w-full px-3 py-2 bg-[#131724] border border-gray-700 rounded-lg text-sm"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setSelected(null)}
                className="px-4 py-2 text-sm text-gray-300 hover:text-white"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="px-4 py-2 text-sm bg-[#f26522] hover:bg-[#e05a1e] rounded-lg font-medium disabled:opacity-50"
              >
                {isSaving ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
