import { getTenantModels } from "@/lib/tenantDb";
import { NextRequest, NextResponse } from "next/server";




import { parse, format, addMinutes, isBefore, isAfter } from "date-fns";
import { checkPermission } from "@/lib/rbac";

// Generate time slots between start and end time
function generateTimeSlots(startTime: string, endTime: string, slotDuration: number = 30): string[] {
    const slots: string[] = [];
    const start = parse(startTime, "HH:mm", new Date());
    const end = parse(endTime, "HH:mm", new Date());

    let current = start;
    while (isBefore(current, end) || format(current, "HH:mm") === format(end, "HH:mm")) {
        slots.push(format(current, "HH:mm"));
        current = addMinutes(current, slotDuration);
    }

    return slots;
}

// Get available slots for a staff member on a specific date or day
export async function GET(request: NextRequest, props: any) {
    const tenantSlug = request.headers.get('x-store-slug') || 'pusat';
    const { StaffSlot, Appointment, Staff } = await getTenantModels(tenantSlug);

    try {
    const permissionErrorGET = await checkPermission(request, 'staffSlots', 'view');
    if (permissionErrorGET) return permissionErrorGET;
        
        

        const { searchParams } = new URL(request.url);
        const staffId = searchParams.get("staffId");
        const date = searchParams.get("date");
        const dayOfWeek = searchParams.get("dayOfWeek");
        const type = searchParams.get("type") || "date";

        if (!staffId) {
            return NextResponse.json(
                { success: false, error: "staffId is required" },
                { status: 400 }
            );
        }

        let storedSlots = [];
        let selectedDate: Date | null = null;
        let startOfDay, endOfDay;
        let dayName = dayOfWeek;

        if (type === "date" && date) {
            const dateStr = date.includes('T') ? date : date + 'T00:00:00';
            selectedDate = new Date(dateStr);
            startOfDay = new Date(selectedDate);
            startOfDay.setHours(0, 0, 0, 0);
            endOfDay = new Date(selectedDate);
            endOfDay.setHours(23, 59, 59, 999);

            // 1. Try to find date-specific slots
            storedSlots = await StaffSlot.find({
                staff: staffId,
                type: 'date',
                date: {
                    $gte: startOfDay,
                    $lte: endOfDay
                }
            }).sort({ startTime: 1 });

            // 2. Fallback to day-wise slots if no date-specific slots exist
            if (storedSlots.length === 0) {
                const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
                dayName = dayNames[selectedDate.getDay()];
                storedSlots = await StaffSlot.find({
                    staff: staffId,
                    type: 'day',
                    dayOfWeek: dayName
                }).sort({ startTime: 1 });
            }
        } else if (type === "day" && dayOfWeek) {
            // Querying day-wise slots directly (for management)
            storedSlots = await StaffSlot.find({
                staff: staffId,
                type: 'day',
                dayOfWeek: dayOfWeek
            }).sort({ startTime: 1 });
        } else {
            return NextResponse.json(
                { success: false, error: "date or dayOfWeek is required based on type" },
                { status: 400 }
            );
        }

        // Get staff working hours for info
        const staff = await Staff.findById(staffId);
        if (!staff) {
            return NextResponse.json(
                { success: false, error: "Staff not found" },
                { status: 404 }
            );
        }

        const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        const currentDayName = selectedDate ? dayNames[selectedDate.getDay()] : dayOfWeek;
        const workingDay = staff.workingDays?.find((wd: any) => wd.day === currentDayName);
        const defaultStartTime = workingDay?.startTime || "09:00";
        const defaultEndTime = workingDay?.endTime || "18:00";
        const slotDuration = 30;

        // If we have a date, check for appointments
        let filteredAppointments: any[] = [];
        if (selectedDate) {
            const excludeAppointmentId = searchParams.get("excludeAppointmentId");
            const appointments = await Appointment.find({
                staff: staffId,
                date: {
                    $gte: startOfDay,
                    $lte: endOfDay
                },
                status: { $nin: ['cancelled'] }
            }).sort({ startTime: 1 });

            filteredAppointments = excludeAppointmentId
                ? appointments.filter(apt => apt._id.toString() !== excludeAppointmentId)
                : appointments;
        }

        const allSlots = storedSlots.map((s: any) => ({
            _id: s._id.toString(),
            startTime: s.startTime,
            endTime: s.endTime,
            isAvailable: s.isAvailable,
            slotDuration: s.slotDuration || slotDuration,
            notes: s.notes,
            type: s.type,
            dayOfWeek: s.dayOfWeek,
            date: s.date
        }));

        // Mark slots as booked if they conflict with existing appointments
        const bookedSlots: string[] = [];
        const processedSlots = allSlots.map((slot: any) => {
            if (slot.isAvailable && selectedDate) {
                const slotStart = parse(slot.startTime, "HH:mm", new Date());
                const slotEnd = parse(slot.endTime, "HH:mm", new Date());

                const isBooked = filteredAppointments.some((apt: any) => {
                    const aptStart = parse(apt.startTime, "HH:mm", new Date());
                    const aptEnd = parse(apt.endTime, "HH:mm", new Date());
                    return (
                        (isBefore(slotStart, aptEnd) && isAfter(slotEnd, aptStart)) ||
                        format(slotStart, "HH:mm") === apt.startTime
                    );
                });

                if (isBooked) {
                    bookedSlots.push(slot.startTime);
                    return { ...slot, isAvailable: false };
                }
            }
            return slot;
        });

        const availableSlotsForBooking = processedSlots.filter((slot: any) => slot.isAvailable);

        return NextResponse.json({
            success: true,
            data: {
                availableSlots: processedSlots,
                availableSlotsForBooking,
                bookedSlots,
                workingHours: {
                    start: defaultStartTime,
                    end: defaultEndTime
                }
            }
        });
    } catch (error: any) {
        console.error("Error fetching staff slots:", error);
        return NextResponse.json(
            { success: false, error: error.message || "Failed to fetch staff slots" },
            { status: 500 }
        );
    }
}

