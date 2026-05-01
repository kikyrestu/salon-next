const fs = require('fs');
const path = require('path');

const walkSync = (dir, filelist = []) => {
  if (!fs.existsSync(dir)) return filelist;
  fs.readdirSync(dir).forEach(file => {
    const dirFile = path.join(dir, file);
    if (fs.statSync(dirFile).isDirectory()) {
      filelist = walkSync(dirFile, filelist);
    } else {
      if (dirFile.endsWith('route.ts')) {
        filelist.push(dirFile);
      }
    }
  });
  return filelist;
};

const apiDir = path.join(__dirname, '..', 'app', 'api');
const files = walkSync(apiDir);

let count = 0;

for (const file of files) {
    let content = fs.readFileSync(file, 'utf8');
    let changed = false;
    
    // Replace: const tenantSlug = props?.params?.slug || 'pusat';
    // With: const tenantSlug = request.headers.get('x-store-slug') || 'pusat';
    
    // We need to use the actual request variable name.
    // In our previous script, we matched: export async function GET(request, props)
    // So the request variable is whatever was matched.
    const regex = /export\s+async\s+function\s+(GET|POST|PUT|DELETE|PATCH)\s*\(\s*([^,)]+)\s*,[^)]+\)\s*\{\s*const\s+tenantSlug\s*=\s*props\?\.params\?\.slug\s*\|\|\s*'pusat';/g;
    
    content = content.replace(regex, (match, method, reqVar) => {
        changed = true;
        return `export async function ${method}(${reqVar}, props: any) {\n    const tenantSlug = ${reqVar}.headers.get('x-store-slug') || 'pusat';`;
    });
    
    if (changed) {
        fs.writeFileSync(file, content, 'utf8');
        count++;
    }
}

console.log(`Updated ${count} API routes to read slug from headers.`);
