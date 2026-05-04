// app/(frontend)/pos/page.tsx

"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { useTenantRouter } from "@/hooks/useTenantRouter";
import {
  Search,
  ShoppingCart,
  Plus,
  Minus,
  Trash2,
  CreditCard,
  User,
  Scissors as ScissorsIcon,
  Package,
  LayoutDashboard,
  ChevronRight,
  Zap,
  X,
  Wallet,
} from "lucide-react";
import { FormButton } from "@/components/dashboard/FormInput";
import SearchableSelect from "@/components/dashboard/SearchableSelect";
import Modal from "@/components/dashboard/Modal";
import CustomerForm from "@/components/dashboard/CustomerForm";
import { useSettings } from "@/components/providers/SettingsProvider";
import {
  calculateSplitCommission,
  type SplitMode,
} from "@/lib/splitCommission";

interface Item {
  _id: string;
  name: string;
  price: number;
  memberPrice?: number;
  image?: string;
  type: "Service" | "Product" | "Package" | "Bundle" | "TopUp";
  duration?: number; // Service only
  stock?: number; // Product only
  commissionType?: "percentage" | "fixed";
  commissionValue?: number;
  waFollowUp?: {
    enabled?: boolean;
    firstDays?: number;
    secondDays?: number;
    firstTemplateId?: string;
    secondTemplateId?: string;
  };
  // Bundle only — services contained in this bundle
  bundleServices?: {
    service: string;
    serviceName: string;
    servicePrice: number;
    duration: number;
    commissionType?: string;
    commissionValue?: number;
  }[];
}

interface Staff {
  _id: string;
  name: string;
  commissionRate: number;
}

interface CartItem extends Item {
  quantity: number;
}

interface Customer {
  _id: string;
  name: string;
  phone?: string;
  membershipTier?: string;
  membershipExpiry?: string;
  loyaltyPoints?: number;
  referredBy?: string | object;
  packageSummary?: {
    activePackages?: number;
  };
}

interface StaffAssignment {
  staffId: string;
  percentage: number;
}

interface CustomerPackageQuota {
  service: string;
  serviceName: string;
  totalQuota: number;
  usedQuota: number;
  remainingQuota: number;
}

interface CustomerPackageItem {
  _id: string;
  packageName: string;
  status: "active" | "depleted" | "expired" | "cancelled";
  expiresAt?: string;
  package?: {
    _id?: string;
    name?: string;
    code?: string;
  };
  serviceQuotas: CustomerPackageQuota[];
}

interface CustomerDealOption {
  customerPackageId: string;
  packageName: string;
  packageCode?: string;
  serviceId: string;
  serviceName: string;
  remainingQuota: number;
  totalQuota: number;
  expiresAt?: string;
}

interface PackageClaim {
  enabled: boolean;
  customerPackageId: string;
}

interface PaymentEntry {
  method: string;
  amount: number | string;
}

interface QrisCreateResponse {
  success: boolean;
  error?: string;
  data?: {
    externalId: string;
    checkoutUrl: string;
    status?: string;
  };
}

interface QrisStatusResponse {
  success: boolean;
  error?: string;
  data?: {
    externalId: string;
    status: string;
    sourceType?: "invoice" | "package_order";
    sourceId?: string;
    checkoutUrl?: string;
  };
}

