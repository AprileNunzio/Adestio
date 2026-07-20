const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const rootDir = path.join(__dirname, '..');
const distDir = path.join(rootDir, 'dist');
const packageJsonPath = path.join(rootDir, 'package.json');
try {
    console.log('1. Svuotamento della cartella dist...');
    if (fs.existsSync(distDir)) {
        fs.rmSync(distDir, { recursive: true, force: true });
        console.log('Cartella dist svuotata con successo.');
    } else {
        console.log('Cartella dist non trovata, procedo...');
    }
    console.log('\n2. Aggiornamento automatico della versione (patch)...');
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    const oldVersion = packageJson.version;
    const versionParts = oldVersion.split('.').map(Number);
    versionParts[2]++; 
    packageJson.version = versionParts.join('.');
    fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n');
    console.log(`Versione aggiornata: ${oldVersion} -> ${packageJson.version}`);
    console.log('\n3. Esecuzione di electron-builder per la pubblicazione su GitHub...');
    console.log('NOTA: Questo richiede la variabile d\'ambiente GH_TOKEN impostata con permessi di scrittura.');
    execSync('npx electron-builder --publish always', { 
        stdio: 'inherit', 
        cwd: rootDir 
    });
    console.log('\n✅ Pubblicazione completata con successo!');
    console.log('Il file latest.yml è stato generato e caricato automaticamente su GitHub.');
} catch (err) {
    console.error('\n❌ Errore durante il processo di pubblicazione:');
    console.error(err.message);
    process.exit(1);
}
