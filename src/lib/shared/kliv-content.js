/**
 * Kliv Content SDK - Client library for content filesystem management
 * Singleton pattern - access via the exported 'content' instance
 */
class KlivContent {
    constructor() {
        // Enforce singleton pattern
        if (KlivContent.instance) {
            return KlivContent.instance;
        }

        KlivContent.instance = this;
    }

    /**
     * Normalize a path to ensure it starts with /content/
     * @param {string} path - Path to normalize
     * @returns {string} Normalized path starting with /content/
     * @private
     */
    _normalizePath(path) {
        if (!path) return '/content/';

        // Remove leading/trailing whitespace
        path = path.trim();

        // If already starts with /content/, return as-is
        if (path.startsWith('/content/')) {
            return path;
        }

        // If starts with content/ (no leading slash), add the leading slash
        if (path.startsWith('content/')) {
            return '/' + path;
        }

        // Otherwise, prepend /content/
        // Remove leading slash if present to avoid double slashes
        if (path.startsWith('/')) {
            return '/content' + path;
        }

        return '/content/' + path;
    }

    /**
     * List files in the content filesystem with optional prefix filter
     * @param {string} prefix - Optional path prefix to filter results (should start with /content/, e.g., "/content/uploads/")
     * @returns {Promise<{files: Array}>} List of files with metadata
     */
    async listFiles(prefix = null) {
        const normalizedPrefix = prefix ? this._normalizePath(prefix) : null;
        const url = normalizedPrefix
            ? `/api/v2/content?prefix=${encodeURIComponent(normalizedPrefix)}`
            : '/api/v2/content';

        const response = await fetch(url, {
            method: 'GET'
        });

        const data = await response.json();
        if (!response.ok) throw new Error(data.message || 'Failed to list files');

        return data;
    }

    /**
     * Upload a file using multipart form data
     * @param {File|Blob} file - File or Blob to upload
     * @param {string} directory - Directory path (should start with /content/, e.g., "/content/uploads/")
     * @param {Object} options - Optional parameters
     * @param {Function} options.onProgress - Progress callback ({loaded, total, percentage})
     * @param {AbortSignal} options.signal - AbortSignal for cancellation
     * @returns {Promise<Object>} Created file metadata with uuid, sha256, contentUrl, etc.
     */
    async uploadFile(file, directory = '/content/uploads/', options = {}) {
        return new Promise((resolve, reject) => {
            const normalizedDirectory = this._normalizePath(directory);
            const formData = new FormData();
            formData.append('file', file);
            formData.append('directory', normalizedDirectory);

            const xhr = new XMLHttpRequest();

            // Progress tracking
            if (options.onProgress) {
                xhr.upload.addEventListener('progress', (e) => {
                    if (e.lengthComputable) {
                        options.onProgress({
                            loaded: e.loaded,
                            total: e.total,
                            percentage: (e.loaded / e.total) * 100
                        });
                    }
                });
            }

            // Cancellation support
            if (options.signal) {
                options.signal.addEventListener('abort', () => {
                    xhr.abort();
                    reject(new Error('Upload cancelled'));
                });
            }

            // Success/error handling
            xhr.addEventListener('load', () => {
                if (xhr.status === 200) {
                    try {
                        resolve(JSON.parse(xhr.responseText));
                    } catch (e) {
                        reject(new Error('Invalid JSON response'));
                    }
                } else {
                    try {
                        const error = JSON.parse(xhr.responseText);
                        reject(new Error(error.message || 'Upload failed'));
                    } catch (e) {
                        reject(new Error(`Upload failed with status ${xhr.status}`));
                    }
                }
            });

            xhr.addEventListener('error', () => reject(new Error('Network error')));
            xhr.addEventListener('abort', () => reject(new Error('Upload cancelled')));

            xhr.open('POST', '/api/v2/content');
            xhr.send(formData);
        });
    }

    /**
     * Delete a file by path (soft delete)
     * @param {string} path - The file path (should start with /content/, e.g., "/content/uploads/photo.jpg")
     * @returns {Promise<{deleted: boolean}>}
     */
    async deleteFile(path) {
        const normalizedPath = this._normalizePath(path);
        const response = await fetch(`/api/v2/content?path=${encodeURIComponent(normalizedPath)}`, {
            method: 'DELETE'
        });

        const data = await response.json();
        if (!response.ok) throw new Error(data.message || 'Delete failed');

        return data;
    }

    /**
     * Move or rename a file
     * @param {string} oldPath - Current file path (should start with /content/, e.g., "/content/uploads/old.jpg")
     * @param {string} newPath - New file path (should start with /content/, e.g., "/content/uploads/new.jpg")
     * @returns {Promise<Object>} Updated file metadata
     */
    async moveFile(oldPath, newPath) {
        const normalizedOldPath = this._normalizePath(oldPath);
        const normalizedNewPath = this._normalizePath(newPath);
        const response = await fetch('/api/v2/content/move', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ oldPath: normalizedOldPath, newPath: normalizedNewPath })
        });

        const data = await response.json();
        if (!response.ok) throw new Error(data.message || 'Move failed');

        return data;
    }

    /**
     * Upload a file from an HTML file input element
     * @param {File} file - File object from input element
     * @param {string} directory - Directory path (should start with /content/, e.g., "/content/uploads/")
     * @param {Object} options - Optional parameters (onProgress, signal)
     * @returns {Promise<Object>} Created file metadata
     */
    async uploadFromInput(file, directory = '/content/uploads/', options = {}) {
        return this.uploadFile(file, directory, options);
    }

    /**
     * Upload multiple files from an HTML file input element (serial upload)
     * @param {FileList|Array<File>} files - Files from input element
     * @param {string} directory - Directory path (should start with /content/, e.g., "/content/uploads/")
     * @param {Object} options - Optional parameters
     * @param {Function} options.onFileProgress - Called for each file with (file, progress)
     * @param {Function} options.onComplete - Called after each file completes with (file, result)
     * @returns {Promise<Array<Object>>} Array of created file metadata
     */
    async uploadMultiple(files, directory = '/content/uploads/', options = {}) {
        const results = [];

        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            const result = await this.uploadFile(file, directory, {
                onProgress: (progress) => {
                    if (options.onFileProgress) {
                        options.onFileProgress(file, progress);
                    }
                },
                signal: options.signal
            });

            results.push(result);

            if (options.onComplete) {
                options.onComplete(file, result);
            }
        }

        return results;
    }

}

// Create and export singleton instance
const content = new KlivContent();
export {content, KlivContent};
export default content;
