// appointments/[id]/route.ts

import { NextRequest, NextResponse } from "next/server";
import { connectToDB } from "@/lib/mongodb";
import Appointment from "@/models/Appointment";
import Invoice from "@/models/Invoice";
import Deposit from "@/models/Deposit";
import Settings from "@/models/Settings";
import Staff from "@/models/Staff";
import Service from "@/models/Service";
import { initModels } from "@/lib/initModels";
import { checkPermission } from "@/lib/rbac";
import { handleApiError } from "@/lib/errorHandler";
import { scheduleFollowUp } from "@/lib/waFollowUp";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const permissionError = await checkPermission(request, 'appointments', 'view');
        if (permissionError) return permissionError;

        await connectToDB();
        initModels();
        const { id } = await params;

        const appointment = await Appointment.findById(id)
            .populate('customer')
            .populate('staff');

        if (!appointment) {
            return NextResponse.json({ success: false, error: "Appointment not found" }, { status: 404 });
        }

        return NextResponse.json({ success: true, data: appointment });
    } catch (error: any) {
        return handleApiError('GET_APPOINTMENT', error);
    }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const permissionError = await checkPermission(request, 'appointments', 'edit');
        if (permissionError) return permissionError;

        await connectToDB();
        const { id } = await params;
        const body = await request.json();

        initModels();
        const settings = await Settings.findOne();
        const taxRate = settings?.taxRate || 0;

        const existingAppointment = await Appointment.findById(id);
        if (!existingAppointment) {
            return NextResponse.json({ success: false, error: "Appointment not found" }, { status: 404 });
        }

        const { _id, __v, createdAt, updatedAt, ...cleanBody } = body;

        if (cleanBody.status && typeof cleanBody.status === 'object' && cleanBody.status.target) {
            cleanBody.status = cleanBody.status.target.value;
        }

        const services = cleanBody.services || existingAppointment.services;
        const staffId = cleanBody.staff || existingAppointment.staff;
        const discount = cleanBody.discount !== undefined ? cleanBody.discount : (existingAppointment.discount || 0);

        const subtotal = services.reduce((acc: number, s: any) => acc + s.price, 0);
        const tax = subtotal * (taxRate / 100);
        const totalAmount = (subtotal + tax) - discount;

        let totalCommission = 0;
        for (const item of services) {
            const serviceId = item.service?._id || item.service;
            const service = await Service.findById(serviceId);
            const commValue = Number(service?.commissionValue || 0);
            totalCommission += commValue;
        }

        const appointment = await Appointment.findByIdAndUpdate(id, {
            ...cleanBody,
            subtotal,
            tax,
            totalAmount,
            commission: totalCommission
        }, { new: true });

        if (appointment && (appointment.status === 'confirmed' || appointment.status === 'completed')) {
            initModels();
            const existingInvoice = await Invoice.findOne({ appointment: id });
            if (!existingInvoice) {
                const count = await Invoice.countDocuments();
                const invoiceNumber = `INV-${new Date().getFullYear()}-${(count + 1).toString().padStart(5, '0')}`;

                const createdInvoice = await Invoice.create({
                    invoiceNumber,
                    customer: appointment.customer,
                    appointment: appointment._id,
                    items: appointment.services.map((s: any) => ({
                        item: s.service,
                        itemModel: 'Service',
                        name: s.name,
                        price: s.price,
                        quantity: 1,
                        total: s.price
                    })),
                    subtotal: appointment.subtotal,
                    tax: appointment.tax,
                    discount: appointment.discount || 0,
                    totalAmount: appointment.totalAmount,
                    commission: totalCommission,
                    staff: appointment.staff,
                    staffAssignments: appointment.staff ? [{
                        staff: appointment.staff,
                        percentage: 100,
                        porsiPersen: 100,  // ✅ FIX
                        commission: totalCommission,
                        tip: 0
                    }] : [],
                    status: appointment.status === 'completed' ? 'paid' : 'pending',
                    date: appointment.date
                });

                await scheduleFollowUp(createdInvoice._id);
            } else if (appointment.status === 'completed' && existingInvoice.status !== 'paid') {
                await Invoice.findByIdAndUpdate(existingInvoice._id, { status: 'paid' });
            }
        }

        return NextResponse.json({ success: true, data: appointment });
    } catch (error: any) {
        return handleApiError('UPDATE_APPOINTMENT', error);
    }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const permissionError = await checkPermission(request, 'appointments', 'delete');
        if (permissionError) return permissionError;

        await connectToDB();
        const { id } = await params;

        const linkedInvoices = await Invoice.find({ appointment: id }).select('_id');
        const invoiceIds = linkedInvoices.map((inv: any) => inv._id);

        if (invoiceIds.length > 0) {
            await Deposit.deleteMany({ invoice: { $in: invoiceIds } });
            await Invoice.deleteMany({ _id: { $in: invoiceIds } });
        }

        await Appointment.findByIdAndDelete(id);
        return NextResponse.json({ success: true });
    } catch (error: any) {
        return handleApiError('DELETE_APPOINTMENT', error);
    }
}