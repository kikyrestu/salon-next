# Phase 1 Testing Guide - Cross-Permission Fixes

## Overview

This guide provides step-by-step instructions for manually testing the Phase 1 cross-permission fixes in the RBAC system.

**Problem Fixed**: Pages requiring permission A were fetching data from APIs requiring permission B, causing empty dropdowns for custom roles with only permission A.

**Solution**: Created 8 dedicated list endpoints that check the parent module's permission instead of the resource's permission.

---

## Prerequisites

1. **Database Access**: You need access to the MongoDB database
2. **Admin Account**: You need a Super Admin account to create roles and users
3. **Browser**: Chrome/Firefox with DevTools for network inspection

---

## Quick Start - Automated Setup

### Option 1: Using the Seed Script (Recommended)

Run the seed script to automatically create test roles and users:

```bash
npx tsx scripts/seed-test-roles.ts
```

This will create:
- 4 test roles with minimal permissions
- 4 test users (one for each role)

**Test Credentials Created:**
```
1. Kasir Only
   Email: test.kasir@example.com
   Password: TestPass123!

2. HR Only
   Email: test.hr@example.com
   Password: TestPass123!

3. Purchasing Only
   Email: test.purchasing@example.com
   Password: TestPass123!

4. Inventory Only
   Email: test.inventory@example.com
   Password: TestPass123!
```

