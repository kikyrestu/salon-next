import { getTenantModels } from "@/lib/tenantDb";
import { NextRequest, NextResponse } from "next/server";




import { checkPermissionWithSession } from "@/lib/rbac";
import { logActivity } from "@/lib/logger";

export async function POST(request: NextRequest, props: any) {
    const tenantSlug = request.headers.get('x-store-slug') || 'pusat';
    const { CashBalance, CashSession, CashLog } = await getTenantModels(tenantSlug);

    try {



        // [B14 FIX] Gunakan checkPermissionWithSession — 1 auth() call
        const { error: permissionError, session } = await checkPermissionWithSession(request, 'pos', 'create');
        if (permissionError) return permissionError;
        const userId = (session as any)?.user?.id;

        const body = await request.json();
        const action = body.action; // 'open' | 'close'

        if (action === 'open') {
            const { startingCash, notes } = body;

            // [B08 FIX] Cek sesi per kasir (openedBy), bukan global — kasir A tidak memblokir kasir B
            const existingSession = await CashSession.findOne({ status: 'open', openedBy: userId });
            if (existingSession) {
                return NextResponse.json({ success: false, error: "A session is already open" }, { status: 400 });
            }

            // Get balance
            let balance = await CashBalance.findOne();
            if (!balance) balance = await CashBalance.create({ kasirBalance: 0, brankasBalance: 0, bankBalance: 0 });

            // If startingCash is different from kasirBalance, it means they adjusted the modal
            const discrepancy = startingCash - balance.kasirBalance;

            // Update balance to match starting cash
            balance.kasirBalance = startingCash;
            balance.lastUpdatedAt = new Date();
            await balance.save();

            // Create session
            const cashSession = await CashSession.create({
                openedAt: new Date(),
                openedBy: userId,
                startingCash,
                status: 'open',
                notes
            });

            // Log if there was an adjustment
            if (discrepancy !== 0) {
                await CashLog.create({
                    type: 'adjustment',
                    amount: Math.abs(discrepancy),
                    sourceLocation: discrepancy > 0 ? 'owner' : 'kasir',
                    destinationLocation: discrepancy > 0 ? 'kasir' : 'system',
                    performedBy: userId,
                    description: `Modal adjustment during shift open (Discrepancy: ${discrepancy})`,
                    referenceModel: 'CashSession',
                    referenceId: cashSession._id,
                    balanceAfter: {
                        kasir: balance.kasirBalance,
                        brankas: balance.brankasBalance,
                        bank: balance.bankBalance
                    }
                });
            }

            // Log opening session
            await CashLog.create({
                type: 'open_session',
                amount: startingCash,
                sourceLocation: 'system',
                destinationLocation: 'kasir',
                performedBy: userId,
                description: `Shift opened with modal: ${startingCash}`,
                referenceModel: 'CashSession',
                referenceId: cashSession._id,
                balanceAfter: {
                    kasir: balance.kasirBalance,
                    brankas: balance.brankasBalance,
                    bank: balance.bankBalance
                }
            });

            await logActivity({
                req: request,
                action: 'create',
                resource: 'CashSession',
                details: `Opened cash session with starting cash ${startingCash}`
            });

            return NextResponse.json({ success: true, data: cashSession });

        } else if (action === 'close') {
            const { actualEndingCash, notes } = body;

            // [B08 FIX] Tutup sesi milik kasir ini saja
            const existingSession = await CashSession.findOne({ status: 'open', openedBy: userId });
            if (!existingSession) {
                return NextResponse.json({ success: false, error: "No active session to close" }, { status: 400 });
            }

            let balance = await CashBalance.findOne();
            if (!balance) balance = await CashBalance.create({ kasirBalance: 0, brankasBalance: 0, bankBalance: 0 });

            const expectedEndingCash = balance.kasirBalance;
            const discrepancy = actualEndingCash - expectedEndingCash;

            // Force update kasir balance to what they actually counted
            balance.kasirBalance = actualEndingCash;
            balance.lastUpdatedAt = new Date();
            await balance.save();

            existingSession.closedAt = new Date();
            existingSession.closedBy = userId;
            existingSession.expectedEndingCash = expectedEndingCash;
            existingSession.actualEndingCash = actualEndingCash;
            existingSession.discrepancy = discrepancy;
            existingSession.status = 'closed';
            if (notes) existingSession.notes = (existingSession.notes ? existingSession.notes + '\n' : '') + notes;

            await existingSession.save();

            // Log adjustment if discrepancy
            if (discrepancy !== 0) {
                await CashLog.create({
                    type: 'adjustment',
                    amount: Math.abs(discrepancy),
                    sourceLocation: discrepancy > 0 ? 'system' : 'kasir',
                    destinationLocation: discrepancy > 0 ? 'kasir' : 'system',
                    performedBy: userId,
                    description: `Discrepancy at shift close. Expected: ${expectedEndingCash}, Actual: ${actualEndingCash}`,
                    referenceModel: 'CashSession',
                    referenceId: existingSession._id,
                    balanceAfter: {
                        kasir: balance.kasirBalance,
                        brankas: balance.brankasBalance,
                        bank: balance.bankBalance
                    }
                });
            }

            // Log close session
            await CashLog.create({
                type: 'close_session',
                amount: actualEndingCash,
                sourceLocation: 'kasir',
                destinationLocation: 'system',
                performedBy: userId,
                description: `Shift closed. Actual ending cash: ${actualEndingCash}`,
                referenceModel: 'CashSession',
                referenceId: existingSession._id,
                balanceAfter: {
                    kasir: balance.kasirBalance,
                    brankas: balance.brankasBalance,
                    bank: balance.bankBalance
                }
            });

            await logActivity({
                req: request,
                action: 'update',
                resource: 'CashSession',
                details: `Closed cash session. Expected: ${expectedEndingCash}, Actual: ${actualEndingCash}`
            });

            return NextResponse.json({ success: true, data: existingSession });
        }

        return NextResponse.json({ success: false, error: "Invalid action" }, { status: 400 });

    } catch (error: any) {
        console.error("Cash Session API Error:", error);
        return NextResponse.json(
            { success: false, error: "Failed to process cash session" },
            { status: 500 }
        );
    }
}