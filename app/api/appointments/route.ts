
import { NextRequest, NextResponse } from "next/server";
import { connectToDB } from "@/lib/mongodb";
import Appointment, { IAppointment } from "@/models/Appointment";
import Invoice from "@/models/Invoice";
import Settings from "@/models/Settings";
import Staff from "@/models/Staff";
import Service from "@/models/Service";
import mongoose from "mongoose";
import { initModels } from "@/lib/initModels";
import { checkPermission } from "@/lib/rbac";
import { handleApiError } from "@/lib/errorHandler";
import { scheduleFollowUp } from "@/lib/waFollowUp";

export async function GET(request: NextRequest) {
    try {
        // Security Check
        const permissionError = await checkPermission(request, 'appointments', 'view');
        if (permissionError) return permissionError;

        await connectToDB();
        initModels();
        const { searchParams } = new URL(request.url);

        // Pagination & Search params
        const page = parseInt(searchParams.get("page") || "1");
        const limit = parseInt(searchParams.get("limit") || "10");
        const search = searchParams.get("search") || "";
        const status = searchParams.get("status") || "";
        const start = searchParams.get("start");
        const end = searchParams.get("end");
        const staffId = searchParams.get("staff");

        const query: any = {};
        if (start && end) {
            query.date = {
                $gte: new Date(start),
                $lte: new Date(end + "T23:59:59.999Z")
            };
        }

        if (status) {
            query.status = status;
        }

        if (staffId) {
            query.staff = new mongoose.Types.ObjectId(staffId);
        }

        // Using aggregation for advanced searching and pagination
        const pipeline: any[] = [
            { $match: query },
            {
                $lookup: {
                    from: 'customers',
                    localField: 'customer',
                    foreignField: '_id',
                    as: 'customer'
                }
            },
            { $unwind: '$customer' },
            {
                $lookup: {
                    from: 'staffs',
                    localField: 'staff',
                    foreignField: '_id',
                    as: 'staff'
                }
            },
            { $unwind: '$staff' }
        ];

        // Search filter (name or phone)
        if (search) {
            pipeline.push({
                $match: {
                    $or: [
                        { 'customer.name': { $regex: search, $options: 'i' } },
                        { 'customer.phone': { $regex: search, $options: 'i' } },
                        { 'staff.name': { $regex: search, $options: 'i' } }
                    ]
                }
            });
        }

        // Sorting (by date and time)
        pipeline.push({ $sort: { date: -1, startTime: -1 } });

        // Total count before pagination
        const countPipeline = [...pipeline, { $count: 'total' }];
        const countResult = await Appointment.aggregate(countPipeline);
        const total = countResult.length > 0 ? countResult[0].total : 0;

        // Apply Pagination (only if requested)
        const isPaginated = searchParams.has("page");
        if (isPaginated) {
            const skip = (page - 1) * limit;
            pipeline.push({ $skip: skip });
            pipeline.push({ $limit: limit });
        } else {
            // For calendar, we might still want a safety limit, 
            // but usually a day doesn't have 1000s of appointments
            pipeline.push({ $limit: 1000 });
        }

        const appointments = await Appointment.aggregate(pipeline);

        return NextResponse.json({
            success: true,
            data: appointments,
            pagination: isPaginated ? {
                total,
                page,
                limit,
                pages: Math.ceil(total / limit)
            } : undefined
        });
    } catch (error) {
        console.error(error);
        return NextResponse.json({ success: false, error: "Failed to fetch appointments" }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    try {
        // Security Check
        const permissionError = await checkPermission(request, 'appointments', 'create');
        if (permissionError) return permissionError;

        await connectToDB();
        initModels();
        const body = await request.json();

        // Basic validation
        if (!body.customer || !body.staff || !body.startTime || !body.services || !Array.isArray(body.services) || body.services.length === 0) {
            return NextResponse.json({ success: false, error: "Customer, staff, time slot and at least one service are required" }, { status: 400 });
        }

        // Robustness: Handle if status is accidentally sent as an object
        if (body.status && typeof body.status === 'object' && body.status.target) {
            body.status = body.status.target.value;
        }

        // Generate totals based on settings
        const settings = await Settings.findOne();
        const taxRate = settings?.taxRate || 0;

        const subtotal = body.services.reduce((acc: number, s: any) => acc + (s.price || 0), 0);
        const totalDuration = body.services.reduce((acc: number, s: any) => acc + (s.duration || 0), 0);
        const discount = parseFloat(body.discount) || 0;
        const tax = subtotal * (taxRate / 100);
        const totalAmount = (subtotal + tax) - discount;

        // Calculate commission
        const staff = await Staff.findById(body.staff);
        const staffRate = staff?.commissionRate || 0;

        let commission = 0;
        for (const item of body.services) {
            const service = await Service.findById(item.service);
            const commValue = Number(service?.commissionValue || 0);
            commission += commValue;
        }

        const appointment = await Appointment.create({
            ...body,
            subtotal,
            totalDuration,
            discount,
            tax,
            totalAmount,
            commission
        }) as unknown as IAppointment;

        // Create invoice automatically for confirmed/completed appointments
        if (appointment.status === 'confirmed' || appointment.status === 'completed' || !appointment.status) {
            // More robust invoice number generation: Find the latest invoice number and increment it
            const lastInvoice = await Invoice.findOne().sort({ createdAt: -1 });
            let nextNum = 1;

            if (lastInvoice && lastInvoice.invoiceNumber) {
                const lastNum = parseInt(lastInvoice.invoiceNumber.split('-').pop() || "0");
                if (!isNaN(lastNum)) {
                    nextNum = lastNum + 1;
                }
            }

            const invoiceNumber = `INV-${new Date().getFullYear()}-${nextNum.toString().padStart(5, '0')}`;

            const createdInvoice = await Invoice.create({
                invoiceNumber,
                customer: appointment.customer,
                appointment: appointment._id,
                items: (appointment.services || []).map((s: any) => ({
                    item: s.service,
                    itemModel: 'Service',
                    name: s.name,
                    price: s.price || 0,
                    quantity: 1,
                    total: s.price || 0
                })),
                subtotal: subtotal || 0,
                tax: tax || 0,
                discount: discount || 0,
                totalAmount: totalAmount || 0,
                commission: commission || 0,
                staff: appointment.staff,
                staffAssignments: appointment.staff ? [{
                    staff: appointment.staff,
                    percentage: 100,  // ✅ FIXED: Always 100 for single staff
                    commission: commission || 0,
                    tip: 0
                }] : [],
                status: appointment.status === 'completed' ? 'paid' : 'pending',
                date: appointment.date || new Date()
            });

            await scheduleFollowUp(createdInvoice._id);
        }

        return NextResponse.json({ success: true, data: appointment });
    } catch (error: any) {
        if (error.name === 'ValidationError') {
            return NextResponse.json({ success: false, error: "Validation failed: " + Object.values(error.errors).map((e: any) => e.message).join(', ') }, { status: 400 });
        }
        return handleApiError('CREATE_APPOINTMENT', error);
    }
}
