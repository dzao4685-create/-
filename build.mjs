import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const root = path.dirname(fileURLToPath(import.meta.url));
const html = await readFile(path.join(root, 'index.html'), 'utf8');
const backend = await readFile(path.join(root, 'worker-backend.js'), 'utf8');
await mkdir(path.join(root, 'dist'), { recursive: true });
await writeFile(path.join(root, 'dist/worker.js'), 'const HTML=' + JSON.stringify(html) + ';\n' + backend);
console.log('Built dist/worker.js');
