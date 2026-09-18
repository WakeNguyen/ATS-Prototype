import fs from 'fs';
const content = fs.readFileSync('.env.local', 'utf8');
const keys = content.split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('#')).map(l => l.split('=')[0]);
console.log('Environment variable keys present:', keys);
