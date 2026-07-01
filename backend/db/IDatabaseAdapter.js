class IDatabaseAdapter {
    constructor() {
        if (this.constructor === IDatabaseAdapter) {
            throw new Error('Abstract class');
        }
    }
    async connect(config) { throw new Error('Not implemented'); }
    disconnect() { throw new Error('Not implemented'); }
    execute(sql, params = []) { throw new Error('Not implemented'); }
    query(sql, params = []) { throw new Error('Not implemented'); }
    runMigrations(migrations) { throw new Error('Not implemented'); }
    exportData() { throw new Error('Not implemented'); }
}
module.exports = IDatabaseAdapter;
