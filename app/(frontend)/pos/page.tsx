
"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Search, ShoppingCart, Plus, Minus, Trash2, CreditCard, User, Scissors as ScissorsIcon, Package, LayoutDashboard } from "lucide-react";
import { FormButton } from "@/components/dashboard/FormInput";
import SearchableSelect from "@/components/dashboard/SearchableSelect";
import Modal from "@/components/dashboard/Modal";
import CustomerForm from "@/components/dashboard/CustomerForm";
import { useSettings } from "@/components/providers/SettingsProvider";
import { calculateSplitCommission, type SplitMode } from "@/lib/splitCommission";

interface Item {
    _id: string;
    name: string;
    price: number;
    type: 'Service' | 'Product' | 'Package';
    duration?: number; // Service only
    stock?: number; // Product only
    commissionType?: 'percentage' | 'fixed';
    commissionValue?: number;
    waFollowUp?: {
        enabled?: boolean;
        firstDays?: number;
        secondDays?: number;
        firstTemplateId?: string;
        secondTemplateId?: string;
    };
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
    status: 'active' | 'depleted' | 'expired' | 'cancelled';
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
        sourceType?: 'invoice' | 'package_order';
        sourceId?: string;
        checkoutUrl?: string;
    };
}

export default function POSPage() {
    const router = useRouter();
    const { settings } = useSettings();
    const [activeTab, setActiveTab] = useState<'services' | 'products' | 'packages'>('services');
    const [services, setServices] = useState<Item[]>([]);
    const [products, setProducts] = useState<Item[]>([]);
    const [packages, setPackages] = useState<Item[]>([]);
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [staffList, setStaffList] = useState<Staff[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");

    // Cart State
    const [cart, setCart] = useState<CartItem[]>([]);
    const [selectedCustomer, setSelectedCustomer] = useState("");
    const [serviceStaffAssignments, setServiceStaffAssignments] = useState<Record<string, StaffAssignment[]>>({});
    const [serviceSplitModes, setServiceSplitModes] = useState<Record<string, SplitMode>>({});
    const [customerPackages, setCustomerPackages] = useState<CustomerPackageItem[]>([]);
    const [packageClaims, setPackageClaims] = useState<Record<string, PackageClaim>>({});
    const [discount, setDiscount] = useState(0);
    const [staffTips, setStaffTips] = useState<Record<string, number>>({});
    const [paymentMethod, setPaymentMethod] = useState("Cash");
    const [followUpPhoneNumber, setFollowUpPhoneNumber] = useState("");
    const [amountPaid, setAmountPaid] = useState<number | string>("");
    const [isNonQrisConfirmOpen, setIsNonQrisConfirmOpen] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);
    const [isDealsModalOpen, setIsDealsModalOpen] = useState(false);
    const [toastMessage, setToastMessage] = useState<string | null>(null);
    const [isQrisModalOpen, setIsQrisModalOpen] = useState(false);
    const [qrisSession, setQrisSession] = useState<{ externalId: string; checkoutUrl: string; invoiceId: string; status: string; sourceType: 'invoice' | 'package_order' } | null>(null);
    const [checkingQris, setCheckingQris] = useState(false);

    useEffect(() => {
        fetchResources();
    }, []);

    useEffect(() => {
        if (!toastMessage) return;
        const timeout = window.setTimeout(() => setToastMessage(null), 2200);
        return () => window.clearTimeout(timeout);
    }, [toastMessage]);

    useEffect(() => {
        const loadCustomerPackages = async () => {
            if (!selectedCustomer || selectedCustomer === 'walking-customer') {
                setCustomerPackages([]);
                return;
            }

            try {
                const res = await fetch(`/api/customer-packages?customerId=${selectedCustomer}`);
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
        if (!selectedCustomer || selectedCustomer === 'walking-customer') {
            setFollowUpPhoneNumber('');
            return;
        }

        const customer = customers.find((entry) => entry._id === selectedCustomer);
        setFollowUpPhoneNumber(String(customer?.phone || '').trim());
    }, [selectedCustomer, customers]);

    const fetchResources = async () => {
        setLoading(true);
        try {
            const [serviceRes, productRes, packageRes, customerRes, staffRes] = await Promise.all([
                fetch("/api/services?limit=1000"),
                fetch("/api/products?limit=1000"),
                fetch("/api/service-packages?active=true"),
                fetch("/api/customers?limit=1000"),
                fetch("/api/staff?limit=1000")
            ]);

            const sData = await serviceRes.json();
            const pData = await productRes.json();
            const pkgData = await packageRes.json();
            const cData = await customerRes.json();
            const stData = await staffRes.json();

            if (sData.success) {
                setServices((sData.data || []).map((s: Item) => ({ ...s, type: 'Service' })));
            }
            if (pData.success) {
                setProducts((pData.data || []).map((p: Item) => ({ ...p, type: 'Product' })));
            }
            if (pkgData.success) {
                setPackages((pkgData.data || []).map((pkg: Item) => ({ ...pkg, type: 'Package' })));
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



    const filteredItems = (activeTab === 'services' ? services : activeTab === 'products' ? products : packages).filter(item =>
        item.name.toLowerCase().includes(search.toLowerCase())
    );

    const getCartItemKey = (itemId: string, type: string) => `${type}:${itemId}`;

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
        return assignments.reduce((sum, assignment) => sum + (Number(assignment.percentage) || 0), 0);
    };

    const isSplitTotalValid = (assignments: StaffAssignment[]) => {
        return Math.abs(getTotalSplitPercentage(assignments) - 100) <= SPLIT_TOLERANCE;
    };

    const getEffectiveServiceAssignments = (itemId: string, type: string): StaffAssignment[] => {
        const key = getCartItemKey(itemId, type);
        const splitMode = serviceSplitModes[key] || 'auto';
        const deduped = dedupeAssignments(serviceStaffAssignments[key] || []);

        if (splitMode === 'auto') {
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
        if (item.type === 'Package') {
            if (cart.some((i) => i.type !== 'Package')) {
                alert('Penjualan paket harus diproses terpisah dari service/product. Selesaikan atau kosongkan cart dulu.');
                return;
            }
        }

        if (item.type !== 'Package' && cart.some((i) => i.type === 'Package')) {
            alert('Cart berisi paket. Selesaikan dulu transaksi paket sebelum menambah service/product.');
            return;
        }

        setCart(prev => {
            const existing = prev.find(i => i._id === item._id && i.type === item.type);
            if (existing) {
                return prev.map(i => i._id === item._id && i.type === item.type ? { ...i, quantity: i.quantity + 1 } : i);
            }
            return [...prev, { ...item, quantity: 1 }];
        });
        if (item.type === 'Service') {
            const key = getCartItemKey(item._id, item.type);
            setServiceStaffAssignments(prev => prev[key] ? prev : { ...prev, [key]: [] });
            setServiceSplitModes(prev => prev[key] ? prev : { ...prev, [key]: 'auto' });
        }
    };

    const removeFromCart = (itemId: string, type: string) => {
        setCart(prev => prev.filter(i => !(i._id === itemId && i.type === type)));
        if (type === 'Service') {
            const key = getCartItemKey(itemId, type);
            setServiceStaffAssignments(prev => {
                const rest = { ...prev };
                delete rest[key];
                return rest;
            });
            setServiceSplitModes(prev => {
                const rest = { ...prev };
                delete rest[key];
                return rest;
            });
            setPackageClaims(prev => {
                const rest = { ...prev };
                delete rest[key];
                return rest;
            });
        }
    };

    const updateQuantity = (itemId: string, type: string, delta: number) => {
        setCart(prev => prev.map(i => {
            if (i._id === itemId && i.type === type) {
                if (type === 'Package') {
                    return i;
                }
                const newQty = Math.max(1, i.quantity + delta);
                return { ...i, quantity: newQty };
            }
            return i;
        }));
    };

    const addServiceStaffAssignment = (itemId: string, type: string, staffId: string) => {
        const key = getCartItemKey(itemId, type);
        const current = serviceStaffAssignments[key] || [];
        if (current.find(a => a.staffId === staffId)) return;
        const splitMode = serviceSplitModes[key] || 'auto';

        const nextAssignments = [
            ...current,
            {
                staffId,
                percentage: 0,
            },
        ];

        const effectiveAssignments = splitMode === 'auto'
            ? nextAssignments.map((assignment, idx) => ({
                ...assignment,
                percentage: getEqualSplitPercentages(nextAssignments.length)[idx] || 0,
            }))
            : nextAssignments;

        setServiceStaffAssignments(prev => ({
            ...prev,
            [key]: effectiveAssignments,
        }));
    };

    const removeServiceStaffAssignment = (itemId: string, type: string, staffId: string) => {
        const key = getCartItemKey(itemId, type);
        const splitMode = serviceSplitModes[key] || 'auto';

        setServiceStaffAssignments(prev => ({
            ...prev,
            [key]: (() => {
                const filtered = (prev[key] || []).filter(a => a.staffId !== staffId);
                if (splitMode !== 'auto') return filtered;

                const percentages = getEqualSplitPercentages(filtered.length);
                return filtered.map((assignment, idx) => ({
                    ...assignment,
                    percentage: percentages[idx] || 0,
                }));
            })(),
        }));
    };

    const updateServiceStaffPercentage = (itemId: string, type: string, staffId: string, percentage: number) => {
        const key = getCartItemKey(itemId, type);
        const splitMode = serviceSplitModes[key] || 'auto';
        if (splitMode === 'auto') return;

        setServiceStaffAssignments(prev => ({
            ...prev,
            [key]: (prev[key] || []).map(a =>
                a.staffId === staffId ? { ...a, percentage: Math.max(0, percentage) } : a
            )
        }));
    };

    const updateServiceSplitMode = (itemId: string, type: string, mode: SplitMode) => {
        const key = getCartItemKey(itemId, type);

        setServiceSplitModes(prev => ({
            ...prev,
            [key]: mode,
        }));

        setServiceStaffAssignments(prev => {
            const current = prev[key] || [];
            if (mode !== 'auto') {
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

    const togglePackageClaim = (itemId: string, type: string, enabled: boolean) => {
        const key = getCartItemKey(itemId, type);
        setPackageClaims(prev => {
            const current = prev[key] || { enabled: false, customerPackageId: '' };
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
            .filter((pkg) => pkg.status === 'active')
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
        if (!selectedCustomer || selectedCustomer === 'walking-customer') {
            alert('Pilih customer terdaftar dulu untuk menggunakan paket.');
            return;
        }

        const service = services.find((entry) => entry._id === deal.serviceId);
        if (!service) {
            alert('Service untuk paket ini tidak ditemukan di master service.');
            return;
        }

        const key = getCartItemKey(service._id, 'Service');
        const existing = cart.find((entry) => entry._id === service._id && entry.type === 'Service');
        const existingClaim = packageClaims[key];

        if (existing && (!existingClaim?.enabled || existingClaim.customerPackageId !== deal.customerPackageId)) {
            alert(`Service "${service.name}" sudah ada di cart tanpa claim paket yang sama. Hapus dulu item lama atau gunakan claim dari item yang sudah ada.`);
            return;
        }

        addToCart(service);
        setPackageClaimId(service._id, 'Service', deal.customerPackageId);
        setIsDealsModalOpen(false);
        setToastMessage('Berhasil menambahkan produk!');
    };

    const setPackageClaimId = (itemId: string, type: string, customerPackageId: string) => {
        const key = getCartItemKey(itemId, type);
        setPackageClaims(prev => ({
            ...prev,
            [key]: {
                enabled: true,
                customerPackageId,
            },
        }));
    };

    const getServicePackageOptions = (serviceId: string) => {
        return customerPackages
            .filter(pkg => pkg.status === 'active')
            .map(pkg => {
                const quota = pkg.serviceQuotas.find(q => String(q.service) === String(serviceId));
                return { pkg, quota };
            })
            .filter((entry) => entry.quota && Number(entry.quota.remainingQuota) > 0)
            .map((entry) => ({
                value: entry.pkg._id,
                label: `${entry.pkg.packageName} (Sisa: ${entry.quota?.remainingQuota ?? 0})`,
            }));
    };

    const getStaffRate = (staffId: string) => {
        const staff = staffList.find(s => s._id === staffId);
        return Number(staff?.commissionRate || 0);
    };

    const getSplitCommissionPreviewForItem = (item: CartItem) => {
        const key = getCartItemKey(item._id, item.type);
        const splitMode = serviceSplitModes[key] || 'auto';
        const claim = packageClaims[key];
        const sourceType = claim?.enabled && claim.customerPackageId ? 'package_redeem' : 'normal_sale';

        return calculateSplitCommission({
            splitMode,
            assignments: getEffectiveServiceAssignments(item._id, item.type).map((assignment) => ({
                staffId: assignment.staffId,
                percentage: assignment.percentage,
                staffCommissionRate: getStaffRate(assignment.staffId),
            })),
            servicePrice: item.price,
            quantity: item.quantity,
            commissionType: item.commissionType || 'fixed',
            commissionValue: Number(item.commissionValue || 0),
            sourceType,
        });
    };
    


    const calculateTotal = () => {
        const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        const payableSubtotal = cart.reduce((sum, item) => {
            if (item.type !== 'Service') return sum + (item.price * item.quantity);

            const key = getCartItemKey(item._id, item.type);
            const claim = packageClaims[key];
            if (claim?.enabled && claim.customerPackageId) return sum;

            return sum + (item.price * item.quantity);
        }, 0);

        const taxableAmount = Math.max(0, payableSubtotal - discount);
        const tax = taxableAmount * (settings.taxRate / 100);
        
        // Sum all tips from staffTips state
        const totalTips = Object.values(staffTips).reduce((sum, tip) => sum + (Number(tip) || 0), 0);
        const total = taxableAmount + tax + totalTips;

        let totalCommission = 0;
        const perStaff: Record<string, { staffId: string; commission: number; tip: number }> = {};
        const lineItemSplits: Record<string, { splitCommissionMode: SplitMode; staffAssignments: { staffId: string; percentage: number; porsiPersen: number; commission: number; komisiNominal: number; tip: number }[] }> = {};
        const redeemItems: { customerPackageId: string; serviceId: string; quantity: number; serviceName: string }[] = [];

        cart.forEach(item => {
            if (item.type !== 'Service') return;
            const key = getCartItemKey(item._id, item.type);
            const splitCommissionMode = serviceSplitModes[key] || 'auto';
            const serviceAssignments = getEffectiveServiceAssignments(item._id, item.type);
            const serviceLineAssignments: { staffId: string; percentage: number; porsiPersen: number; commission: number; komisiNominal: number; tip: number }[] = [];

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
                servicePrice: item.price,
                quantity: item.quantity,
                commissionType: item.commissionType || 'fixed',
                commissionValue: Number(item.commissionValue || 0),
                sourceType: claim?.enabled && claim.customerPackageId ? 'package_redeem' : 'normal_sale',
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

            lineItemSplits[key] = {
                splitCommissionMode,
                staffAssignments: serviceLineAssignments,
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
            const percentage = totalCommission > 0
                ? (assignment.commission / totalCommission) * 100
                : (fallbackPercentages[index] || 0);

            return {
                staffId: assignment.staffId,
                percentage,
                porsiPersen: percentage,
                commission: assignment.commission,
                komisiNominal: assignment.commission,
                tip: assignment.tip
            };
        });

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
        };
    };

    const handleCheckout = async (nonQrisPaid?: boolean) => {
        if (!selectedCustomer) {
            alert("Please select a customer");
            return;
        }
        if (cart.length === 0) {
            alert("Cart is empty");
            return;
        }
        const serviceItems = cart.filter(item => item.type === 'Service');
        const hasFollowUpService = serviceItems.some((item) => Boolean(item.waFollowUp?.enabled));
        const packageItems = cart.filter(item => item.type === 'Package');

        if (hasFollowUpService) {
            if (selectedCustomer === 'walking-customer' && !followUpPhoneNumber.trim()) {
                alert('Nomor WA follow-up wajib diisi untuk Walking Customer yang mengambil service follow-up');
                return;
            }

            if (selectedCustomer !== 'walking-customer' && !followUpPhoneNumber.trim()) {
                alert('Customer belum punya nomor telepon. Lengkapi nomor di master customer dulu.');
                return;
            }
        }

        if (paymentMethod !== 'QRIS' && nonQrisPaid === undefined) {
            setIsNonQrisConfirmOpen(true);
            return;
        }

        const isMarkedPaid = nonQrisPaid ?? false;
        const parsedAmountPaid = amountPaid === "" ? 0 : parseFloat(amountPaid.toString());
        const normalizedAmountPaid = Number.isFinite(parsedAmountPaid) ? parsedAmountPaid : 0;

        if (paymentMethod !== 'QRIS' && isMarkedPaid && normalizedAmountPaid < total) {
            alert(`Nominal bayar kurang. Total ${settings.symbol}${total.toLocaleString('id-ID', { maximumFractionDigits: 0 })}. Pilih "Belum Dibayar" jika transaksi belum lunas.`);
            return;
        }

        if (packageItems.length > 0) {
            for (const packageItem of packageItems) {
                if (Number(packageItem.quantity || 0) < 1) {
                    alert(`Quantity paket "${packageItem.name}" tidak valid.`);
                    return;
                }
            }
        }
        for (const item of serviceItems) {
            const key = getCartItemKey(item._id, item.type);
            const rawAssignments = serviceStaffAssignments[key] || [];
            const itemAssignments = getEffectiveServiceAssignments(item._id, item.type);
            const splitMode = serviceSplitModes[key] || 'auto';
            const commissionType = item.commissionType || 'fixed';
            const commissionValue = Number(item.commissionValue || 0);

            if (commissionType === 'fixed' && commissionValue <= 0) {
                alert(`Komisi service "${item.name}" belum diisi. Isi Komisi Nominal lebih dari 0 terlebih dahulu.`);
                return;
            }

            if (commissionType === 'percentage' && commissionValue <= 0) {
                alert(`Komisi service "${item.name}" belum diisi. Isi Komisi Persentase lebih dari 0 terlebih dahulu.`);
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
                sourceType: packageClaims[key]?.enabled ? 'package_redeem' : 'normal_sale',
            });

            if (!splitResult.isValid) {
                alert(`${item.name}: ${splitResult.errors[0] || 'Split komisi tidak valid'}`);
                return;
            }

            const claim = packageClaims[key];
            if (claim?.enabled) {
                if (!selectedCustomer || selectedCustomer === 'walking-customer') {
                    alert('Package claim requires a registered customer');
                    return;
                }

                if (!claim.customerPackageId) {
                    alert(`Please select package source for service "${item.name}"`);
                    return;
                }

                const pkg = customerPackages.find(p => p._id === claim.customerPackageId);
                const quota = pkg?.serviceQuotas.find(q => String(q.service) === String(item._id));
                if (!quota || Number(quota.remainingQuota) < Number(item.quantity || 0)) {
                    alert(`Insufficient quota for service "${item.name}"`);
                    return;
                }
            }
        }

        setSubmitting(true);
        try {
            if (packageItems.length > 0) {
                const customerId = selectedCustomer === 'walking-customer' ? undefined : selectedCustomer;

                if (!customerId) {
                    alert('Pembelian paket wajib pilih customer terdaftar.');
                    return;
                }

                const expandedPackageItems = packageItems.flatMap((item) => {
                    const qty = Math.max(1, Number(item.quantity || 1));
                    return Array.from({ length: qty }, () => item);
                });

                if (paymentMethod === 'QRIS' && expandedPackageItems.length > 1) {
                    alert('QRIS untuk multi paket belum didukung dalam satu checkout. Gunakan Cash/Card/Transfer atau proses QRIS satu paket per transaksi.');
                    return;
                }

                const createdPayments: Array<{ sourceId: string; amount: number; customer: string; description: string }> = [];

                for (const packageItem of expandedPackageItems) {
                    const orderRes = await fetch('/api/package-orders', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            customerId,
                            packageId: packageItem._id,
                        }),
                    });

                    const orderData = await orderRes.json();
                    if (!orderData.success || !orderData.data?.payment) {
                        alert(orderData.error || 'Gagal membuat order paket');
                        return;
                    }

                    createdPayments.push(orderData.data.payment);
                }

                if (paymentMethod === 'QRIS') {
                    const payment = createdPayments[0];
                    const qrisRes = await fetch('/api/payments/xendit/create-invoice', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            sourceType: 'package_order',
                            sourceId: payment.sourceId,
                            amount: payment.amount,
                            customer: payment.customer,
                            description: payment.description,
                        }),
                    });

                    const qrisData = await qrisRes.json() as QrisCreateResponse;
                    if (!qrisData.success || !qrisData.data) {
                        alert(qrisData.error || 'Gagal membuat pembayaran QRIS paket');
                        return;
                    }

                    setCart([]);
                    setDiscount(0);
                    setStaffTips({});
                    setSelectedCustomer('');
                    setServiceStaffAssignments({});
                    setServiceSplitModes({});
                    setPackageClaims({});
                    setAmountPaid('');
                    setQrisSession({
                        externalId: qrisData.data.externalId,
                        checkoutUrl: qrisData.data.checkoutUrl,
                        invoiceId: '',
                        status: qrisData.data.status || 'pending',
                        sourceType: 'package_order',
                    });
                    setIsQrisModalOpen(true);
                    return;
                }

                if (isMarkedPaid) {
                    for (const payment of createdPayments) {
                        const markPaidRes = await fetch(`/api/package-orders/${payment.sourceId}`, {
                            method: 'PATCH',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                paid: true,
                                paymentMethod,
                            }),
                        });

                        const markPaidData = await markPaidRes.json();
                        if (!markPaidData.success) {
                            alert(markPaidData.error || 'Gagal konfirmasi pembayaran paket');
                            return;
                        }
                    }

                    alert(`Pembayaran ${createdPayments.length} paket tersimpan dan paket customer langsung aktif.`);
                } else {
                    alert(`Order ${createdPayments.length} paket dibuat sebagai belum dibayar (pending). Paket akan aktif setelah dilunasi.`);
                }

                setCart([]);
                setDiscount(0);
                setStaffTips({});
                setSelectedCustomer('');
                setFollowUpPhoneNumber('');
                setServiceStaffAssignments({});
                setServiceSplitModes({});
                setPackageClaims({});
                setAmountPaid('');
                return;
            }

            const { payableSubtotal, tax, total, tips, commission, assignments, lineItemSplits, redeemItems } = calculateTotal();

            const isQrisPayment = paymentMethod === 'QRIS';
            const paid = isQrisPayment
                ? 0
                : (isMarkedPaid ? (amountPaid === "" ? total : parseFloat(amountPaid.toString())) : 0);
            const status = isQrisPayment
                ? "pending"
                : (isMarkedPaid ? (paid >= total ? "paid" : "partially_paid") : "pending");

            // Handle walking customer by setting customer to undefined
            const customerId = selectedCustomer === 'walking-customer' ? undefined : selectedCustomer;

            const payload = {
                customer: customerId,
                followUpPhoneNumber: followUpPhoneNumber.trim() || undefined,
                items: cart.map(item => ({
                    ...(item.type === 'Service' && (packageClaims[getCartItemKey(item._id, item.type)]?.enabled) ? { metadata: { claimedFromPackage: true } } : {}),
                    ...(item.type === 'Service'
                        ? {
                            splitCommissionMode: (lineItemSplits[getCartItemKey(item._id, item.type)]?.splitCommissionMode || serviceSplitModes[getCartItemKey(item._id, item.type)] || 'auto'),
                            staffAssignments: (lineItemSplits[getCartItemKey(item._id, item.type)]?.staffAssignments || []).map((assignment) => ({
                                staff: assignment.staffId,
                                staffId: assignment.staffId,
                                percentage: assignment.percentage,
                                porsiPersen: assignment.porsiPersen,
                                commission: assignment.commission,
                                komisiNominal: assignment.komisiNominal,
                                tip: assignment.tip,
                            })),
                        }
                        : {}),
                    item: item._id,
                    itemModel: item.type,
                    name: item.name,
                    price: item.price,
                    quantity: item.quantity,
                    total: item.type === 'Service' && (packageClaims[getCartItemKey(item._id, item.type)]?.enabled)
                        ? 0
                        : item.price * item.quantity
                })),
                subtotal: payableSubtotal,
                tax,
                discount,
                tips,
                totalAmount: total,
                commission,
                sourceType: redeemItems.length === 0
                    ? 'normal_sale'
                    : 'package_redeem',
                staffAssignments: assignments.map(a => ({
                    staff: a.staffId,
                    staffId: a.staffId,
                    percentage: a.percentage,
                    porsiPersen: a.porsiPersen,
                    commission: a.commission,
                    komisiNominal: a.komisiNominal,
                    tip: a.tip
                })),
                staff: assignments[0]?.staffId || undefined, // Keep primary staff for compatibility
                amountPaid: 0,
                paymentMethod,
                status: status
            };

            const res = await fetch("/api/invoices", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });
            const data = await res.json();
            if (data.success) {
                if (redeemItems.length > 0 && customerId) {
                    const redeemRes = await fetch('/api/customer-packages/redeem', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            customerId,
                            invoiceId: data.data._id,
                            items: redeemItems,
                            note: 'Redeem from POS checkout',
                        }),
                    });

                    const redeemData = await redeemRes.json();
                    if (!redeemData.success) {
                        alert(redeemData.error || 'Failed to redeem package quota');
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

                    const qrisData = await qrisRes.json() as QrisCreateResponse;
                    if (!qrisData.success || !qrisData.data) {
                        alert(qrisData.error || "Gagal membuat pembayaran QRIS");
                        return;
                    }

                    setCart([]);
                    setDiscount(0);
                    setStaffTips({});
                    setSelectedCustomer("");
                    setFollowUpPhoneNumber('');
                    setServiceStaffAssignments({});
                    setServiceSplitModes({});
                    setPackageClaims({});
                    setAmountPaid("");
                    setQrisSession({
                        externalId: qrisData.data.externalId,
                        checkoutUrl: qrisData.data.checkoutUrl,
                        invoiceId: data.data._id,
                        status: qrisData.data.status || 'pending',
                        sourceType: 'invoice',
                    });
                    setIsQrisModalOpen(true);
                    return;
                }

                // If there's a payment, create a deposit record
                if (paid > 0) {
                    await fetch("/api/deposits", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            invoice: data.data._id,
                            customer: customerId,
                            amount: paid,
                            paymentMethod,
                            notes: "Initial payment from POS"
                        }),
                    });
                }

                setCart([]);
                setDiscount(0);
                setStaffTips({});
                setSelectedCustomer("");
                setFollowUpPhoneNumber('');
                setServiceStaffAssignments({});
                setServiceSplitModes({});
                setPackageClaims({});
                setAmountPaid("");
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
            const res = await fetch(`/api/payments/xendit/status/${qrisSession.externalId}`);
            const statusData = await res.json() as QrisStatusResponse;
            if (!statusData.success || !statusData.data) {
                alert(statusData.error || 'Gagal cek status QRIS');
                return;
            }

            setQrisSession(prev => prev ? { ...prev, status: statusData.data!.status } : prev);

            if (statusData.data.status === 'paid') {
                if (statusData.data.sourceType === 'package_order' || qrisSession?.sourceType === 'package_order') {
                    alert('Pembayaran QRIS paket berhasil. Paket customer sudah aktif.');
                    setIsQrisModalOpen(false);
                    return;
                }

                alert('Pembayaran QRIS berhasil. Invoice sudah diperbarui.');
                setIsQrisModalOpen(false);
                const invoiceId = statusData.data.sourceId || qrisSession?.invoiceId;
                if (invoiceId) {
                    router.push(`/invoices/print/${invoiceId}`);
                }
            }
        } catch (error) {
            console.error(error);
            alert('Gagal cek status QRIS');
        } finally {
            setCheckingQris(false);
        }
    };

    const { subtotal, payableSubtotal, tax, total, tips, commission, assignments } = calculateTotal();
    const hasInvalidSplitInCart = cart.some((item) => {
        if (item.type !== 'Service') return false;
        return !getSplitCommissionPreviewForItem(item).isValid;
    });
    const enteredPaidAmount = amountPaid === "" ? 0 : parseFloat(amountPaid.toString()) || 0;
    const changeAmount = Math.max(0, enteredPaidAmount - total);
    const [mobileTab, setMobileTab] = useState<'catalog' | 'cart'>('catalog');
    const availableDeals = getAvailableDeals();

    return (
        <div className="flex h-[100dvh] w-full bg-gray-50 overflow-hidden flex-col md:flex-row">
            {/* Left Side: Items Catalog */}
            <div className={`flex-1 flex flex-col min-w-0 border-r border-gray-200 bg-white ${mobileTab === 'cart' ? 'hidden md:flex' : 'flex'}`}>
                <div className="bg-white flex flex-col h-full overflow-hidden">
                    {/* Header/Tabs */}
                    <div className="px-4 py-3 md:px-6 md:py-4 border-b border-gray-200 sticky top-0 bg-white z-10">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                            <h1 className="text-lg md:text-xl font-bold text-gray-800">POS System</h1>
                            <div className="flex items-center gap-2 md:gap-3 flex-wrap sm:flex-nowrap">
                                <button
                                    onClick={() => router.push("/dashboard")}
                                    className="inline-flex items-center gap-2 px-3 py-2 bg-gray-100 text-gray-700 rounded-lg text-xs md:text-sm font-medium hover:bg-gray-200 transition-colors"
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
                                        className="w-full pl-9 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-xs md:text-sm focus:outline-none focus:ring-2 focus:ring-blue-900"
                                    />
                                </div>
                            </div>
                        </div>
                        <div className="flex gap-2">
                            <button
                                onClick={() => setActiveTab('services')}
                                className={`flex-1 sm:flex-none px-4 py-2 rounded-lg text-xs md:text-sm font-medium transition-colors ${activeTab === 'services' ? 'bg-blue-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                            >
                                Services
                            </button>
                            <button
                                onClick={() => setActiveTab('products')}
                                className={`flex-1 sm:flex-none px-4 py-2 rounded-lg text-xs md:text-sm font-medium transition-colors ${activeTab === 'products' ? 'bg-blue-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                            >
                                Products
                            </button>
                            <button
                                onClick={() => setActiveTab('packages')}
                                className={`flex-1 sm:flex-none px-4 py-2 rounded-lg text-xs md:text-sm font-medium transition-colors ${activeTab === 'packages' ? 'bg-blue-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                            >
                                Packages
                            </button>
                        </div>
                    </div>

                    {/* Grid */}
                    <div className="flex-1 overflow-y-auto p-3 md:p-4 bg-gray-50 pb-20 md:pb-4">
                        {loading ? (
                            <div className="flex justify-center py-20"><div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-900 border-t-transparent"></div></div>
                        ) : activeTab === 'packages' && filteredItems.length === 0 ? (
                            <div className="h-full flex flex-col items-center justify-center text-center px-4">
                                <div className="w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center mb-3">
                                    <Package className="w-6 h-6 text-amber-600" />
                                </div>
                                <p className="text-sm font-semibold text-gray-800 mb-1">Belum ada paket aktif</p>
                                <p className="text-xs text-gray-500 mb-3">Buat dulu master paket di halaman Packages, lalu paket akan muncul di POS.</p>
                                <button
                                    type="button"
                                    onClick={() => router.push('/packages')}
                                    className="px-3 py-2 text-xs font-semibold rounded-lg bg-blue-900 text-white hover:bg-blue-800"
                                >
                                    Buka Halaman Packages
                                </button>
                            </div>
                        ) : (
                            <div className="grid grid-cols-2 xs:grid-cols-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-2 md:gap-3">
                                {filteredItems.map(item => (
                                    <div
                                        key={item._id}
                                        onClick={() => addToCart(item)}
                                        className="bg-white p-2 md:p-3 rounded-lg shadow-sm border border-gray-200 cursor-pointer hover:shadow-md transition-shadow flex flex-col items-center text-center group min-h-[120px] md:min-h-[132px] active:scale-95 duration-75"
                                    >
                                        <div className="w-8 h-8 md:w-10 md:h-10 rounded-full flex items-center justify-center mb-1 md:mb-2 group-hover:scale-110 transition-transform">
                                            {item.type === 'Service' ? (
                                                <div className="w-7 h-7 md:w-9 md:h-9 rounded-full bg-purple-100 flex items-center justify-center">
                                                    <ScissorsIcon className="w-4 h-4 md:w-5 md:h-5 text-purple-600" />
                                                </div>
                                            ) : item.type === 'Product' ? (
                                                <div className="w-7 h-7 md:w-9 md:h-9 rounded-full bg-green-100 flex items-center justify-center">
                                                    <Package className="w-4 h-4 md:w-5 md:h-5 text-green-600" />
                                                </div>
                                            ) : (
                                                <div className="w-7 h-7 md:w-9 md:h-9 rounded-full bg-amber-100 flex items-center justify-center">
                                                    <Package className="w-4 h-4 md:w-5 md:h-5 text-amber-600" />
                                                </div>
                                            )}
                                        </div>
                                        <h3 className="font-semibold text-gray-800 text-[10px] md:text-xs leading-tight line-clamp-2 mb-1 h-8 flex items-center justify-center">{item.name}</h3>
                                        <p className="text-blue-900 font-bold text-xs md:text-sm">{settings.symbol}{item.price}</p>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Right Side: Cart */}
            <div className={`w-full md:w-[460px] lg:w-[540px] xl:w-[600px] md:flex-none flex flex-col bg-white border-l border-gray-200 ${mobileTab === 'catalog' ? 'hidden md:flex' : 'flex'} h-full`}>
                <div className="bg-white flex flex-col h-full overflow-hidden">
                    <div className="p-3 md:p-4 border-b border-gray-200 bg-gray-50 flex-shrink-0 space-y-3">
                        <div className="flex items-center gap-2">
                            <User className="w-4 h-4 md:w-5 md:h-5 text-gray-500 flex-shrink-0" />
                            <SearchableSelect
                                placeholder="Select Customer"
                                value={selectedCustomer}
                                onChange={(val) => setSelectedCustomer(val)}
                                options={[
                                    { value: 'walking-customer', label: 'Walking Customer' },
                                    ...customers.map((c) => ({
                                        value: c._id,
                                        label: `${c.name} ${c.phone ? `(${c.phone})` : ''}`,
                                        showGreenIndicator: Number(c.packageSummary?.activePackages || 0) > 0,
                                    })),
                                ]}
                                className="flex-1"
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
                                disabled={!selectedCustomer || selectedCustomer === 'walking-customer'}
                                className="p-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                                title="My Deals"
                            >
                                <Package className="w-4 h-4" />
                            </button>
                        </div>

                        {selectedCustomer && selectedCustomer !== 'walking-customer' && (
                            <div className="flex items-center justify-between rounded-lg border border-amber-100 bg-amber-50 px-3 py-2">
                                <p className="text-[11px] text-amber-800 font-semibold">
                                    My Deals: {availableDeals.length} reward tersedia
                                </p>
                                <button
                                    type="button"
                                    onClick={() => setIsDealsModalOpen(true)}
                                    className="text-[10px] font-bold uppercase tracking-wide text-amber-700 hover:text-amber-900"
                                >
                                    Lihat Paket
                                </button>
                            </div>
                        )}

                        {selectedCustomer === 'walking-customer' && (
                            <div className="space-y-1">
                                <label className="text-[11px] font-semibold text-gray-700">Nomor WhatsApp (Walking Customer)</label>
                                <input
                                    type="text"
                                    value={followUpPhoneNumber}
                                    onChange={(e) => setFollowUpPhoneNumber(e.target.value)}
                                    placeholder="Contoh: 08123456789"
                                    className="w-full h-9 px-3 text-xs md:text-sm bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                                />
                                <p className="text-[10px] text-gray-500">
                                    Isi hanya jika customer belum terdaftar. Nomor ini dipakai untuk WA follow-up setelah layanan.
                                </p>
                            </div>
                        )}
                    </div>

                    {/* Cart Items */}
                    <div className="flex-grow overflow-y-auto p-2 md:p-3 space-y-2 pb-24 md:pb-2">
                        {cart.length === 0 ? (
                            <div className="h-full flex flex-col items-center justify-center text-gray-400 py-10">
                                <ShoppingCart className="w-8 h-8 md:w-10 md:h-10 mb-2 opacity-30" />
                                <p className="text-xs md:text-sm">Cart is empty</p>
                            </div>
                        ) : (
                            cart.map(item => (
                                <div key={item._id} className="p-2 border border-gray-100 rounded-lg bg-white shadow-sm space-y-2">
                                    <div className="flex items-center justify-between gap-1">
                                        <div className="flex items-center gap-2 overflow-hidden flex-1">
                                            <div className="flex-shrink-0">
                                                {item.type === 'Service' ? (
                                                    <div className="w-6 h-6 rounded-full bg-purple-100 flex items-center justify-center">
                                                        <ScissorsIcon className="w-3 h-3 text-purple-600" />
                                                    </div>
                                                ) : (
                                                    <div className="w-6 h-6 rounded-full bg-green-100 flex items-center justify-center">
                                                        <Package className="w-3 h-3 text-green-600" />
                                                    </div>
                                                )}
                                            </div>
                                            <div className="min-w-0">
                                                <p className="text-[10px] md:text-xs font-semibold text-gray-800 truncate">{item.name}</p>
                                                <p className="text-[9px] md:text-[10px] text-gray-500">{settings.symbol}{item.price}</p>
                                                {(() => {
                                                    if (item.type !== 'Service') return null;
                                                    const claim = packageClaims[getCartItemKey(item._id, item.type)];
                                                    if (!claim?.enabled || !claim.customerPackageId) return null;
                                                    const pkg = customerPackages.find((entry) => entry._id === claim.customerPackageId);
                                                    const quota = pkg?.serviceQuotas.find((entry) => String(entry.service) === String(item._id));

                                                    return (
                                                        <p className="text-[9px] md:text-[10px] text-amber-700 font-bold truncate">
                                                            Reward: {pkg?.packageName || 'Paket'} ({quota ? `${quota.remainingQuota}/${quota.totalQuota}` : 'Claim'})
                                                        </p>
                                                    );
                                                })()}
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-1 flex-shrink-0">
                                            <button onClick={() => updateQuantity(item._id, item.type, -1)} className="p-1 hover:bg-gray-200 rounded text-gray-600"><Minus className="w-2.5 h-2.5 md:w-3 md:h-3" /></button>
                                            <span className="text-[10px] md:text-xs font-bold w-4 text-center">{item.quantity}</span>
                                            <button onClick={() => updateQuantity(item._id, item.type, 1)} className="p-1 hover:bg-gray-200 rounded text-gray-600"><Plus className="w-2.5 h-2.5 md:w-3 md:h-3" /></button>
                                            <button onClick={() => removeFromCart(item._id, item.type)} className="p-1 hover:bg-red-50 text-red-500 rounded ml-0.5"><Trash2 className="w-2.5 h-2.5 md:w-3 md:h-3" /></button>
                                        </div>
                                    </div>
                                    {item.type === 'Service' && (
                                        <div className="pl-8 space-y-1.5">
                                            {(() => {
                                                const key = getCartItemKey(item._id, item.type);
                                                const splitMode = serviceSplitModes[key] || 'auto';
                                                const effectiveAssignments = getEffectiveServiceAssignments(item._id, item.type);
                                                const totalSplit = getTotalSplitPercentage(effectiveAssignments);
                                                const splitValid = isSplitTotalValid(effectiveAssignments);
                                                const splitPreview = getSplitCommissionPreviewForItem(item);

                                                return (
                                                    <div className="space-y-1.5">
                                                        <div className="flex items-center justify-between gap-1 bg-slate-50 border border-slate-200 rounded p-1.5">
                                                            <span className="text-[10px] font-bold text-slate-700">Assignment Staff & Komisi</span>
                                                            <div className="inline-flex rounded border border-slate-300 overflow-hidden text-[10px] font-bold">
                                                                <button
                                                                    type="button"
                                                                    onClick={() => updateServiceSplitMode(item._id, item.type, 'auto')}
                                                                    className={`px-2 py-0.5 ${splitMode === 'auto' ? 'bg-slate-700 text-white' : 'bg-white text-slate-600'}`}
                                                                >
                                                                    Auto 50:50
                                                                </button>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => updateServiceSplitMode(item._id, item.type, 'manual')}
                                                                    className={`px-2 py-0.5 ${splitMode === 'manual' ? 'bg-slate-700 text-white' : 'bg-white text-slate-600'}`}
                                                                >
                                                                    Manual
                                                                </button>
                                                            </div>
                                                        </div>

                                                        <div className={`text-[9px] font-bold ${splitValid ? 'text-emerald-600' : 'text-red-600'}`}>
                                                            Total porsi: {roundTwo(totalSplit)}% {splitValid ? 'OK' : '(harus 100%)'}
                                                        </div>
                                                        {!splitPreview.isValid && (
                                                            <div className="text-[9px] font-bold text-red-600">
                                                                {splitPreview.errors[0]}
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })()}

                                            <div className="flex items-center justify-between gap-2 bg-amber-50 border border-amber-100 rounded p-1.5">
                                                <label className="flex items-center gap-1.5 text-[10px] font-bold text-amber-700">
                                                    <input
                                                        type="checkbox"
                                                        checked={Boolean(packageClaims[getCartItemKey(item._id, item.type)]?.enabled)}
                                                        onChange={(e) => togglePackageClaim(item._id, item.type, e.target.checked)}
                                                        disabled={!selectedCustomer || selectedCustomer === 'walking-customer'}
                                                    />
                                                    Claim Paket
                                                </label>
                                                {(!selectedCustomer || selectedCustomer === 'walking-customer') && (
                                                    <span className="text-[9px] text-amber-600">Pilih customer dulu</span>
                                                )}
                                            </div>

                                            {packageClaims[getCartItemKey(item._id, item.type)]?.enabled && (
                                                <SearchableSelect
                                                    placeholder="Pilih paket customer"
                                                    value={packageClaims[getCartItemKey(item._id, item.type)]?.customerPackageId || ""}
                                                    onChange={(val) => setPackageClaimId(item._id, item.type, val)}
                                                    options={getServicePackageOptions(item._id)}
                                                    className="w-full h-8"
                                                />
                                            )}

                                            <SearchableSelect
                                                placeholder="Assign staff"
                                                value=""
                                                onChange={(val) => addServiceStaffAssignment(item._id, item.type, val)}
                                                options={staffList.map(s => ({ value: s._id, label: s.name }))}
                                                className="w-full h-8"
                                            />
                                            {(serviceStaffAssignments[getCartItemKey(item._id, item.type)] || []).length > 0 && (
                                                <div className="space-y-1">
                                                    {(() => {
                                                        const previewResult = getSplitCommissionPreviewForItem(item);
                                                        const previewMap = new Map(previewResult.assignments.map((a) => [a.staffId, a.komisiNominal]));

                                                        return getEffectiveServiceAssignments(item._id, item.type).map(assignment => {
                                                            const splitMode = serviceSplitModes[getCartItemKey(item._id, item.type)] || 'auto';
                                                            const staff = staffList.find(s => s._id === assignment.staffId);
                                                            return (
                                                                <div key={assignment.staffId} className="flex items-center gap-1.5 bg-blue-50 p-1 rounded border border-blue-100">
                                                                    <p className="text-[9px] font-bold text-gray-800 flex-1 truncate">{staff?.name}</p>
                                                                    <div className="flex items-center gap-1 bg-white px-1 py-0.5 rounded border border-blue-200">
                                                                        <input
                                                                            type="number"
                                                                            min="0"
                                                                            max="100"
                                                                            value={assignment.percentage}
                                                                            onChange={(e) => updateServiceStaffPercentage(item._id, item.type, assignment.staffId, parseFloat(e.target.value) || 0)}
                                                                            disabled={splitMode === 'auto'}
                                                                            className={`w-12 md:w-14 text-right text-xs md:text-sm font-black bg-transparent focus:outline-none ${splitMode === 'auto' ? 'text-blue-400' : 'text-blue-900'}`}
                                                                        />
                                                                        <span className="text-[10px] md:text-xs font-bold text-blue-900">%</span>
                                                                    </div>
                                                                    <button
                                                                        onClick={() => removeServiceStaffAssignment(item._id, item.type, assignment.staffId)}
                                                                        className="p-1 hover:bg-red-50 text-gray-400 hover:text-red-500 rounded transition-colors"
                                                                    >
                                                                        <Trash2 className="w-2.5 h-2.5" />
                                                                    </button>
                                                                    <span className="text-[9px] font-bold text-emerald-700 min-w-[78px] text-right">
                                                                        {settings.symbol}{(previewMap.get(assignment.staffId) || 0).toLocaleString('id-ID', { maximumFractionDigits: 0 })}
                                                                    </span>
                                                                </div>
                                                            );
                                                        });
                                                    })()}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                    {item.type === 'Package' && (
                                        <div className="pl-8">
                                            
                                        </div>
                                    )}
                                </div>
                            ))
                        )}
                    </div>

                    {/* Summary - Sticky at bottom */}
                    <div className="flex-shrink-0 p-3 bg-gray-50 border-t border-gray-200 overflow-y-auto pb-20 md:pb-3 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
                        <div className="space-y-1 mb-3 text-[10px] md:text-xs">
                            <div className="flex justify-between text-gray-600">
                                <span>Subtotal</span>
                                <span>{settings.symbol}{subtotal.toLocaleString('id-ID', { maximumFractionDigits: 0 })}</span>
                            </div>
                            {payableSubtotal !== subtotal && (
                                <div className="flex justify-between text-amber-600">
                                    <span>Subtotal Dibayar</span>
                                    <span>{settings.symbol}{payableSubtotal.toLocaleString('id-ID', { maximumFractionDigits: 0 })}</span>
                                </div>
                            )}
                            <div className="flex justify-between text-gray-600">
                                <span>Tax ({settings.taxRate}%)</span>
                                <span>{settings.symbol}{tax.toLocaleString('id-ID', { maximumFractionDigits: 0 })}</span>
                            </div>
                            {(commission > 0 || tips > 0) && (
                                <div className="space-y-1 bg-indigo-50 px-2 py-1.5 rounded border border-indigo-100/50">
                                    <div className="flex justify-between text-indigo-600 font-bold mb-1 border-b border-indigo-200/50 pb-0.5 px-1">
                                        <span>Staff Earnings</span>
                                        <div className="flex gap-4 text-[8px] uppercase tracking-tighter">
                                            <span>Comm</span>
                                            <span className="w-10 text-right">Tip</span>
                                        </div>
                                    </div>
                                    {assignments.map((assignment, idx) => {
                                        const staff = staffList.find(s => s._id === assignment.staffId);
                                        return (
                                            <div key={idx} className="flex items-center justify-between text-[10px] text-indigo-700 bg-white/50 p-1 rounded">
                                                <span className="truncate font-medium flex-1">{staff?.name}</span>
                                                <div className="flex items-center gap-2">
                                                    <span className="text-[9px] text-indigo-400">{settings.symbol}{(assignment.commission || 0).toLocaleString('id-ID', { maximumFractionDigits: 0 })}</span>
                                                    <div className="flex items-center gap-0.5 bg-indigo-100 px-1 rounded border border-indigo-200">
                                                        <span className="text-[8px] font-bold text-indigo-400">{settings.symbol}</span>
                                                        <input
                                                            type="number"
                                                            min="0"
                                                            value={staffTips[assignment.staffId] || ""}
                                                            placeholder="0"
                                                            onChange={(e) => setStaffTips(prev => ({ ...prev, [assignment.staffId]: parseFloat(e.target.value) || 0 }))}
                                                            className="w-8 text-right bg-transparent focus:outline-none font-bold text-indigo-900"
                                                        />
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                            <div className="flex justify-between text-gray-600 items-center">
                                <span>Discount</span>
                                <input
                                    type="number"
                                    value={discount}
                                    onChange={(e) => setDiscount(parseFloat(e.target.value) || 0)}
                                    className="w-16 text-right text-[10px] md:text-xs border border-gray-300 rounded px-1 py-0.5 focus:ring-1 focus:ring-blue-900 outline-none"
                                    min="0"
                                />
                            </div>
                            {tips > 0 && (
                                <div className="flex justify-between text-indigo-600 items-center animate-in fade-in slide-in-from-right-2 duration-300">
                                    <span className="flex items-center gap-1">
                                        Tips
                                        <span className="text-[8px] bg-indigo-100 px-1 rounded uppercase tracking-tighter">Auto</span>
                                    </span>
                                    <span className="font-bold">{settings.symbol}{tips.toLocaleString('id-ID', { maximumFractionDigits: 0 })}</span>
                                </div>
                            )}
                            <div className="flex justify-between items-center text-blue-900 border-t border-gray-200 pt-1.5 mt-1">
                                <span className="text-[10px] font-bold">Paid</span>
                                <input
                                    type="number"
                                    placeholder={total.toLocaleString('id-ID', { maximumFractionDigits: 0 })}
                                    value={amountPaid}
                                    onChange={(e) => setAmountPaid(e.target.value)}
                                    className="w-20 text-right text-[10px] md:text-xs border-2 border-blue-900/20 rounded px-1 py-0.5 focus:border-blue-900 outline-none font-bold"
                                />
                            </div>
                            <div className="flex justify-between text-sm md:text-base font-black text-gray-900 pt-1 border-t border-gray-200">
                                <span> {parseFloat(amountPaid.toString()) < total ? 'Due' : 'Total'}</span>
                                <span className={parseFloat(amountPaid.toString()) < total ? 'text-red-600' : 'text-blue-900'}>
                                    {settings.symbol}{(parseFloat(amountPaid.toString()) < total ? (total - (parseFloat(amountPaid.toString()) || 0)) : total).toLocaleString('id-ID', { maximumFractionDigits: 0 })}
                                </span>
                            </div>
                        </div>

                        <div className="mb-3">
                            <div className="grid grid-cols-4 gap-1 md:gap-1.5">
                                {['Cash', 'Card', 'Wallet', 'QRIS'].map(method => (
                                    <button
                                        key={method}
                                        onClick={() => setPaymentMethod(method)}
                                        className={`py-1.5 text-[9px] md:text-[10px] uppercase tracking-wider font-bold rounded border transition-all ${paymentMethod === method ? 'bg-blue-900 text-white border-blue-900 shadow-sm' : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300'}`}
                                    >
                                        {method}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <FormButton
                            onClick={() => { void handleCheckout(); }}
                            loading={submitting}
                            disabled={hasInvalidSplitInCart || cart.length === 0}
                            variant="success"
                            className="w-full py-4 md:py-4 text-xs md:text-sm uppercase tracking-widest font-black shadow-lg hover:shadow-xl active:translate-y-0.5 transition-all mb-4"
                            icon={<CreditCard className="w-4 h-4" />}
                        >
                            Complete Order
                        </FormButton>
                    </div>
                </div>
            </div>

            {/* Mobile Navigation Bar */}
            <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 flex items-center justify-around h-16 z-50 px-2 shadow-[0_-4px_10px_rgba(0,0,0,0.05)]">
                <button
                    onClick={() => setMobileTab('catalog')}
                    className={`flex flex-col items-center justify-center w-20 h-full transition-all ${mobileTab === 'catalog' ? 'text-blue-900 scale-110' : 'text-gray-400'}`}
                >
                    <LayoutDashboard className="w-5 h-5 mb-1" />
                    <span className="text-[10px] font-bold">Catalog</span>
                    {mobileTab === 'catalog' && <div className="absolute top-0 w-8 h-1 bg-blue-900 rounded-b-full"></div>}
                </button>
                <div className="w-px h-8 bg-gray-100"></div>
                <button
                    onClick={() => setMobileTab('cart')}
                    className={`flex flex-col items-center justify-center w-20 h-full transition-all relative ${mobileTab === 'cart' ? 'text-blue-900 scale-110' : 'text-gray-400'}`}
                >
                    <div className="relative">
                        <ShoppingCart className="w-5 h-5 mb-1" />
                        {cart.length > 0 && (
                            <span className="absolute -top-1 -right-2 bg-red-500 text-white text-[8px] font-bold w-4 h-4 rounded-full flex items-center justify-center animate-pulse">
                                {cart.reduce((a, b) => a + b.quantity, 0)}
                            </span>
                        )}
                    </div>
                    <span className="text-[10px] font-bold">Cart</span>
                    {mobileTab === 'cart' && <div className="absolute top-0 w-8 h-1 bg-blue-900 rounded-b-full"></div>}
                </button>
            </div>

            <Modal
                isOpen={isCustomerModalOpen}
                onClose={() => setIsCustomerModalOpen(false)}
                title="Add New Customer"
            >
                <CustomerForm
                    onSuccess={(newCustomer) => {
                        setCustomers(prev => [newCustomer, ...prev]);
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
                    {!selectedCustomer || selectedCustomer === 'walking-customer' ? (
                        <p className="text-sm text-gray-500">Pilih customer terdaftar dulu untuk melihat paket.</p>
                    ) : availableDeals.length === 0 ? (
                        <p className="text-sm text-gray-500">Customer belum punya reward paket aktif.</p>
                    ) : (
                        availableDeals.map((deal, index) => (
                            <div key={`${deal.customerPackageId}-${deal.serviceId}-${index}`} className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                                <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0">
                                        <p className="text-xs font-black text-amber-900 uppercase tracking-wide">
                                            {deal.packageCode ? `${deal.packageCode} ` : ''}{deal.serviceName}
                                        </p>
                                        <p className="text-xs text-amber-800 mt-0.5">
                                            Reward: {deal.packageName} ({deal.remainingQuota}/{deal.totalQuota})
                                        </p>
                                        <p className="text-[11px] text-amber-700 mt-0.5">
                                            Exp: {deal.expiresAt ? new Date(deal.expiresAt).toLocaleDateString('id-ID') : '-'}
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
                isOpen={isQrisModalOpen}
                onClose={() => setIsQrisModalOpen(false)}
                title="Pembayaran QRIS"
            >
                <div className="space-y-4">
                    <p className="text-sm text-gray-600">Status: <span className="font-bold uppercase text-gray-900">{qrisSession?.status || 'pending'}</span></p>
                    <p className="text-xs text-gray-500 break-all">External ID: {qrisSession?.externalId || '-'}</p>

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
                        <FormButton onClick={checkQrisStatus} loading={checkingQris} variant="secondary">
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
                        Payment method: <span className="font-semibold">{paymentMethod}</span>. Has this transaction been paid?
                    </p>
                    <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm space-y-1">
                        <div className="flex justify-between text-gray-600">
                            <span>Total</span>
                            <span className="font-semibold text-gray-900">{settings.symbol}{total.toLocaleString('id-ID', { maximumFractionDigits: 0 })}</span>
                        </div>
                        <div className="flex justify-between text-gray-600">
                            <span>Paid Amount</span>
                            <span className="font-semibold text-gray-900">{settings.symbol}{enteredPaidAmount.toLocaleString('id-ID', { maximumFractionDigits: 0 })}</span>
                        </div>
                        {changeAmount > 0 && (
                            <div className="flex justify-between text-emerald-700 font-semibold border-t border-emerald-200 pt-1 mt-1">
                                <span>Change</span>
                                <span>{settings.symbol}{changeAmount.toLocaleString('id-ID', { maximumFractionDigits: 0 })}</span>
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
                <div className="fixed bottom-20 md:bottom-6 right-3 md:right-6 z-[70] px-4 py-2 rounded-lg bg-emerald-600 text-white text-xs md:text-sm font-bold shadow-xl">
                    {toastMessage}
                </div>
            )}
        </div>
    );
}
