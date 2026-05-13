/**
 * Seed script to create test roles and users for Phase 1 RBAC testing
 *
 * Usage:
 *   npx tsx scripts/seed-test-roles.ts
 *
 * This script creates 4 test roles with minimal permissions:
 * 1. Kasir Only - Only pos.view (no services/products/customers access)
 * 2. HR Only - Only payroll.view (no staff access)
 * 3. Purchasing Only - Only purchases.view (no suppliers/products access)
 * 4. Inventory Only - Only usageLogs.view (no products/staff access)
 *
 * And creates 4 test users, one for each role.
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { getTenantModels } from '../lib/tenantDb';

dotenv.config();

const TEST_ROLES = [
  {
    name: 'TEST_Kasir_Only',
    description: 'Test role: POS access only (no services/products/customers management)',
    permissions: {
      dashboard: { view: true },
      pos: { view: 'all', create: true, edit: true, delete: false },
      // Explicitly NO access to these:
      services: { view: 'none', create: false, edit: false, delete: false },
      products: { view: 'none', create: false, edit: false, delete: false },
      customers: { view: 'none', create: false, edit: false, delete: false },
      // All other permissions set to none
      appointments: { view: 'none', create: false, edit: false, delete: false },
      staff: { view: 'none', create: false, edit: false, delete: false },
      suppliers: { view: 'none', create: false, edit: false, delete: false },
      expenses: { view: 'none', create: false, edit: false, delete: false },
      purchases: { view: 'none', create: false, edit: false, delete: false },
      invoices: { view: 'none', create: false, edit: false, delete: false },
      deposits: { view: 'none', create: false, edit: false, delete: false },
      payroll: { view: 'none', create: false, edit: false, delete: false },
      vouchers: { view: 'none', create: false, edit: false, delete: false },
      usageLogs: { view: 'none', create: false, edit: false, delete: false },
      reports: { view: 'none', create: false, edit: false, delete: false },
      users: { view: 'none', create: false, edit: false, delete: false },
      roles: { view: 'none', create: false, edit: false, delete: false },
      staffSlots: { view: 'none', create: false, edit: false, delete: false },
      bundles: { view: 'none', create: false, edit: false, delete: false },
      packages: { view: 'none', create: false, edit: false, delete: false },
      membership: { view: 'none', create: false, edit: false, delete: false },
      waTemplates: { view: 'none', create: false, edit: false, delete: false },
      aiReports: { view: false },
      calendarView: { view: false },
      activityLogs: { view: false },
      settings: { view: false, edit: false },
    },
    isSystem: false,
  },
  {
    name: 'TEST_HR_Only',
    description: 'Test role: Payroll access only (no staff management)',
    permissions: {
      dashboard: { view: true },
      payroll: { view: 'all', create: true, edit: true, delete: false },
      // Explicitly NO access to staff:
      staff: { view: 'none', create: false, edit: false, delete: false },
      // All other permissions set to none
      appointments: { view: 'none', create: false, edit: false, delete: false },
      pos: { view: 'none', create: false, edit: false, delete: false },
      services: { view: 'none', create: false, edit: false, delete: false },
      products: { view: 'none', create: false, edit: false, delete: false },
      customers: { view: 'none', create: false, edit: false, delete: false },
      suppliers: { view: 'none', create: false, edit: false, delete: false },
      expenses: { view: 'none', create: false, edit: false, delete: false },
      purchases: { view: 'none', create: false, edit: false, delete: false },
      invoices: { view: 'none', create: false, edit: false, delete: false },
      deposits: { view: 'none', create: false, edit: false, delete: false },
      vouchers: { view: 'none', create: false, edit: false, delete: false },
      usageLogs: { view: 'none', create: false, edit: false, delete: false },
      reports: { view: 'none', create: false, edit: false, delete: false },
      users: { view: 'none', create: false, edit: false, delete: false },
      roles: { view: 'none', create: false, edit: false, delete: false },
      staffSlots: { view: 'none', create: false, edit: false, delete: false },
      bundles: { view: 'none', create: false, edit: false, delete: false },
      packages: { view: 'none', create: false, edit: false, delete: false },
      membership: { view: 'none', create: false, edit: false, delete: false },
      waTemplates: { view: 'none', create: false, edit: false, delete: false },
      aiReports: { view: false },
      calendarView: { view: false },
      activityLogs: { view: false },
      settings: { view: false, edit: false },
    },
    isSystem: false,
  },
  {
    name: 'TEST_Purchasing_Only',
    description: 'Test role: Purchases access only (no suppliers/products management)',
    permissions: {
      dashboard: { view: true },
      purchases: { view: 'all', create: true, edit: true, delete: false },
      // Explicitly NO access to these:
      suppliers: { view: 'none', create: false, edit: false, delete: false },
      products: { view: 'none', create: false, edit: false, delete: false },
      // All other permissions set to none
      appointments: { view: 'none', create: false, edit: false, delete: false },
      pos: { view: 'none', create: false, edit: false, delete: false },
      services: { view: 'none', create: false, edit: false, delete: false },
      customers: { view: 'none', create: false, edit: false, delete: false },
      staff: { view: 'none', create: false, edit: false, delete: false },
      expenses: { view: 'none', create: false, edit: false, delete: false },
      invoices: { view: 'none', create: false, edit: false, delete: false },
      deposits: { view: 'none', create: false, edit: false, delete: false },
      payroll: { view: 'none', create: false, edit: false, delete: false },
      vouchers: { view: 'none', create: false, edit: false, delete: false },
      usageLogs: { view: 'none', create: false, edit: false, delete: false },
      reports: { view: 'none', create: false, edit: false, delete: false },
      users: { view: 'none', create: false, edit: false, delete: false },
      roles: { view: 'none', create: false, edit: false, delete: false },
      staffSlots: { view: 'none', create: false, edit: false, delete: false },
      bundles: { view: 'none', create: false, edit: false, delete: false },
      packages: { view: 'none', create: false, edit: false, delete: false },
      membership: { view: 'none', create: false, edit: false, delete: false },
      waTemplates: { view: 'none', create: false, edit: false, delete: false },
      aiReports: { view: false },
      calendarView: { view: false },
      activityLogs: { view: false },
      settings: { view: false, edit: false },
    },
    isSystem: false,
  },
  {
    name: 'TEST_Inventory_Only',
    description: 'Test role: Usage Logs access only (no products/staff management)',
    permissions: {
      dashboard: { view: true },
      usageLogs: { view: 'all', create: true, edit: true, delete: false },
      // Explicitly NO access to these:
      products: { view: 'none', create: false, edit: false, delete: false },
      staff: { view: 'none', create: false, edit: false, delete: false },
      // All other permissions set to none
      appointments: { view: 'none', create: false, edit: false, delete: false },
      pos: { view: 'none', create: false, edit: false, delete: false },
      services: { view: 'none', create: false, edit: false, delete: false },
      customers: { view: 'none', create: false, edit: false, delete: false },
      suppliers: { view: 'none', create: false, edit: false, delete: false },
      expenses: { view: 'none', create: false, edit: false, delete: false },
      purchases: { view: 'none', create: false, edit: false, delete: false },
      invoices: { view: 'none', create: false, edit: false, delete: false },
      deposits: { view: 'none', create: false, edit: false, delete: false },
      payroll: { view: 'none', create: false, edit: false, delete: false },
      vouchers: { view: 'none', create: false, edit: false, delete: false },
      reports: { view: 'none', create: false, edit: false, delete: false },
      users: { view: 'none', create: false, edit: false, delete: false },
      roles: { view: 'none', create: false, edit: false, delete: false },
      staffSlots: { view: 'none', create: false, edit: false, delete: false },
      bundles: { view: 'none', create: false, edit: false, delete: false },
      packages: { view: 'none', create: false, edit: false, delete: false },
      membership: { view: 'none', create: false, edit: false, delete: false },
      waTemplates: { view: 'none', create: false, edit: false, delete: false },
      aiReports: { view: false },
      calendarView: { view: false },
      activityLogs: { view: false },
      settings: { view: false, edit: false },
    },
    isSystem: false,
  },
];

const TEST_USERS = [
  {
    name: 'Test Kasir',
    email: 'test.kasir@example.com',
    password: 'TestPass123!',
    roleName: 'TEST_Kasir_Only',
  },
  {
    name: 'Test HR',
    email: 'test.hr@example.com',
    password: 'TestPass123!',
    roleName: 'TEST_HR_Only',
  },
  {
    name: 'Test Purchasing',
    email: 'test.purchasing@example.com',
    password: 'TestPass123!',
    roleName: 'TEST_Purchasing_Only',
  },
  {
    name: 'Test Inventory',
    email: 'test.inventory@example.com',
    password: 'TestPass123!',
    roleName: 'TEST_Inventory_Only',
  },
];

async function seedTestData(tenantSlug: string = 'pusat') {
  try {
    console.log(`\n🌱 Starting seed for tenant: ${tenantSlug}\n`);

    const { Role, User } = await getTenantModels(tenantSlug);

    // Create roles
    console.log('📋 Creating test roles...');
    const createdRoles: any = {};

    for (const roleData of TEST_ROLES) {
      // Check if role already exists
      const existingRole = await Role.findOne({ name: roleData.name });

      if (existingRole) {
        console.log(`   ⏭️  Role "${roleData.name}" already exists, skipping...`);
        createdRoles[roleData.name] = existingRole;
      } else {
        const role = await Role.create(roleData);
        console.log(`   ✅ Created role: ${roleData.name}`);
        createdRoles[roleData.name] = role;
      }
    }

    // Create users
    console.log('\n👥 Creating test users...');

    for (const userData of TEST_USERS) {
      // Check if user already exists
      const existingUser = await User.findOne({ email: userData.email });

      if (existingUser) {
        console.log(`   ⏭️  User "${userData.email}" already exists, skipping...`);
      } else {
        const role = createdRoles[userData.roleName];

        if (!role) {
          console.log(`   ❌ Role "${userData.roleName}" not found for user ${userData.email}`);
          continue;
        }

        await User.create({
          name: userData.name,
          email: userData.email,
          password: userData.password,
          role: role._id,
        });

        console.log(`   ✅ Created user: ${userData.email} (${userData.roleName})`);
      }
    }

    console.log('\n✨ Seed completed successfully!\n');
    console.log('📝 Test Credentials:');
    console.log('─────────────────────────────────────────────────────');
    TEST_USERS.forEach(user => {
      console.log(`   Email: ${user.email}`);
      console.log(`   Password: ${user.password}`);
      console.log(`   Role: ${user.roleName}`);
      console.log('─────────────────────────────────────────────────────');
    });

  } catch (error) {
    console.error('❌ Error seeding test data:', error);
    throw error;
  }
}

// Main execution
async function main() {
  const tenantSlug = process.argv[2] || 'pusat';

  console.log('╔════════════════════════════════════════════════════╗');
  console.log('║   Phase 1 RBAC Testing - Seed Test Roles & Users  ║');
  console.log('╚════════════════════════════════════════════════════╝');

  try {
    await seedTestData(tenantSlug);
    process.exit(0);
  } catch (error) {
    console.error('\n💥 Fatal error:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

export { seedTestData, TEST_ROLES, TEST_USERS };
