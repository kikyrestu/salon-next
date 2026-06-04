import { getTenantModels } from "@/lib/tenantDb";
import { NextRequest, NextResponse } from "next/server";
import { checkPermissionWithSession } from "@/lib/rbac";
import { logActivity } from "@/lib/logger";

export async function POST(request: NextRequest) {
    const tenantSlug = request.headers.get('x-store-slug') || 'pusat';
    const { CashBalance, CashLog, User, Settings } = await getTenantModels(tenantSlug);

    try {
        const { error: permissionError, session } = await checkPermissionWithSession(request, 'pos', 'create');
        if (permissionError) return permissionError;
        const userId = (session as any)?.user?.id;

        const body = await request.json();
        const { target, newBalance, notes, ownerPassword } = body;

        // Validate input
        if (!target || !['bank', 'owner'].includes(target)) {
            return NextResponse.json({ success: false, error: "Target harus 'bank' atau 'owner'" }, { status: 400 });
        }
        if (newBalance === undefined || newBalance === null || newBalance < 0) {
            return NextResponse.json({ success: false, error: "Saldo baru harus angka positif atau nol" }, { status: 400 });
        }
        if (!notes || !notes.trim()) {
            return NextResponse.json({ success: false, error: "Catatan/alasan wajib diisi untuk audit trail" }, { status: 400 });
        }
        if (!ownerPassword) {
            return NextResponse.json({ success: false, error: "Password diperlukan untuk penyesuaian saldo" }, { status: 401 });
        }

        // Validate password — use ownerTransferPassword, fallback to stockAdjustmentPassword, then Super Admin password
        const settings = await Settings.findOne();
        let isAuthorized = false;

        const ownerPass = settings?.ownerTransferPassword;
        const stockPass = settings?.stockAdjustmentPassword;

        if (ownerPass && ownerPass === ownerPassword) {
            isAuthorized = true;
        } else if (!ownerPass && stockPass && stockPass === ownerPassword) {
            isAuthorized = true;
        } else {
            // Fallback to Super Admin password
            const superAdmins = await User.find({}).select('+password').populate('role');
            for (const admin of superAdmins) {
                const isAdminOrOwner = (admin as any).role?.name === 'Super Admin' || (admin as any).role?.name === 'Owner';
                if (isAdminOrOwner) {
                    const isValid = await (admin as any).comparePassword(ownerPassword);
                    if (isValid) {
                        isAuthorized = true;
                        break;
                    }
                }
            }
        }

        if (!isAuthorized) {
            return NextResponse.json({ success: false, error: "Password salah atau Anda tidak memiliki akses" }, { status: 403 });
        }

        // Get current balance
        let balance = await CashBalance.findOne();
        if (!balance) balance = await CashBalance.create({ kasirBalance: 0, brankasBalance: 0, bankBalance: 0, ownerBalance: 0 });

        const oldBalance = target === 'bank' ? balance.bankBalance : (balance.ownerBalance || 0);
        const difference = newBalance - oldBalance;

        // Update balance
        if (target === 'bank') {
            balance.bankBalance = newBalance;
        } else {
            balance.ownerBalance = newBalance;
        }
        balance.lastUpdatedAt = new Date();
        await balance.save();

        // Create audit log
        const targetLabel = target === 'bank' ? 'Disetor Ke Bank' : 'Diambil Owner';
        await CashLog.create({
            type: 'adjustment',
            amount: Math.abs(difference),
            sourceLocation: 'system',
            destinationLocation: target,
            performedBy: userId,
            description: `Adjust saldo "${targetLabel}": ${oldBalance} → ${newBalance}. Alasan: ${notes}`,
            balanceAfter: {
                kasir: balance.kasirBalance,
                brankas: balance.brankasBalance,
                bank: balance.bankBalance
            }
        });

        await logActivity({
            req: request,
            action: 'update',
            resource: 'CashBalance',
            details: `Adjusted ${targetLabel} from ${oldBalance} to ${newBalance}. Reason: ${notes}`
        });

        return NextResponse.json({ success: true, data: { balance } });

    } catch (error: any) {
        console.error("Cash Adjust API Error:", error);
        return NextResponse.json(
            { success: false, error: "Failed to adjust balance" },
            { status: 500 }
        );
    }
}