// Create or update staff slots
export async function POST(request: NextRequest, props: any) {
    const tenantSlug = request.headers.get('x-store-slug') || 'pusat';
    const { StaffSlot, Appointment, Staff } = await getTenantModels(tenantSlug);

    try {
    const permissionErrorPOST = await checkPermission(request, 'staffSlots', 'create');
    if (permissionErrorPOST) return permissionErrorPOST;
        
        

        const body = await request.json();
        const { staffId, date, dayOfWeek, type, slots } = body;

        if (!staffId || !type || !Array.isArray(slots)) {
            return NextResponse.json(
                { success: false, error: "staffId, type, and slots array are required" },
                { status: 400 }
            );
        }

        if (type === 'date' && !date) {
            return NextResponse.json({ success: false, error: "date is required for type 'date'" }, { status: 400 });
        }
        if (type === 'day' && !dayOfWeek) {
            return NextResponse.json({ success: false, error: "dayOfWeek is required for type 'day'" }, { status: 400 });
        }

        if (type === 'date') {
            const dateStr = date.includes('T') ? date : date + 'T00:00:00';
            const selectedDate = new Date(dateStr);
            selectedDate.setHours(0, 0, 0, 0);
            const startOfDay = new Date(selectedDate);
            const endOfDay = new Date(selectedDate);
            endOfDay.setHours(23, 59, 59, 999);

            await StaffSlot.deleteMany({
                staff: staffId,
                type: 'date',
                date: { $gte: startOfDay, $lte: endOfDay }
            });

            const createdSlots = await StaffSlot.insertMany(
                slots.map((slot: any) => ({
                    staff: staffId,
                    type: 'date',
                    date: selectedDate,
                    startTime: slot.startTime,
                    endTime: slot.endTime,
                    isAvailable: slot.isAvailable !== false,
                    slotDuration: slot.slotDuration || 30,
                    notes: slot.notes || ""
                }))
            );

            return NextResponse.json({ success: true, data: createdSlots });
        } else {
            // type === 'day'
            await StaffSlot.deleteMany({
                staff: staffId,
                type: 'day',
                dayOfWeek: dayOfWeek
            });

            const createdSlots = await StaffSlot.insertMany(
                slots.map((slot: any) => ({
                    staff: staffId,
                    type: 'day',
                    dayOfWeek: dayOfWeek,
                    date: new Date(0), // Placeholder to satisfy cached "required" validation
                    startTime: slot.startTime,
                    endTime: slot.endTime,
                    isAvailable: slot.isAvailable !== false,
                    slotDuration: slot.slotDuration || 30,
                    notes: slot.notes || ""
                }))
            );

            return NextResponse.json({ success: true, data: createdSlots });
        }
    } catch (error: any) {
        console.error("Error creating staff slots:", error);
        return NextResponse.json(
            { success: false, error: error.message || "Failed to create staff slots" },
            { status: 500 }
        );
    }
}

