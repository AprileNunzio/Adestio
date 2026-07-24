'use strict';

const fs = require('fs');

class WasmSandboxBridge {
    constructor() {
        try {
            this._loadedModules = new Map();
        } catch (e) {}
    }

    async loadWasmModule(moduleId, wasmFilePath, importObject = {}) {
        try {
            if (!fs.existsSync(wasmFilePath)) {
                throw new Error(`File WASM non trovato: ${wasmFilePath}`);
            }
            const buffer = fs.readFileSync(wasmFilePath);
            const compiled = await WebAssembly.compile(buffer);
            const instance = await WebAssembly.instantiate(compiled, importObject);

            this._loadedModules.set(moduleId, {
                instance,
                exports: instance.exports
            });
            return { success: true, exports: Object.keys(instance.exports) };
        } catch (e) {
            return { success: false, error: e.message };
        }
    }

    callWasmExport(moduleId, exportName, ...args) {
        try {
            if (!this._loadedModules.has(moduleId)) {
                throw new Error(`Modulo WASM non caricato: ${moduleId}`);
            }
            const mod = this._loadedModules.get(moduleId);
            if (typeof mod.exports[exportName] !== 'function') {
                throw new Error(`Export WASM ${exportName} non trovato`);
            }
            const result = mod.exports[exportName](...args);
            return { success: true, result };
        } catch (e) {
            return { success: false, error: e.message };
        }
    }
}

module.exports = new WasmSandboxBridge();
