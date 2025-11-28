/**
 * Kliv Database SDK - Client library for PostgREST-compatible database API
 * Singleton pattern - access via the exported 'db' instance
 */
class KlivDatabase {
    constructor() {
        if (KlivDatabase.instance) return KlivDatabase.instance;
        this.baseUrl = '/api/v2/database';
        KlivDatabase.instance = this;
    }

    /**
     * Build URL with query parameters
     */
    buildUrl(table, params = {}) {
        const url = table
            ? `${this.baseUrl}/${encodeURIComponent(table)}`
            : this.baseUrl;

        const searchParams = new URLSearchParams();
        for (const [key, value] of Object.entries(params)) {
            if (value !== undefined && value !== null) {
                searchParams.append(key, String(value));
            }
        }

        const queryString = searchParams.toString();
        return queryString ? `${url}?${queryString}` : url;
    }

    /**
     * Make API request
     */
    async request(method, table, params = {}, body = null) {
        const url = this.buildUrl(table, params);
        const options = {
            method,
            headers: {'Accept': 'application/json'}
        };

        if (body) {
            options.headers['Content-Type'] = 'application/json';
            options.body = JSON.stringify(body);
        }

        const response = await fetch(url, options);
        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.message || data.error || `${method} request failed`);
        }

        return data;
    }

    /**
     * List all tables
     */
    async listTables() {
        const data = await this.request('GET', null);
        return data.tables || [];
    }

    /**
     * Query records (SELECT)
     * Supports all PostgREST query parameters
     */
    async query(table, params = {}) {
        if (!table) throw new Error('Table name is required');
        return this.request('GET', table, params);
    }

    /**
     * Get single record by ID
     */
    async get(table, id) {
        const results = await this.query(table, {_row_id: `eq.${id}`});
        return results.length > 0 ? results[0] : null;
    }

    /**
     * Insert record(s)
     */
    async insert(table, data) {
        if (!table) throw new Error('Table name is required');
        return this.request('POST', table, {}, data);
    }

    /**
     * Update records
     */
    async update(table, params, data) {
        if (!table) throw new Error('Table name is required');
        return this.request('PUT', table, params, data);
    }

    /**
     * Delete records (soft delete)
     */
    async delete(table, params) {
        if (!table) throw new Error('Table name is required');
        if (!params || Object.keys(params).length === 0) {
            throw new Error('Filters required for delete (safety)');
        }
        return this.request('DELETE', table, params);
    }

    /**
     * Count records
     */
    async count(table, params = {}) {
        const newParams = {...params, select: 'count'};
        const result = await this.request('GET', table, newParams);
        return result.count || 0;
    }
}

// Export singleton instance
const db = new KlivDatabase();
export {db, KlivDatabase};
export default db;