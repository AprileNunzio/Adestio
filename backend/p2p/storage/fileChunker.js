'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

class FileChunker {
    constructor() {
        try {
            this.chunkSize = 512 * 1024;
        } catch (error) {
            console.error('[FileChunker constructor Error]', error);
        }
    }

    async splitFile(filePath, outputDir) {
        try {
            if (!fs.existsSync(filePath)) {
                throw new Error(`File non trovato: ${filePath}`);
            }

            if (!fs.existsSync(outputDir)) {
                fs.mkdirSync(outputDir, { recursive: true });
            }

            const fileBuffer = fs.readFileSync(filePath);
            const totalHash = crypto.createHash('sha256').update(fileBuffer).digest('hex');

            const chunks = [];
            let offset = 0;

            while (offset < fileBuffer.length) {
                try {
                    const chunk = fileBuffer.slice(offset, offset + this.chunkSize);
                    const chunkHash = crypto.createHash('sha256').update(chunk).digest('hex');
                    const chunkPath = path.join(outputDir, `${chunkHash}.chk`);

                    if (!fs.existsSync(chunkPath)) {
                        fs.writeFileSync(chunkPath, chunk);
                    }

                    chunks.push({
                        index: chunks.length,
                        hash: chunkHash,
                        size: chunk.length
                    });

                    offset += this.chunkSize;
                } catch (chunkErr) {
                    console.error('[FileChunker chunk write Error]', chunkErr);
                    throw chunkErr;
                }
            }

            return {
                fileHash: totalHash,
                fileName: path.basename(filePath),
                totalSize: fileBuffer.length,
                chunkCount: chunks.length,
                chunks: chunks
            };
        } catch (error) {
            console.error('[FileChunker splitFile Error]', error);
            throw error;
        }
    }

    async reassembleFile(manifest, chunksDir, outputPath) {
        try {
            const dir = path.dirname(outputPath);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }

            const writeStream = fs.createWriteStream(outputPath);

            for (const chunkInfo of manifest.chunks) {
                try {
                    const chunkPath = path.join(chunksDir, `${chunkInfo.hash}.chk`);
                    if (!fs.existsSync(chunkPath)) {
                        throw new Error(`Blocco mancante: ${chunkInfo.hash}`);
                    }
                    const chunkData = fs.readFileSync(chunkPath);
                    const checkHash = crypto.createHash('sha256').update(chunkData).digest('hex');
                    if (checkHash !== chunkInfo.hash) {
                        throw new Error(`Corruzione blocco: ${chunkInfo.hash}`);
                    }
                    writeStream.write(chunkData);
                } catch (singleChunkErr) {
                    writeStream.close();
                    console.error('[FileChunker reassemble chunk Error]', singleChunkErr);
                    throw singleChunkErr;
                }
            }

            writeStream.end();
            return true;
        } catch (error) {
            console.error('[FileChunker reassembleFile Error]', error);
            return false;
        }
    }
}

module.exports = new FileChunker();
