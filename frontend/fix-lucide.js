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
        
        // Replace "lucide-react@0.487.0" with "lucide-react"
        const newContent = content.replace(/"lucide-react@0\.487\.0"/g, '"lucide-react"');
                                  
        if (newContent !== content) {
            fs.writeFileSync(filePath, newContent, 'utf8');
            console.log('Fixed lucide-react in', file);
            count++;
        }
    }
});

console.log(`Successfully fixed ${count} files.`);
