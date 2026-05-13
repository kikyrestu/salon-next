# Quick Test Reference - Phase 1 RBAC Fixes

## 🚀 Quick Start

```bash
# 1. Create test data
npx tsx scripts/seed-test-roles.ts

# 2. Run automated tests
npm test cross-permission-fixes

# 3. Manual testing - use credentials below
```

---

## 🔑 Test Credentials

| Role | Email | Password | Module | URL |
|------|-------|----------|--------|-----|
| **Kasir** | test.kasir@example.com | TestPass123! | POS | `/[slug]/pos` |
| **HR** | test.hr@example.com | TestPass123! | Payroll | `/[slug]/payroll` |
| **Purchasing** | test.purchasing@example.com | TestPass123! | Purchases | `/[slug]/purchases/create` |
| **Inventory** | test.inventory@example.com | TestPass123! | Usage Logs | `/[slug]/usage-logs` |

---

## ✅ What to Check

### For Each Test User:

1. **Login** with credentials above
2. **Navigate** to the module URL
3. **Open DevTools** (F12) → Network tab
4. **Verify**:
   - ✅ Page loads without errors
   - ✅ Dropdowns are populated (not empty)
   - ✅ Correct API endpoints called (see below)
   - ✅ Can create/edit records

---

## 🔍 Expected API Calls

### Test 1: Kasir (POS)
```
✅ GET /api/services/pos-list      (200)
✅ GET /api/products/pos-list      (200)
✅ GET /api/customers/pos-list     (200)

❌ NOT /api/services
❌ NOT /api/products
❌ NOT /api/customers
```

### Test 2: HR (Payroll)
```
✅ GET /api/staff/payroll-list     (200)

❌ NOT /api/staff
```

### Test 3: Purchasing (Purchases)
```
✅ GET /api/suppliers/purchase-list (200)
✅ GET /api/products/purchase-list  (200)

❌ NOT /api/suppliers
❌ NOT /api/products
```

### Test 4: Inventory (Usage Logs)
```
✅ GET /api/products/usage-list    (200)
✅ GET /api/staff/usage-list       (200)

❌ NOT /api/products
❌ NOT /api/staff
```

---

## 🎯 Success Criteria

| Test | Criteria | Status |
|------|----------|--------|
| **Automated Tests** | All 17 tests pass | ✅ PASS |
| **POS Dropdowns** | Services, Products, Customers populated | ⏳ |
| **Payroll Dropdown** | Staff populated | ⏳ |
| **Purchases Dropdowns** | Suppliers, Products populated | ⏳ |
| **Usage Logs Dropdowns** | Products, Staff populated | ⏳ |
| **No 403 Errors** | No permission errors in console | ⏳ |
| **Correct Endpoints** | Dedicated list endpoints called | ⏳ |

---

## 🧹 Cleanup

```bash
# Delete test users and roles via UI:
# 1. Login as Super Admin
# 2. Users → Delete test.* users
# 3. Roles → Delete TEST_* roles
```

---

## 📊 Test Results Summary

**Phase 1 Modules Fixed**: 4/4
- ✅ POS (3 dependencies)
- ✅ Payroll (1 dependency)
- ✅ Purchases (2 dependencies)
- ✅ Usage Logs (2 dependencies)

**Total Endpoints Created**: 8
**Total Tests**: 17 (All Passing)

---

## 🐛 Common Issues

| Issue | Solution |
|-------|----------|
| Empty dropdowns | Hard refresh: Ctrl+Shift+R |
| 403 errors | Logout and login again |
| Wrong endpoints | Clear .next cache and restart |

---

**Quick Links:**
- Full Guide: [PHASE1_TESTING_GUIDE.md](./PHASE1_TESTING_GUIDE.md)
- Audit Report: [RBAC_AUDIT_REPORT.md](./RBAC_AUDIT_REPORT.md)
- Issues Doc: [CROSS_PERMISSION_ISSUES.md](./CROSS_PERMISSION_ISSUES.md)
