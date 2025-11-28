/**
 * Kliv Auth SDK - Client library for authentication and user management
 * Singleton pattern - access via the exported 'auth' instance
 */
class KlivAuth {
    constructor() {
        // Enforce singleton pattern
        if (KlivAuth.instance) {
            return KlivAuth.instance;
        }

        this.user = null;
        KlivAuth.instance = this;
    }

    async signUp(email, password, name = null, locale = null, metadata = null) {
        const body = {email, password};
        if (name) body.name = name;
        if (locale) body.locale = locale;
        if (metadata) body.metadata = metadata;

        const response = await fetch('/api/v2/auth/signup', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(body)
        });

        const data = await response.json();
        if (!response.ok) throw new Error(data.message || 'Signup failed');

        this.user = data.user;
        return this.user;
    }

    async signIn(email, password) {
        const response = await fetch('/api/v2/auth/signin', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({email, password})
        });

        const data = await response.json();
        if (!response.ok) throw new Error(data.message || 'Sign in failed');

        this.user = data.user;
        return this.user;
    }

    async signOut() {
        await fetch('/api/v2/auth/signout', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({})
        });

        this.user = null;
    }

    async getUser(forceRefresh = false) {
        // Return cached user unless forced to refresh
        if (!forceRefresh && this.user) {
            return this.user;
        }

        const response = await fetch('/api/v2/auth/user', {
            method: 'GET'
        });

        if (!response.ok) {
            this.user = null;
            return null;
        }

        const data = await response.json();
        this.user = data.user;
        return this.user;
    }

    async updateUser(updates) {
        // updates can include: email, password, firstName, lastName, metadata
        const response = await fetch('/api/v2/auth/user', {
            method: 'PUT',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(updates)
        });

        const data = await response.json();
        if (!response.ok) throw new Error(data.message || 'Update failed');

        this.user = data.user;
        return this.user;
    }

    async requestPasswordReset(email) {
        const response = await fetch('/api/v2/auth/password-reset', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({email})
        });

        const data = await response.json();
        if (!response.ok) throw new Error(data.message || 'Password reset request failed');

        return data;
    }

    async completePasswordReset(token, password) {
        const response = await fetch('/api/v2/auth/password-reset-complete', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({token, password})
        });

        const data = await response.json();
        if (!response.ok) throw new Error(data.message || 'Password reset failed');

        return data;
    }

    async listUsers(options = {}) {
        const params = new URLSearchParams();
        if (options.startRow !== undefined) params.append('startRow', options.startRow);
        if (options.endRow !== undefined) params.append('endRow', options.endRow);
        if (options.search) params.append('search', JSON.stringify(options.search));

        const response = await fetch(`/api/v2/auth/users?${params}`, {
            method: 'GET'
        });

        const data = await response.json();
        if (!response.ok) throw new Error(data.message || 'Failed to list users');

        return data;
    }

    async getUserByUuid(userUuid) {
        const response = await fetch(`/api/v2/auth/users/${userUuid}`, {
            method: 'GET'
        });

        const data = await response.json();
        if (!response.ok) throw new Error(data.message || 'Failed to get user');

        return data;
    }

    async updateUserByUuid(userUuid, updates) {
        const response = await fetch(`/api/v2/auth/users/${userUuid}`, {
            method: 'PUT',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(updates)
        });

        const data = await response.json();
        if (!response.ok) throw new Error(data.message || 'Failed to update user');

        return data;
    }

    async deleteUser(userUuid) {
        const response = await fetch(`/api/v2/auth/users/${userUuid}`, {
            method: 'DELETE'
        });

        const data = await response.json();
        if (!response.ok) throw new Error(data.message || 'Failed to delete user');

        return data;
    }

    async listGroups() {
        const response = await fetch('/api/v2/auth/groups', {
            method: 'GET'
        });

        const data = await response.json();
        if (!response.ok) throw new Error(data.message || 'Failed to list groups');

        return data;
    }

    // Getter to check if user is signed in
    get isSignedIn() {
        return this.user !== null;
    }

    // Compatibility aliases for older method names
    async createUser(email, password, name = null, locale = null, metadata = null) {
        return this.signUp(email, password, name, locale, metadata);
    }

    async getCurrentUser(forceRefresh = false) {
        return this.getUser(forceRefresh);
    }
}

// Create and export singleton instance
const auth = new KlivAuth();
export {auth, KlivAuth};
export default auth;