export default function POSPage() {
  const router = useTenantRouter();
  const searchParams = useSearchParams();
  const { settings } = useSettings();
  const [activeTab, setActiveTab] = useState<
    "all" | "services" | "products" | "packages" | "bundles" | "topup"
  >("all");
  // Top-Up Wallet state
  const [topupAmount, setTopupAmount] = useState<number | string>("");
  const [services, setServices] = useState<Item[]>([]);
  const [products, setProducts] = useState<Item[]>([]);
  const [packages, setPackages] = useState<Item[]>([]);
  const [serviceBundles, setServiceBundles] = useState<Item[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [staffList, setStaffList] = useState<Staff[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  // Cart State
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState("");
  const [serviceStaffAssignments, setServiceStaffAssignments] = useState<
    Record<string, StaffAssignment[]>
  >({});
  const [serviceSplitModes, setServiceSplitModes] = useState<
    Record<string, SplitMode>
  >({});
  const [customerPackages, setCustomerPackages] = useState<
    CustomerPackageItem[]
  >([]);
  const [packageClaims, setPackageClaims] = useState<
    Record<string, PackageClaim>
  >({});
  const [discount, setDiscount] = useState(0);
  const [discountType, setDiscountType] = useState<"nominal" | "percentage">("percentage");
  const [discountReason, setDiscountReason] = useState("");
  const [staffTips, setStaffTips] = useState<Record<string, number>>({});
  const [splitPayments, setSplitPayments] = useState<PaymentEntry[]>([
    { method: "", amount: "" },
  ]);
  const [followUpPhoneNumber, setFollowUpPhoneNumber] = useState("");
  // Voucher redemption
  const [voucherCode, setVoucherCode] = useState("");
  const [voucherApplied, setVoucherApplied] = useState<{
    voucherId: string;
    code: string;
    discountType: string;
    discountValue: number;
    discountAmount: number;
    description?: string;
  } | null>(null);
  const [voucherLoading, setVoucherLoading] = useState(false);
  // Loyalty point redemption
  const [loyaltyPointsToRedeem, setLoyaltyPointsToRedeem] = useState(0);
  const [customerLoyaltyPoints, setCustomerLoyaltyPoints] = useState(0);
  const [customerWalletBalance, setCustomerWalletBalance] = useState(0);
  const [isNonQrisConfirmOpen, setIsNonQrisConfirmOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);
  const [isDealsModalOpen, setIsDealsModalOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isStaffEarningsHidden, setIsStaffEarningsHidden] = useState(false);
  const [expandedStaffKey, setExpandedStaffKey] = useState<string | null>(null);
  const [showVoucherInput, setShowVoucherInput] = useState(false);
  const [showLoyaltySlider, setShowLoyaltySlider] = useState(false);
  const [referralCode, setReferralCode] = useState("");
  const [referralValidating, setReferralValidating] = useState(false);
  const [referralInfoModal, setReferralInfoModal] = useState<{name: string, phone: string} | null>(null);
  const [referralValidated, setReferralValidated] = useState<{
    referrerName: string;
    discountAmount: number;
  } | null>(null);
  const [isFirstTimer, setIsFirstTimer] = useState(false);
  const [isQrisModalOpen, setIsQrisModalOpen] = useState(false);
  const [qrisSession, setQrisSession] = useState<{
    externalId: string;
    checkoutUrl: string;
    invoiceId: string;
    status: string;
    sourceType: "invoice" | "package_order";
  } | null>(null);
  const [checkingQris, setCheckingQris] = useState(false);

  // Derived from splitPayments (backward compat with checkout logic)
  const paymentMethod = splitPayments[0]?.method || "Cash";
  const isQrisOnly = splitPayments.length === 1 && paymentMethod === "QRIS";

  // Split payment helpers
  const totalSplitPaidComputed = splitPayments.reduce((sum, p) => {
    const v = parseFloat(String(p.amount || "0"));
    return sum + (Number.isFinite(v) ? v : 0);
  }, 0);

  const addSplitPayment = () => {
    setSplitPayments((prev) => [...prev, { method: "Cash", amount: "" }]);
  };

  const removeSplitPayment = (index: number) => {
    if (splitPayments.length <= 1) return;
    setSplitPayments((prev) => prev.filter((_, i) => i !== index));
  };

  const updateSplitMethod = (index: number, method: string) => {
    setSplitPayments((prev) => {
      if (method === "QRIS") return [{ method: "QRIS", amount: "" }];
      const next = [...prev];
      next[index] = { ...next[index], method };
      return next;
    });
  };

  const updateSplitAmount = (index: number, amount: string) => {
    setSplitPayments((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], amount };
      return next;
    });
  };

  useEffect(() => {
    if (selectedCustomer && selectedCustomer !== "walking-customer") {
      const cust = customers.find((c) => c._id === selectedCustomer);
      if (cust) {
        setCustomerLoyaltyPoints(cust.loyaltyPoints || 0);
        setCustomerWalletBalance((cust as any).walletBalance || 0);
      } else {
        setCustomerLoyaltyPoints(0);
        setCustomerWalletBalance(0);
      }
    } else {
      setCustomerLoyaltyPoints(0);
      setCustomerWalletBalance(0);
    }
  }, [selectedCustomer, customers]);

  useEffect(() => {
    fetchResources();
  }, []);

  const appointmentId = searchParams.get("appointmentId");
  const [appointmentLoaded, setAppointmentLoaded] = useState(false);

  // Auto-load appointment data to cart if appointmentId is present
  useEffect(() => {
    if (!appointmentId || loading || services.length === 0 || appointmentLoaded)
      return;

    const loadAppointment = async () => {
      try {
        const res = await fetch(`/api/appointments/${appointmentId}`);
        const data = await res.json();

        if (data.success && data.data) {
          const apt = data.data;

          // Set Customer
          const customerId = apt.customer?._id || apt.customer;
          if (customerId) {
            setSelectedCustomer(customerId);
          }

          // Add items to cart
          const tempCart: CartItem[] = [];
          const tempAssignments: Record<string, StaffAssignment[]> = {};
          const tempSplitModes: Record<string, SplitMode> = {};

          // Appointment services
          apt.services.forEach((s: any) => {
            const sId = s.service?._id || s.service;
            const matchedService = services.find((svc) => svc._id === sId);
            if (matchedService) {
              const cartKey = getCartItemKey(matchedService._id, "Service");
              tempCart.push({ ...matchedService, quantity: 1, price: s.price }); // use appointment price

              // Assign staff from appointment
              const staffId = apt.staff?._id || apt.staff;
              if (staffId) {
                tempAssignments[cartKey] = [{ staffId, percentage: 100 }];
                tempSplitModes[cartKey] = "auto";
              }
            }
          });

          if (tempCart.length > 0) {
            setCart(tempCart);
            setServiceStaffAssignments(tempAssignments);
            setServiceSplitModes((prev) => ({ ...prev, ...tempSplitModes }));
            setDiscount(apt.discount || 0);
          }

          setToastMessage("Appointment loaded to POS successfully");
          setAppointmentLoaded(true);
        }
      } catch (err) {
        console.error("Failed to load appointment", err);
      }
    };

    loadAppointment();
  }, [appointmentId, loading, services, appointmentLoaded]);

  useEffect(() => {
    if (!toastMessage) return;
    const timeout = window.setTimeout(() => setToastMessage(null), 2200);
    return () => window.clearTimeout(timeout);
  }, [toastMessage]);

  useEffect(() => {
    const loadCustomerPackages = async () => {
      if (!selectedCustomer || selectedCustomer === "walking-customer") {
        setCustomerPackages([]);
        return;
      }

      try {
        const res = await fetch(
          `/api/customer-packages?customerId=${selectedCustomer}`,
        );
        const data = await res.json();
        if (data.success) {
          setCustomerPackages(data.data || []);
        } else {
          setCustomerPackages([]);
        }
      } catch {
        setCustomerPackages([]);
      }
    };

    loadCustomerPackages();
  }, [selectedCustomer]);

  useEffect(() => {
    if (!selectedCustomer || selectedCustomer === "walking-customer") {
      setFollowUpPhoneNumber("");
      setCustomerLoyaltyPoints(0);
      setLoyaltyPointsToRedeem(0);
      setIsFirstTimer(false);
      setReferralCode("");
      setReferralValidated(null);
      return;
    }

    const customer = customers.find((entry) => entry._id === selectedCustomer);
    setFollowUpPhoneNumber(String(customer?.phone || "").trim());

    // Fetch customer loyalty points
    fetch(`/api/customers/${selectedCustomer}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          setCustomerLoyaltyPoints(Number(data.data?.loyaltyPoints || 0));
        }
      })
      .catch(() => setCustomerLoyaltyPoints(0));

    // Check if customer is a first-timer (no paid invoices)
    fetch(`/api/invoices?customerId=${selectedCustomer}&status=paid&limit=1`)
      .then((res) => res.json())
      .then((data) => {
        if (data.success && Array.isArray(data.data)) {
          setIsFirstTimer(data.data.length === 0);
        } else {
          setIsFirstTimer(false);
        }
      })
      .catch(() => setIsFirstTimer(false));
  }, [selectedCustomer, customers]);

  // Apply referral code
  const applyReferralCode = async () => {
    if (!referralCode.trim() || !isFirstTimer) return;
    setReferralValidating(true);
    setReferralValidated(null);
    try {
      const res = await fetch(`/api/customers?referralCode=${referralCode.trim().toUpperCase()}`);
      const data = await res.json();
      const validReferrers = data.data || [];
      if (data.success && validReferrers.length > 0) {
        const referrer = validReferrers[0];

        const isVIP = referrer.membershipExpiry && new Date(referrer.membershipExpiry).getTime() > new Date().getTime();
        if (!isVIP) {
          alert("Peringatan: Kode referral hanya berlaku jika pemiliknya adalah member VIP aktif!");
          setReferralCode("");
          return;
        }

        if (referrer._id === selectedCustomer) {
          alert("Peringatan: Tidak bisa menggunakan kode referral milik sendiri!");
          setReferralCode("");
          return;
        }

        setReferralInfoModal({ name: referrer.name, phone: referrer.phone || "-" });

        const amt =
          settings.referralDiscountType === "percentage"
            ? (settings.referralDiscountValue || 0)
            : (settings.referralDiscountValue || 0);
        setReferralValidated({
          referrerName: referrer.name,
          discountAmount: amt, // Will be computed in calculateTotal if percentage
        });
      } else {
        alert("Kode referral tidak valid atau tidak ditemukan");
        setReferralCode("");
      }
    } catch {
      alert("Error memvalidasi kode referral");
      setReferralCode("");
    } finally {
      setReferralValidating(false);
    }
  };

  // Apply voucher code
  const applyVoucher = async () => {
    if (!voucherCode.trim()) return;
    setVoucherLoading(true);
    try {
      const { subtotal } = calculateTotal();
      const res = await fetch("/api/vouchers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "validate",
          code: voucherCode.trim(),
          totalAmount: subtotal,
          customerId:
            selectedCustomer !== "walking-customer"
              ? selectedCustomer
              : undefined,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setVoucherApplied(data.data);
        setVoucherCode("");
      } else {
        alert(data.error || "Voucher tidak valid");
      }
    } catch {
      alert("Gagal memvalidasi voucher");
    } finally {
      setVoucherLoading(false);
    }
  };

  const removeVoucher = () => {
    setVoucherApplied(null);
    setVoucherCode("");
  };

  const fetchResources = async () => {
    setLoading(true);
    try {
      const [
        serviceRes,
        productRes,
        packageRes,
        bundleRes,
        customerRes,
        staffRes,
      ] = await Promise.all([
        fetch("/api/services?limit=1000"),
        fetch("/api/products?limit=1000"),
        fetch("/api/service-packages?active=true"),
        fetch("/api/service-bundles"),
        fetch("/api/customers?limit=1000"),
        fetch("/api/staff?limit=1000"),
      ]);

      const sData = await serviceRes.json();
      const pData = await productRes.json();
      const pkgData = await packageRes.json();
      const bData = await bundleRes.json();
      const cData = await customerRes.json();
      const stData = await staffRes.json();

      if (sData.success) {
        setServices(
          (sData.data || []).map((s: Item) => ({ ...s, type: "Service" })),
        );
      }
      if (pData.success) {
        setProducts(
          (pData.data || []).map((p: Item) => ({ ...p, type: "Product" })),
        );
      }
      if (pkgData.success) {
        setPackages(
          (pkgData.data || []).map((pkg: Item) => ({
            ...pkg,
            type: "Package",
          })),
        );
      }
      if (bData.success) {
        setServiceBundles(
          (bData.data || []).map((b: any) => ({
            _id: b._id,
            name: b.name,
            price: b.price,
            image: b.image,
            type: "Bundle" as const,
            bundleServices: b.services,
          })),
        );
      }
      if (cData.success) {
        setCustomers(cData.data);
      }
      if (stData.success) {
        setStaffList(stData.data);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const filteredItems = (
    activeTab === "all"
      ? [...services, ...serviceBundles, ...products, ...packages]
      : activeTab === "services"
        ? services
        : activeTab === "products"
          ? products
          : activeTab === "bundles"
            ? serviceBundles
            : packages
  ).filter((item) => item.name.toLowerCase().includes(search.toLowerCase()));

  const getCartItemKey = (itemId: string, type: string, bundleIndex?: number) => bundleIndex !== undefined ? `${type}:${itemId}-${bundleIndex}` : `${type}:${itemId}`;

  const isPremiumActive = () => {
    if (!selectedCustomer || selectedCustomer === "walking-customer") return false;
    const c = customers.find((x) => x._id === selectedCustomer);
    if (!c) return false;
    return (
      c.membershipTier === "premium" &&
      !!c.membershipExpiry &&
      new Date(c.membershipExpiry) > new Date()
    );
  };

  const isIncludedInMembership = (item: Item) => {
    const s = settings as any;
    if (item.type === "Service" && s.memberIncludedServices?.includes(item._id)) return true;
    if (item.type === "Product" && s.memberIncludedProducts?.includes(item._id)) return true;
    if (item.type === "Bundle" && s.memberIncludedBundles?.includes(item._id)) return true;
    return false;
  };

  const getEffectivePrice = (item: Item) => {
    if (isPremiumActive()) {
      if (isIncludedInMembership(item)) {
        if (item.memberPrice !== undefined && item.memberPrice > 0) {
          return item.memberPrice;
        }

        const s = settings as any;
        const discType = s.memberDiscountType || "percentage";
        const discVal = Number(s.memberDiscountValue) || 0;

        if (discVal > 0) {
          if (discType === "percentage") {
            const discAmount = (item.price * discVal) / 100;
            return Math.max(0, item.price - discAmount);
          } else {
            return Math.max(0, item.price - discVal);
          }
        }
      }
    }
    return item.price;
  };

  const roundTwo = (value: number) => Math.round(value * 100) / 100;

  const SPLIT_TOLERANCE = 0.01;

  const getEqualSplitPercentages = (count: number): number[] => {
    if (count <= 0) return [];
    const base = Math.floor((100 / count) * 100) / 100;
    const values = Array.from({ length: count }, () => base);
    const currentTotal = values.reduce((sum, val) => sum + val, 0);
    values[count - 1] = roundTwo(values[count - 1] + (100 - currentTotal));
    return values;
  };

  const dedupeAssignments = (assignments: StaffAssignment[]) => {
    const seen = new Set<string>();
    return assignments.filter((assignment) => {
      if (!assignment.staffId || seen.has(assignment.staffId)) return false;
      seen.add(assignment.staffId);
      return true;
    });
  };

  const getTotalSplitPercentage = (assignments: StaffAssignment[]) => {
    return assignments.reduce(
      (sum, assignment) => sum + (Number(assignment.percentage) || 0),
      0,
    );
  };

  const isSplitTotalValid = (assignments: StaffAssignment[]) => {
    return (
      Math.abs(getTotalSplitPercentage(assignments) - 100) <= SPLIT_TOLERANCE
    );
  };

  const getEffectiveServiceAssignments = (
    itemId: string,
    type: string,
    bundleIndex?: number,
  ): StaffAssignment[] => {
    const key = getCartItemKey(itemId, type, bundleIndex);
    const splitMode = serviceSplitModes[key] || "auto";
    const deduped = dedupeAssignments(serviceStaffAssignments[key] || []);

    if (splitMode === "auto") {
      const percentages = getEqualSplitPercentages(deduped.length);
      return deduped.map((assignment, idx) => ({
        ...assignment,
        percentage: percentages[idx] || 0,
      }));
    }

    return deduped.map((assignment) => ({
      ...assignment,
      percentage: Number(assignment.percentage) || 0,
    }));
  };

  const addToCart = (item: Item) => {
    if (item.type === "Package") {
      if (cart.some((i) => i.type !== "Package")) {
        alert(
          "Penjualan paket harus diproses terpisah dari service/product. Selesaikan atau kosongkan cart dulu.",
        );
        return;
      }
    }

    if (item.type !== "Package" && cart.some((i) => i.type === "Package")) {
      alert(
        "Cart berisi paket. Selesaikan dulu transaksi paket sebelum menambah service/product.",
      );
      return;
    }

    setCart((prev) => {
      const existing = prev.find(
        (i) => i._id === item._id && i.type === item.type,
      );
      if (existing) {
        return prev.map((i) =>
          i._id === item._id && i.type === item.type
            ? { ...i, quantity: i.quantity + 1 }
            : i,
        );
      }
      return [...prev, { ...item, quantity: 1 }];
    });
    if (item.type === "Service") {
      const key = getCartItemKey(item._id, item.type);
      setServiceStaffAssignments((prev) => prev[key] ? prev : { ...prev, [key]: [] });
      setServiceSplitModes((prev) => prev[key] ? prev : { ...prev, [key]: "auto" });
    } else if (item.type === "Bundle" && item.bundleServices) {
      const newStaffAssignments: any = {};
      const newSplitModes: any = {};
      item.bundleServices.forEach((bs, i) => {
        const key = getCartItemKey(item._id, item.type, i);
        newStaffAssignments[key] = [];
        newSplitModes[key] = "auto";
      });
      setServiceStaffAssignments((prev) => ({ ...prev, ...newStaffAssignments }));
      setServiceSplitModes((prev) => ({ ...prev, ...newSplitModes }));
    }
  };

  const addTopUpToCart = () => {
    const amount = Number(topupAmount);
    if (!amount || amount <= 0) {
      alert("Masukkan nominal top-up yang valid");
      return;
    }
    if (!selectedCustomer || selectedCustomer === "walking-customer") {
      alert("Pilih customer terdaftar untuk top-up wallet");
      return;
    }
    // Check if there's already a TopUp item – replace it
    setCart((prev) => {
      const withoutOldTopup = prev.filter((i) => i.type !== "TopUp");
      const topUpItem: CartItem = {
        _id: `topup-${Date.now()}`,
        name: `Top-Up Saldo Wallet`,
        price: amount,
        type: "TopUp",
        quantity: 1,
      };
      return [...withoutOldTopup, topUpItem];
    });
    setTopupAmount("");
    setActiveTab("all");
    if (typeof window !== "undefined" && window.innerWidth < 768) {
      setMobileTab("cart");
    }
  };

  const removeFromCart = (itemId: string, type: string) => {
    setCart((prev) =>
      prev.filter((i) => !(i._id === itemId && i.type === type)),
    );
    if (type === "Service") {
      const key = getCartItemKey(itemId, type);
      setServiceStaffAssignments((prev) => { const rest = { ...prev }; delete rest[key]; return rest; });
      setServiceSplitModes((prev) => { const rest = { ...prev }; delete rest[key]; return rest; });
      setPackageClaims((prev) => { const rest = { ...prev }; delete rest[key]; return rest; });
    } else if (type === "Bundle") {
      const item = cart.find(i => i._id === itemId && i.type === type);
      if (item && item.bundleServices) {
        setServiceStaffAssignments((prev) => {
          const rest = { ...prev };
          item.bundleServices!.forEach((bs, i) => delete rest[getCartItemKey(itemId, type, i)]);
          return rest;
        });
        setServiceSplitModes((prev) => {
          const rest = { ...prev };
          item.bundleServices!.forEach((bs, i) => delete rest[getCartItemKey(itemId, type, i)]);
          return rest;
        });
      }
    }
  };

  const updateQuantity = (itemId: string, type: string, delta: number) => {
    setCart((prev) =>
      prev.map((i) => {
        if (i._id === itemId && i.type === type) {
          if (type === "Package") {
            return i;
          }
          const newQty = Math.max(1, i.quantity + delta);
          return { ...i, quantity: newQty };
        }
        return i;
      }),
    );
  };

  const addServiceStaffAssignment = (
    itemId: string,
    type: string,
    staffId: string,
    bundleIndex?: number,
  ) => {
    const key = getCartItemKey(itemId, type, bundleIndex);
    const current = serviceStaffAssignments[key] || [];
    if (current.find((a) => a.staffId === staffId)) return;
    const splitMode = serviceSplitModes[key] || "auto";

    const nextAssignments = [
      ...current,
      {
        staffId,
        percentage: 0,
      },
    ];

    const effectiveAssignments =
      splitMode === "auto"
        ? nextAssignments.map((assignment, idx) => ({
          ...assignment,
          percentage:
            getEqualSplitPercentages(nextAssignments.length)[idx] || 0,
        }))
        : nextAssignments;

    setServiceStaffAssignments((prev) => ({
      ...prev,
      [key]: effectiveAssignments,
    }));
  };

  const removeServiceStaffAssignment = (
    itemId: string,
    type: string,
    staffId: string,
    bundleIndex?: number,
  ) => {
    const key = getCartItemKey(itemId, type, bundleIndex);
    const splitMode = serviceSplitModes[key] || "auto";

    setServiceStaffAssignments((prev) => ({
      ...prev,
      [key]: (() => {
        const filtered = (prev[key] || []).filter((a) => a.staffId !== staffId);
        if (splitMode !== "auto") return filtered;

        const percentages = getEqualSplitPercentages(filtered.length);
        return filtered.map((assignment, idx) => ({
          ...assignment,
          percentage: percentages[idx] || 0,
        }));
      })(),
    }));
  };

  const updateServiceStaffPercentage = (
    itemId: string,
    type: string,
    staffId: string,
    percentage: number,
    bundleIndex?: number,
  ) => {
    const key = getCartItemKey(itemId, type, bundleIndex);
    const splitMode = serviceSplitModes[key] || "auto";
    if (splitMode === "auto") return;

    setServiceStaffAssignments((prev) => ({
      ...prev,
      [key]: (prev[key] || []).map((a) =>
        a.staffId === staffId
          ? { ...a, percentage: Math.max(0, percentage) }
          : a,
      ),
    }));
  };

  const updateServiceSplitMode = (
    itemId: string,
    type: string,
    mode: SplitMode,
    bundleIndex?: number,
  ) => {
    const key = getCartItemKey(itemId, type, bundleIndex);

    setServiceSplitModes((prev) => ({
      ...prev,
      [key]: mode,
    }));

    setServiceStaffAssignments((prev) => {
      const current = prev[key] || [];
      if (mode !== "auto") {
        return {
          ...prev,
          [key]: current,
        };
      }

      const percentages = getEqualSplitPercentages(current.length);
      return {
        ...prev,
        [key]: current.map((assignment, idx) => ({
          ...assignment,
          percentage: percentages[idx] || 0,
        })),
      };
    });
  };

  const togglePackageClaim = (
    itemId: string,
    type: string,
    enabled: boolean,
  ) => {
    const key = getCartItemKey(itemId, type);
    setPackageClaims((prev) => {
      const current = prev[key] || { enabled: false, customerPackageId: "" };
      return {
        ...prev,
        [key]: {
          ...current,
          enabled,
        },
      };
    });
  };

  const getAvailableDeals = (): CustomerDealOption[] => {
    return customerPackages
      .filter((pkg) => pkg.status === "active")
      .flatMap((pkg) => {
        return (pkg.serviceQuotas || [])
          .filter((quota) => Number(quota.remainingQuota) > 0)
          .map((quota) => ({
            customerPackageId: pkg._id,
            packageName: pkg.packageName,
            packageCode: pkg.package?.code,
            serviceId: String(quota.service),
            serviceName: quota.serviceName,
            remainingQuota: Number(quota.remainingQuota || 0),
            totalQuota: Number(quota.totalQuota || 0),
            expiresAt: pkg.expiresAt,
          }));
      });
  };

  const addDealToCart = (deal: CustomerDealOption) => {
    if (!selectedCustomer || selectedCustomer === "walking-customer") {
      alert("Pilih customer terdaftar dulu untuk menggunakan paket.");
      return;
    }

    const service = services.find((entry) => entry._id === deal.serviceId);
    if (!service) {
      alert("Service untuk paket ini tidak ditemukan di master service.");
      return;
    }

    const key = getCartItemKey(service._id, "Service");
    const existing = cart.find(
      (entry) => entry._id === service._id && entry.type === "Service",
    );
    const existingClaim = packageClaims[key];

    if (
      existing &&
      (!existingClaim?.enabled ||
        existingClaim.customerPackageId !== deal.customerPackageId)
    ) {
      alert(
        `Service "${service.name}" sudah ada di cart tanpa claim paket yang sama. Hapus dulu item lama atau gunakan claim dari item yang sudah ada.`,
      );
      return;
    }

    addToCart(service);
    setPackageClaimId(service._id, "Service", deal.customerPackageId);
    setIsDealsModalOpen(false);
    setToastMessage("Berhasil menambahkan produk!");
  };

  const setPackageClaimId = (
    itemId: string,
    type: string,
    customerPackageId: string,
  ) => {
    const key = getCartItemKey(itemId, type);
    setPackageClaims((prev) => ({
      ...prev,
      [key]: {
        enabled: true,
        customerPackageId,
      },
    }));
  };

  const getServicePackageOptions = (serviceId: string) => {
    return customerPackages
      .filter((pkg) => pkg.status === "active")
      .map((pkg) => {
        const quota = pkg.serviceQuotas.find(
          (q) => String(q.service) === String(serviceId),
        );
        return { pkg, quota };
      })
      .filter((entry) => entry.quota && Number(entry.quota.remainingQuota) > 0)
      .map((entry) => ({
        value: entry.pkg._id,
        label: `${entry.pkg.packageName} (Sisa: ${entry.quota?.remainingQuota ?? 0})`,
      }));
  };

  const getStaffRate = (staffId: string) => {
    const staff = staffList.find((s) => s._id === staffId);
    return Number(staff?.commissionRate || 0);
  };

  const getSplitCommissionPreviewForItem = (item: CartItem) => {
    const key = getCartItemKey(item._id, item.type);
    const splitMode = serviceSplitModes[key] || "auto";
    const claim = packageClaims[key];
    const sourceType =
      claim?.enabled && claim.customerPackageId
        ? "package_redeem"
        : "normal_sale";

    return calculateSplitCommission({
      splitMode,
      assignments: getEffectiveServiceAssignments(item._id, item.type).map(
        (assignment) => ({
          staffId: assignment.staffId,
          percentage: assignment.percentage,
          staffCommissionRate: getStaffRate(assignment.staffId),
        }),
      ),
      servicePrice: getEffectivePrice(item),
      quantity: item.quantity,
      commissionType: item.commissionType || "fixed",
      commissionValue: Number(item.commissionValue || 0),
      sourceType,
    });
  };

  const calculateTotal = () => {
    const subtotal = cart.reduce(
      (sum, item) => sum + getEffectivePrice(item) * item.quantity,
      0,
    );
    const payableSubtotal = cart.reduce((sum, item) => {
      if (item.type !== "Service") return sum + getEffectivePrice(item) * item.quantity;

      const key = getCartItemKey(item._id, item.type);
      const claim = packageClaims[key];
      if (claim?.enabled && claim.customerPackageId) return sum;

      return sum + getEffectivePrice(item) * item.quantity;
    }, 0);

    // Voucher discount
    const voucherDiscount = voucherApplied?.discountAmount || 0;
    // Loyalty point discount: 1 point = settings.loyaltyPointValue currency units
    const loyaltyDiscount = Math.min(loyaltyPointsToRedeem * (settings.loyaltyPointValue || 1), payableSubtotal);

    // Referral discount
    let referralDiscount = 0;
    if (referralValidated) {
      if (settings.referralDiscountType === "percentage") {
        referralDiscount = (payableSubtotal * (settings.referralDiscountValue || 0)) / 100;
      } else {
        referralDiscount = settings.referralDiscountValue || 0;
      }
    }
    referralDiscount = Math.min(referralDiscount, payableSubtotal);

    // Discount flat vs percentage
    const effectiveDiscount = discountType === "percentage" ? (payableSubtotal * discount) / 100 : discount;

    const taxableAmount = Math.max(
      0,
      payableSubtotal - effectiveDiscount - voucherDiscount - loyaltyDiscount - referralDiscount,
    );
    const tax = taxableAmount * (settings.taxRate / 100);

    // Sum all tips from staffTips state
    const totalTips = Object.values(staffTips).reduce(
      (sum, tip) => sum + (Number(tip) || 0),
      0,
    );
    const total = taxableAmount + tax + totalTips;

    let totalCommission = 0;
    const perStaff: Record<
      string,
      { staffId: string; commission: number; tip: number }
    > = {};
    const lineItemSplits: Record<
      string,
      {
        splitCommissionMode: SplitMode;
        staffAssignments: {
          staffId: string;
          percentage: number;
          porsiPersen: number;
          commission: number;
          komisiNominal: number;
          tip: number;
        }[];
      }
    > = {};
    const redeemItems: {
      customerPackageId: string;
      serviceId: string;
      quantity: number;
      serviceName: string;
    }[] = [];

    cart.forEach((item) => {
      if (item.type !== "Service") return;
      const key = getCartItemKey(item._id, item.type);
      const splitCommissionMode = serviceSplitModes[key] || "auto";
      const serviceAssignments = getEffectiveServiceAssignments(
        item._id,
        item.type,
      );
      const serviceLineAssignments: {
        staffId: string;
        percentage: number;
        porsiPersen: number;
        commission: number;
        komisiNominal: number;
        tip: number;
      }[] = [];

      const claim = packageClaims[key];
      if (claim?.enabled && claim.customerPackageId) {
        redeemItems.push({
          customerPackageId: claim.customerPackageId,
          serviceId: item._id,
          quantity: item.quantity,
          serviceName: item.name,
        });
      }

      if (serviceAssignments.length === 0) {
        lineItemSplits[key] = {
          splitCommissionMode,
          staffAssignments: [],
        };
        return;
      }

      const splitResult = calculateSplitCommission({
        splitMode: splitCommissionMode,
        assignments: serviceAssignments.map((assignment) => ({
          staffId: assignment.staffId,
          percentage: assignment.percentage,
          staffCommissionRate: getStaffRate(assignment.staffId),
        })),
        servicePrice: getEffectivePrice(item),
        quantity: item.quantity,
        commissionType: item.commissionType || "fixed",
        commissionValue: Number(item.commissionValue || 0),
        sourceType:
          claim?.enabled && claim.customerPackageId
            ? "package_redeem"
            : "normal_sale",
      });

      if (!splitResult.isValid) {
        lineItemSplits[key] = {
          splitCommissionMode,
          staffAssignments: [],
        };
        return;
      }

      totalCommission += splitResult.totalCommission;

      splitResult.assignments.forEach((assignment) => {
        if (!perStaff[assignment.staffId]) {
          perStaff[assignment.staffId] = {
            staffId: assignment.staffId,
            commission: 0,
            tip: 0,
          };
        }
        perStaff[assignment.staffId].commission += assignment.komisiNominal;

        serviceLineAssignments.push({
          staffId: assignment.staffId,
          percentage: assignment.percentage,
          porsiPersen: assignment.porsiPersen,
          commission: assignment.komisiNominal,
          komisiNominal: assignment.komisiNominal,
          tip: 0,
        });
      });

      lineItemSplits[key] = {
        splitCommissionMode,
        staffAssignments: serviceLineAssignments,
      };
    });

    // Bundle commission — processing internal service splits
    cart.forEach((item) => {
      if (item.type !== "Bundle" || !item.bundleServices) return;
      const totalOriginalPrice = item.bundleServices.reduce((sum, bs) => sum + bs.servicePrice, 0);

      item.bundleServices.forEach((bs, i) => {
        const bsKey = getCartItemKey(item._id, item.type, i);
        const splitCommissionMode = serviceSplitModes[bsKey] || "auto";
        const serviceAssignments = getEffectiveServiceAssignments(item._id, item.type, i);
        const serviceLineAssignments: any[] = [];
        
        const proportion = totalOriginalPrice > 0 ? bs.servicePrice / totalOriginalPrice : 1 / item.bundleServices!.length;
        const subItemPrice = Math.round(getEffectivePrice(item) * proportion);

        if (serviceAssignments.length === 0) {
          lineItemSplits[bsKey] = { splitCommissionMode, staffAssignments: [] };
          return;
        }

        const splitResult = calculateSplitCommission({
          splitMode: splitCommissionMode,
          assignments: serviceAssignments.map((assignment) => ({
            staffId: assignment.staffId,
            percentage: assignment.percentage,
            staffCommissionRate: getStaffRate(assignment.staffId),
          })),
          servicePrice: subItemPrice,
          quantity: item.quantity,
          commissionType: (bs.commissionType as "fixed" | "percentage") || "fixed",
          commissionValue: Number(bs.commissionValue || 0),
          sourceType: "normal_sale",
        });

        if (!splitResult.isValid) {
          lineItemSplits[bsKey] = { splitCommissionMode, staffAssignments: [] };
          return;
        }

        totalCommission += splitResult.totalCommission;

        splitResult.assignments.forEach((assignment) => {
          if (!perStaff[assignment.staffId]) {
            perStaff[assignment.staffId] = { staffId: assignment.staffId, commission: 0, tip: 0 };
          }
          perStaff[assignment.staffId].commission += assignment.komisiNominal;

          serviceLineAssignments.push({
            staffId: assignment.staffId,
            percentage: assignment.percentage,
            porsiPersen: assignment.porsiPersen,
            commission: assignment.komisiNominal,
            komisiNominal: assignment.komisiNominal,
            tip: 0,
          });
        });

        lineItemSplits[bsKey] = {
          splitCommissionMode,
          staffAssignments: serviceLineAssignments,
        };
      });
    });

    // Product & Package commission — single staff, no split
    cart.forEach((item) => {
      if (item.type !== "Product" && item.type !== "Package") return;
      if (!item.commissionValue || Number(item.commissionValue) <= 0) return;

      const key = getCartItemKey(item._id, item.type);
      const productStaffArr = serviceStaffAssignments[key];
      if (!productStaffArr || productStaffArr.length === 0) return;

      const staffId = productStaffArr[0].staffId;
      const commissionType = item.commissionType || "fixed";
      const commissionValue = Number(item.commissionValue || 0);
      const qty = item.quantity;

      let komisi = 0;
      if (commissionType === "percentage") {
        komisi = getEffectivePrice(item) * qty * (commissionValue / 100);
      } else {
        komisi = commissionValue * qty;
      }

      totalCommission += komisi;

      if (!perStaff[staffId]) {
        perStaff[staffId] = { staffId, commission: 0, tip: 0 };
      }
      perStaff[staffId].commission += komisi;

      lineItemSplits[key] = {
        splitCommissionMode: "auto",
        staffAssignments: [
          {
            staffId,
            percentage: 100,
            porsiPersen: 100,
            commission: komisi,
            komisiNominal: komisi,
            tip: 0,
          },
        ],
      };
    });

    // Add tips from staffTips state to the aggregated perStaff records
    Object.entries(staffTips).forEach(([staffId, tip]) => {
      if (tip > 0) {
        if (!perStaff[staffId]) {
          perStaff[staffId] = { staffId, commission: 0, tip: 0 };
        }
        perStaff[staffId].tip = tip;
      }
    });

    const perStaffValues = Object.values(perStaff);
    const fallbackPercentages = getEqualSplitPercentages(perStaffValues.length);
    const updatedAssignments = perStaffValues.map((assignment, index) => {
      const percentage =
        totalCommission > 0
          ? (assignment.commission / totalCommission) * 100
          : fallbackPercentages[index] || 0;

      return {
        staffId: assignment.staffId,
        percentage,
        porsiPersen: percentage,
        commission: assignment.commission,
        komisiNominal: assignment.commission,
        tip: assignment.tip,
      };
    });

    const maxWalletAllowedSubtotal = cart.reduce((sum, item) => {
      if (item.type === "Service" && packageClaims[getCartItemKey(item._id, item.type)]?.enabled) return sum;
      let isAllowed = false;
      if (item.type === "Service" && settings.walletIncludedServices?.includes(item._id)) isAllowed = true;
      if (item.type === "Product" && settings.walletIncludedProducts?.includes(item._id)) isAllowed = true;
      if (item.type === "Bundle" && settings.walletIncludedBundles?.includes(item._id)) isAllowed = true;
      if (isAllowed) return sum + getEffectivePrice(item) * item.quantity;
      return sum;
    }, 0);
    const maxWalletPaymentAllowed = Math.min(total, maxWalletAllowedSubtotal * (1 + (settings.taxRate / 100)));

    return {
      subtotal,
      payableSubtotal,
      tax,
      total,
      tips: totalTips,
      commission: totalCommission,
      assignments: updatedAssignments,
      lineItemSplits,
      redeemItems,
      referralDiscount,
      effectiveDiscount,
      maxWalletPaymentAllowed
    };
  };

  const handleCheckout = async (nonQrisPaid?: boolean) => {
    if (submitting) return;
    if (referralCode.trim() && !referralValidated && isFirstTimer) {
      alert("Peringatan: Anda mengisi Kode Referral tetapi belum divalidasi. Klik tombol 'Cek Kode' terlebih dahulu.");
      return;
    }
    if (!selectedCustomer) {
      alert("Please select a customer");
      return;
    }
    if (cart.length === 0) {
      alert("Cart is empty");
      return;
    }
    const serviceItems = cart.filter((item) => item.type === "Service");
    const hasFollowUpService = serviceItems.some((item) =>
      Boolean(item.waFollowUp?.enabled),
    );
    const packageItems = cart.filter((item) => item.type === "Package");

    if (hasFollowUpService) {
      if (
        selectedCustomer === "walking-customer" &&
        !followUpPhoneNumber.trim()
      ) {
        alert(
          "Nomor WA follow-up wajib diisi untuk Walking Customer yang mengambil service follow-up",
        );
        return;
      }

      if (
        selectedCustomer !== "walking-customer" &&
        !followUpPhoneNumber.trim()
      ) {
        alert(
          "Customer belum punya nomor telepon. Lengkapi nomor di master customer dulu.",
        );
        return;
      }
    }

    if (!isQrisOnly && nonQrisPaid === undefined) {
      setIsNonQrisConfirmOpen(true);
      return;
    }

    const isMarkedPaid = nonQrisPaid ?? false;
    // For split payment: use sum of all entries; for single: use that entry's amount
    const parsedAmountPaid =
      totalSplitPaidComputed > 0 ? totalSplitPaidComputed : total;
    const normalizedAmountPaid = Number.isFinite(parsedAmountPaid)
      ? parsedAmountPaid
      : 0;

    if (!isQrisOnly && isMarkedPaid) {
      // Validate empty method
      if (splitPayments.some((p) => !p.method || p.method === "Pilih Metode..." || p.method.trim() === "")) {
        alert("Harap pilih metode pembayaran yang valid.");
        return;
      }

      // Validate manual discount reason
      if (effectiveDiscount > 0 && !discountReason.trim()) {
        alert("Alasan diskon manual wajib diisi!");
        return;
      }

      // Validate 0 amount
      if (splitPayments.length === 1 && totalSplitPaidComputed === 0 && total > 0) {
        alert("Harap isi nominal bayar atau klik tombol 'Isi Pas'.");
        return;
      }
      // Split payment: all entries must sum to total (within Rp 1 tolerance)
      if (
        splitPayments.length > 1 &&
        Math.abs(totalSplitPaidComputed - total) >= 1
      ) {
        alert(
          `Total split pembayaran (${settings.symbol}${totalSplitPaidComputed.toLocaleString("id-ID", { maximumFractionDigits: 0 })}) tidak sesuai dengan total transaksi (${settings.symbol}${total.toLocaleString("id-ID", { maximumFractionDigits: 0 })}). Sesuaikan jumlah tiap metode pembayaran.`,
        );
        return;
      }
      // Single payment: entered amount must be >= total (or empty = pay full)
      if (
        splitPayments.length === 1 &&
        totalSplitPaidComputed > 0 &&
        totalSplitPaidComputed < total
      ) {
        alert(
          `Nominal bayar kurang. Total ${settings.symbol}${total.toLocaleString("id-ID", { maximumFractionDigits: 0 })}. Pilih "Belum Dibayar" jika transaksi belum lunas.`,
        );
        return;
      }
    }

    if (packageItems.length > 0) {
      for (const packageItem of packageItems) {
        if (Number(packageItem.quantity || 0) < 1) {
          alert(`Quantity paket "${packageItem.name}" tidak valid.`);
          return;
        }
      }
    }
    for (const item of cart.filter(i => i.type === "Service" || i.type === "Bundle")) {
      if (item.type === "Bundle" && item.bundleServices) {
        const totalOriginalPrice = item.bundleServices.reduce((s, bs) => s + bs.servicePrice, 0);
        for (let i = 0; i < item.bundleServices.length; i++) {
          const bs = item.bundleServices[i];
          const bsKey = getCartItemKey(item._id, item.type, i);
          const rawAssignments = serviceStaffAssignments[bsKey] || [];
          const itemAssignments = getEffectiveServiceAssignments(item._id, item.type, i);
          const splitMode = serviceSplitModes[bsKey] || "auto";
          const commissionType = bs.commissionType || "fixed";
          const commissionValue = Number(bs.commissionValue || 0);

          if (commissionType === "fixed" && commissionValue <= 0) {
            alert(`Komisi service "${bs.serviceName}" dalam bundle "${item.name}" belum diisi. Isi Komisi Nominal lebih dari 0 terlebih dahulu di Master.`);
            return;
          }

          if (commissionType === "percentage" && commissionValue <= 0) {
            alert(`Komisi service "${bs.serviceName}" dalam bundle "${item.name}" belum diisi. Isi Komisi Persentase lebih dari 0 terlebih dahulu di Master.`);
            return;
          }

          if (itemAssignments.length === 0) {
            alert(`Please assign at least 1 staff for service "${bs.serviceName}" in bundle "${item.name}"`);
            return;
          }

          const ids = rawAssignments.map((assignment) => assignment.staffId);
          if (ids.length !== new Set(ids).size) {
            alert(`Duplicate staff found in service "${bs.serviceName}" split across "${item.name}"`);
            return;
          }

          const proportion = totalOriginalPrice > 0 ? bs.servicePrice / totalOriginalPrice : 1 / item.bundleServices.length;
          const itemPrice = Math.round(item.price * proportion);

          const splitResult = calculateSplitCommission({
            splitMode,
            assignments: itemAssignments.map((assignment) => ({
              staffId: assignment.staffId,
              percentage: assignment.percentage,
              staffCommissionRate: getStaffRate(assignment.staffId),
            })),
            servicePrice: itemPrice,
            quantity: item.quantity,
            commissionType: (commissionType as "fixed" | "percentage"),
            commissionValue,
            sourceType: "normal_sale",
          });

          if (!splitResult.isValid) {
            alert(`${bs.serviceName} in ${item.name}: ${splitResult.errors[0] || "Split komisi tidak valid"}`);
            return;
          }
        }
        continue;
      }

      const key = getCartItemKey(item._id, item.type);
      const rawAssignments = serviceStaffAssignments[key] || [];
      const itemAssignments = getEffectiveServiceAssignments(
        item._id,
        item.type,
      );
      const splitMode = serviceSplitModes[key] || "auto";
      const commissionType = item.commissionType || "fixed";
      const commissionValue = Number(item.commissionValue || 0);

      if (commissionType === "fixed" && commissionValue <= 0) {
        alert(
          `Komisi service "${item.name}" belum diisi. Isi Komisi Nominal lebih dari 0 terlebih dahulu.`,
        );
        return;
      }

      if (commissionType === "percentage" && commissionValue <= 0) {
        alert(
          `Komisi service "${item.name}" belum diisi. Isi Komisi Persentase lebih dari 0 terlebih dahulu.`,
        );
        return;
      }

      if (itemAssignments.length === 0) {
        alert(`Please assign at least 1 staff for service "${item.name}"`);
        return;
      }

      const ids = rawAssignments.map((assignment) => assignment.staffId);
      if (ids.length !== new Set(ids).size) {
        alert(`Duplicate staff found in service "${item.name}" split`);
        return;
      }

      const splitResult = calculateSplitCommission({
        splitMode,
        assignments: itemAssignments.map((assignment) => ({
          staffId: assignment.staffId,
          percentage: assignment.percentage,
          staffCommissionRate: getStaffRate(assignment.staffId),
        })),
        servicePrice: item.price,
        quantity: item.quantity,
        commissionType,
        commissionValue,
        sourceType: packageClaims[key]?.enabled
          ? "package_redeem"
          : "normal_sale",
      });

      if (!splitResult.isValid) {
        alert(
          `${item.name}: ${splitResult.errors[0] || "Split komisi tidak valid"}`,
        );
        return;
      }

      const claim = packageClaims[key];
      if (claim?.enabled) {
        if (!selectedCustomer || selectedCustomer === "walking-customer") {
          alert("Package claim requires a registered customer");
          return;
        }

        if (!claim.customerPackageId) {
          alert(`Please select package source for service "${item.name}"`);
          return;
        }

        const pkg = customerPackages.find(
          (p) => p._id === claim.customerPackageId,
        );
        const quota = pkg?.serviceQuotas.find(
          (q) => String(q.service) === String(item._id),
        );
        if (
          !quota ||
          Number(quota.remainingQuota) < Number(item.quantity || 0)
        ) {
          alert(`Insufficient quota for service "${item.name}"`);
          return;
        }
      }
    }

    setSubmitting(true);
    try {
      if (packageItems.length > 0) {
        const customerId =
          selectedCustomer === "walking-customer"
            ? undefined
            : selectedCustomer;

        if (!customerId) {
          alert("Pembelian paket wajib pilih customer terdaftar.");
          return;
        }

        const expandedPackageItems = packageItems.flatMap((item) => {
          const qty = Math.max(1, Number(item.quantity || 1));
          return Array.from({ length: qty }, () => item);
        });

        if (paymentMethod === "QRIS" && expandedPackageItems.length > 1) {
          alert(
            "QRIS untuk multi paket belum didukung dalam satu checkout. Gunakan Cash/Card/Transfer atau proses QRIS satu paket per transaksi.",
          );
          return;
        }

        const createdPayments: Array<{
          sourceId: string;
          amount: number;
          customer: string;
          description: string;
        }> = [];

        for (const packageItem of expandedPackageItems) {
          const orderRes = await fetch("/api/package-orders", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              customerId,
              packageId: packageItem._id,
            }),
          });

          const orderData = await orderRes.json();
          if (!orderData.success || !orderData.data?.payment) {
            alert(orderData.error || "Gagal membuat order paket");
            return;
          }

          createdPayments.push(orderData.data.payment);
        }

        if (paymentMethod === "QRIS") {
          const payment = createdPayments[0];
          const qrisRes = await fetch("/api/payments/xendit/create-invoice", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              sourceType: "package_order",
              sourceId: payment.sourceId,
              amount: payment.amount,
              customer: payment.customer,
              description: payment.description,
            }),
          });

          const qrisData = (await qrisRes.json()) as QrisCreateResponse;
          if (!qrisData.success || !qrisData.data) {
            alert(qrisData.error || "Gagal membuat pembayaran QRIS paket");
            return;
          }

          setCart([]);
          setDiscount(0);
          setDiscountReason("");
          setStaffTips({});
          setSelectedCustomer("");
          setServiceStaffAssignments({});
          setServiceSplitModes({});
          setPackageClaims({});
          setSplitPayments([{ method: "", amount: "" }]);
          setQrisSession({
            externalId: qrisData.data.externalId,
            checkoutUrl: qrisData.data.checkoutUrl,
            invoiceId: "",
            status: qrisData.data.status || "pending",
            sourceType: "package_order",
          });
          setIsQrisModalOpen(true);
          return;
        }

        if (isMarkedPaid) {
          let lastInvoiceId: string | null = null;

          for (const payment of createdPayments) {
            const markPaidRes = await fetch(
              `/api/package-orders/${payment.sourceId}`,
              {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  paid: true,
                  paymentMethod,
                }),
              },
            );

            const markPaidData = await markPaidRes.json();
            if (!markPaidData.success) {
              alert(markPaidData.error || "Gagal konfirmasi pembayaran paket");
              return;
            }

            // Capture the invoice ID for receipt redirect
            if (markPaidData.invoice?._id) {
              lastInvoiceId = markPaidData.invoice._id;
            }
          }

          setCart([]);
          setDiscount(0);
          setDiscountReason("");
          setStaffTips({});
          setSelectedCustomer("");
          setFollowUpPhoneNumber("");
          setServiceStaffAssignments({});
          setServiceSplitModes({});
          setPackageClaims({});
          setSplitPayments([{ method: "", amount: "" }]);

          // Redirect to receipt if invoice was created
          if (lastInvoiceId) {
            router.push(`/invoices/print/${lastInvoiceId}`);
          } else {
            alert(
              `Pembayaran ${createdPayments.length} paket tersimpan dan paket customer langsung aktif.`,
            );
          }
        } else {
          alert(
            `Order ${createdPayments.length} paket dibuat sebagai belum dibayar (pending). Paket akan aktif setelah dilunasi.`,
          );

          setCart([]);
          setDiscount(0);
          setDiscountReason("");
          setStaffTips({});
          setSelectedCustomer("");
          setFollowUpPhoneNumber("");
          setServiceStaffAssignments({});
          setServiceSplitModes({});
          setPackageClaims({});
          setSplitPayments([{ method: "", amount: "" }]);
        }
        return;
      }

      const {
        payableSubtotal,
        tax,
        total,
        tips,
        commission,
        assignments,
        lineItemSplits,
        redeemItems,
        referralDiscount,
        effectiveDiscount,
      } = calculateTotal();

      const isQrisPayment = isQrisOnly;
      const paid = isQrisPayment
        ? 0
        : isMarkedPaid
          ? totalSplitPaidComputed > 0
            ? totalSplitPaidComputed
            : total
          : 0;
      const status = isQrisPayment
        ? "pending"
        : isMarkedPaid
          ? paid >= total
            ? "paid"
            : "partially_paid"
          : "pending";

      // Handle walking customer by setting customer to undefined
      const customerId =
        selectedCustomer === "walking-customer" ? undefined : selectedCustomer;

      const payload = {
        customer: customerId,
        appointment: appointmentId || undefined,
        followUpPhoneNumber: followUpPhoneNumber.trim() || undefined,
        items: cart.flatMap((item): any[] => {
          // Expand Bundle into individual Service line items
          if (
            item.type === "Bundle" &&
            item.bundleServices &&
            item.bundleServices.length > 0
          ) {
            const totalOriginalPrice = item.bundleServices.reduce(
              (s, bs) => s + bs.servicePrice,
              0,
            );
            const qty = item.quantity;

            return Array.from({ length: qty }, () =>
              (item.bundleServices || []).map((bs, i) => {
                const bundleKey = getCartItemKey(item._id, item.type, i);
                const splitData = lineItemSplits[bundleKey];
                
                const proportion =
                  totalOriginalPrice > 0
                    ? bs.servicePrice / totalOriginalPrice
                    : 1 / (item.bundleServices?.length || 1);
                const itemPrice = Math.round(item.price * proportion);
                
                const splitMode = splitData?.splitCommissionMode || "auto";
                const assignments = splitData?.staffAssignments || [];

                return {
                  item: bs.service,
                  itemModel: "Service" as const,
                  name: `${bs.serviceName} (Bundle: ${item.name})`,
                  price: itemPrice,
                  quantity: 1,
                  total: itemPrice,
                  splitCommissionMode: splitMode,
                  staffAssignments: assignments.map((a: any) => ({
                    staff: a.staffId,
                    staffId: a.staffId,
                    percentage: a.percentage,
                    porsiPersen: a.percentage,
                    commission: a.commission,
                    komisiNominal: a.commission,
                    tip: 0,
                  })),
                };
              }),
            ).flat();
          }

          // TopUp Wallet items — no staff, no commission
          if (item.type === "TopUp") {
            return [
              {
                itemModel: "TopUp",
                name: item.name,
                price: item.price,
                quantity: 1,
                total: item.price,
              },
            ];
          }

          // Normal Service / Product / Package items
          return [
            {
              ...(item.type === "Service" &&
                packageClaims[getCartItemKey(item._id, item.type)]?.enabled
                ? { metadata: { claimedFromPackage: true } }
                : {}),
              ...(item.type === "Service"
                ? {
                  splitCommissionMode:
                    lineItemSplits[getCartItemKey(item._id, item.type)]
                      ?.splitCommissionMode ||
                    serviceSplitModes[getCartItemKey(item._id, item.type)] ||
                    "auto",
                  staffAssignments: (
                    lineItemSplits[getCartItemKey(item._id, item.type)]
                      ?.staffAssignments || []
                  ).map((assignment) => ({
                    staff: assignment.staffId,
                    staffId: assignment.staffId,
                    percentage: assignment.percentage,
                    porsiPersen: assignment.porsiPersen,
                    commission: assignment.commission,
                    komisiNominal: assignment.komisiNominal,
                    tip: assignment.tip,
                  })),
                }
                : (item.type === "Product" || item.type === "Package") &&
                  (
                    lineItemSplits[getCartItemKey(item._id, item.type)]
                      ?.staffAssignments || []
                  ).length > 0
                  ? {
                    splitCommissionMode: "auto" as const,
                    staffAssignments: (
                      lineItemSplits[getCartItemKey(item._id, item.type)]
                        ?.staffAssignments || []
                    ).map((assignment) => ({
                      staff: assignment.staffId,
                      staffId: assignment.staffId,
                      percentage: 100,
                      porsiPersen: 100,
                      commission: assignment.komisiNominal,
                      komisiNominal: assignment.komisiNominal,
                      tip: 0,
                    })),
                  }
                  : {}),
              item: item._id,
              itemModel: item.type === "Bundle" ? "Service" : item.type,
              name: item.name,
              price: item.price,
              quantity: item.quantity,
              total:
                item.type === "Service" &&
                  packageClaims[getCartItemKey(item._id, item.type)]?.enabled
                  ? 0
                  : item.price * item.quantity,
            },
          ];
        }) as any[],
        subtotal: payableSubtotal,
        tax,
        discount:
          effectiveDiscount +
          (voucherApplied?.discountAmount || 0) +
          referralDiscount +
          Math.min(loyaltyPointsToRedeem * (settings.loyaltyPointValue || 1), payableSubtotal),
        loyaltyPointsUsed: Math.min(loyaltyPointsToRedeem, Math.ceil(payableSubtotal / (settings.loyaltyPointValue || 1))),
        tips,
        totalAmount: total,
        commission,
        sourceType: redeemItems.length === 0 ? "normal_sale" : "package_redeem",
        staffAssignments: assignments.map((a) => ({
          staff: a.staffId,
          staffId: a.staffId,
          percentage: a.percentage,
          porsiPersen: a.porsiPersen,
          commission: a.commission,
          komisiNominal: a.komisiNominal,
          tip: a.tip,
        })),
        staff: assignments[0]?.staffId || undefined, // Keep primary staff for compatibility
        amountPaid: 0,
        paymentMethod, // primary method (first entry) for backward compat
        paymentMethods: splitPayments.map((p) => ({
          method: p.method,
          amount: parseFloat(String(p.amount || "0")) || 0,
        })),
        status: status,
        referralCode: referralCode.trim() || undefined,
        voucherId: voucherApplied?.voucherId || undefined,
        discountBreakdown: {
          manual: effectiveDiscount,
          manualReason: discountReason.trim() || undefined,
          loyalty: Math.min(loyaltyPointsToRedeem * (settings.loyaltyPointValue || 1), payableSubtotal),
          referral: referralDiscount,
          voucher: voucherApplied?.discountAmount || 0
        },
        packageUsage: cart.filter(item => item.type === "Service" && packageClaims[getCartItemKey(item._id, item.type)]?.enabled).map(item => {
          const claim = packageClaims[getCartItemKey(item._id, item.type)];
          const pkg = customerPackages.find(p => p._id === claim.customerPackageId);
          const quota = pkg?.serviceQuotas.find(q => String(q.service) === String(item._id));
          return {
            itemName: item.name,
            packageName: pkg?.package?.name || "Package",
            usedQuantity: item.quantity,
            remainingQuota: Math.max(0, (quota?.remainingQuota || 0) - item.quantity),
            expiryDate: pkg?.expiresAt
          };
        }),
        notes:
          [
            voucherApplied
              ? `Voucher: ${voucherApplied.code} (-${settings.symbol}${voucherApplied.discountAmount.toLocaleString("id-ID")})`
              : "",
            loyaltyPointsToRedeem > 0
              ? `Loyalty Redeem: ${loyaltyPointsToRedeem} pts (-${settings.symbol}${Math.min(loyaltyPointsToRedeem * (settings.loyaltyPointValue || 1), payableSubtotal).toLocaleString("id-ID")})`
              : "",
            referralValidated
              ? `Referral Code: ${referralCode} (-${settings.symbol}${referralDiscount.toLocaleString("id-ID")})`
              : "",
          ]
            .filter(Boolean)
            .join(" | ") || undefined,
      };

      const res = await fetch("/api/invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (data.success) {
        // Voucher usage is now handled atomically in POST /api/invoices backend.

        // Remove manual loyalty point deduction logic (handled securely in POST /api/invoices)
        // Deduct loyalty points logic has been moved to backend POST handler.

        // Auto-complete appointment if we have an appointmentId
        if (appointmentId) {
          try {
            await fetch(`/api/appointments/${appointmentId}`, {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ status: "completed" }),
            });
          } catch (err) {
            console.error("Failed to auto-complete appointment", err);
          }
        }

        if (redeemItems.length > 0 && customerId) {
          const redeemRes = await fetch("/api/customer-packages/redeem", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              customerId,
              invoiceId: data.data._id,
              items: redeemItems,
              note: "Redeem from POS checkout",
            }),
          });

          const redeemData = await redeemRes.json();
          if (!redeemData.success) {
            alert(redeemData.error || "Failed to redeem package quota");
            return;
          }
        }

        if (isQrisPayment) {
          const qrisRes = await fetch("/api/payments/xendit/create-invoice", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              invoiceId: data.data._id,
              description: `Pembayaran ${data.data.invoiceNumber}`,
            }),
          });

          const qrisData = (await qrisRes.json()) as QrisCreateResponse;
          if (!qrisData.success || !qrisData.data) {
            alert(qrisData.error || "Gagal membuat pembayaran QRIS");
            return;
          }

          setCart([]);
          setDiscount(0);
          setDiscountReason("");
          setStaffTips({});
          setSelectedCustomer("");
          setFollowUpPhoneNumber("");
          setServiceStaffAssignments({});
          setServiceSplitModes({});
          setPackageClaims({});
          setSplitPayments([{ method: "", amount: "" }]);
          setReferralCode("");
          setQrisSession({
            externalId: qrisData.data.externalId,
            checkoutUrl: qrisData.data.checkoutUrl,
            invoiceId: data.data._id,
            status: qrisData.data.status || "pending",
            sourceType: "invoice",
          });
          setIsQrisModalOpen(true);
          return;
        }

        // If there's a payment, create deposit record(s) — one per split payment entry
        if (paid > 0) {
          const depositEntries = splitPayments.filter((p) => {
            const amt = parseFloat(String(p.amount || "0"));
            return Number.isFinite(amt) && amt > 0;
          });

          if (depositEntries.length > 0) {
            // Split payment: create one deposit per method
            for (const entry of depositEntries) {
              const entryAmount = parseFloat(String(entry.amount || "0")) || 0;
              // Wallet deduction is handled centrally in the backend API (app/api/invoices/route.ts)

              await fetch("/api/deposits", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  invoice: data.data._id,
                  customer: customerId,
                  amount: entryAmount,
                  paymentMethod: entry.method,
                  notes:
                    depositEntries.length > 1
                      ? `Split payment (${entry.method}) dari POS`
                      : "Initial payment from POS",
                }),
              });
            }
          } else {
            // Fallback: single deposit using total paid amount
            await fetch("/api/deposits", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                invoice: data.data._id,
                customer: customerId,
                amount: paid,
                paymentMethod,
                notes: "Initial payment from POS",
              }),
            });
          }
        }

        // Auto-complete appointment if checkout was initiated from a booking
        if (appointmentId) {
          try {
            await fetch(`/api/appointments/${appointmentId}`, {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ status: "completed" }),
            });
          } catch (err) {
            console.error("Failed to auto-complete appointment:", err);
          }
        }

        setCart([]);
        setDiscount(0);
        setStaffTips({});
        setSelectedCustomer("");
        setFollowUpPhoneNumber("");
        setServiceStaffAssignments({});
        setServiceSplitModes({});
        setPackageClaims({});
        setSplitPayments([{ method: "", amount: "" }]);
        setVoucherApplied(null);
        setVoucherCode("");
        setLoyaltyPointsToRedeem(0);
        setCustomerLoyaltyPoints(0);
        setReferralCode("");
        router.push(`/invoices/print/${data.data._id}`);
      } else {
        alert(data.error || "Failed to create invoice");
      }
    } catch (error) {
      console.error(error);
      alert("Error processing checkout");
    } finally {
      setSubmitting(false);
    }
  };

  const checkQrisStatus = async () => {
    if (!qrisSession?.externalId) return;

    setCheckingQris(true);
    try {
      const res = await fetch(
        `/api/payments/xendit/status/${qrisSession.externalId}`,
      );
      const statusData = (await res.json()) as QrisStatusResponse;
      if (!statusData.success || !statusData.data) {
        alert(statusData.error || "Gagal cek status QRIS");
        return;
      }

      setQrisSession((prev) =>
        prev ? { ...prev, status: statusData.data!.status } : prev,
      );

      if (statusData.data.status === "paid") {
        if (
          statusData.data.sourceType === "package_order" ||
          qrisSession?.sourceType === "package_order"
        ) {
          alert("Pembayaran QRIS paket berhasil. Paket customer sudah aktif.");
          setIsQrisModalOpen(false);
          return;
        }

        alert("Pembayaran QRIS berhasil. Invoice sudah diperbarui.");
        setIsQrisModalOpen(false);
        const invoiceId = statusData.data.sourceId || qrisSession?.invoiceId;
        if (invoiceId) {
          router.push(`/invoices/print/${invoiceId}`);
        }
      }
    } catch (error) {
      console.error(error);
      alert("Gagal cek status QRIS");
    } finally {
      setCheckingQris(false);
    }
  };

  const {
    subtotal,
    payableSubtotal,
    tax,
    total,
    tips,
    commission,
    assignments,
    maxWalletPaymentAllowed,
    effectiveDiscount,
  } = calculateTotal();
  const hasInvalidSplitInCart = cart.some((item) => {
    if (item.type !== "Service") return false;
    return !getSplitCommissionPreviewForItem(item).isValid;
  });
  const enteredPaidAmount = totalSplitPaidComputed;
  const changeAmount = Math.max(0, totalSplitPaidComputed - total);
  const [mobileTab, setMobileTab] = useState<"catalog" | "cart">("catalog");
  const availableDeals = getAvailableDeals();
  const cartItemCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <div className="flex h-[100dvh] w-full bg-gray-50 overflow-hidden flex-col md:flex-row">
      {/* Left Side: Items Catalog */}
      <div
        className={`flex-1 flex flex-col min-w-0 border-r border-gray-200 bg-white ${mobileTab === "cart" ? "hidden md:flex" : "flex"}`}
      >
        <div className="bg-white flex flex-col h-full overflow-hidden">
          {/* Header/Tabs */}
          <div className="px-4 py-3 lg:px-6 lg:py-4 border-b border-gray-200 sticky top-0 bg-white z-10">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
              <h1 className="text-lg lg:text-xl font-bold text-gray-800">
                POS System
              </h1>
              <div className="flex items-center gap-2 lg:gap-3 flex-wrap sm:flex-nowrap">
                <button
                  onClick={() => router.push("/dashboard")}
                  className="inline-flex items-center gap-2 px-3 py-2 bg-gray-100 text-gray-700 rounded-lg text-xs lg:text-sm font-medium hover:bg-gray-200 transition-colors"
                >
                  <LayoutDashboard className="w-4 h-4" />
                  <span className="hidden xs:inline">Dashboard</span>
                </button>
                <div className="relative flex-1 sm:w-64 min-w-[150px]">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <input
                    type="text"
                    placeholder="Search items..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 bg-gray-50 border border-gray-200 text-gray-900 rounded-lg text-xs lg:text-sm focus:outline-none focus:ring-2 focus:ring-blue-900"
                  />
                  {search && (
                    <button
                      type="button"
                      onClick={() => setSearch("")}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      title="Clear search"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setActiveTab("all")}
                className={`flex-1 sm:flex-none px-4 py-2 rounded-lg text-xs lg:text-sm font-medium transition-colors ${activeTab === "all" ? "bg-blue-900 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
              >
                All
              </button>
              <button
                onClick={() => setActiveTab("services")}
                className={`flex-1 sm:flex-none px-4 py-2 rounded-lg text-xs lg:text-sm font-medium transition-colors ${activeTab === "services" ? "bg-blue-900 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
              >
                Services
              </button>
              <button
                onClick={() => setActiveTab("products")}
                className={`flex-1 sm:flex-none px-4 py-2 rounded-lg text-xs lg:text-sm font-medium transition-colors ${activeTab === "products" ? "bg-blue-900 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
              >
                Products
              </button>
              <button
                onClick={() => setActiveTab("packages")}
                className={`flex-1 sm:flex-none px-4 py-2 rounded-lg text-xs lg:text-sm font-medium transition-colors ${activeTab === "packages" ? "bg-blue-900 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
              >
                Paket
              </button>
              <button
                onClick={() => setActiveTab("bundles")}
                className={`flex-1 sm:flex-none px-4 py-2 rounded-lg text-xs lg:text-sm font-medium transition-colors ${activeTab === "bundles" ? "bg-blue-900 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
              >
                Bundling
              </button>
              <button
                onClick={() => setActiveTab("topup")}
                className={`flex-1 sm:flex-none px-4 py-2 rounded-lg text-xs lg:text-sm font-medium transition-colors flex items-center gap-1.5 ${activeTab === "topup" ? "bg-emerald-600 text-white" : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200"}`}
              >
                <Wallet className="w-3.5 h-3.5" />
                Top-Up
              </button>
            </div>
          </div>

          {/* Grid */}
          <div className="flex-1 overflow-y-auto p-3 lg:p-4 bg-gray-50 pb-20 md:pb-4">
            {loading ? (
              <div className="flex justify-center py-20">
                <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-900 border-t-transparent"></div>
              </div>
            ) : activeTab === "topup" ? (
              <div className="h-full flex flex-col items-center justify-center px-4">
                <div className="w-full max-w-md bg-white rounded-2xl shadow-lg border border-gray-200 p-6 space-y-5">
                  <div className="text-center">
                    <div className="w-16 h-16 mx-auto rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center mb-3 shadow-lg">
                      <Wallet className="w-8 h-8 text-white" />
                    </div>
                    <h3 className="text-lg font-bold text-gray-900">Top-Up Saldo Wallet</h3>
                    <p className="text-xs text-gray-500 mt-1">Isi saldo e-wallet pelanggan, otomatis masuk ke invoice & laporan kasir</p>
                  </div>

                  {(!selectedCustomer || selectedCustomer === "walking-customer") && (
                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-center">
                      <p className="text-xs text-amber-700 font-semibold">⚠️ Pilih Customer terdaftar terlebih dahulu di panel kanan</p>
                    </div>
                  )}

                  {selectedCustomer && selectedCustomer !== "walking-customer" && (
                    <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 flex items-center justify-between">
                      <span className="text-xs text-emerald-700 font-medium">Saldo saat ini</span>
                      <span className="text-sm font-bold text-emerald-700">
                        {settings.symbol}{(customerWalletBalance || 0).toLocaleString("id-ID", { maximumFractionDigits: 0 })}
                      </span>
                    </div>
                  )}

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1.5">Nominal Top-Up</label>
                    <input
                      type="number"
                      min="0"
                      placeholder="Contoh: 100000"
                      value={topupAmount}
                      onChange={(e) => setTopupAmount(e.target.value)}
                      className="w-full px-4 py-3 text-lg font-bold border border-gray-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-gray-900 bg-white"
                    />
                  </div>

                  {/* Quick amount buttons */}
                  <div className="grid grid-cols-3 gap-2">
                    {[50000, 100000, 200000, 300000, 500000, 1000000].map((amt) => (
                      <button
                        key={amt}
                        type="button"
                        onClick={() => setTopupAmount(amt)}
                        className="py-2 px-2 text-xs font-semibold rounded-lg border border-gray-200 bg-gray-50 hover:bg-emerald-50 hover:border-emerald-300 transition-colors text-gray-700"
                      >
                        {settings.symbol}{amt.toLocaleString("id-ID")}
                      </button>
                    ))}
                  </div>

                  <button
                    type="button"
                    onClick={addTopUpToCart}
                    disabled={!selectedCustomer || selectedCustomer === "walking-customer" || !topupAmount || Number(topupAmount) <= 0}
                    className="w-full py-3 rounded-xl bg-emerald-600 text-white font-bold text-sm hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-md"
                  >
                    <ShoppingCart className="w-4 h-4" />
                    Tambahkan ke Keranjang
                  </button>
                </div>
              </div>
            ) : activeTab === "packages" && filteredItems.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center px-4">
                <div className="w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center mb-3">
                  <Package className="w-6 h-6 text-amber-600" />
                </div>
                <p className="text-sm font-semibold text-gray-800 mb-1">
                  Belum ada paket aktif
                </p>
                <p className="text-xs text-gray-500 mb-3">
                  Buat dulu master paket di halaman Packages, lalu paket akan
                  muncul di POS.
                </p>
                <button
                  type="button"
                  onClick={() => router.push("/packages")}
                  className="px-3 py-2 text-xs font-semibold rounded-lg bg-blue-900 text-white hover:bg-blue-800"
                >
                  Buka Halaman Packages
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-2 xs:grid-cols-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-2 lg:gap-3">
                {filteredItems.map((item) => (
                  <div
                    key={item._id}
                    onClick={() => {
                      addToCart(item);
                      if (
                        typeof window !== "undefined" &&
                        window.innerWidth < 768
                      ) {
                        setMobileTab("cart");
                      }
                    }}
                    className="bg-white p-2 lg:p-3 rounded-lg shadow-sm border border-gray-200 cursor-pointer hover:shadow-md transition-shadow flex flex-col items-center text-center group min-h-[120px] lg:min-h-[132px] active:scale-95 duration-75"
                  >
                    <div className="w-12 h-12 lg:w-16 lg:h-16 rounded-full flex items-center justify-center mb-1 lg:mb-2 group-hover:scale-105 transition-transform overflow-hidden bg-gray-100">
                      {item.image ? (
                        <img
                          src={item.image}
                          alt={item.name}
                          className="w-full h-full object-cover"
                        />
                      ) : item.type === "Service" ? (
                        <div className="w-full h-full bg-purple-100 flex items-center justify-center">
                          <ScissorsIcon className="w-5 h-5 lg:w-6 lg:h-6 text-purple-600" />
                        </div>
                      ) : item.type === "Product" ? (
                        <div className="w-full h-full bg-green-100 flex items-center justify-center">
                          <Package className="w-5 h-5 lg:w-6 lg:h-6 text-green-600" />
                        </div>
                      ) : (
                        <div className="w-full h-full bg-amber-100 flex items-center justify-center">
                          <Package className="w-5 h-5 lg:w-6 lg:h-6 text-amber-600" />
                        </div>
                      )}
                    </div>
                    <h3 className="font-semibold text-gray-800 text-[10px] lg:text-xs leading-tight line-clamp-2 mb-1 h-8 flex items-center justify-center">
                      {item.name}
                    </h3>
                    <p className="text-blue-900 font-bold text-xs lg:text-sm">
                      {settings.symbol}
                      {item.price}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Right Side: Cart */}
      <div
        className={`w-full md:w-[420px] lg:w-[500px] xl:w-[560px] 2xl:w-[620px] md:flex-none flex flex-col text-gray-900 bg-white border-l border-gray-200 ${mobileTab === "catalog" ? "hidden md:flex" : "flex"} h-full`}
      >
        <div className="bg-white flex flex-col h-full overflow-hidden">
          <div className="p-3 lg:p-4 border-b border-gray-200 bg-gray-50 flex-shrink-0 space-y-3">
            <div className="flex items-center gap-2">
              <User className="w-4 h-4 lg:w-5 lg:h-5 text-gray-500 flex-shrink-0" />
              <SearchableSelect
                placeholder="Select Customer"
                value={selectedCustomer}
                onChange={(val) => setSelectedCustomer(val)}
                options={[
                  { value: "walking-customer", label: "Walking Customer" },
                  ...customers.map((c) => ({
                    value: c._id,
                    label: `${c.name} ${c.phone ? `(${c.phone})` : ""}`,
                    showGreenIndicator:
                      Number(c.packageSummary?.activePackages || 0) > 0,
                  })),
                ]}
                className="flex-1"
                controlClassName="px-3 py-1.5 text-xs md:text-xs lg:text-sm"
              />
              <button
                onClick={() => setIsCustomerModalOpen(true)}
                className="p-2 bg-blue-900 text-white rounded-lg hover:bg-blue-800 transition-colors shadow-sm"
                title="Add New Customer"
              >
                <Plus className="w-4 h-4 ml-0.5" />
              </button>
              <button
                type="button"
                onClick={() => setIsDealsModalOpen(true)}
                disabled={
                  !selectedCustomer || selectedCustomer === "walking-customer"
                }
                className="p-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                title="My Deals"
              >
                <Package className="w-4 h-4" />
              </button>
            </div>

            {(() => {
              const cust = customers.find(c => c._id === selectedCustomer);
              const isPremium = cust && cust.membershipTier === "premium" && cust.membershipExpiry && new Date(cust.membershipExpiry) > new Date();
              if (!isPremium) return null;
              return (
                <div className="flex items-center justify-between rounded-lg border border-amber-200 bg-gradient-to-r from-amber-50 to-orange-50 px-3 py-2 shadow-sm">
                  <div className="flex flex-col">
                    <span className="text-[12px] font-black text-amber-800 tracking-wide uppercase flex items-center gap-1">
                      🌟 Premium Member Active
                    </span>
                    <span className="text-[10px] text-amber-600 font-bold">
                      s/d {new Date(cust.membershipExpiry!).toLocaleDateString("id-ID")}
                    </span>
                  </div>
                  <span className="text-[10px] text-amber-700 font-bold">
                    Harga Diskon
                  </span>
                </div>
              );
            })()}

            {selectedCustomer &&
              selectedCustomer !== "walking-customer" &&
              availableDeals.length > 0 && (
                <div className="flex items-center justify-between rounded-lg border border-amber-100 bg-amber-50 px-3 py-2">
                  <div className="flex items-center gap-1.5">
                    <Zap className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
                    <p className="text-[11px] text-amber-800 font-semibold">
                      {availableDeals.length} reward tersedia
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsDealsModalOpen(true)}
                    className="inline-flex items-center gap-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-700 hover:text-amber-900"
                  >
                    Lihat <ChevronRight className="w-3 h-3" />
                  </button>
                </div>
              )}

            {/* Referral Code */}
            {selectedCustomer && selectedCustomer !== "walking-customer" && isFirstTimer && !customers.find((c) => c._id === selectedCustomer)?.referredBy && (
              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-gray-700 flex items-center gap-1">
                  🎁 Kode Referral (First Timer Only)
                </label>
                {referralValidated ? (
                  <div className="flex items-center justify-between px-3 py-2 bg-green-50 border border-green-200 rounded-lg">
                    <div>
                      <p className="text-xs font-bold text-green-800">
                        Kode dari {referralValidated.referrerName} ✅
                      </p>
                      <p className="text-[10px] text-green-600">
                        Diskon otomatis{" "}
                        {settings.referralDiscountType === "percentage"
                          ? `${settings.referralDiscountValue}%`
                          : `${settings.symbol}${(settings.referralDiscountValue || 0).toLocaleString("id-ID")}`}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setReferralValidated(null);
                        setReferralCode("");
                      }}
                      className="text-xs font-bold text-red-600 px-2 py-1 hover:bg-red-50 rounded"
                    >
                      Batal
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={referralCode}
                      onChange={(e) => { setReferralCode(e.target.value.toUpperCase()); if (referralValidated) setReferralValidated(null); }} onKeyDown={(e) => { if (e.key === "Enter") void applyReferralCode(); }}
                      placeholder="Masukkan kode teman"
                      className="flex-1 h-9 px-3 text-xs lg:text-sm text-gray-900 bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 uppercase tracking-wider font-bold placeholder:font-normal placeholder:tracking-normal placeholder:normal-case"
                    />
                    <button
                      type="button"
                      onClick={applyReferralCode}
                      disabled={!referralCode.trim() || referralValidating}
                      className="h-9 px-3 bg-amber-100 text-amber-700 font-bold text-xs rounded-lg hover:bg-amber-200 disabled:opacity-50 transition-colors"
                    >
                      {referralValidating ? "Cek..." : "Cek Kode"}
                    </button>
                  </div>
                )}
              </div>
            )}

            {selectedCustomer === "walking-customer" && (
              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-gray-700">
                  Nomor WhatsApp (Walking Customer)
                </label>
                <input
                  type="text"
                  value={followUpPhoneNumber}
                  onChange={(e) => setFollowUpPhoneNumber(e.target.value)}
                  placeholder="Contoh: 08123456789"
                  className="w-full h-9 px-3 text-xs lg:text-sm text-gray-900 bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            )}
          </div>

          {/* Cart Items */}
          <div className="flex-grow overflow-y-auto p-2 lg:p-3 space-y-2 pb-24 md:pb-2">
            {cart.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-gray-400 py-10">
                <ShoppingCart className="w-8 h-8 lg:w-10 lg:h-10 mb-2 opacity-30" />
                <p className="text-xs lg:text-sm">Cart is empty</p>
              </div>
            ) : (
              cart.map((item) => (
                <div
                  key={`${item._id}-${item.type}`}
                  className="p-2 border border-gray-100 rounded-lg bg-white shadow-sm space-y-2"
                >
                  <div className="flex items-center justify-between gap-1">
                    <div className="flex items-center gap-2 overflow-hidden flex-1">
                      <div className="flex-shrink-0">
                        {item.type === "Service" ? (
                          <div className="w-6 h-6 rounded-full bg-purple-100 flex items-center justify-center">
                            <ScissorsIcon className="w-3 h-3 text-purple-600" />
                          </div>
                        ) : item.type === "TopUp" ? (
                          <div className="w-6 h-6 rounded-full bg-emerald-100 flex items-center justify-center">
                            <Wallet className="w-3 h-3 text-emerald-600" />
                          </div>
                        ) : (
                          <div className="w-6 h-6 rounded-full bg-green-100 flex items-center justify-center">
                            <Package className="w-3 h-3 text-green-600" />
                          </div>
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs lg:text-sm font-bold text-gray-800 truncate">
                          {item.name}
                        </p>
                        <p className="text-[9px] lg:text-[10px] text-gray-500 flex items-center gap-1.5 flex-wrap">
                          {getEffectivePrice(item) < item.price ? (
                            <>
                              <span className="line-through text-gray-400">
                                {settings.symbol}{item.price.toLocaleString("id-ID")}
                              </span>
                              <span className="font-bold text-amber-600">
                                {settings.symbol}{getEffectivePrice(item).toLocaleString("id-ID")}
                              </span>
                              <span className="px-1 py-0.5 bg-amber-100 text-amber-700 text-[8px] uppercase font-black rounded-sm leading-none">
                                Member
                              </span>
                            </>
                          ) : (
                            <span>
                              {settings.symbol}{item.price.toLocaleString("id-ID")}
                            </span>
                          )}
                        </p>
                        {(() => {
                          if (item.type !== "Service") return null;
                          const claim =
                            packageClaims[getCartItemKey(item._id, item.type)];
                          if (!claim?.enabled || !claim.customerPackageId)
                            return null;
                          const pkg = customerPackages.find(
                            (entry) => entry._id === claim.customerPackageId,
                          );
                          const quota = pkg?.serviceQuotas.find(
                            (entry) =>
                              String(entry.service) === String(item._id),
                          );

                          return (
                            <p className="text-[9px] lg:text-[10px] text-amber-700 font-bold truncate">
                              Reward: {pkg?.packageName || "Paket"} (
                              {quota
                                ? `${quota.remainingQuota}/${quota.totalQuota}`
                                : "Claim"}
                              )
                            </p>
                          );
                        })()}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button
                        onClick={() => updateQuantity(item._id, item.type, -1)}
                        className="p-1 hover:bg-gray-200 rounded text-gray-600"
                      >
                        <Minus className="w-2.5 h-2.5 md:w-3 md:h-3" />
                      </button>
                      <span className="text-xs md:text-sm font-black w-5 text-center text-gray-900">
                        {item.quantity}
                      </span>
                      <button
                        onClick={() => updateQuantity(item._id, item.type, 1)}
                        className="p-1 hover:bg-gray-200 rounded text-gray-600"
                      >
                        <Plus className="w-2.5 h-2.5 md:w-3 md:h-3" />
                      </button>
                      <button
                        onClick={() => removeFromCart(item._id, item.type)}
                        className="p-1 hover:bg-red-50 text-red-500 rounded ml-0.5"
                      >
                        <Trash2 className="w-2.5 h-2.5 md:w-3 md:h-3" />
                      </button>
                    </div>
                  </div>
                  {(item.type === "Service" || item.type === "Product" || item.type === "Package") && (() => {
                    const key = getCartItemKey(item._id, item.type);
                    const isExpanded = expandedStaffKey === key;
                    const assignedStaff = serviceStaffAssignments[key] || [];
                    const splitMode = serviceSplitModes[key] || "auto";

                    return (
                      <div className="mt-1">
                        {/* Inline toggle button or assigned staff badges */}
                        {assignedStaff.length === 0 && !isExpanded ? (
                          <button
                            type="button"
                            onClick={() => setExpandedStaffKey(key)}
                            className="ml-8 flex items-center gap-1 text-[10px] font-semibold text-gray-500 hover:text-blue-700 border border-dashed border-gray-300 hover:border-blue-300 rounded px-2 py-1 transition-colors"
                          >
                            <User className="w-3 h-3" /> Assign Staff
                          </button>
                        ) : assignedStaff.length > 0 && !isExpanded ? (
                          <button
                            type="button"
                            onClick={() => setExpandedStaffKey(key)}
                            className="ml-8 flex items-center gap-1.5 flex-wrap"
                          >
                            {assignedStaff.map((a) => {
                              const staff = staffList.find((s) => s._id === a.staffId);
                              return (
                                <span key={a.staffId} className="inline-flex items-center gap-1 text-[10px] font-bold text-blue-700 bg-blue-50 border border-blue-200 rounded-full px-2 py-0.5">
                                  <User className="w-2.5 h-2.5" />{staff?.name}
                                </span>
                              );
                            })}
                          </button>
                        ) : null}

                        {/* Expanded staff assignment panel */}
                        {isExpanded && (
                          <div className="ml-8 mt-1 space-y-1.5 bg-slate-50 border border-slate-200 rounded-lg p-2">
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] font-bold text-slate-600">Staff & Komisi</span>
                              <div className="flex items-center gap-1.5">
                                <div className="inline-flex rounded border border-slate-300 overflow-hidden text-[9px] font-bold">
                                  <button type="button" onClick={() => updateServiceSplitMode(item._id, item.type, "auto")} className={`px-1.5 py-0.5 ${splitMode === "auto" ? "bg-slate-700 text-white" : "bg-white text-slate-500"}`}>Auto</button>
                                  <button type="button" onClick={() => updateServiceSplitMode(item._id, item.type, "manual")} className={`px-1.5 py-0.5 ${splitMode === "manual" ? "bg-slate-700 text-white" : "bg-white text-slate-500"}`}>Manual</button>
                                </div>
                                <button type="button" onClick={() => setExpandedStaffKey(null)} className="p-0.5 text-gray-400 hover:text-gray-600 rounded">
                                  <X className="w-3 h-3" />
                                </button>
                              </div>
                            </div>
                            <SearchableSelect
                              placeholder="Assign staff"
                              value=""
                              onChange={(val) => addServiceStaffAssignment(item._id, item.type, val)}
                              options={staffList.map((s) => ({ value: s._id, label: s.name }))}
                              className="w-full h-7"
                              controlClassName="px-2 py-0.5 text-[11px]"
                            />
                            {assignedStaff.length > 0 && (
                              <div className="space-y-1">
                                {(() => {
                                  const previewResult = getSplitCommissionPreviewForItem(item);
                                  const previewMap = new Map(previewResult.assignments.map((a) => [a.staffId, a.komisiNominal]));
                                  return getEffectiveServiceAssignments(item._id, item.type).map((assignment) => {
                                    const staff = staffList.find((s) => s._id === assignment.staffId);
                                    return (
                                      <div key={assignment.staffId} className="flex items-center gap-1 bg-white p-1 rounded border border-blue-100">
                                        <p className="text-[9px] font-bold text-gray-800 flex-1 truncate">{staff?.name}</p>
                                        <div className="flex items-center gap-0.5 bg-blue-50 px-1 py-0.5 rounded border border-blue-200">
                                          <input type="number" min="0" max="100" value={assignment.percentage} onChange={(e) => updateServiceStaffPercentage(item._id, item.type, assignment.staffId, parseFloat(e.target.value) || 0)} disabled={splitMode === "auto"} className={`w-10 text-right text-[11px] font-black border-0 bg-transparent focus:outline-none ${splitMode === "auto" ? "text-blue-400" : "text-blue-900"}`} />
                                          <span className="text-[9px] font-bold text-blue-700">%</span>
                                        </div>
                                        {settings.showCommissionInPOS && (
                                          <span className="text-[9px] font-bold text-emerald-700 min-w-[60px] text-right">
                                            {settings.symbol}{(previewMap.get(assignment.staffId) || 0).toLocaleString("id-ID", { maximumFractionDigits: 0 })}
                                          </span>
                                        )}
                                        <button onClick={() => removeServiceStaffAssignment(item._id, item.type, assignment.staffId)} className="p-0.5 text-gray-400 hover:text-red-500 rounded">
                                          <Trash2 className="w-2.5 h-2.5" />
                                        </button>
                                      </div>
                                    );
                                  });
                                })()}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })()}
                  {(item.type === "Product" || item.type === "Package") &&
                    Number(item.commissionValue || 0) > 0 && (
                      <div className="pl-8 space-y-1.5 mt-1">
                        <div className="flex items-center gap-1 bg-green-50 border border-green-100 rounded p-1.5">
                          <span className="text-[10px] font-bold text-green-700 flex-1">
                            Staff Penjual {settings.showCommissionInPOS && (
                              `(Komisi ${item.commissionType === "percentage"
                                ? `${item.commissionValue}%`
                                : `Rp${Number(item.commissionValue).toLocaleString("id-ID")}/pcs`})`
                            )}
                          </span>
                        </div>
                        <SearchableSelect
                          placeholder="Assign staff penjual"
                          value={
                            serviceStaffAssignments[
                              getCartItemKey(item._id, item.type)
                            ]?.[0]?.staffId || ""
                          }
                          onChange={(val) => {
                            const key = getCartItemKey(item._id, item.type);
                            setServiceStaffAssignments((prev) => ({
                              ...prev,
                              [key]: val
                                ? [{ staffId: val, percentage: 100 }]
                                : [],
                            }));
                          }}
                          options={[
                            { value: "", label: "— Tanpa komisi staff —" },
                            ...staffList.map((s) => ({
                              value: s._id,
                              label: s.name,
                            })),
                          ]}
                          className="w-full h-8"
                          controlClassName="px-2.5 py-1 text-[11px] md:text-[11px] lg:text-xs"
                        />
                      </div>
                    )}
                  {item.type === "Bundle" && (
                    <div className="pl-8 space-y-2 mt-1">
                      {/* Services list inside bundle */}
                      <div className="bg-blue-50 border border-blue-100 rounded p-1.5 mb-2">
                        <p className="text-[9px] font-black text-blue-800 uppercase tracking-wide mb-1">
                          Pembagian komisi per jasa:
                        </p>
                      </div>
                      
                      {(item.bundleServices || []).map((bs, i) => {
                        const bsKey = getCartItemKey(item._id, item.type, i);
                        const bsAssignments = serviceStaffAssignments[bsKey] || [];
                        const bsEffective = getEffectiveServiceAssignments(item._id, item.type, i);
                        const splitMode = serviceSplitModes[bsKey] || "auto";
                        
                        return (
                          <div key={i} className="mb-2 p-2 border border-blue-100 bg-white rounded shadow-sm">
                            <div className="flex justify-between text-[10px] text-blue-800 font-bold mb-1.5">
                              <span className="truncate">{bs.serviceName}</span>
                              <span className="flex-shrink-0 ml-1">
                                {settings.symbol}
                                {bs.servicePrice.toLocaleString("id-ID", {
                                  maximumFractionDigits: 0,
                                })}
                              </span>
                            </div>

                            {/* Auto/Manual Split Toggle */}
                            <div className="flex items-center justify-between gap-1 bg-slate-50 border border-slate-200 rounded p-1.5 mb-1.5">
                              <span className="text-[10px] font-bold text-slate-700">
                                Split Komisi
                              </span>
                              <div className="inline-flex rounded border border-slate-300 overflow-hidden text-[10px] font-bold">
                                <button
                                  type="button"
                                  onClick={() =>
                                    updateServiceSplitMode(
                                      item._id,
                                      item.type,
                                      "auto",
                                      i,
                                    )
                                  }
                                  className={`px-2 py-0.5 ${splitMode === "auto" ? "bg-slate-700 text-white" : "bg-white text-slate-600"}`}
                                >
                                  Auto
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    updateServiceSplitMode(
                                      item._id,
                                      item.type,
                                      "manual",
                                      i,
                                    )
                                  }
                                  className={`px-2 py-0.5 ${splitMode === "manual" ? "bg-slate-700 text-white" : "bg-white text-slate-600"}`}
                                >
                                  Manual
                                </button>
                              </div>
                            </div>
                            
                            <SearchableSelect
                              placeholder={`Assign staff untuk ${bs.serviceName}`}
                              value=""
                              onChange={(val) =>
                                addServiceStaffAssignment(item._id, item.type, val, i)
                              }
                              options={staffList.map((s) => ({
                                value: s._id,
                                label: s.name,
                              }))}
                              className="w-full h-8 mb-1.5"
                              controlClassName="px-2.5 py-1 text-[11px] md:text-[11px] lg:text-xs"
                            />
                            
                            {bsAssignments.length > 0 && (
                              <div className="space-y-1">
                                {bsEffective.map((assignment) => {
                                  const staff = staffList.find(
                                    (s) => s._id === assignment.staffId,
                                  );
                                  return (
                                    <div
                                      key={assignment.staffId}
                                      className="flex items-center gap-1.5 bg-blue-50/50 p-1 rounded border border-blue-100"
                                    >
                                      <p className="text-[9px] font-bold text-gray-800 flex-1 truncate">
                                        {staff?.name}
                                      </p>
                                      <div className="flex items-center gap-1 bg-white px-1 py-0.5 rounded border border-blue-200">
                                        <input
                                          type="number"
                                          min="0"
                                          max="100"
                                          value={assignment.percentage}
                                          onChange={(e) =>
                                            updateServiceStaffPercentage(
                                              item._id,
                                              item.type,
                                              assignment.staffId,
                                              parseFloat(e.target.value) || 0,
                                              i
                                            )
                                          }
                                          disabled={splitMode === "auto"}
                                          className={`w-12 md:w-14 text-right text-xs md:text-sm font-black border border-blue-200 bg-white rounded px-1 disabled:bg-gray-50 disabled:border-transparent focus:outline-none focus:border-blue-400 ${splitMode === "auto" ? "text-blue-400" : "text-blue-900"}`}
                                        />
                                        <span className="text-[10px] md:text-xs font-bold text-blue-900">
                                          %
                                        </span>
                                      </div>
                                      <button
                                        onClick={() =>
                                          removeServiceStaffAssignment(
                                            item._id,
                                            item.type,
                                            assignment.staffId,
                                            i
                                          )
                                        }
                                        className="p-1 hover:bg-red-50 text-gray-400 hover:text-red-500 rounded transition-colors"
                                      >
                                        <Trash2 className="w-2.5 h-2.5" />
                                      </button>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                  {item.type === "Package" && <div className="pl-8"></div>}
                </div>
              ))
            )}
          </div>

          {/* Summary - Sticky at bottom */}
          <div className="flex-shrink-0 p-2 bg-gray-50 border-t border-gray-200 pb-20 md:pb-2 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
            <div className="max-h-[200px] md:max-h-[280px] lg:max-h-[340px] overflow-y-auto pr-1">
              <div className="space-y-0.5 mb-2 text-[10px] lg:text-xs">
                <div className="flex justify-between text-gray-600">
                  <span>Subtotal</span>
                  <span>
                    {settings.symbol}
                    {subtotal.toLocaleString("id-ID", {
                      maximumFractionDigits: 0,
                    })}
                  </span>
                </div>
                {payableSubtotal !== subtotal && (
                  <div className="flex justify-between text-amber-600">
                    <span>Subtotal Dibayar</span>
                    <span>
                      {settings.symbol}
                      {payableSubtotal.toLocaleString("id-ID", {
                        maximumFractionDigits: 0,
                      })}
                    </span>
                  </div>
                )}
                {tax > 0 && (
                  <div className="flex justify-between text-gray-600">
                    <span>Tax ({settings.taxRate}%)</span>
                    <span>
                      {settings.symbol}
                      {tax.toLocaleString("id-ID", { maximumFractionDigits: 0 })}
                    </span>
                  </div>
                )}
                {(commission > 0 || tips > 0) && (
                  <div className="flex items-center justify-end">
                    <button
                      type="button"
                      onClick={() => setIsStaffEarningsHidden((prev) => !prev)}
                      className="text-[9px] lg:text-[10px] font-semibold text-indigo-600 hover:text-indigo-800"
                    >
                      {isStaffEarningsHidden
                        ? "Tampilkan Staff Earnings"
                        : "Hide Staff Earnings"}
                    </button>
                  </div>
                )}
                {(commission > 0 || tips > 0) && !isStaffEarningsHidden && (
                  <div className="space-y-1 bg-indigo-50 px-2 py-1.5 rounded border border-indigo-100/50">
                    <div className="flex justify-between text-indigo-600 font-bold mb-1 border-b border-indigo-200/50 pb-0.5 px-1">
                      <span>Staff Earnings</span>
                      <div className="flex gap-4 text-[8px] uppercase tracking-tighter">
                        {settings.showCommissionInPOS && <span>Comm</span>}
                        <span className="w-10 text-right">Tip</span>
                      </div>
                    </div>
                    {assignments.map((assignment, idx) => {
                      const staff = staffList.find(
                        (s) => s._id === assignment.staffId,
                      );
                      return (
                        <div
                          key={idx}
                          className="flex items-center justify-between text-[10px] text-indigo-700 bg-white/50 p-1 rounded"
                        >
                          <span className="truncate font-medium flex-1">
                            {staff?.name}
                          </span>
                          <div className="flex items-center gap-2">
                            {settings.showCommissionInPOS && (
                              <span className="text-[9px] text-indigo-400">
                                {settings.symbol}
                                {(assignment.commission || 0).toLocaleString(
                                  "id-ID",
                                  { maximumFractionDigits: 0 },
                                )}
                              </span>
                            )}
                            <div className="flex items-center gap-0.5 bg-indigo-100 px-1 rounded border border-indigo-200">
                              <span className="text-[8px] font-bold text-indigo-400">
                                {settings.symbol}
                              </span>
                              <input
                                type="number"
                                min="0"
                                value={staffTips[assignment.staffId] || ""}
                                placeholder="0"
                                onChange={(e) =>
                                  setStaffTips((prev) => ({
                                    ...prev,
                                    [assignment.staffId]:
                                      parseFloat(e.target.value) || 0,
                                  }))
                                }
                                className="w-10 text-right text-gray-900 bg-white border border-indigo-200 rounded px-1 py-0.5 focus:outline-none focus:border-indigo-400 font-bold text-indigo-900"
                              />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
                <div className="flex justify-between text-gray-600 items-center">
                  <div className="flex items-center gap-2">
                    <span>Discount</span>
                    <select
                      value={discountType}
                      onChange={(e) => setDiscountType(e.target.value as "nominal" | "percentage")}
                      className="bg-white text-[10px] lg:text-xs font-bold text-blue-900 border border-gray-300 rounded px-1.5 py-0.5 focus:ring-1 focus:ring-blue-900 outline-none cursor-pointer"
                    >
                      <option value="nominal">{settings.symbol}</option>
                      <option value="percentage">%</option>
                    </select>
                  </div>
                  <input
                    type="number"
                    value={discount}
                    onChange={(e) =>
                      setDiscount(parseFloat(e.target.value) || 0)
                    }
                    className="w-16 text-right text-[10px] lg:text-xs text-gray-900 border border-gray-300 rounded px-1 py-0.5 focus:ring-1 focus:ring-blue-900 outline-none bg-white"
                    min="0"
                  />
                </div>
                {discount > 0 && (
                  <div className="flex flex-col gap-1 mt-1">
                    <label className="text-[10px] lg:text-xs font-semibold text-red-600">Alasan Diskon (Wajib)</label>
                    <input
                      type="text"
                      value={discountReason}
                      onChange={(e) => setDiscountReason(e.target.value)}
                      placeholder="Contoh: Promo Spesial"
                      className={`w-full text-[10px] lg:text-xs text-gray-900 border ${!discountReason.trim() ? "border-red-300 focus:ring-red-500" : "border-gray-300 focus:ring-blue-900"} rounded px-2 py-1 outline-none bg-white`}
                    />
                  </div>
                )}

                {/* ── Voucher Redemption ── */}
                {!voucherApplied ? (
                  showVoucherInput ? (
                    <div className="flex gap-1 items-center">
                      <input
                        type="text"
                        value={voucherCode}
                        onChange={(e) =>
                          setVoucherCode(e.target.value.toUpperCase())
                        }
                        onKeyDown={(e) =>
                          e.key === "Enter" && void applyVoucher()
                        }
                        placeholder="Kode Voucher..."
                        className="flex-1 text-[10px] lg:text-xs text-gray-900 border border-gray-200 rounded px-2 py-1 focus:ring-1 focus:ring-blue-900 outline-none bg-white"
                        autoFocus
                      />
                      <button
                        type="button"
                        onClick={() => void applyVoucher()}
                        disabled={voucherLoading || !voucherCode.trim()}
                        className="px-2 py-1 text-[9px] font-bold bg-blue-900 text-white rounded hover:bg-blue-800 disabled:opacity-50 transition-colors"
                      >
                        {voucherLoading ? "..." : "Pakai"}
                      </button>
                      <button type="button" onClick={() => { setShowVoucherInput(false); setVoucherCode(''); }} className="text-gray-400 hover:text-gray-600"><X className="w-3 h-3" /></button>
                    </div>
                  ) : (
                    <button type="button" onClick={() => setShowVoucherInput(true)} className="text-[10px] font-semibold text-blue-600 hover:text-blue-800">
                      🎫 Punya voucher?
                    </button>
                  )
                ) : (
                  <div className="flex justify-between items-center text-emerald-700 bg-emerald-50 border border-emerald-200 rounded px-2 py-1">
                    <span className="text-[10px] font-bold flex items-center gap-1">
                      🎫 {voucherApplied.code}
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-black">
                        -{settings.symbol}
                        {voucherApplied.discountAmount.toLocaleString("id-ID", {
                          maximumFractionDigits: 0,
                        })}
                      </span>
                      <button
                        type="button"
                        onClick={removeVoucher}
                        className="text-red-400 hover:text-red-600 text-[10px] font-bold"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                )}

                {/* ── Loyalty Point Redemption ── */}
                {selectedCustomer &&
                  selectedCustomer !== "walking-customer" &&
                  customerLoyaltyPoints > 0 && (
                    showLoyaltySlider ? (
                    <div className="space-y-1">
                      <div className="flex justify-between items-center text-amber-700">
                        <span className="text-[10px] font-bold flex items-center gap-1">
                          ⭐ Loyalty Points (
                          {customerLoyaltyPoints.toLocaleString("id-ID")} pts)
                        </span>
                        {loyaltyPointsToRedeem > 0 && (
                          <span className="text-[10px] font-black text-emerald-700">
                            -{settings.symbol}
                            {Math.min(
                              loyaltyPointsToRedeem * (settings.loyaltyPointValue || 1),
                              payableSubtotal,
                            ).toLocaleString("id-ID", {
                              maximumFractionDigits: 0,
                            })}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          type="range"
                          min="0"
                          max={Math.min(customerLoyaltyPoints, Math.ceil(payableSubtotal / (settings.loyaltyPointValue || 1)))}
                          step="100"
                          value={loyaltyPointsToRedeem}
                          onChange={(e) =>
                            setLoyaltyPointsToRedeem(
                              parseInt(e.target.value) || 0,
                            )
                          }
                          className="flex-1 accent-amber-600"
                        />
                        <input
                          type="number"
                          min="0"
                          max={Math.min(customerLoyaltyPoints, Math.ceil(payableSubtotal / (settings.loyaltyPointValue || 1)))}
                          value={loyaltyPointsToRedeem || ""}
                          placeholder="0"
                          onChange={(e) => {
                            const val = parseInt(e.target.value) || 0;
                            setLoyaltyPointsToRedeem(
                              Math.min(
                                val,
                                customerLoyaltyPoints,
                                payableSubtotal,
                              ),
                            );
                          }}
                          className="w-16 text-right text-[10px] text-gray-900 border border-amber-200 rounded px-1 py-0.5 focus:ring-1 focus:ring-amber-500 outline-none bg-white"
                        />
                      </div>
                    </div>
                    ) : (
                      <button type="button" onClick={() => setShowLoyaltySlider(true)} className="flex items-center justify-between w-full text-[10px] font-semibold text-amber-700 hover:text-amber-900">
                        <span className="flex items-center gap-1">⭐ {customerLoyaltyPoints.toLocaleString("id-ID")} pts tersedia</span>
                        <span className="text-[9px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded font-bold hover:bg-amber-200 transition-colors">Pakai</span>
                      </button>
                    )
                  )}

                  {/* Wallet Balance Info */}
                  {selectedCustomer && selectedCustomer !== 'walking-customer' && customerWalletBalance > 0 && maxWalletPaymentAllowed > 0 && (
                    <div className="flex justify-between items-center text-emerald-700 bg-emerald-50 border border-emerald-200 rounded px-2 py-1.5 shadow-sm">
                      <span className="flex items-center gap-1">💳 Saldo Wallet</span>
                      <div className="text-right flex flex-col">
                        <span className="font-bold">{settings.symbol}{customerWalletBalance.toLocaleString('id-ID', { maximumFractionDigits: 0 })}</span>
                        <span className="text-[9px] text-emerald-600">Max usable: {settings.symbol}{maxWalletPaymentAllowed.toLocaleString('id-ID', { maximumFractionDigits: 0 })}</span>
                      </div>
                    </div>
                  )}

                {tips > 0 && (
                  <div className="flex justify-between text-indigo-600 items-center animate-in fade-in slide-in-from-right-2 duration-300">
                    <span className="flex items-center gap-1">
                      Tips
                      <span className="text-[8px] bg-indigo-100 px-1 rounded uppercase tracking-tighter">
                        Auto
                      </span>
                    </span>
                    <span className="font-bold">
                      {settings.symbol}
                      {tips.toLocaleString("id-ID", {
                        maximumFractionDigits: 0,
                      })}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* ── Split Payment Section ── */}
            <div className="mb-2 space-y-1.5 border-t border-gray-200 pt-1.5 mt-0.5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] lg:text-xs font-black text-gray-700 flex items-center gap-1">
                  <CreditCard className="w-3 h-3" /> Metode Pembayaran
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                        if (splitPayments.length > 0) {
                            const lastIdx = splitPayments.length - 1;
                            const paidBeforeLast = splitPayments.slice(0, lastIdx).reduce((sum, p) => sum + (parseFloat(String(p.amount || "0")) || 0), 0);
                            const remainder = Math.max(0, total - paidBeforeLast);
                            updateSplitAmount(lastIdx, remainder.toString());
                        } else {
                            setSplitPayments([{ method: "Cash", amount: total.toString() }]);
                        }
                    }}
                    className="text-[9px] lg:text-[10px] font-bold text-emerald-700 hover:text-emerald-900 flex items-center gap-0.5 border border-emerald-200 rounded px-1.5 py-0.5 hover:bg-emerald-50 transition-colors"
                  >
                    Isi Pas
                  </button>
                  {!isQrisOnly && (
                    <button
                      type="button"
                      onClick={addSplitPayment}
                      className="text-[9px] lg:text-[10px] font-bold text-blue-900 hover:text-blue-700 flex items-center gap-0.5 border border-blue-200 rounded px-1.5 py-0.5 hover:bg-blue-50 transition-colors"
                    >
                      <Plus className="w-2.5 h-2.5" /> Tambah Metode
                    </button>
                  )}
                </div>
              </div>

              {splitPayments.map((payment, index) => (
                <div key={index} className="flex items-center gap-1.5">
                  <select
                    value={payment.method}
                    onChange={(e) => updateSplitMethod(index, e.target.value)}
                    className={`flex-1 text-[10px] lg:text-xs font-bold border border-gray-200 rounded px-2 py-1.5 focus:ring-1 focus:ring-blue-900 outline-none cursor-pointer ${payment.method ? 'text-gray-900 bg-white' : 'text-gray-400 bg-gray-50'}`}
                  >
                    <option value="" disabled className="text-gray-400 font-normal">Pilih Metode...</option>
                    {["Cash", "Transfer", "Debit", "Credit Card", "QRIS", ...(selectedCustomer && selectedCustomer !== 'walking-customer' && customerWalletBalance > 0 && maxWalletPaymentAllowed > 0 ? ["Wallet"] : [])].map(
                      (m) => (
                        <option
                          key={m}
                          value={m}
                          className="text-gray-900 bg-white font-semibold"
                        >
                          {m}
                        </option>
                      ),
                    )}
                  </select>
                  <input
                    type="number"
                    placeholder={
                      splitPayments.length === 1
                        ? total.toLocaleString("id-ID", {
                          maximumFractionDigits: 0,
                        })
                        : index === splitPayments.length - 1 &&
                          totalSplitPaidComputed < total
                          ? (
                            total -
                            splitPayments
                              .slice(0, -1)
                              .reduce(
                                (s, p) =>
                                  s +
                                  (parseFloat(String(p.amount || "0")) || 0),
                                0,
                              )
                          ).toLocaleString("id-ID", {
                            maximumFractionDigits: 0,
                          })
                          : "0"
                    }
                    value={payment.amount}
                    onChange={(e) => {
                      let val = e.target.value;
                      if (payment.method === 'Wallet') {
                        const numVal = parseFloat(val) || 0;
                        const maxAllowed = Math.min(customerWalletBalance, maxWalletPaymentAllowed);
                        if (numVal > maxAllowed) {
                          val = maxAllowed.toString();
                        }
                      }
                      updateSplitAmount(index, val);
                    }}
                    className="w-28 text-right text-xs lg:text-sm text-gray-900 border border-gray-200 rounded px-2 py-1.5 focus:ring-1 focus:ring-blue-900 outline-none font-black"
                  />
                  {splitPayments.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeSplitPayment(index)}
                      className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors flex-shrink-0"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ))}

              {/* Running total for split mode */}
              {splitPayments.length > 1 && (
                <div
                  className={`flex justify-between text-[10px] font-bold px-1 py-0.5 rounded ${Math.abs(totalSplitPaidComputed - total) < 1
                    ? "text-emerald-700 bg-emerald-50"
                    : totalSplitPaidComputed > total
                      ? "text-red-600 bg-red-50"
                      : "text-amber-700 bg-amber-50"
                    }`}
                >
                  <span>Total dibayar:</span>
                  <span>
                    {settings.symbol}
                    {totalSplitPaidComputed.toLocaleString("id-ID", {
                      maximumFractionDigits: 0,
                    })}
                    {Math.abs(totalSplitPaidComputed - total) < 1
                      ? " ✓ Sesuai"
                      : totalSplitPaidComputed > total
                        ? ` (lebih ${settings.symbol}${(totalSplitPaidComputed - total).toLocaleString("id-ID", { maximumFractionDigits: 0 })})`
                        : ` (kurang ${settings.symbol}${(total - totalSplitPaidComputed).toLocaleString("id-ID", { maximumFractionDigits: 0 })})`}
                  </span>
                </div>
              )}

              {/* Single payment: show change if overpaid */}
              {splitPayments.length === 1 &&
                changeAmount > 0 &&
                totalSplitPaidComputed > 0 && (
                  <div className="flex justify-between text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1 py-0.5 rounded">
                    <span>Kembalian:</span>
                    <span>
                      {settings.symbol}
                      {changeAmount.toLocaleString("id-ID", {
                        maximumFractionDigits: 0,
                      })}
                    </span>
                  </div>
                )}
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-gray-200 mb-4 mt-1">
              <div className="flex items-center gap-2">
                <span className="text-lg lg:text-xl font-black text-gray-900">
                  {splitPayments.length === 1 &&
                    totalSplitPaidComputed > 0 &&
                    totalSplitPaidComputed < total
                    ? "Due"
                    : "Total"}
                </span>
                <span
                  className={
                    `text-xl lg:text-2xl font-black ${
                    splitPayments.length === 1 &&
                      totalSplitPaidComputed > 0 &&
                      totalSplitPaidComputed < total
                      ? "text-red-600"
                      : "text-blue-900"
                    }`
                  }
                >
                  {settings.symbol}{(splitPayments.length === 1 &&
                    totalSplitPaidComputed > 0 &&
                    totalSplitPaidComputed < total
                    ? total - totalSplitPaidComputed
                    : total
                  ).toLocaleString("id-ID", { maximumFractionDigits: 0 })}
                </span>
              </div>

              <FormButton
                onClick={() => {
                  void handleCheckout();
                }}
                loading={submitting}
                disabled={hasInvalidSplitInCart || cart.length === 0 || !splitPayments.some(p => !!p.method)}
                variant="success"
                className="flex-1 sm:max-w-max px-4 py-3 text-[11px] lg:text-xs uppercase tracking-widest font-black shadow-lg hover:shadow-xl active:translate-y-0.5 transition-all w-full sm:w-auto"
                icon={<CreditCard className="w-4 h-4" />}
              >
                Complete Order
              </FormButton>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Navigation Bar */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 text-gray-900 bg-white border-t border-gray-200 flex items-center justify-around h-16 z-50 px-2 shadow-[0_-4px_10px_rgba(0,0,0,0.05)]">
        <button
          onClick={() => setMobileTab("catalog")}
          className={`flex flex-col items-center justify-center w-20 h-full transition-all ${mobileTab === "catalog" ? "text-blue-900 scale-110" : "text-gray-400"}`}
        >
          <LayoutDashboard className="w-5 h-5 mb-1" />
          <span className="text-[10px] font-bold">Catalog</span>
          {mobileTab === "catalog" && (
            <div className="absolute top-0 w-8 h-1 bg-blue-900 rounded-b-full"></div>
          )}
        </button>
        <div className="w-px h-8 bg-gray-100"></div>
        <button
          onClick={() => setMobileTab("cart")}
          className={`flex flex-col items-center justify-center w-20 h-full transition-all relative ${mobileTab === "cart" ? "text-blue-900 scale-110" : "text-gray-400"}`}
        >
          <div className="relative">
            <ShoppingCart className="w-5 h-5 mb-1" />
            {cartItemCount > 0 && (
              <span className="absolute -top-1 -right-2 bg-red-500 text-white text-[8px] font-bold w-4 h-4 rounded-full flex items-center justify-center animate-pulse">
                {cartItemCount}
              </span>
            )}
          </div>
          <span className="text-[10px] font-bold">Cart</span>
          {mobileTab === "cart" && (
            <div className="absolute top-0 w-8 h-1 bg-blue-900 rounded-b-full"></div>
          )}
        </button>
      </div>

      <Modal
        isOpen={isCustomerModalOpen}
        onClose={() => setIsCustomerModalOpen(false)}
        title="Add New Customer"
      >
        <CustomerForm
          onSuccess={(newCustomer) => {
            setCustomers((prev) => [newCustomer, ...prev]);
            setSelectedCustomer(newCustomer._id);
            setIsCustomerModalOpen(false);
          }}
          onCancel={() => setIsCustomerModalOpen(false)}
        />
      </Modal>

      <Modal
        isOpen={isDealsModalOpen}
        onClose={() => setIsDealsModalOpen(false)}
        title="My Deals"
        size="lg"
      >
        <div className="space-y-3 text-black max-h-[70vh] overflow-y-auto pr-1">
          {!selectedCustomer || selectedCustomer === "walking-customer" ? (
            <p className="text-sm text-gray-500">
              Pilih customer terdaftar dulu untuk melihat paket.
            </p>
          ) : availableDeals.length === 0 ? (
            <p className="text-sm text-gray-500">
              Customer belum punya reward paket aktif.
            </p>
          ) : (
            availableDeals.map((deal, index) => (
              <div
                key={`${deal.customerPackageId}-${deal.serviceId}-${index}`}
                className="rounded-lg border border-amber-200 bg-amber-50 p-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs font-black text-amber-900 uppercase tracking-wide">
                      {deal.packageCode ? `${deal.packageCode} ` : ""}
                      {deal.serviceName}
                    </p>
                    <p className="text-xs text-amber-800 mt-0.5">
                      Reward: {deal.packageName} ({deal.remainingQuota}/
                      {deal.totalQuota})
                    </p>
                    <p className="text-[11px] text-amber-700 mt-0.5">
                      Exp:{" "}
                      {deal.expiresAt
                        ? new Date(deal.expiresAt).toLocaleDateString("id-ID")
                        : "-"}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => addDealToCart(deal)}
                    className="shrink-0 px-3 py-1.5 rounded-lg bg-amber-600 text-white text-xs font-bold hover:bg-amber-700"
                  >
                    Masuk Cart
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </Modal>

      <Modal
        isOpen={referralInfoModal !== null}
        onClose={() => setReferralInfoModal(null)}
        title="🎁 Kode Referral Ditemukan!"
      >
        <div className="space-y-4">
          <div className="flex flex-col items-center justify-center p-4 bg-green-50 border border-green-200 rounded-lg">
            <span className="text-4xl mb-2">✅</span>
            <p className="text-lg font-bold text-green-800 text-center">
              Member VIP Valid
            </p>
            <div className="mt-4 w-full bg-white rounded p-3 shadow-sm border border-green-100 flex flex-col gap-1">
              <div className="flex justify-between">
                <span className="text-gray-500 text-xs">Nama Member</span>
                <span className="font-bold text-gray-900">{referralInfoModal?.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500 text-xs">No. WhatsApp</span>
                <span className="font-bold text-gray-900">{referralInfoModal?.phone}</span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setReferralInfoModal(null)}
              className="mt-4 w-full py-2 bg-green-600 hover:bg-green-700 text-white font-bold rounded-lg transition-colors"
            >
              Gunakan Diskon Referral
            </button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={isQrisModalOpen}
        onClose={() => setIsQrisModalOpen(false)}
        title="Pembayaran QRIS"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Status:{" "}
            <span className="font-bold uppercase text-gray-900">
              {qrisSession?.status || "pending"}
            </span>
          </p>
          <p className="text-xs text-gray-500 break-all">
            External ID: {qrisSession?.externalId || "-"}
          </p>

          {qrisSession?.checkoutUrl && (
            <a
              href={qrisSession.checkoutUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center px-4 py-2 rounded-lg bg-blue-900 text-white text-sm font-semibold hover:bg-blue-800"
            >
              Buka Checkout QRIS
            </a>
          )}

          <div>
            <FormButton
              onClick={checkQrisStatus}
              loading={checkingQris}
              variant="secondary"
            >
              Cek Status QRIS
            </FormButton>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={isNonQrisConfirmOpen}
        onClose={() => setIsNonQrisConfirmOpen(false)}
        title="Payment Confirmation"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-700">
            {splitPayments.length === 1 ? (
              <>
                <span className="font-semibold">{splitPayments[0].method}</span>{" "}
                — konfirmasi pembayaran transaksi ini?
              </>
            ) : (
              <>
                Split payment{" "}
                <span className="font-semibold">
                  {splitPayments.length} metode
                </span>{" "}
                — konfirmasi pembayaran transaksi ini?
              </>
            )}
          </p>
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm space-y-1">
            <div className="flex justify-between text-gray-600 font-semibold border-b border-gray-200 pb-1 mb-1">
              <span>Total Transaksi</span>
              <span className="text-gray-900">
                {settings.symbol}
                {total.toLocaleString("id-ID", { maximumFractionDigits: 0 })}
              </span>
            </div>
            {splitPayments.map((p, i) => (
              <div key={i} className="flex justify-between text-gray-600">
                <span className="flex items-center gap-1">
                  {splitPayments.length > 1 && (
                    <span className="text-[10px] bg-blue-100 text-blue-700 font-bold px-1 rounded">
                      {p.method}
                    </span>
                  )}
                  {splitPayments.length === 1 && <span>Jumlah Dibayar</span>}
                </span>
                <span className="font-semibold text-gray-900">
                  {settings.symbol}
                  {(
                    parseFloat(String(p.amount || "0")) ||
                    (splitPayments.length === 1 ? total : 0)
                  ).toLocaleString("id-ID", { maximumFractionDigits: 0 })}
                </span>
              </div>
            ))}
            {changeAmount > 0 && enteredPaidAmount > 0 && (
              <div className="flex justify-between text-emerald-700 font-semibold border-t border-emerald-200 pt-1 mt-1">
                <span>Kembalian</span>
                <span>
                  {settings.symbol}
                  {changeAmount.toLocaleString("id-ID", {
                    maximumFractionDigits: 0,
                  })}
                </span>
              </div>
            )}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <button
              type="button"
              className="px-3 py-2 rounded-lg bg-green-600 text-white text-sm font-semibold hover:bg-green-700"
              onClick={() => {
                setIsNonQrisConfirmOpen(false);
                void handleCheckout(true);
              }}
            >
              Paid
            </button>
            <button
              type="button"
              className="px-3 py-2 rounded-lg bg-amber-600 text-white text-sm font-semibold hover:bg-amber-700"
              onClick={() => {
                setIsNonQrisConfirmOpen(false);
                void handleCheckout(false);
              }}
            >
              Not Paid Yet
            </button>
          </div>
        </div>
      </Modal>

      {toastMessage && (
        <div className="fixed bottom-20 md:bottom-6 right-3 md:right-6 z-[70] px-4 py-2 rounded-lg bg-emerald-600 text-white text-xs lg:text-sm font-bold shadow-xl">
          {toastMessage}
        </div>
      )}
    </div>
  );
}
