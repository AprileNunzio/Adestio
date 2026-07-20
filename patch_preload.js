const fs = require('fs');
let c = fs.readFileSync('preload.js', 'utf8');
c = c.replace(/function withActor\(args\)\s*\{\s*try\s*\{\s*return Object\.assign\(\{\},\s*args,\s*\{\s*actorUserId:\s*sessionStorage\.getItem\('currentUserId'\)\s*\|\|\s*''\s*\}\);\s*\}\s*catch\s*\(e\)\s*\{\s*return args;\s*\}\s*\}/g, '');
c = c.replace(/withActor\(([^)]+)\)/g, '$1');
fs.writeFileSync('preload.js', c);
console.log('patched preload.js');
