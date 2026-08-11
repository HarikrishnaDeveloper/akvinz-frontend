"use client";
import React, { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { adminFetch, clearAdminToken, getAdminToken } from "@/lib/adminApi";

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
  aadharFrontImageUrl: string | null;
  aadharBackImageUrl: string | null;
  panFrontImageUrl: string | null;
  panBackImageUrl: string | null;
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
  modelName: string | null;
  machineSerialNumber: string | null;
  createdAt: string;
}

interface Draft {
  id: string;
  fullName: string | null;
  mobileNumber: string | null;
  email: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  state: string | null;
  pincode: string | null;
  planDuration: number | null;
  houseType: string | null;
  residenceDocType: string | null;
  createdAt: string;
  updatedAt: string;
}

interface Invoice {
  id: string;
  billNumber: string;
  type: string;
  productType: string;
  amount: number;
  paymentMethod: string;
  transactionId: string | null;
  status: string;
  reason: string | null;
  documentDate: string;
  createdAt: string;
}

interface ReturnEvent {
  id: string;
  step: string;
  status: string;
  eventDate: string;
  remarks: string | null;
  defectImageUrls: string[];
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

const DOCUMENT_FIELDS: { key: keyof Customer; label: string }[] = [
  { key: "aadharFrontImageUrl", label: "Aadhar (Front)" },
  { key: "aadharBackImageUrl", label: "Aadhar (Back)" },
  { key: "panFrontImageUrl", label: "PAN (Front)" },
  { key: "panBackImageUrl", label: "PAN (Back)" },
  { key: "residenceDocUrl", label: "Residence Doc" },
];

const RETURN_STEPS: { key: string; label: string; kind: "status" | "boolean" }[] = [
  { key: "DEINITIALIZATION_INITIATED", label: "De-initialization Initiated", kind: "status" },
  { key: "DEFECT_REPORTED", label: "Machine Defect Status Reported", kind: "boolean" },
  { key: "MACHINE_COLLECTED", label: "Machine Collected from Customer Location", kind: "status" },
  { key: "MACHINE_RECEIVED_WAREHOUSE", label: "Machine Received at Warehouse", kind: "status" },
  { key: "REFUND_INITIATED", label: "Refund Initiated", kind: "status" },
  { key: "PAYMENT_REFUNDED", label: "Payment Refunded", kind: "status" },
];

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function nowTimeHHMM(): string {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function formatEventDateTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function returnEventStatusColor(status: string): string {
  if (status === "COMPLETED" || status === "NO") return "bg-green-500/20 text-green-400";
  if (status === "YES") return "bg-red-500/20 text-red-400";
  return "bg-gray-500/20 text-gray-400";
}

function DueDateCell({ customer }: { customer: Customer }) {
  if (!customer.subscriptionEnd) {
    return <span className="text-gray-500 text-xs">-</span>;
  }

  const due = new Date(customer.subscriptionEnd);
  const dueDay = new Date(due.getFullYear(), due.getMonth(), due.getDate());
  const today = new Date();
  const todayDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const daysLeft = Math.round((dueDay.getTime() - todayDay.getTime()) / (1000 * 60 * 60 * 24));

  const isActive = customer.subscriptionStatus === "ACTIVE";
  const isOverdue = isActive && daysLeft < 0;
  const isDueSoon = isActive && daysLeft >= 0 && daysLeft <= 3;

  return (
    <div>
      <div className={isOverdue ? "text-red-400 font-medium" : isDueSoon ? "text-yellow-400 font-medium" : "text-gray-300"}>
        {dueDay.toLocaleDateString()}
      </div>
      {isOverdue && (
        <div className="text-xs text-red-500">{Math.abs(daysLeft)} day{Math.abs(daysLeft) === 1 ? "" : "s"} overdue</div>
      )}
      {isDueSoon && (
        <div className="text-xs text-yellow-500">{daysLeft === 0 ? "Due today" : `Due in ${daysLeft} day${daysLeft === 1 ? "" : "s"}`}</div>
      )}
    </div>
  );
}

function DocumentChip({ label, url }: { label: string; url: string | null }) {
  return (
    <div
      className={`flex items-center justify-between gap-2 px-3 py-2 rounded-lg border text-xs ${
        url ? "border-gray-700 bg-[#131724]" : "border-gray-800 bg-[#131724]/40"
      }`}
    >
      <span className={url ? "text-gray-300" : "text-gray-600"}>{label}</span>
      {url ? (
        <a href={url} target="_blank" rel="noreferrer" className="text-[#f26522] hover:underline font-medium shrink-0">
          View
        </a>
      ) : (
        <span className="text-gray-600 shrink-0">Not uploaded</span>
      )}
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-[#1a1f30] border border-gray-700/50 rounded-2xl p-5 flex flex-col">
      <p className="text-gray-400 text-sm leading-tight min-h-[2.5rem]">{label}</p>
      <p className="text-2xl font-bold text-white mt-1">{value}</p>
    </div>
  );
}

function ModalSection({ title, children }: { title: React.ReactNode; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">{title}</h3>
      {children}
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
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [invoicesLoading, setInvoicesLoading] = useState(false);
  const [returnEvents, setReturnEvents] = useState<ReturnEvent[]>([]);
  const [returnEventsLoading, setReturnEventsLoading] = useState(false);
  const [returnEventForm, setReturnEventForm] = useState<Record<string, { status: string; eventDate: string; eventTime: string; remarks: string }>>({});
  const [savingReturnStep, setSavingReturnStep] = useState("");
  const [showReturnHistory, setShowReturnHistory] = useState(false);
  const [defectImages, setDefectImages] = useState<(File | null)[]>([null, null, null]);

  const [activeTab, setActiveTab] = useState<"customers" | "drafts">("customers");
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [draftsTotalPages, setDraftsTotalPages] = useState(1);
  const [draftsPage, setDraftsPage] = useState(1);
  const [draftsSearch, setDraftsSearch] = useState("");
  const [draftsLoading, setDraftsLoading] = useState(false);
  const [copiedDraftId, setCopiedDraftId] = useState("");

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

  const loadDrafts = useCallback(async () => {
    setDraftsLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({ page: String(draftsPage), limit: "20" });
      if (draftsSearch) params.set("search", draftsSearch);

      const res = await adminFetch(`/api/admin/drafts?${params.toString()}`);
      const data = await res.json();
      if (data.success) {
        setDrafts(data.drafts);
        setDraftsTotalPages(data.pagination.totalPages || 1);
      } else {
        setError(data.message || "Failed to load drafts");
      }
    } catch {
      setError("Error connecting to server");
    } finally {
      setDraftsLoading(false);
    }
  }, [draftsPage, draftsSearch]);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  useEffect(() => {
    loadCustomers();
  }, [loadCustomers]);

  useEffect(() => {
    if (activeTab === "drafts") loadDrafts();
  }, [activeTab, loadDrafts]);

  useEffect(() => {
    setPage(1);
  }, [search, paymentStatus, subscriptionStatus, returnRequested]);

  useEffect(() => {
    setDraftsPage(1);
  }, [draftsSearch]);

  useEffect(() => {
    if (!selected) {
      setInvoices([]);
      return;
    }
    setInvoicesLoading(true);
    adminFetch(`/api/admin/customers/${selected.id}/invoices`)
      .then((res) => res.json())
      .then((data) => {
        if (data.success) setInvoices(data.invoices);
      })
      .finally(() => setInvoicesLoading(false));
  }, [selected]);

  useEffect(() => {
    setShowReturnHistory(false);
    setDefectImages([null, null, null]);
    const initial: Record<string, { status: string; eventDate: string; eventTime: string; remarks: string }> = {};
    RETURN_STEPS.forEach((s) => {
      initial[s.key] = { status: s.kind === "boolean" ? "NO" : "PENDING", eventDate: todayISO(), eventTime: nowTimeHHMM(), remarks: "" };
    });
    setReturnEventForm(initial);

    if (!selected || !selected.returnRequested) {
      setReturnEvents([]);
      return;
    }
    setReturnEventsLoading(true);
    adminFetch(`/api/admin/customers/${selected.id}/return-events`)
      .then((res) => res.json())
      .then((data) => {
        if (data.success) setReturnEvents(data.events);
      })
      .finally(() => setReturnEventsLoading(false));
  }, [selected]);

  const latestReturnEvent = (step: string): ReturnEvent | undefined =>
    returnEvents.find((e) => e.step === step);

  const submitReturnEvent = async (stepKey: string) => {
    if (!selected) return;
    const form = returnEventForm[stepKey];
    if (!form) return;
    if (stepKey === "DEFECT_REPORTED" && form.status === "YES" && !form.remarks.trim()) {
      setError("Remarks are required when reporting a defect");
      return;
    }
    setSavingReturnStep(stepKey);
    try {
      const body = new FormData();
      body.append("step", stepKey);
      body.append("status", form.status);
      body.append("eventDate", `${form.eventDate}T${form.eventTime || "00:00"}`);
      if (form.remarks) body.append("remarks", form.remarks);
      if (stepKey === "DEFECT_REPORTED" && form.status === "YES") {
        defectImages.forEach((file) => {
          if (file) body.append("defectImages", file);
        });
      }

      const res = await adminFetch(`/api/admin/customers/${selected.id}/return-events`, {
        method: "POST",
        body,
      });
      const data = await res.json();
      if (data.success) {
        setReturnEvents((prev) => [data.event, ...prev]);
        setReturnEventForm((prev) => ({
          ...prev,
          [stepKey]: {
            status: stepKey === "DEFECT_REPORTED" ? "NO" : "PENDING",
            eventDate: todayISO(),
            eventTime: nowTimeHHMM(),
            remarks: "",
          },
        }));
        if (stepKey === "DEFECT_REPORTED") setDefectImages([null, null, null]);
      } else {
        setError(data.message || "Failed to save update");
      }
    } catch {
      setError("Error connecting to server");
    } finally {
      setSavingReturnStep("");
    }
  };

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
      modelName: customer.modelName || "",
      machineSerialNumber: customer.machineSerialNumber || "",
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

  const copyDraftLink = async (draft: Draft) => {
    const url = `${window.location.origin}/customerForm?draft=${draft.id}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopiedDraftId(draft.id);
      setTimeout(() => setCopiedDraftId(""), 2000);
    } catch {
      setError("Failed to copy link");
    }
  };

  const downloadInvoicePdf = async (invoice: Invoice) => {
    try {
      const res = await adminFetch(`/api/admin/invoices/${invoice.id}/pdf`);
      if (!res.ok) {
        setError("Failed to download receipt");
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${invoice.billNumber}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      setError("Failed to download receipt");
    }
  };

  const handleDeleteDraft = async (draft: Draft) => {
    if (!confirm(`Delete draft for "${draft.fullName || draft.mobileNumber || "this entry"}"? This cannot be undone.`)) return;
    try {
      const res = await adminFetch(`/api/admin/drafts/${draft.id}`, { method: "DELETE" });
      const data = await res.json();
      if (data.success) {
        loadDrafts();
      } else {
        setError(data.message || "Failed to delete draft");
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

        <div className="flex gap-2">
          <button
            onClick={() => setActiveTab("customers")}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${activeTab === "customers" ? "bg-[#f26522] text-white" : "bg-[#1a1f30] border border-gray-700/50 text-gray-400 hover:text-white"}`}
          >
            Customers
          </button>
          <button
            onClick={() => setActiveTab("drafts")}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${activeTab === "drafts" ? "bg-[#f26522] text-white" : "bg-[#1a1f30] border border-gray-700/50 text-gray-400 hover:text-white"}`}
          >
            Drafts
          </button>
        </div>

        {activeTab === "customers" && (
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
                  <th className="py-2 pr-4 font-medium">Subscription</th>
                  <th className="py-2 pr-4 font-medium">Product</th>
                  <th className="py-2 pr-4 font-medium">Rental</th>
                  <th className="py-2 pr-4 font-medium">Due Date</th>
                  <th className="py-2 pr-4 font-medium">Last Rental Payment</th>
                  <th className="py-2 pr-4 font-medium">Joined</th>
                  <th className="py-2 pr-4 font-medium">Returned</th>
                  <th className="py-2 pr-4 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr>
                    <td colSpan={10} className="py-8 text-center text-gray-400">Loading...</td>
                  </tr>
                ) : customers.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="py-8 text-center text-gray-400">No customers found</td>
                  </tr>
                ) : (
                  customers.map((c) => (
                    <tr key={c.id} className="border-b border-gray-800 hover:bg-white/5">
                      <td className="py-3 pr-4">{c.fullName}</td>
                      <td className="py-3 pr-4 text-gray-300">
                        <div>{c.mobileNumber}</div>
                        <div className="text-xs text-gray-500">{c.email}</div>
                      </td>
                      <td className="py-3 pr-4"><StatusBadge status={c.subscriptionStatus} /></td>
                      <td className="py-3 pr-4 text-gray-300">
                        {c.modelName || c.machineSerialNumber ? (
                          <>
                            <div>{c.modelName || "-"}</div>
                            <div className="text-xs text-gray-500">{c.machineSerialNumber || "-"}</div>
                          </>
                        ) : (
                          <span className="text-gray-500 text-xs">-</span>
                        )}
                      </td>
                      <td className="py-3 pr-4 text-gray-300">{c.rentalAmount ? `₹${c.rentalAmount}` : "-"}</td>
                      <td className="py-3 pr-4"><DueDateCell customer={c} /></td>
                      <td className="py-3 pr-4 text-gray-300">{c.lastPaymentDate ? new Date(c.lastPaymentDate).toLocaleDateString() : "-"}</td>
                      <td className="py-3 pr-4 text-gray-400">{new Date(c.createdAt).toLocaleDateString()}</td>
                      <td className="py-3 pr-4 text-gray-300">
                        {c.returnRequested && c.returnRequestedAt ? (
                          new Date(c.returnRequestedAt).toLocaleDateString()
                        ) : (
                          <span className="text-gray-500 text-xs">-</span>
                        )}
                      </td>
                      <td className="py-3 pr-4 text-right space-x-3 whitespace-nowrap">
                        <button
                          onClick={() => openEdit(c)}
                          title="View full details"
                          aria-label="View full details"
                          className="inline-flex align-middle text-gray-400 hover:text-white transition-colors"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          </svg>
                        </button>
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
        )}

        {activeTab === "drafts" && (
        <div className="bg-[#1a1f30] border border-gray-700/50 rounded-2xl p-4 sm:p-6">
          <div className="flex flex-col sm:flex-row gap-3 mb-4">
            <input
              type="text"
              value={draftsSearch}
              onChange={(e) => setDraftsSearch(e.target.value)}
              placeholder="Search by name, email, or mobile..."
              className="flex-grow px-4 py-2.5 bg-[#131724] border border-gray-700 rounded-xl focus:ring-1 focus:ring-[#f26522] focus:border-[#f26522] text-white text-sm transition-colors"
            />
          </div>

          <p className="text-xs text-gray-500 mb-4">
            Registrations customers started but haven&apos;t completed and submitted yet. These are not counted as customers.
          </p>

          {error && <p className="text-sm text-red-400 mb-4">{error}</p>}

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-400 border-b border-gray-700/50">
                  <th className="py-2 pr-4 font-medium">Name</th>
                  <th className="py-2 pr-4 font-medium">Contact</th>
                  <th className="py-2 pr-4 font-medium">City</th>
                  <th className="py-2 pr-4 font-medium">Plan</th>
                  <th className="py-2 pr-4 font-medium">House Type</th>
                  <th className="py-2 pr-4 font-medium">Documents</th>
                  <th className="py-2 pr-4 font-medium">Last Updated</th>
                  <th className="py-2 pr-4 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {draftsLoading ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-gray-400">Loading...</td>
                  </tr>
                ) : drafts.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-gray-400">No drafts found</td>
                  </tr>
                ) : (
                  drafts.map((d) => (
                    <tr key={d.id} className="border-b border-gray-800 hover:bg-white/5">
                      <td className="py-3 pr-4">{d.fullName || <span className="text-gray-500">-</span>}</td>
                      <td className="py-3 pr-4 text-gray-300">
                        <div>{d.mobileNumber || "-"}</div>
                        <div className="text-xs text-gray-500">{d.email || "-"}</div>
                      </td>
                      <td className="py-3 pr-4 text-gray-300">{d.city || "-"}</td>
                      <td className="py-3 pr-4 text-gray-300">{d.planDuration ? `${d.planDuration} months` : "-"}</td>
                      <td className="py-3 pr-4 text-gray-300">{d.houseType || "-"}</td>
                      <td className="py-3 pr-4">
                        {d.residenceDocType ? (
                          <span className="px-2 py-1 rounded-lg text-xs font-medium bg-blue-500/20 text-blue-400">
                            {d.residenceDocType}
                          </span>
                        ) : (
                          <span className="text-gray-600 text-xs">Not selected</span>
                        )}
                      </td>
                      <td className="py-3 pr-4 text-gray-400">{new Date(d.updatedAt).toLocaleString()}</td>
                      <td className="py-3 pr-4 text-right space-x-3 whitespace-nowrap">
                        <button onClick={() => copyDraftLink(d)} className="text-[#f26522] hover:underline">
                          {copiedDraftId === d.id ? "Copied!" : "Copy Continue Link"}
                        </button>
                        <button onClick={() => handleDeleteDraft(d)} className="text-red-400 hover:underline">Delete</button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between mt-4 text-sm text-gray-400">
            <span>Page {draftsPage} of {draftsTotalPages}</span>
            <div className="space-x-2">
              <button
                onClick={() => setDraftsPage((p) => Math.max(1, p - 1))}
                disabled={draftsPage <= 1}
                className="px-3 py-1.5 border border-gray-700 rounded-lg disabled:opacity-40"
              >
                Previous
              </button>
              <button
                onClick={() => setDraftsPage((p) => Math.min(draftsTotalPages, p + 1))}
                disabled={draftsPage >= draftsTotalPages}
                className="px-3 py-1.5 border border-gray-700 rounded-lg disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        </div>
        )}
      </main>

      {selected && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center px-4 z-50">
          <div className="bg-[#1a1f30] border border-gray-700/50 rounded-2xl w-full max-w-5xl max-h-[90vh] overflow-y-auto flex flex-col">
            <div className="flex items-start justify-between gap-4 px-6 py-5 border-b border-gray-800 sticky top-0 bg-[#1a1f30] z-10">
              <div>
                <h2 className="text-lg font-bold">{selected.fullName}</h2>
                <p className="text-gray-400 text-sm mt-0.5">{selected.email} · {selected.mobileNumber}</p>
              </div>
              <button
                onClick={() => setSelected(null)}
                aria-label="Close"
                className="text-gray-400 hover:text-white shrink-0"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 p-6">
              {/* Column 1: profile */}
              <div className="space-y-6">
                <ModalSection title="Customer Details">
                  <div className="text-sm text-gray-300 space-y-1">
                    <p>{selected.addressLine1}{selected.addressLine2 ? `, ${selected.addressLine2}` : ""}</p>
                    <p>{selected.city}, {selected.state} - {selected.pincode}</p>
                    <p className="text-gray-500">Plan: {selected.planDuration} months · House: {selected.houseType}</p>
                  </div>
                </ModalSection>

                <ModalSection title="Quick Links">
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
                </ModalSection>

                <ModalSection title="Assigned Product">
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs text-gray-400 mb-1">Model Name</label>
                      <input
                        type="text"
                        value={editForm.modelName}
                        onChange={(e) => setEditForm({ ...editForm, modelName: e.target.value })}
                        placeholder="e.g. AKV-200"
                        className="w-full px-3 py-2 bg-[#131724] border border-gray-700 rounded-lg text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-400 mb-1">Machine Serial Number</label>
                      <input
                        type="text"
                        value={editForm.machineSerialNumber}
                        onChange={(e) => setEditForm({ ...editForm, machineSerialNumber: e.target.value })}
                        placeholder="e.g. SN-000123"
                        className="w-full px-3 py-2 bg-[#131724] border border-gray-700 rounded-lg text-sm"
                      />
                    </div>
                  </div>
                </ModalSection>
              </div>

              {/* Column 2: documents + receipts */}
              <div className="space-y-6">
                <ModalSection
                  title={
                    <>
                      Documents{" "}
                      <span className="normal-case text-gray-500">
                        ({DOCUMENT_FIELDS.filter(({ key }) => Boolean(selected[key])).length}/{DOCUMENT_FIELDS.length} uploaded)
                      </span>
                    </>
                  }
                >
                  <div className="space-y-2">
                    {DOCUMENT_FIELDS.map(({ key, label }) => (
                      <DocumentChip key={key} label={label} url={selected[key] as string | null} />
                    ))}
                  </div>
                </ModalSection>

                <ModalSection title="Receipts">
                  {invoicesLoading ? (
                    <p className="text-xs text-gray-500">Loading...</p>
                  ) : invoices.length === 0 ? (
                    <p className="text-xs text-gray-500">No receipts yet.</p>
                  ) : (
                    <div className="space-y-2">
                      {invoices.map((inv) => (
                        <div
                          key={inv.id}
                          className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg border border-gray-700 bg-[#131724] text-xs"
                        >
                          <div>
                            <div className="text-gray-200 font-medium">{inv.billNumber}</div>
                            <div className="text-gray-500">
                              {inv.productType} · ₹{inv.amount} · {new Date(inv.documentDate).toLocaleDateString()}
                            </div>
                          </div>
                          <button onClick={() => downloadInvoicePdf(inv)} className="text-[#f26522] hover:underline shrink-0">
                            Download PDF
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </ModalSection>
              </div>

              {/* Column 3: editable status & subscription */}
              <div className="space-y-6">
                <ModalSection title="Status">
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
                  </div>
                </ModalSection>

                <ModalSection title="Subscription">
                  <div className="grid grid-cols-2 gap-3">
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
                  </div>
                </ModalSection>

                <ModalSection title="Returns & Refund">
                  <div className="space-y-3">
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
                    <div>
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
                </ModalSection>
              </div>
            </div>

            {selected.returnRequested && (
              <div className="px-6 pb-6">
                <div className="border-t border-gray-800 pt-6">
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                    <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                      Return Process
                      {selected.returnRequestedAt && (
                        <span className="normal-case text-gray-500 ml-2 font-normal">
                          · Return Date: {new Date(selected.returnRequestedAt).toLocaleDateString()}
                        </span>
                      )}
                    </h3>
                    <button
                      type="button"
                      onClick={() => setShowReturnHistory((v) => !v)}
                      className="text-xs text-[#f26522] hover:underline"
                    >
                      {showReturnHistory ? "Hide History" : "View History"}
                    </button>
                  </div>

                  {!showReturnHistory ? (
                    <div className="space-y-3">
                      {RETURN_STEPS.map((step) => {
                        const latest = latestReturnEvent(step.key);
                        const form = returnEventForm[step.key] || {
                          status: step.kind === "boolean" ? "NO" : "PENDING",
                          eventDate: todayISO(),
                          eventTime: nowTimeHHMM(),
                          remarks: "",
                        };
                        return (
                          <div key={step.key} className="bg-[#131724] border border-gray-700 rounded-xl p-3">
                            <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                              <span className="text-sm text-gray-200 font-medium">{step.label}</span>
                              {latest ? (
                                <span className={`px-2 py-0.5 rounded-lg text-xs font-medium ${returnEventStatusColor(latest.status)}`}>
                                  {latest.status} · {formatEventDateTime(latest.eventDate)}
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 rounded-lg text-xs font-medium bg-gray-500/20 text-gray-400">Not started</span>
                              )}
                            </div>
                            <div className="flex flex-wrap items-end gap-2">
                              <div>
                                <label className="block text-xs text-gray-500 mb-1">Status</label>
                                <select
                                  value={form.status}
                                  onChange={(e) =>
                                    setReturnEventForm((prev) => ({ ...prev, [step.key]: { ...form, status: e.target.value } }))
                                  }
                                  className="px-2 py-1.5 bg-[#1a1f30] border border-gray-700 rounded-lg text-xs"
                                >
                                  {(step.kind === "boolean" ? ["NO", "YES"] : ["PENDING", "COMPLETED"]).map((v) => (
                                    <option key={v} value={v}>{v}</option>
                                  ))}
                                </select>
                              </div>
                              <div>
                                <label className="block text-xs text-gray-500 mb-1">Date</label>
                                <input
                                  type="date"
                                  value={form.eventDate}
                                  onChange={(e) =>
                                    setReturnEventForm((prev) => ({ ...prev, [step.key]: { ...form, eventDate: e.target.value } }))
                                  }
                                  className="px-2 py-1.5 bg-[#1a1f30] border border-gray-700 rounded-lg text-xs"
                                />
                              </div>
                              <div>
                                <label className="block text-xs text-gray-500 mb-1">Time</label>
                                <input
                                  type="time"
                                  value={form.eventTime}
                                  onChange={(e) =>
                                    setReturnEventForm((prev) => ({ ...prev, [step.key]: { ...form, eventTime: e.target.value } }))
                                  }
                                  className="px-2 py-1.5 bg-[#1a1f30] border border-gray-700 rounded-lg text-xs"
                                />
                              </div>
                              {step.kind === "boolean" && form.status === "YES" && (
                                <div className="flex-1 min-w-[160px]">
                                  <label className="block text-xs text-gray-500 mb-1">Remarks</label>
                                  <input
                                    type="text"
                                    value={form.remarks}
                                    onChange={(e) =>
                                      setReturnEventForm((prev) => ({ ...prev, [step.key]: { ...form, remarks: e.target.value } }))
                                    }
                                    placeholder="Defect details..."
                                    className="w-full px-2 py-1.5 bg-[#1a1f30] border border-gray-700 rounded-lg text-xs"
                                  />
                                </div>
                              )}
                              <button
                                type="button"
                                onClick={() => submitReturnEvent(step.key)}
                                disabled={savingReturnStep === step.key}
                                className="px-3 py-1.5 text-xs bg-[#f26522] hover:bg-[#e05a1e] rounded-lg font-medium disabled:opacity-50"
                              >
                                {savingReturnStep === step.key ? "Saving..." : "Log Update"}
                              </button>
                            </div>
                            {step.kind === "boolean" && form.status === "YES" && (
                              <div className="grid grid-cols-3 gap-2 mt-3">
                                {[0, 1, 2].map((i) => (
                                  <div key={i}>
                                    <label className="block text-xs text-gray-500 mb-1">Picture {i + 1}</label>
                                    <input
                                      type="file"
                                      accept="image/*"
                                      onChange={(e) => {
                                        const file = e.target.files?.[0] || null;
                                        setDefectImages((prev) => {
                                          const next = [...prev];
                                          next[i] = file;
                                          return next;
                                        });
                                      }}
                                      className="w-full text-xs text-gray-400 file:mr-2 file:px-2 file:py-1 file:rounded-md file:border-0 file:bg-[#1a1f30] file:text-gray-300 file:text-xs file:cursor-pointer"
                                    />
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                      {returnEventsLoading ? (
                        <p className="text-xs text-gray-500">Loading...</p>
                      ) : returnEvents.length === 0 ? (
                        <p className="text-xs text-gray-500">No updates logged yet.</p>
                      ) : (
                        returnEvents.map((ev) => {
                          const stepLabel = RETURN_STEPS.find((s) => s.key === ev.step)?.label || ev.step;
                          return (
                            <div
                              key={ev.id}
                              className="flex items-start justify-between gap-3 px-3 py-2 rounded-lg border border-gray-700 bg-[#131724] text-xs"
                            >
                              <div>
                                <div className="text-gray-200 font-medium">{stepLabel}</div>
                                <div className="text-gray-500">
                                  {ev.status} · {formatEventDateTime(ev.eventDate)}
                                  {ev.remarks && <> · {ev.remarks}</>}
                                </div>
                                {ev.defectImageUrls.length > 0 && (
                                  <div className="flex flex-wrap gap-2 mt-1.5">
                                    {ev.defectImageUrls.map((url, i) => (
                                      <a
                                        key={url}
                                        href={url}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="text-[#f26522] hover:underline"
                                      >
                                        Picture {i + 1}
                                      </a>
                                    ))}
                                  </div>
                                )}
                              </div>
                              <span className="text-gray-600 shrink-0 whitespace-nowrap">
                                logged {new Date(ev.createdAt).toLocaleString()}
                              </span>
                            </div>
                          );
                        })
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-800 sticky bottom-0 bg-[#1a1f30]">
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
