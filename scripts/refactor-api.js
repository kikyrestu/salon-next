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
    
    // Find all model imports
    const modelImportRegex = /import\s+([A-Z][a-zA-Z0-9_]*)\s+from\s+['"]@\/models\/[^'"]+['"];?/g;
    const initModelsRegex = /import\s+\{([^}]+)\}\s+from\s+['"]@\/lib\/initModels['"];?/g;
    
    let modelsUsed = new Set();
    let match;
    
    while ((match = modelImportRegex.exec(content)) !== null) {
        modelsUsed.add(match[1]);
    }
    
    while ((match = initModelsRegex.exec(content)) !== null) {
        const imports = match[1].split(',').map(s => s.trim()).filter(s => s && s !== 'initModels');
        imports.forEach(i => modelsUsed.add(i));
    }
    
    if (modelsUsed.size > 0) {
        // Remove old imports
        content = content.replace(modelImportRegex, '');
        content = content.replace(initModelsRegex, '');
        
        // Ensure tenantDb is imported
        if (!content.includes('getTenantModels')) {
            content = `import { getTenantModels } from "@/lib/tenantDb";\n` + content;
        }
        
        // Find exported functions
        const methods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'];
        for (const method of methods) {
            const methodRegex = new RegExp(`export\\s+async\\s+function\\s+${method}\\s*\\(\\s*([^,)]+)(?:\\s*,\\s*([^)]+))?\\s*\\)\\s*\\{`, 'g');
            
            content = content.replace(methodRegex, (fullMatch, reqParam, propsParam) => {
                // If it already has params
                let newSignature = '';
                if (propsParam && propsParam.includes('params')) {
                    newSignature = `export async function ${method}(${reqParam}, ${propsParam}) {`;
                } else {
                    newSignature = `export async function ${method}(${reqParam}, props: { params: { slug?: string } }) {`;
                }
                
                const modelDestructure = `\n    const tenantSlug = props?.params?.slug || 'pusat';\n    const { ${Array.from(modelsUsed).join(', ')} } = await getTenantModels(tenantSlug);\n`;
                
                // remove any await connectDB() or initModels()
                return newSignature + modelDestructure;
            });
        }
        
        // Clean up connectDB calls
        content = content.replace(/await\s+connectDB\(\);?/g, '');
        content = content.replace(/initModels\(\);?/g, '');
        
        fs.writeFileSync(file, content, 'utf8');
        count++;
    }
}

console.log(`Refactored ${count} API routes to use getTenantModels.`);
