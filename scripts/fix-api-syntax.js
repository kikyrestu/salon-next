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
    
    if (content.includes('request: NextRequest.headers.get')) {
        content = content.replace(/request:\s*NextRequest\.headers\.get/g, 'request.headers.get');
        changed = true;
    }
    
    if (content.includes('req: NextRequest.headers.get')) {
        content = content.replace(/req:\s*NextRequest\.headers\.get/g, 'req.headers.get');
        changed = true;
    }
    
    if (content.includes('request: any.headers.get')) {
        content = content.replace(/request:\s*any\.headers\.get/g, 'request.headers.get');
        changed = true;
    }
    
    if (content.includes('req: any.headers.get')) {
        content = content.replace(/req:\s*any\.headers\.get/g, 'req.headers.get');
        changed = true;
    }
    
    // Also remove await connectToDB() if it exists
    if (content.includes('await connectToDB()')) {
        content = content.replace(/await\s+connectToDB\(\);?/g, '');
        changed = true;
    }

    if (changed) {
        fs.writeFileSync(file, content, 'utf8');
        count++;
    }
}

console.log(`Fixed syntax in ${count} API routes.`);
