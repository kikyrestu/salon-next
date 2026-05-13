import { getTenantModels } from "@/lib/tenantDb";
import { NextRequest, NextResponse } from "next/server";




import { checkPermissionWithSession } from "@/lib/rbac";
import { logActivity } from "@/lib/logger";

export async function POST(request: NextRequest, props: any) {
    const tenantSlug = request.headers.get('x-store-slug') || 'pusat';
    const { CashBalance, CashLog, User } = await getTenantModels(tenantSlug);

    try {
        
        

        // [B14 FIX] Gunakan checkPermissionWithSession — 1 auth() call
        const { error: permissionError, session } = await checkPermissionWithSession(request, 'pos', 'create');
        if (permissionError) return permissionError;
        const userId = (session as any)?.user?.id;

        const body = await request.json();
        const { source, destination, amount, notes, ownerPassword } = body;

        if (!source || !destination || !amount || amount <= 0) {
            return NextResponse.json({ success: false, error: "Invalid transfer parameters" }, { status: 400 });
        }

        // Validate Owner Password if moving from Brankas
        if (source === 'brankas' && (destination === 'bank' || destination === 'owner')) {
            if (!ownerPassword) {
                return NextResponse.json({ success: false, error: "Password Otoritas Owner diperlukan untuk transaksi ini" }, { status: 401 });
            }

            // Find an owner/super admin and verify password
            // Or verify against the current user if they are an owner
            // A generic approach: find any user with role 'Super Admin' whose password matches
            const superAdmins = await User.find({}).populate('role');
            let isAuthorized = false;

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

            if (!isAuthorized) {
                return NextResponse.json({ success: false, error: "Password Otoritas salah atau Anda tidak memiliki akses" }, { status: 403 });
            }
        }

        let balance = await CashBalance.findOne();
        if (!balance) balance = await CashBalance.create({ kasirBalance: 0, brankasBalance: 0, bankBalance: 0 });

        // Check if sufficient funds
        if (source === 'kasir' && balance.kasirBalance < amount) {
            return NextResponse.json({ success: false, error: "Saldo kasir tidak mencukupi" }, { status: 400 });
        }
        if (source === 'brankas' && balance.brankasBalance < amount) {
            return NextResponse.json({ success: false, error: "Saldo brankas tidak mencukupi" }, { status: 400 });
        }

        // Deduct from source
        if (source === 'kasir') balance.kasirBalance -= amount;
        else if (source === 'brankas') balance.brankasBalance -= amount;

        // Add to destination
        if (destination === 'brankas') balance.brankasBalance += amount;
        else if (destination === 'bank') balance.bankBalance += amount;
        // if destination === 'owner', money is taken out completely from the business tracking (or kept track in owner equity, but we just deduct it).

        balance.lastUpdatedAt = new Date();
        await balance.save();

        // Create log
        const log = await CashLog.create({
            type: 'transfer',
            amount,
            sourceLocation: source,
            destinationLocation: destination,
            performedBy: userId,
            description: notes || `Transfer from ${source} to ${destination}`,
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
            details: `Transferred ${amount} from ${source} to ${destination}`
        });

        return NextResponse.json({ success: true, data: { balance, log } });

    } catch (error: any) {
        console.error("Cash Transfer API Error:", error);
        return NextResponse.json(
            { success: false, error: "Failed to transfer cash" },
            { status: 500 }
        );
    }
}
