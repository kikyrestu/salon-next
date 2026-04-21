import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import { Customer, Staff, Service, ServiceCategory, Appointment } from '@/lib/initModels';

export async function GET() {
    try {
        await connectDB();
        
        // 1. Create Service Categories
        const catHair = await ServiceCategory.findOneAndUpdate(
            { slug: 'hair-care' },
            { name: 'Hair Care', status: 'active' },
            { upsert: true, new: true }
        );
        const catNail = await ServiceCategory.findOneAndUpdate(
            { slug: 'nail-art' },
            { name: 'Nail Art', status: 'active' },
            { upsert: true, new: true }
        );

        // 2. Create Services
        const svcHaircut = await Service.findOneAndUpdate(
            { name: 'Premium Haircut' },
            {
                category: catHair._id,
                duration: 60,
                price: 150000,
                gender: 'unisex',
                commissionType: 'percentage',
                commissionValue: 10
            },
            { upsert: true, new: true }
        );
        
        const svcColor = await Service.findOneAndUpdate(
            { name: 'Hair Coloring' },
            {
                category: catHair._id,
                duration: 120,
                price: 450000,
                gender: 'female',
                commissionType: 'fixed',
                commissionValue: 50000
            },
            { upsert: true, new: true }
        );

        // 3. Create Staff
        const defaultWorkingDays = [
            { day: 'Monday', startTime: '09:00', endTime: '18:00', isOff: false },
            { day: 'Tuesday', startTime: '09:00', endTime: '18:00', isOff: false },
            { day: 'Wednesday', startTime: '09:00', endTime: '18:00', isOff: false },
            { day: 'Thursday', startTime: '09:00', endTime: '18:00', isOff: false },
            { day: 'Friday', startTime: '09:00', endTime: '18:00', isOff: false },
            { day: 'Saturday', startTime: '09:00', endTime: '18:00', isOff: false },
            { day: 'Sunday', startTime: '09:00', endTime: '18:00', isOff: true }
        ];

        const staffBudi = await Staff.findOneAndUpdate(
            { email: 'budi@salon.com' },
            {
                name: 'Budi Stylist',
                phone: '08111222333',
                designation: 'Senior Stylist',
                skills: [svcHaircut._id, svcColor._id],
                commissionRate: 10,
                salary: 5000000,
                isActive: true,
                workingDays: defaultWorkingDays
            },
            { upsert: true, new: true }
        );

        const staffSusi = await Staff.findOneAndUpdate(
            { phone: '08999990000' },
            {
                name: 'Susi Nail Artist',
                designation: 'Nail Artist',
                skills: [],
                commissionRate: 15,
                salary: 4000000,
                isActive: true,
                workingDays: defaultWorkingDays
            },
            { upsert: true, new: true }
        );

        // 4. Create Customers
        const custAgus = await Customer.findOneAndUpdate(
            { email: 'agus@customer.com' },
            {
                name: 'Agus Setiawan',
                phone: '081234567890',
                status: 'active',
                totalPurchases: 0,
                loyaltyPoints: 0
            },
            { upsert: true, new: true }
        );

        const custDewi = await Customer.findOneAndUpdate(
            { email: 'dewi@customer.com' },
            {
                name: 'Dewi Lestari',
                phone: '087788990011',
                status: 'active',
                totalPurchases: 0,
                loyaltyPoints: 0
            },
            { upsert: true, new: true }
        );

        // 5. Create Appointments

        // Scheduled for today (Pending)
        const dateToday = new Date();
        // Zero time parts so it matches UI queries easily
        dateToday.setHours(0, 0, 0, 0); 
        await Appointment.create({
            customer: custAgus._id,
            staff: staffBudi._id,
            services: [{
                service: svcHaircut._id,
                name: svcHaircut.name,
                price: svcHaircut.price,
                duration: svcHaircut.duration
            }],
            date: dateToday,
            startTime: '14:00',
            endTime: '15:00',
            totalDuration: 60,
            subtotal: 150000,
            tax: 0,
            totalAmount: 150000,
            discount: 0,
            commission: 15000,
            tips: 0,
            status: 'pending',
            notes: 'Minta potong rapi'
        });

        // Completed yesterday 
        const dateYesterday = new Date();
        dateYesterday.setDate(dateToday.getDate() - 1);
        dateYesterday.setHours(0, 0, 0, 0);
        await Appointment.create({
            customer: custDewi._id,
            staff: staffBudi._id,
            services: [{
                service: svcColor._id,
                name: svcColor.name,
                price: svcColor.price,
                duration: svcColor.duration
            }],
            date: dateYesterday,
            startTime: '10:00',
            endTime: '12:00',
            totalDuration: 120,
            subtotal: 450000,
            tax: 0,
            totalAmount: 450000,
            discount: 0,
            commission: 50000,
            tips: 0,
            status: 'completed',
            notes: 'Warna ash grey'
        });

        return NextResponse.json({ success: true, message: 'Data demo (Kategori, Layanan, Karyawan, Pelanggan, dan Appointment) berhasil inject ke Database!' });
    } catch (e: any) {
        return NextResponse.json({ success: false, error: e.message }, { status: 500 });
    }
}