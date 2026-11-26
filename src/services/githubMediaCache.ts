export type MediaKind = 'image' | 'video';

export interface RemoteImageManifestItem {
  id: string;
  name: string;
  path: string;
  version: string;
  updatedAt: string;
  mimeType?: string;
  label?: string;
}

export interface RemoteVideoManifestItem {
  id: string;
  name: string;
  path: string;
  version: string;
  updatedAt: string;
  mimeType?: string;
  thumbnailId?: string;
  thumbnailPath?: string;
  title?: string;
  subtitle?: string;
  description?: string;
  creatorId?: string;
  category?: 'Music' | 'Culture' | 'Culinary' | 'Documentary' | 'Dance' | 'Street & Travel';
  subgenre?: string;
  region?: 'Addis Ababa' | 'Lalibela' | 'Gondar' | 'Harar' | 'Bahir Dar' | 'Hawassa' | 'Jimma';
  language?: string;
  durationSec?: number;
}

export interface GitHubMediaManifest {
  schemaVersion: number;
  repository?: {
    owner?: string;
    repo?: string;
    branch?: string;
  };
  updatedAt: string;
  images: RemoteImageManifestItem[];
  videos: RemoteVideoManifestItem[];
}

export interface CachedMediaRecord {
  key: string; // `${kind}:${id}`
  id: string;
  kind: MediaKind;
  name: string;
  path: string;
  version: string;
  updatedAt: string;
  mimeType: string;
  blob: Blob;
  cachedAt: number;
}

const DB_NAME = 'ethiohub_github_media_cache_v1';
const DB_VERSION = 1;
const STORE_MANIFEST = 'manifest';
const STORE_ASSETS = 'assets';
const MANIFEST_KEY = 'current_manifest';

function isIndexedDBAvailable(): boolean {
  return typeof window !== 'undefined' && 'indexedDB' in window;
}

function openMediaDB(): Promise<IDBDatabase | null> {
  if (!isIndexedDBAvailable()) return Promise.resolve(null);

  return new Promise((resolve) => {
    try {
      const request = window.indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE_MANIFEST)) {
          db.createObjectStore(STORE_MANIFEST);
        }
        if (!db.objectStoreNames.contains(STORE_ASSETS)) {
          db.createObjectStore(STORE_ASSETS, { keyPath: 'key' });
        }
      };

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

export function makeCacheKey(kind: MediaKind, id: string): string {
  return `${kind}:${id}`;
}

export async function getCachedManifest(): Promise<GitHubMediaManifest | null> {
  const db = await openMediaDB();
  if (!db) return null;

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_MANIFEST, 'readonly');
      const store = tx.objectStore(STORE_MANIFEST);
      const req = store.get(MANIFEST_KEY);
      req.onsuccess = () => resolve((req.result as GitHubMediaManifest | undefined) ?? null);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

export async function saveCachedManifest(manifest: GitHubMediaManifest): Promise<void> {
  const db = await openMediaDB();
  if (!db) return;

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_MANIFEST, 'readwrite');
      const store = tx.objectStore(STORE_MANIFEST);
      store.put(manifest, MANIFEST_KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}

export async function getCachedAsset(
  kind: MediaKind,
  id: string
): Promise<CachedMediaRecord | null> {
  const db = await openMediaDB();
  if (!db) return null;

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_ASSETS, 'readonly');
      const store = tx.objectStore(STORE_ASSETS);
      const req = store.get(makeCacheKey(kind, id));
      req.onsuccess = () => resolve((req.result as CachedMediaRecord | undefined) ?? null);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

export async function getAllCachedAssets(): Promise<CachedMediaRecord[]> {
  const db = await openMediaDB();
  if (!db) return [];

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_ASSETS, 'readonly');
      const store = tx.objectStore(STORE_ASSETS);
      const req = store.getAll();
      req.onsuccess = () => resolve((req.result as CachedMediaRecord[] | undefined) ?? []);
      req.onerror = () => resolve([]);
    } catch {
      resolve([]);
    }
  });
}

export async function saveCachedAsset(record: CachedMediaRecord): Promise<void> {
  const db = await openMediaDB();
  if (!db) return;

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_ASSETS, 'readwrite');
      const store = tx.objectStore(STORE_ASSETS);
      store.put(record);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}

export function isAssetUnchanged(
  cached: CachedMediaRecord | null | undefined,
  remote: { path: string; version: string; updatedAt: string }
): boolean {
  if (!cached || !cached.blob || cached.blob.size === 0) return false;
  return (
    cached.version === remote.version &&
    cached.updatedAt === remote.updatedAt &&
    cached.path === remote.path
  );
}
