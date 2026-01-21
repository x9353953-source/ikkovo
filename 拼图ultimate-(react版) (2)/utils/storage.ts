
const DB_NAME = 'PuzzleUltimateDB';
const STORE_NAME = 'images';
const DB_VERSION = 1;

export interface StoredImage {
    id: string;
    name: string;
    file: File;
    timestamp: number;
}

export const initDB = (): Promise<IDBDatabase> => {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);
        request.onupgradeneeded = (event) => {
            const db = (event.target as IDBOpenDBRequest).result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME, { keyPath: 'id' });
            }
        };
    });
};

export const saveImageToDB = async (item: StoredImage) => {
    try {
        const db = await initDB();
        const tx = db.transaction(STORE_NAME, 'readwrite');
        tx.objectStore(STORE_NAME).put(item);
        return new Promise<void>((resolve, reject) => {
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
        });
    } catch(e) { console.error('Save failed', e); }
};

export const saveImagesToDB = async (items: StoredImage[]) => {
    try {
        const db = await initDB();
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        items.forEach(item => store.put(item));
        return new Promise<void>((resolve, reject) => {
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
        });
    } catch(e) { console.error('Bulk save failed', e); }
};

export const deleteImageFromDB = async (id: string) => {
    try {
        const db = await initDB();
        const tx = db.transaction(STORE_NAME, 'readwrite');
        tx.objectStore(STORE_NAME).delete(id);
        return new Promise<void>((resolve, reject) => {
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
        });
    } catch(e) { console.error('Delete failed', e); }
};

export const clearImagesFromDB = async () => {
    try {
        const db = await initDB();
        const tx = db.transaction(STORE_NAME, 'readwrite');
        tx.objectStore(STORE_NAME).clear();
        return new Promise<void>((resolve, reject) => {
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
        });
    } catch(e) { console.error('Clear failed', e); }
};

export const getAllImagesFromDB = async (): Promise<StoredImage[]> => {
    try {
        const db = await initDB();
        return new Promise<StoredImage[]>((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, 'readonly');
            const store = tx.objectStore(STORE_NAME);
            const request = store.getAll();
            request.onsuccess = () => {
                const results = request.result as StoredImage[];
                // Sort by timestamp to preserve order
                results.sort((a, b) => a.timestamp - b.timestamp);
                resolve(results);
            };
            request.onerror = () => reject(request.error);
        });
    } catch (e) {
        console.error('Get all failed', e);
        return [];
    }
};
