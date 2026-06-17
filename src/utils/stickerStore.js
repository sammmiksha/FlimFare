// Simple, dependency-free IndexedDB manager for custom user stickers
const DB_NAME = 'AuraBoothDB';
const STORE_NAME = 'customStickers';
const DB_VERSION = 1;

const initDB = () => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    
    request.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
      }
    };
    
    request.onsuccess = (e) => {
      resolve(e.target.result);
    };
    
    request.onerror = (e) => {
      reject(e.target.error);
    };
  });
};

export const getCustomStickers = async () => {
  try {
    const db = await initDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.getAll();
      
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    console.error('Failed to get custom stickers from IndexedDB:', err);
    return [];
  }
};

export const addCustomSticker = async (dataUrl, name) => {
  try {
    const db = await initDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const sticker = { dataUrl, name, addedAt: Date.now() };
      const request = store.add(sticker);
      
      request.onsuccess = (e) => {
        resolve({ ...sticker, id: e.target.result });
      };
      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    console.error('Failed to add custom sticker to IndexedDB:', err);
    throw err;
  }
};

export const deleteCustomSticker = async (id) => {
  try {
    const db = await initDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.delete(id);
      
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    console.error('Failed to delete custom sticker from IndexedDB:', err);
    throw err;
  }
};
