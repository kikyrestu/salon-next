export async function register() {
    if (process.env.NEXT_RUNTIME === 'nodejs') {
        const { startWaScheduler } = await import('./lib/scheduler');
        // This will automatically run node-cron inside the Node.js process 
        // when the Next.js server starts (e.g. npm run dev or npm run start on Hostinger)
        startWaScheduler();
        console.log('✅ WA Scheduler registered and started automatically via instrumentation');

        // Auto-migrate role permissions saat server start
        // Supaya setiap kali ada resource baru ditambahkan ke kode,
        // role yang sudah ada di DB otomatis dapat field baru tanpa perlu manual
        const { migratePermissionsAllTenants } = await import('./lib/migratePermissions');
        await migratePermissionsAllTenants();
        console.log('✅ Role permissions migration completed');
    }
}