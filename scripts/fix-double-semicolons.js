const fs = require('fs');
const path = require('path');

const files = [
  'app/[slug]/(frontend)/users/new/page.tsx',
  'app/[slug]/(frontend)/roles/new/page.tsx',
  'app/[slug]/(frontend)/reports/activity-log/ActivityLogFilters.tsx',
  'app/[slug]/(frontend)/purchases/[id]/page.tsx',
  'app/[slug]/(frontend)/purchases/create/page.tsx',
  'app/[slug]/(frontend)/membership/page.tsx',
  'app/[slug]/(frontend)/customers/page.tsx',
  'app/[slug]/(frontend)/customers/[id]/page.tsx',
  'app/[slug]/(frontend)/invoices/print/[id]/page.tsx',
  'app/[slug]/(auth)/register/page.tsx',
  'app/[slug]/(frontend)/appointments/page.tsx',
  'app/[slug]/(frontend)/appointments/calendar/page.tsx',
];

let fixed = 0;
files.forEach(f => {
  const fullPath = path.join(__dirname, '..', f);
  if (!fs.existsSync(fullPath)) {
    console.log(`SKIP (not found): ${f}`);
    return;
  }
  let content = fs.readFileSync(fullPath, 'utf8');
  const original = content;
  // Fix double semicolons on import lines
  content = content.replace(/from\s+"@\/hooks\/useTenantRouter";;/g, 'from "@/hooks/useTenantRouter";');
  if (content !== original) {
    fs.writeFileSync(fullPath, content, 'utf8');
    console.log(`FIXED: ${f}`);
    fixed++;
  } else {
    console.log(`NO CHANGE: ${f}`);
  }
});
console.log(`\nDone. Fixed ${fixed} files.`);
