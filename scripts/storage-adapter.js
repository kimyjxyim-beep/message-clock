/* Storage abstraction for Jinzhu's browser-local state. */
(function defineStorageAdapters() {
    "use strict";
    function StorageAdapter() {}
    StorageAdapter.prototype.get = function () { throw new Error("StorageAdapter.get must be implemented"); };
    StorageAdapter.prototype.set = function () { throw new Error("StorageAdapter.set must be implemented"); };

    function LocalStorageAdapter(prefix) {
        this.prefix = prefix || "";
        this.available = true;
    }
    LocalStorageAdapter.prototype = Object.create(StorageAdapter.prototype);
    LocalStorageAdapter.prototype.constructor = LocalStorageAdapter;
    LocalStorageAdapter.prototype.get = function (key, fallback) {
        try {
            var value = localStorage.getItem(this.prefix + key);
            return value === null ? fallback : JSON.parse(value);
        } catch (error) {
            this.available = false;
            return fallback;
        }
    };
    LocalStorageAdapter.prototype.set = function (key, value) {
        try {
            localStorage.setItem(this.prefix + key, JSON.stringify(value));
            return true;
        } catch (error) {
            this.available = false;
            return false;
        }
    };

    window.StorageAdapter = StorageAdapter;
    window.LocalStorageAdapter = LocalStorageAdapter;
})();
