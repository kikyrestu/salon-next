const fs = require('fs');
const path = require('path');

const walkSync = (dir, filelist = []) => {
  if (!fs.existsSync(dir)) return filelist;
  fs.readdirSync(dir).forEach(file => {
    const dirFile = path.join(dir, file);
    try {
      if (fs.statSync(dirFile).isDirectory()) {
        filelist = walkSync(dirFile, filelist);
      } else if (dirFile.endsWith('.ts') || dirFile.endsWith('.tsx')) {
        filelist.push(dirFile);
      }
    } catch (e) {}
  });
  return filelist;
};

const apiDir = path.join(__dirname, '..', 'app', 'api');
const files = walkSync(apiDir);

let totalFixed = 0;

files.forEach(filePath => {
  let content = fs.readFileSync(filePath, 'utf8');
  const original = content;

  // Fix: `await params` -> `await props.params` (where props is the second arg)
  // The pattern is: function has `props: any` as second param, then uses `await params`
  content = content.replace(/const\s*\{([^}]+)\}\s*=\s*await\s+params\s*;/g, 
    'const {$1} = await props.params;');

  if (content !== original) {
    fs.writeFileSync(filePath, content, 'utf8');
    const rel = path.relative(path.join(__dirname, '..'), filePath);
    console.log(`FIXED: ${rel}`);
    totalFixed++;
  }
});

console.log(`\nDone. Fixed ${totalFixed} files.`);
