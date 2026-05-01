const fs = require('fs');
const path = require('path');

const walkSync = (dir, filelist = []) => {
  if (!fs.existsSync(dir)) return filelist;
  fs.readdirSync(dir).forEach(file => {
    const dirFile = path.join(dir, file);
    try {
      if (fs.statSync(dirFile).isDirectory()) {
        filelist = walkSync(dirFile, filelist);
      } else {
        if (dirFile.endsWith('.tsx') || dirFile.endsWith('.ts')) {
          filelist.push(dirFile);
        }
      }
    } catch (err) {
      if (err.code === 'ENOENT' || err.code === 'EPERM' || err.code === 'EACCES') return;
      throw err;
    }
  });
  return filelist;
};

const dirsToScan = [path.join(__dirname, '..', 'app'), path.join(__dirname, '..', 'components')];
let files = [];
for (const dir of dirsToScan) {
    files = files.concat(walkSync(dir));
}

let linkCount = 0;
let routerCount = 0;

for (const file of files) {
  let content = fs.readFileSync(file, 'utf8');
  let changed = false;

  // Refactor Link
  if (content.includes("from 'next/link'") || content.includes('from "next/link"')) {
      content = content.replace(/import Link from ['"]next\/link['"];?/g, "import TenantLink from '@/components/TenantLink';");
      content = content.replace(/<Link/g, "<TenantLink");
      content = content.replace(/<\/Link>/g, "</TenantLink>");
      changed = true;
      linkCount++;
  }

  // Refactor useRouter
  if (content.includes("useRouter()") && (content.includes("from 'next/navigation'") || content.includes('from "next/navigation"'))) {
      content = content.replace(/import {([^}]*)useRouter([^}]*)} from ['"]next\/navigation['"]/g, (match, p1, p2) => {
          let newImports = `import {${p1}${p2}} from "next/navigation";\nimport { useTenantRouter } from "@/hooks/useTenantRouter";`;
          // clean up empty imports
          newImports = newImports.replace(/import {\s*} from "next\/navigation";\n/, '');
          newImports = newImports.replace(/,\s*,/g, ',');
          return newImports;
      });
      content = content.replace(/useRouter\(\)/g, "useTenantRouter()");
      changed = true;
      routerCount++;
  }

  if (changed) {
      fs.writeFileSync(file, content, 'utf8');
  }
}

console.log(`Refactored ${linkCount} files with Link, and ${routerCount} files with useRouter.`);
