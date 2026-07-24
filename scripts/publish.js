require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const ftp = require('basic-ftp');

const rootDir = path.join(__dirname, '..');
const distDir = path.join(rootDir, 'dist');
const packageJsonPath = path.join(rootDir, 'package.json');

async function publishAll() {
    try {
        console.log('1. Svuotamento della cartella dist...');
        if (fs.existsSync(distDir)) {
            fs.rmSync(distDir, { recursive: true, force: true });
        }

        console.log('\n2. Aggiornamento automatico della versione...');
        const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
        const oldVersion = packageJson.version;
        const versionParts = oldVersion.split('.').map(Number);
        versionParts[2]++;
        packageJson.version = versionParts.join('.');
        fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n');
        console.log(`Versione aggiornata: ${oldVersion} -> ${packageJson.version}`);

        console.log('\n3. Esecuzione electron-builder per GitHub release...');
        execSync('npx electron-builder --publish always', {
            stdio: 'inherit',
            cwd: rootDir
        });

        console.log('\n4. Caricamento file di installazione su Server FTP...');
        const client = new ftp.Client();
        try {
            if (process.env.FTP_HOST && process.env.FTP_USER && process.env.FTP_PASS) {
                await client.access({
                    host: process.env.FTP_HOST,
                    user: process.env.FTP_USER,
                    password: process.env.FTP_PASS,
                    secure: false
                });

                const setupFile = `Adestio-Setup-${packageJson.version}.exe`;
                const setupPath = path.join(distDir, setupFile);
                const latestYmlPath = path.join(distDir, 'latest.yml');

                if (fs.existsSync(setupPath)) {
                    console.log(`[FTP] Uploading ${setupFile}...`);
                    await client.uploadFrom(setupPath, setupFile);
                }

                if (fs.existsSync(latestYmlPath)) {
                    console.log(`[FTP] Uploading latest.yml...`);
                    await client.uploadFrom(latestYmlPath, 'latest.yml');
                }
                console.log('[FTP] ✅ Upload completato con successo!');
            } else {
                console.warn('[FTP] Credenziali FTP mancanti nel file .env');
            }
        } catch (ftpError) {
            console.error('[FTP] Errore durante l\'upload:', ftpError.message);
        } finally {
            client.close();
        }

        console.log('\n5. Pubblicazione Marketplace App (Adestio Business Suite)...');
        try {
            const marketplaceDir = path.join(rootDir, '..', 'Adestio-Marketplace');
            if (fs.existsSync(marketplaceDir)) {
                execSync('node pack_and_deploy.js App-BusinessSuite --prod', {
                    stdio: 'inherit',
                    cwd: marketplaceDir
                });
            }
        } catch (mpErr) {
            console.error('[Marketplace] Errore deploy marketplace:', mpErr.message);
        }

        console.log('\n✅ PUBBLICAZIONE COMPLETA RISOLTA SU GITHUB E FTP!');
    } catch (err) {
        console.error('\n❌ Errore durante il processo di pubblicazione:', err.message);
        process.exit(1);
    }
}

publishAll();
