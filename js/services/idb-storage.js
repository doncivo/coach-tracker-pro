/* ================================================================
   services/idb-storage.js — IndexedDB storage pour Coach Tracker Pro

   Stratégie hybride :
   - localStorage : écriture synchrone immédiate (cache rapide, 5MB)
   - IndexedDB    : stockage principal large (jusqu'à 50% espace libre)

   Au chargement : IndexedDB en priorité, fallback localStorage
   À la sauvegarde : localStorage immédiat + IndexedDB async en parallèle

   Sur PWA installée iOS : stockage persistant automatique (pas d'effacement 7j)
   ================================================================ */

const IDBStorage = (() => {

  const DB_NAME    = 'ctp-db';
  const DB_VERSION = 1;
  const STORE_NAME = 'state';
  const KEY        = 'ctp_v3';

  let _db = null;
  let _ready = false;
  let _initPromise = null;

  /* ── Ouvrir/créer la base ── */
  function _open() {
    if (_initPromise) return _initPromise;
    _initPromise = new Promise((resolve, reject) => {
      if (!window.indexedDB) { reject(new Error('IndexedDB non supporté')); return; }

      const req = indexedDB.open(DB_NAME, DB_VERSION);

      req.onupgradeneeded = e => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME);
        }
      };

      req.onsuccess = e => {
        _db = e.target.result;
        _ready = true;
        resolve(_db);
      };

      req.onerror = () => reject(req.error);
      req.onblocked = () => reject(new Error('IndexedDB bloqué'));
    });
    return _initPromise;
  }

  /* ── Écrire ── */
  async function set(value) {
    try {
      const db = await _open();
      return new Promise((resolve, reject) => {
        const tx   = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const req   = store.put(value, KEY);
        req.onsuccess = () => resolve(true);
        req.onerror   = () => reject(req.error);
      });
    } catch(e) {
      console.warn('[IDB] set() failed:', e.message);
      return false;
    }
  }

  /* ── Lire ── */
  async function get() {
    try {
      const db = await _open();
      return new Promise((resolve, reject) => {
        const tx    = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const req   = store.get(KEY);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror   = () => reject(req.error);
      });
    } catch(e) {
      console.warn('[IDB] get() failed:', e.message);
      return null;
    }
  }

  /* ── Supprimer ── */
  async function clear() {
    try {
      const db = await _open();
      return new Promise((resolve) => {
        const tx    = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        store.delete(KEY);
        tx.oncomplete = () => resolve(true);
        tx.onerror    = () => resolve(false);
      });
    } catch(e) { return false; }
  }

  /* ── Estimer l'espace utilisé ── */
  async function estimate() {
    try {
      if (!navigator.storage?.estimate) return null;
      const est = await navigator.storage.estimate();
      return {
        used:  Math.round((est.usage  || 0) / 1024 / 1024 * 10) / 10, // MB
        quota: Math.round((est.quota  || 0) / 1024 / 1024 * 10) / 10, // MB
        pct:   est.quota > 0 ? Math.round(est.usage / est.quota * 100) : 0,
      };
    } catch(e) { return null; }
  }

  /* ── Demander le stockage persistant ── */
  async function requestPersistent() {
    try {
      if (!navigator.storage?.persist) return false;
      const granted = await navigator.storage.persist();
      return granted;
    } catch(e) { return false; }
  }

  async function isPersistent() {
    try {
      if (!navigator.storage?.persisted) return false;
      return await navigator.storage.persisted();
    } catch(e) { return false; }
  }

  return { set, get, clear, estimate, requestPersistent, isPersistent };

})();

window.IDBStorage = IDBStorage;
