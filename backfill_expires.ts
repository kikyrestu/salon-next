import mongoose from 'mongoose';
import { getTenantModels } from '@/lib/tenantDb';

async function backfill() {
  await mongoose.connect(process.env.MONGODB_URI || '');
  console.log('Connected to DB');
  
  const tenants = ['pusat', 'kikyrestu']; // Add known tenants or we can do it via a quick loop
  
  for (const slug of tenants) {
    try {
      const { CustomerPackage, ServicePackage } = await getTenantModels(slug);
      const packages = await CustomerPackage.find({ expiresAt: { $exists: false } }).populate('package');
      
      console.log(`Found ${packages.length} packages to backfill in ${slug}`);
      let fixed = 0;
      for (const cp of packages) {
        if (cp.package && cp.package.validityDays) {
          cp.expiresAt = new Date(cp.activatedAt.getTime() + cp.package.validityDays * 24 * 60 * 60 * 1000);
          await cp.save();
          fixed++;
        }
      }
      console.log(`Fixed ${fixed} packages in ${slug}`);
    } catch (e) {
      console.error('Error for slug', slug, e);
    }
  }
  
  process.exit(0);
}

backfill();
