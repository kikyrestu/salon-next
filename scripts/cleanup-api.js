const fs = require('fs');
const path = require('path');

const walkSync = (dir, filelist = []) => {
  if (!fs.existsSync(dir)) return filelist;
  fs.readdirSync(dir).forEach(file => {
    const dirFile = path.join(dir, file);
    try {
      if (fs.statSync(dirFile).isDirectory()) {
        filelist = walkSync(dirFile, filelist);
      } else if (dirFile.endsWith('route.ts')) {
        filelist.push(dirFile);
      }
    } catch (e) {}
  });
  return filelist;
};

const apiDir = path.join(__dirname, '..', 'app', 'api');
const files = walkSync(apiDir);
let count = 0;

for (const file of files) {
    let content = fs.readFileSync(file, 'utf8');
    const original = content;

    // Remove import of connectDB / connectToDB from mongodb.ts
    content = content.replace(/import\s+connectDB\s+from\s+['"]@\/lib\/mongodb['"];?\r?\n?/g, '');
    content = content.replace(/import\s+{\s*connectToDB\s*}\s+from\s+['"]@\/lib\/mongodb['"];?\r?\n?/g, '');
    content = content.replace(/import\s+dbConnect\s+from\s+['"]@\/lib\/mongodb['"];?\r?\n?/g, '');
    content = content.replace(/import\s+{\s*connectDB\s*}\s+from\s+['"]@\/lib\/mongodb['"];?\r?\n?/g, '');

    // Remove stale import of initModels if not used (but keep if used)
    // Only remove the import line, not the destructured usage
    if (!content.includes('initModels()') && !content.includes('initModels,')) {
        content = content.replace(/import\s+{\s*initModels\s*}\s+from\s+['"]@\/lib\/initModels['"];?\r?\n?/g, '');
    }

    // Remove any stray calls to connectDB/connectToDB/dbConnect
    content = content.replace(/\s*await\s+connectDB\(\);?\r?\n?/g, '\n');
    content = content.replace(/\s*await\s+connectToDB\(\);?\r?\n?/g, '\n');
    content = content.replace(/\s*await\s+dbConnect\(\);?\r?\n?/g, '\n');
    content = content.replace(/\s*initModels\(\);?\r?\n?/g, '\n');

    // Remove multiple consecutive blank lines (more than 2)
    content = content.replace(/\n{4,}/g, '\n\n');

    if (content !== original) {
        fs.writeFileSync(file, content, 'utf8');
        count++;
    }
}

console.log(`Cleaned up ${count} API routes.`);
