import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Get current directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// Root is one level up from scripts/
const rootDir = path.resolve(__dirname, '..');

const srcDir = path.join(rootDir, 'src', 'public');
const destDir = path.join(rootDir, 'dist', 'public');

try {
    // Ensure destination directory exists (or cpSync handles parent dirs? No, best to ensure)
    // Actually cpSync with recursive creates directories if they don't exist? 
    // Node fs.cpSync docs: "If dest does not exist, it is created." for files. For directories...
    // Let's just use cpSync with recursive: true.

    console.log(`Copying static assets from ${srcDir} to ${destDir}...`);

    if (fs.existsSync(srcDir)) {
        fs.cpSync(srcDir, destDir, { recursive: true });
        console.log('Static assets copied successfully.');
    } else {
        console.warn('No src/public directory found. Skipping asset copy.');
    }
} catch (error) {
    console.error('Failed to copy static assets:', error);
    process.exit(1);
}
