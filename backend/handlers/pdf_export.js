'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');
const JSZip = require('jszip');

function _xmlEscape(s) {
    return String(s == null ? '' : s)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// Individua l'eseguibile di LibreOffice (config override, env, percorsi standard per OS).
function findSoffice() {
    const candidates = [];
    try { const cfg = require('../config').readConfig() || {}; if (cfg.libreoffice_path) candidates.push(cfg.libreoffice_path); } catch (_) {}
    if (process.env.SOFFICE_PATH) candidates.push(process.env.SOFFICE_PATH);
    if (process.platform === 'win32') {
        candidates.push('C:\\Program Files\\LibreOffice\\program\\soffice.exe');
        candidates.push('C:\\Program Files (x86)\\LibreOffice\\program\\soffice.exe');
    } else if (process.platform === 'darwin') {
        candidates.push('/Applications/LibreOffice.app/Contents/MacOS/soffice');
    } else {
        candidates.push('/usr/bin/soffice', '/usr/local/bin/soffice', '/opt/libreoffice/program/soffice');
    }
    for (const c of candidates) { try { if (c && fs.existsSync(c)) return c; } catch (_) {} }
    return null;
}

function _coreXml(meta) {
    const now = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
    return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:dcmitype="http://purl.org/dc/dcmitype/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">' +
        '<dc:title>' + _xmlEscape(meta.title) + '</dc:title>' +
        '<dc:subject>' + _xmlEscape(meta.subject) + '</dc:subject>' +
        '<dc:creator>' + _xmlEscape(meta.creator) + '</dc:creator>' +
        '<cp:keywords>' + _xmlEscape(meta.keywords) + '</cp:keywords>' +
        '<dc:description>' + _xmlEscape(meta.description) + '</dc:description>' +
        '<cp:lastModifiedBy>' + _xmlEscape(meta.creator) + '</cp:lastModifiedBy>' +
        '<dcterms:created xsi:type="dcterms:W3CDTF">' + now + '</dcterms:created>' +
        '<dcterms:modified xsi:type="dcterms:W3CDTF">' + now + '</dcterms:modified>' +
        '</cp:coreProperties>';
}

// Inietta i metadati nel core.xml del docx, così LibreOffice li riporta nell'XMP del PDF/A.
async function injectDocxMetadata(docxBuffer, meta) {
    const zip = await JSZip.loadAsync(docxBuffer);
    zip.file('docProps/core.xml', _coreXml(meta || {}));
    const ct = zip.file('[Content_Types].xml');
    if (ct) {
        let xml = await ct.async('string');
        if (!/docProps\/core\.xml/.test(xml)) {
            xml = xml.replace('</Types>', '<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/></Types>');
            zip.file('[Content_Types].xml', xml);
        }
    }
    const rels = zip.file('_rels/.rels');
    if (rels) {
        let xml = await rels.async('string');
        if (!/core-properties/.test(xml)) {
            xml = xml.replace('</Relationships>', '<Relationship Id="rIdCoreProps" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/></Relationships>');
            zip.file('_rels/.rels', xml);
        }
    }
    return zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
}

function _fileUrl(p) {
    return 'file:///' + String(p).replace(/\\/g, '/').replace(/^\/+/, '');
}

// Converte un docx (buffer) in PDF/A tramite LibreOffice headless. pdfaVersion: 1|2|3 (PDF/A-1b/2b/3b).
async function convertDocxToPdfA(docxBuffer, meta, opts) {
    opts = opts || {};
    const version = String(opts.pdfaVersion || 2);
    const exe = findSoffice() || 'soffice';
    let withMeta;
    try { withMeta = await injectDocxMetadata(docxBuffer, meta || {}); }
    catch (e) { withMeta = Buffer.isBuffer(docxBuffer) ? docxBuffer : Buffer.from(docxBuffer); }
    const workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'adestio-pdfa-'));
    const profileDir = path.join(workDir, 'loprofile');
    const inPath = path.join(workDir, 'documento.docx');
    const outPath = path.join(workDir, 'documento.pdf');
    try { fs.writeFileSync(inPath, withMeta); }
    catch (e) { try { fs.rmSync(workDir, { recursive: true, force: true }); } catch (_) {} return { success: false, code: 'IO_ERROR', error: e.message }; }
    const filter = 'pdf:writer_pdf_Export:{"SelectPdfVersion":{"type":"long","value":"' + version + '"}}';
    const args = ['--headless', '--nologo', '--nofirststartwizard', '--norestore', '--nolockcheck',
        '-env:UserInstallation=' + _fileUrl(profileDir), '--convert-to', filter, '--outdir', workDir, inPath];
    return new Promise((resolve) => {
        let done = false;
        const finish = (res) => { if (done) return; done = true; try { fs.rmSync(workDir, { recursive: true, force: true }); } catch (_) {} resolve(res); };
        let proc;
        try { proc = spawn(exe, args, { windowsHide: true }); }
        catch (e) { return finish({ success: false, code: 'NO_LIBREOFFICE', error: e.message }); }
        const timer = setTimeout(() => { try { proc.kill(); } catch (_) {} finish({ success: false, code: 'TIMEOUT', error: 'Conversione LibreOffice scaduta' }); }, opts.timeoutMs || 90000);
        let stderr = '';
        if (proc.stderr) proc.stderr.on('data', d => { stderr += String(d); });
        proc.on('error', (e) => {
            clearTimeout(timer);
            finish({ success: false, code: e.code === 'ENOENT' ? 'NO_LIBREOFFICE' : 'SPAWN_ERROR', error: e.code === 'ENOENT' ? 'LibreOffice non trovato' : e.message });
        });
        proc.on('close', (code) => {
            clearTimeout(timer);
            if (fs.existsSync(outPath)) {
                let pdf = null;
                try { pdf = fs.readFileSync(outPath); } catch (e) { return finish({ success: false, code: 'READ_ERROR', error: e.message }); }
                return finish({ success: true, pdf });
            }
            finish({ success: false, code: 'CONVERT_FAILED', error: stderr.trim() || ('LibreOffice uscito con codice ' + code) });
        });
    });
}

module.exports = { findSoffice, injectDocxMetadata, convertDocxToPdfA };
