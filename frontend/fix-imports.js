import fs from 'fs';
import path from 'path';

const dir = 'src/components/admin/ui';

if (!fs.existsSync(dir)) {
    console.error('Directory not found:', dir);
    process.exit(1);
}

const files = fs.readdirSync(dir);

let count = 0;
files.forEach(file => {
    if (file.endsWith('.tsx') || file.endsWith('.ts') || file.endsWith('.jsx') || file.endsWith('.js')) {
        const filePath = path.join(dir, file);
        let content = fs.readFileSync(filePath, 'utf8');
        
        // Match things like "@radix-ui/react-slot@1.1.2" and replace with "@radix-ui/react-slot"
        // Also class-variance-authority@0.7.1 -> class-variance-authority
        const newContent = content.replace(/("@radix-ui\/[^@"]+)@[^"]+"/g, '$1"')
                                  .replace(/("class-variance-authority)@[^"]+"/g, '$1"');
                                  
        if (newContent !== content) {
            fs.writeFileSync(filePath, newContent, 'utf8');
            console.log('Fixed imports in', file);
            count++;
        }
    }
});

console.log(`Fixed ${count} files.`);
