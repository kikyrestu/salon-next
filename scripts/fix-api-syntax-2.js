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
    
    // Fix things like `request: Request.headers.get`
    const regex = /([a-zA-Z0-9_]+):\s*[a-zA-Z0-9_]+\.headers\.get/g;
    if (regex.test(content)) {
        content = content.replace(regex, '$1.headers.get');
        changed = true;
    }
    
    if (changed) {
        fs.writeFileSync(file, content, 'utf8');
        count++;
    }
}

console.log(`Fixed syntax in ${count} API routes.`);
