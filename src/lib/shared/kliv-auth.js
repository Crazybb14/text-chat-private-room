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

    async resendActivation(email) {
        const response = await fetch('/api/v2/auth/resend-activation', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({email})
        });

        const data = await response.json();
        if (!response.ok) throw new Error(data.message || 'Resend activation failed');

        return data;
    }

    async getActivationInfo(token) {
        const response = await fetch(`/api/v2/auth/activate?token=${encodeURIComponent(token)}`, {
            method: 'GET'
        });

        const data = await response.json();
        if (!response.ok) throw new Error(data.message || 'Failed to get activation info');

        return data;
    }

    async activate(token, password = null) {
        const body = {token};
        if (password) body.password = password;

        const response = await fetch('/api/v2/auth/activate', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(body)
        });

        const data = await response.json();
        if (!response.ok) throw new Error(data.message || 'Activation failed');

        // If activation returns a user (successful account activation), cache it
        if (data.user) {
            this.user = data.user;
        }

        return data.user || data;
    }

    /**
     * List users (requires organization:listUsers or tenant:describeCustomer permission)
     * @param {Object} [options] - Listing options
     * @param {number} [options.startRow=0] - Starting row for pagination
     * @param {number} [options.endRow=100] - Ending row for pagination
     * @param {Object} [options.search] - Search filters
     * @param {string} [options.search.email] - Filter by email (partial match)
     * @param {string} [options.search.teamUuid] - Filter by team UUID
     * @returns {Promise<{data: Array, totalCount: number}>}
     */
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

    /**
     * Admin: Update a user by UUID
     * @param {string} userUuid - User UUID to update
     * @param {Object} updates - Fields to update
     * @param {string} [updates.email] - New email
     * @param {string} [updates.password] - New password
     * @param {string} [updates.firstName] - New first name
     * @param {string} [updates.lastName] - New last name
     * @param {boolean} [updates.emailVerified] - Mark email as verified (admin only, cannot set on yourself)
     * @param {Object} [updates.metadata] - User metadata (replaces current metadata)
     */
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

    /**
     * Admin: Create a new user in a team
     * @param {Object} options - User creation options
     * @param {string} options.email - User email (required)
     * @param {string} [options.password] - Password (if omitted, sends activation email)
     * @param {string} [options.firstName] - First name
     * @param {string} [options.lastName] - Last name
     * @param {string} [options.locale] - Locale code (default: en-US)
     * @param {string} [options.teamUuid] - Target team UUID (requires Cross-Team Administration policy)
     * @param {Object} [options.metadata] - User metadata key-value pairs
     */
    async createUser(options) {
        const response = await fetch('/api/v2/auth/users', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(options)
        });

        const data = await response.json();
        if (!response.ok) throw new Error(data.message || 'Failed to create user');

        return data;
    }

    // Getter to check if user is signed in
    get isSignedIn() {
        return this.user !== null;
    }

    /**
     * Check if current user belongs to a group by key
     * @param {string} groupKey - Group key to check (e.g., 'org_admin', 'premium-users')
     * @returns {boolean} True if user is in the group
     */
    hasGroup(groupKey) {
        return this.user?.groups?.some(g => g.key === groupKey) ?? false;
    }

    async getCurrentUser(forceRefresh = false) {
        return this.getUser(forceRefresh);
    }
}

// Create and export singleton instance
const auth = new KlivAuth();
export {auth, KlivAuth};
export default auth;