After running the seed script, skip to the [Testing Scenarios](#testing-scenarios) section.

---

## Manual Setup (Alternative)

If you prefer to create roles and users manually through the UI:

### Step 1: Create Test Roles

Login as Super Admin and navigate to **Roles Management** (`/[slug]/roles`).

#### 1.1 Create "TEST_Kasir_Only" Role

**Permissions:**
- ✅ `pos.view = 'all'`
- ✅ `pos.create = true`
- ❌ `services.view = 'none'`
- ❌ `products.view = 'none'`
- ❌ `customers.view = 'none'`
- ❌ All other permissions = 'none' or false

#### 1.2 Create "TEST_HR_Only" Role

**Permissions:**
- ✅ `payroll.view = 'all'`
- ✅ `payroll.create = true`
- ❌ `staff.view = 'none'`
- ❌ All other permissions = 'none' or false

#### 1.3 Create "TEST_Purchasing_Only" Role

**Permissions:**
- ✅ `purchases.view = 'all'`
- ✅ `purchases.create = true`
- ❌ `suppliers.view = 'none'`
- ❌ `products.view = 'none'`
- ❌ All other permissions = 'none' or false

#### 1.4 Create "TEST_Inventory_Only" Role

**Permissions:**
- ✅ `usageLogs.view = 'all'`
- ✅ `usageLogs.create = true`
- ❌ `products.view = 'none'`
- ❌ `staff.view = 'none'`
- ❌ All other permissions = 'none' or false

### Step 2: Create Test Users

Navigate to **Users Management** (`/[slug]/users`) and create 4 test users:

1. **Test Kasir**
   - Email: `test.kasir@example.com`
   - Password: `TestPass123!`
   - Role: `TEST_Kasir_Only`

2. **Test HR**
   - Email: `test.hr@example.com`
   - Password: `TestPass123!`
   - Role: `TEST_HR_Only`

3. **Test Purchasing**
   - Email: `test.purchasing@example.com`
   - Password: `TestPass123!`
   - Role: `TEST_Purchasing_Only`

4. **Test Inventory**
   - Email: `test.inventory@example.com`
   - Password: `TestPass123!`
   - Role: `TEST_Inventory_Only`

---

## Testing Scenarios

### Test 1: POS Module (3 Dependencies)

**Objective**: Verify that a user with only `pos.view` can see services, products, and customers in POS page.

#### Steps:

1. **Logout** from admin account

2. **Login** as test user:
   - Email: `test.kasir@example.com`
   - Password: `TestPass123!`

3. **Navigate** to POS page: `/[slug]/pos`

4. **Open Browser DevTools**:
   - Press `F12` or `Ctrl+Shift+I` (Windows) / `Cmd+Option+I` (Mac)
   - Go to **Network** tab
   - Filter by `Fetch/XHR`

5. **Verify Page Loads**:
   - ✅ Page should load without errors
   - ✅ No 403 Forbidden errors in console

6. **Verify Dropdowns Are Populated**:
   - ✅ **Services dropdown** should show list of services
   - ✅ **Products dropdown** should show list of products
   - ✅ **Customers dropdown** should show list of customers
   - ❌ Dropdowns should NOT be empty

7. **Verify API Calls in Network Tab**:
   - ✅ Should see: `GET /api/services/pos-list` (Status: 200)
   - ✅ Should see: `GET /api/products/pos-list` (Status: 200)
   - ✅ Should see: `GET /api/customers/pos-list` (Status: 200)
   - ❌ Should NOT see: `/api/services` (without `/pos-list`)
   - ❌ Should NOT see: `/api/products` (without `/pos-list`)
   - ❌ Should NOT see: `/api/customers` (without `/pos-list`)

8. **Test Transaction Creation**:
   - Try to create a POS transaction
   - ✅ Should be able to select services, products, and customers
   - ✅ Transaction should be created successfully

#### Expected Result:
✅ **PASS** - User can use POS without needing services/products/customers management permissions.

---

### Test 2: Payroll Module (1 Dependency)

**Objective**: Verify that a user with only `payroll.view` can see staff list in Payroll page.

#### Steps:

1. **Logout** and **Login** as:
   - Email: `test.hr@example.com`
   - Password: `TestPass123!`

2. **Navigate** to Payroll page: `/[slug]/payroll`

3. **Open DevTools** → **Network** tab

4. **Verify Page Loads**:
   - ✅ Page should load without errors
   - ✅ No 403 Forbidden errors

5. **Verify Staff Dropdown**:
   - ✅ **Staff dropdown** should show list of staff members
   - ❌ Dropdown should NOT be empty

6. **Verify API Call**:
   - ✅ Should see: `GET /api/staff/payroll-list` (Status: 200)
   - ❌ Should NOT see: `/api/staff` (without `/payroll-list`)

7. **Test Payroll Operations**:
   - Try to view/create payroll records
   - ✅ Should be able to select staff members
   - ✅ Operations should work correctly

#### Expected Result:
✅ **PASS** - User can manage payroll without needing staff management permissions.

---

### Test 3: Purchases Module (2 Dependencies)

**Objective**: Verify that a user with only `purchases.view` can see suppliers and products in Purchases page.

#### Steps:

1. **Logout** and **Login** as:
   - Email: `test.purchasing@example.com`
   - Password: `TestPass123!`

2. **Navigate** to Purchases Create page: `/[slug]/purchases/create`

3. **Open DevTools** → **Network** tab

4. **Verify Page Loads**:
   - ✅ Page should load without errors
   - ✅ No 403 Forbidden errors

5. **Verify Dropdowns**:
   - ✅ **Suppliers dropdown** should show list of suppliers
   - ✅ **Products dropdown** should show list of products
   - ❌ Dropdowns should NOT be empty

6. **Verify API Calls**:
   - ✅ Should see: `GET /api/suppliers/purchase-list` (Status: 200)
   - ✅ Should see: `GET /api/products/purchase-list` (Status: 200)
   - ❌ Should NOT see: `/api/suppliers` (without `/purchase-list`)
   - ❌ Should NOT see: `/api/products` (without `/purchase-list`)

7. **Test Purchase Order Creation**:
   - Try to create a purchase order
   - ✅ Should be able to select suppliers and products
   - ✅ Purchase order should be created successfully

#### Expected Result:
✅ **PASS** - User can create purchase orders without needing suppliers/products management permissions.

---

### Test 4: Usage Logs Module (2 Dependencies)

**Objective**: Verify that a user with only `usageLogs.view` can see products and staff in Usage Logs page.

#### Steps:

1. **Logout** and **Login** as:
   - Email: `test.inventory@example.com`
   - Password: `TestPass123!`

2. **Navigate** to Usage Logs page: `/[slug]/usage-logs`

3. **Open DevTools** → **Network** tab

4. **Verify Page Loads**:
   - ✅ Page should load without errors
   - ✅ No 403 Forbidden errors

5. **Verify Dropdowns**:
   - ✅ **Products dropdown** should show list of products
   - ✅ **Staff dropdown** should show list of staff members
   - ❌ Dropdowns should NOT be empty

6. **Verify API Calls**:
   - ✅ Should see: `GET /api/products/usage-list` (Status: 200)
   - ✅ Should see: `GET /api/staff/usage-list` (Status: 200)
   - ❌ Should NOT see: `/api/products` (without `/usage-list`)
   - ❌ Should NOT see: `/api/staff` (without `/usage-list`)

7. **Test Usage Log Creation**:
   - Try to create a usage log
   - ✅ Should be able to select products and staff
   - ✅ Usage log should be created successfully

#### Expected Result:
✅ **PASS** - User can log product usage without needing products/staff management permissions.

---

## Automated Testing

Run the automated test suite:

```bash
# Run all tests
npm test

# Run only cross-permission tests
npm test cross-permission-fixes

# Run with coverage
npm run test:coverage
```

**Expected Output:**
```
✓ Phase 1 Cross-Permission Fixes - Dedicated List Endpoints (8)
  ✓ POS Module - 3 Dependencies (6)
    ✓ GET /api/services/pos-list (2)
    ✓ GET /api/products/pos-list (2)
    ✓ GET /api/customers/pos-list (2)
  ✓ Payroll Module - 1 Dependency (2)
    ✓ GET /api/staff/payroll-list (2)
  ✓ Purchases Module - 2 Dependencies (4)
    ✓ GET /api/suppliers/purchase-list (2)
    ✓ GET /api/products/purchase-list (2)
  ✓ Usage Logs Module - 2 Dependencies (4)
    ✓ GET /api/products/usage-list (2)
    ✓ GET /api/staff/usage-list (2)

Test Files  1 passed (1)
     Tests  16 passed (16)
```

---

## Troubleshooting

### Issue: Dropdowns are still empty

**Possible Causes:**
1. Old API endpoints are still being called
2. Frontend cache not cleared
3. Role permissions not saved correctly

**Solutions:**
1. Hard refresh the page: `Ctrl+Shift+R` (Windows) / `Cmd+Shift+R` (Mac)
2. Clear browser cache and cookies
3. Verify role permissions in database
4. Check Network tab to confirm correct endpoints are called

### Issue: 403 Forbidden errors

**Possible Causes:**
1. User doesn't have the required permission
2. Role not assigned to user correctly
3. Session not refreshed after role change

**Solutions:**
1. Logout and login again
2. Verify user's role in database
3. Check role permissions match the test requirements

### Issue: Wrong API endpoints are called

**Possible Causes:**
1. Frontend code not updated
2. Build cache not cleared

**Solutions:**
1. Restart the development server
2. Clear `.next` cache: `rm -rf .next`
3. Rebuild: `npm run build`

---

## Cleanup

After testing, you can remove test data:

### Option 1: Manual Cleanup via UI

1. Login as Super Admin
2. Navigate to Users Management
3. Delete all test users (test.kasir@example.com, etc.)
4. Navigate to Roles Management
5. Delete all test roles (TEST_Kasir_Only, etc.)

### Option 2: Database Cleanup Script

Create a cleanup script if needed:

```bash
# Delete test users
db.users.deleteMany({ email: { $regex: /^test\./i } })

# Delete test roles
db.roles.deleteMany({ name: { $regex: /^TEST_/i } })
```

---

## Summary Checklist

After completing all tests, verify:

- [ ] **POS Module**: Kasir can use POS without services/products/customers access
- [ ] **Payroll Module**: HR can manage payroll without staff access
- [ ] **Purchases Module**: Purchasing can create POs without suppliers/products access
- [ ] **Usage Logs Module**: Inventory can log usage without products/staff access
- [ ] **API Endpoints**: All dedicated list endpoints are called correctly
- [ ] **No 403 Errors**: No permission errors in console
- [ ] **Automated Tests**: All 16 tests pass

---

## Next Steps

After Phase 1 testing is complete:

1. **Document Results**: Record any issues found
2. **Phase 2 Planning**: Review RBAC_AUDIT_REPORT.md for Phase 2 modules
3. **Production Deployment**: If all tests pass, prepare for production deployment

---

## Support

If you encounter issues:

1. Check the Network tab for API errors
2. Check browser console for JavaScript errors
3. Verify database records for roles and users
4. Review the implementation in:
   - `app/api/*/pos-list/route.ts`
   - `app/api/*/payroll-list/route.ts`
   - `app/api/*/purchase-list/route.ts`
   - `app/api/*/usage-list/route.ts`

---

**Last Updated**: 2026-05-13
**Version**: Phase 1 Testing Guide v1.0
