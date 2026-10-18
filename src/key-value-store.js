// Values too big for localStorage (tracks, fetched data), kept in a single
// IndexedDB key-value store. Without IndexedDB (some private modes), every
// call rejects.
const databaseName = 'explorer-tiles-viewer';
const storeName = 'keyval';

let database;
const openDatabase = () => {
  database = database ?? new Promise((resolve, reject) => {
    const opening = indexedDB.open(databaseName, 1);
    opening.onupgradeneeded = () => opening.result.createObjectStore(storeName);
    opening.onsuccess = () => resolve(opening.result);
    opening.onerror = () => reject(opening.error);
  });
  return database;
};

const runInStore = async (mode, operation) => {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const request = operation(db.transaction(storeName, mode).objectStore(storeName));
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

export const getValue = key => runInStore('readonly', store => store.get(key));

export const setValue = (key, value) => runInStore('readwrite', store => store.put(value, key));

export const removeValue = key => runInStore('readwrite', store => store.delete(key));
