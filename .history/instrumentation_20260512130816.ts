export async function register() {
    if (process.env.NEXT_RUNTIME === 'nodejs') {
        const { startWaScheduler } = await import('./lib/scheduler');
        // This will automatically run node-cron inside the Node.js process 
        // when the Next.js server starts (e.g. npm run dev or npm run start on Hostinger)
        startWaScheduler();
        console.log('✅ WA Scheduler registered and started automatically via instrumentation');
    }
}
