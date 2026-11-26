import {
  CachedMediaRecord,
  getAllCachedAssets,
  getCachedAsset,
  getCachedManifest,
  GitHubMediaManifest,
  isAssetUnchanged,
  makeCacheKey,
  MediaKind,
  RemoteImageManifestItem,
  RemoteVideoManifestItem,
  saveCachedAsset,
  saveCachedManifest,
} from './githubMediaCache';

export interface GitHubRepoConfig {
  owner: string;
  repo: string;
  branch: string;
  manifestPath: string;
}

export interface MediaManagerSnapshot {
  manifest: GitHubMediaManifest | null;
  objectUrls: Record<string, string>; // key: `${kind}:${id}` or normalized path/name -> blob URL
  pathToId: Record<string, string>; // maps remote-images/foo.jpg, /remote-images/foo.jpg, /src/assets/images/foo.jpg -> id
  videoUrlById: Record<string, string>; // video id -> blob URL or GitHub raw URL
  remoteImages: RemoteImageManifestItem[];
  remoteVideos: RemoteVideoManifestItem[];
  lastSyncedAt: number | null;
  isSyncing: boolean;
  isOfflineFallback: boolean;
}

type Listener = (snapshot: MediaManagerSnapshot) => void;

const AUTO_REFRESH_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
const MIN_SYNC_GAP_MS = 15 * 1000; // avoid redundant bursts on rapid focus switches
const MAX_CACHED_VIDEO_BYTES = 85 * 1024 * 1024; // 85MB safety ceiling per video blob

function readEnvRepoConfig(): GitHubRepoConfig {
  const env = import.meta.env as Record<string, string | undefined>;
  const owner = (env.VITE_GITHUB_OWNER || '').trim();
  const repo = (env.VITE_GITHUB_REPO || '').trim();
  const branch = (env.VITE_GITHUB_BRANCH || 'main').trim() || 'main';
  const manifestPath = (env.VITE_GITHUB_MANIFEST_PATH || 'public/manifest.json').trim();

  const isPlaceholder =
    !owner ||
    !repo ||
    owner === 'YOUR_GITHUB_USERNAME' ||
    repo === 'YOUR_GITHUB_REPO';

  return {
    owner: isPlaceholder ? '' : owner,
    repo: isPlaceholder ? '' : repo,
    branch,
    manifestPath: manifestPath.replace(/^\/+/, ''),
  };
}

export function buildGitHubRawUrl(
  config: GitHubRepoConfig,
  repoRelativePath: string,
  cacheBustVersion?: string
): string | null {
  if (!config.owner || !config.repo) return null;
  const cleanPath = repoRelativePath.replace(/^\/+/, '');
  const base = `https://raw.githubusercontent.com/${encodeURIComponent(config.owner)}/${encodeURIComponent(config.repo)}/${encodeURIComponent(config.branch)}/${cleanPath}`;
  if (!cacheBustVersion) return base;
  return `${base}?v=${encodeURIComponent(cacheBustVersion)}`;
}

export function buildLocalPublicUrl(repoRelativePath: string): string {
  const clean = repoRelativePath.replace(/^\/+/, '');
  if (clean.startsWith('public/')) {
    return `/${clean.slice('public/'.length)}`;
  }
  return `/${clean}`;
}

function normalizeLookupKey(rawUrlOrPath: string): string {
  const withoutQuery = rawUrlOrPath.split('?')[0].trim();
  // Extract filename for resilient matching across /src/assets/images/X and public/remote-images/X
  const segments = withoutQuery.split('/');
  return segments[segments.length - 1] || withoutQuery;
}

class GitHubMediaManager {
  private envConfig: GitHubRepoConfig = readEnvRepoConfig();
  private activeConfig: GitHubRepoConfig = { ...this.envConfig };
  private listeners = new Set<Listener>();
  private inFlightDownloads = new Map<string, Promise<string | null>>();
  private syncPromise: Promise<void> | null = null;
  private initialized = false;
  private refreshIntervalId: number | null = null;
  private lastAttemptAt = 0;

  private snapshot: MediaManagerSnapshot = {
    manifest: null,
    objectUrls: {},
    pathToId: {},
    videoUrlById: {},
    remoteImages: [],
    remoteVideos: [],
    lastSyncedAt: null,
    isSyncing: false,
    isOfflineFallback: false,
  };

  public subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    listener(this.snapshot);
    this.ensureInitialized();
    return () => {
      this.listeners.delete(listener);
    };
  }

  public getSnapshot(): MediaManagerSnapshot {
    return this.snapshot;
  }

  private emit() {
    const nextSnapshot: MediaManagerSnapshot = {
      ...this.snapshot,
      objectUrls: { ...this.snapshot.objectUrls },
      pathToId: { ...this.snapshot.pathToId },
      videoUrlById: { ...this.snapshot.videoUrlById },
    };
    this.snapshot = nextSnapshot;
    for (const listener of this.listeners) {
      listener(nextSnapshot);
    }
  }

  public ensureInitialized() {
    if (this.initialized) return;
    this.initialized = true;

    void this.bootstrapAndSync();

    if (typeof window !== 'undefined') {
      window.addEventListener('online', this.handleAutoRefreshTrigger);
      window.addEventListener('focus', this.handleAutoRefreshTrigger);
      document.addEventListener('visibilitychange', this.handleVisibilityChange);
      this.refreshIntervalId = window.setInterval(() => {
        if (document.visibilityState === 'visible') {
          void this.syncManifest(false);
        }
      }, AUTO_REFRESH_INTERVAL_MS);
    }
  }

  private handleVisibilityChange = () => {
    if (document.visibilityState === 'visible') {
      this.handleAutoRefreshTrigger();
    }
  };

  private handleAutoRefreshTrigger = () => {
    if (typeof navigator !== 'undefined' && navigator.onLine === false) return;
    if (Date.now() - this.lastAttemptAt < MIN_SYNC_GAP_MS) return;
    void this.syncManifest(false);
  };

  private async bootstrapAndSync(): Promise<void> {
    // 1. Hydrate immediately from IndexedDB so cached images & videos work offline instantaneously
    try {
      const [cachedManifest, cachedAssets] = await Promise.all([
        getCachedManifest(),
        getAllCachedAssets(),
      ]);

      if (cachedManifest) {
        this.applyManifestMetadata(cachedManifest);
      }
      if (cachedAssets.length > 0) {
        this.hydrateCachedBlobs(cachedAssets);
      }
      this.emit();
    } catch {
      // Continue safely to remote sync
    }

    // 2. Fetch fresh manifest from GitHub (or local public/manifest.json fallback)
    await this.syncManifest(true);
  }

  private hydrateCachedBlobs(records: CachedMediaRecord[]) {
    for (const record of records) {
      if (!record.blob || record.blob.size === 0) continue;
      const cacheKey = makeCacheKey(record.kind, record.id);
      if (!this.snapshot.objectUrls[cacheKey]) {
        const blobUrl = URL.createObjectURL(record.blob);
        this.registerObjectUrl(record.kind, record.id, record.name, record.path, blobUrl);
      }
    }
  }

  private registerObjectUrl(
    kind: MediaKind,
    id: string,
    name: string,
    path: string,
    blobUrl: string
  ) {
    const cacheKey = makeCacheKey(kind, id);
    const previousUrl = this.snapshot.objectUrls[cacheKey];
    if (previousUrl && previousUrl !== blobUrl && previousUrl.startsWith('blob:')) {
      // Delay revoking briefly so active DOM img/video tags smoothly swap to the new blob URL
      window.setTimeout(() => URL.revokeObjectURL(previousUrl), 4000);
    }

    this.snapshot.objectUrls[cacheKey] = blobUrl;
    this.snapshot.objectUrls[name] = blobUrl;
    this.snapshot.objectUrls[path] = blobUrl;
    this.snapshot.objectUrls[buildLocalPublicUrl(path)] = blobUrl;

    if (kind === 'video') {
      this.snapshot.videoUrlById[id] = blobUrl;
    }
  }

  private applyManifestMetadata(manifest: GitHubMediaManifest) {
    // Allow repository coordinates to be configured either via .env or manifest.json
    const repoOwner = this.envConfig.owner || manifest.repository?.owner?.trim() || '';
    const repoName = this.envConfig.repo || manifest.repository?.repo?.trim() || '';
    const repoBranch =
      (this.envConfig.owner ? this.envConfig.branch : manifest.repository?.branch?.trim()) ||
      'main';

    this.activeConfig = {
      owner: repoOwner,
      repo: repoName,
      branch: repoBranch,
      manifestPath: this.envConfig.manifestPath,
    };

    const images = Array.isArray(manifest.images) ? manifest.images : [];
    const videos = Array.isArray(manifest.videos) ? manifest.videos : [];

    const nextPathToId: Record<string, string> = {};
    for (const img of images) {
      nextPathToId[img.id] = img.id;
      nextPathToId[img.name] = img.id;
      nextPathToId[img.path] = img.id;
      nextPathToId[buildLocalPublicUrl(img.path)] = img.id;
    }

    const nextVideoUrlById: Record<string, string> = { ...this.snapshot.videoUrlById };
    for (const vid of videos) {
      const cacheKey = makeCacheKey('video', vid.id);
      if (this.snapshot.objectUrls[cacheKey]) {
        nextVideoUrlById[vid.id] = this.snapshot.objectUrls[cacheKey];
      } else {
        const rawUrl = buildGitHubRawUrl(this.activeConfig, vid.path, vid.version);
        nextVideoUrlById[vid.id] = rawUrl || buildLocalPublicUrl(vid.path);
      }
    }

    this.snapshot.manifest = manifest;
    this.snapshot.remoteImages = images;
    this.snapshot.remoteVideos = videos;
    this.snapshot.pathToId = nextPathToId;
    this.snapshot.videoUrlById = nextVideoUrlById;
  }

  private async fetchManifestFromNetwork(): Promise<GitHubMediaManifest | null> {
    const cacheBuster = `${Date.now()}`;
    const candidateUrls: string[] = [];

    // 1. Primary: GitHub raw content URL when configured
    const ghManifestUrl = buildGitHubRawUrl(
      this.activeConfig,
      this.activeConfig.manifestPath,
      cacheBuster
    );
    if (ghManifestUrl) {
      candidateUrls.push(ghManifestUrl);
    }

    // 2. Local bundled public/manifest.json (same-origin fallback)
    candidateUrls.push(`/manifest.json?t=${cacheBuster}`);

    for (const url of candidateUrls) {
      try {
        const res = await fetch(url, { cache: 'no-store' });
        if (!res.ok) continue;
        const parsed = (await res.json()) as Partial<GitHubMediaManifest>;
        if (!parsed || (!Array.isArray(parsed.images) && !Array.isArray(parsed.videos))) {
          continue;
        }
        return {
          schemaVersion: parsed.schemaVersion ?? 1,
          repository: parsed.repository,
          updatedAt: parsed.updatedAt ?? new Date().toISOString(),
          images: Array.isArray(parsed.images) ? parsed.images : [],
          videos: Array.isArray(parsed.videos) ? parsed.videos : [],
        };
      } catch {
        // Try next candidate safely
      }
    }

    return null;
  }

  public async syncManifest(force = false): Promise<void> {
    if (this.syncPromise) return this.syncPromise;
    if (!force && Date.now() - this.lastAttemptAt < MIN_SYNC_GAP_MS) return;

    this.lastAttemptAt = Date.now();
    this.snapshot.isSyncing = true;
    this.emit();

    this.syncPromise = (async () => {
      try {
        const remoteManifest = await this.fetchManifestFromNetwork();

        if (!remoteManifest) {
          this.snapshot.isOfflineFallback = true;
          this.snapshot.isSyncing = false;
          this.emit();
          return;
        }

        // If local manifest supplied GitHub repo coordinates we didn't have in .env, re-fetch directly from GitHub
        let effectiveManifest = remoteManifest;
        const hadRepo = Boolean(this.activeConfig.owner && this.activeConfig.repo);
        this.applyManifestMetadata(remoteManifest);
        const nowHasRepo = Boolean(this.activeConfig.owner && this.activeConfig.repo);

        if (!hadRepo && nowHasRepo) {
          const directGitHubUrl = buildGitHubRawUrl(
            this.activeConfig,
            this.activeConfig.manifestPath,
            `${Date.now()}`
          );
          if (directGitHubUrl) {
            try {
              const ghRes = await fetch(directGitHubUrl, { cache: 'no-store' });
              if (ghRes.ok) {
                const ghManifest = (await ghRes.json()) as GitHubMediaManifest;
                if (Array.isArray(ghManifest.images) || Array.isArray(ghManifest.videos)) {
                  effectiveManifest = {
                    schemaVersion: ghManifest.schemaVersion ?? 1,
                    repository: ghManifest.repository,
                    updatedAt: ghManifest.updatedAt ?? new Date().toISOString(),
                    images: Array.isArray(ghManifest.images) ? ghManifest.images : [],
                    videos: Array.isArray(ghManifest.videos) ? ghManifest.videos : [],
                  };
                  this.applyManifestMetadata(effectiveManifest);
                }
              }
            } catch {
              // Keep already-loaded manifest safely
            }
          }
        }

        await saveCachedManifest(effectiveManifest);
        this.snapshot.isOfflineFallback = false;
        this.snapshot.lastSyncedAt = Date.now();
        this.emit();

        // Sync ONLY new or updated images automatically (skip unchanged images!)
        await this.syncChangedItems('image', effectiveManifest.images);

        // Pre-cache new or updated videos selectively (skip unchanged videos!)
        void this.syncChangedItems('video', effectiveManifest.videos);
      } catch {
        this.snapshot.isOfflineFallback = true;
      } finally {
        this.snapshot.isSyncing = false;
        this.syncPromise = null;
        this.emit();
      }
    })();

    return this.syncPromise;
  }

  private async syncChangedItems(
    kind: MediaKind,
    items: Array<RemoteImageManifestItem | RemoteVideoManifestItem>
  ): Promise<void> {
    if (!items || items.length === 0) return;

    const tasks = items.map(async (item) => {
      try {
        const cached = await getCachedAsset(kind, item.id);
        if (isAssetUnchanged(cached, item)) {
          // Ensure blob URL is live in memory without any network request
          const cacheKey = makeCacheKey(kind, item.id);
          if (cached && !this.snapshot.objectUrls[cacheKey]) {
            const blobUrl = URL.createObjectURL(cached.blob);
            this.registerObjectUrl(kind, item.id, item.name, item.path, blobUrl);
            this.emit();
          }
          return;
        }

        // New or replaced asset detected -> download from GitHub Raw (fallback to local public path)
        await this.downloadAndCacheAsset(kind, item);
      } catch {
        // Safe per-item error isolation; preserve existing cached copy if present
      }
    });

    await Promise.allSettled(tasks);
  }

  private async downloadAndCacheAsset(
    kind: MediaKind,
    item: RemoteImageManifestItem | RemoteVideoManifestItem
  ): Promise<string | null> {
    const cacheKey = makeCacheKey(kind, item.id);
    const existingPromise = this.inFlightDownloads.get(cacheKey);
    if (existingPromise) return existingPromise;

    const task = (async () => {
      const candidateUrls: string[] = [];
      const ghRaw = buildGitHubRawUrl(
        this.activeConfig,
        item.path,
        `${item.version}-${item.updatedAt}`
      );
      if (ghRaw) candidateUrls.push(ghRaw);
      candidateUrls.push(buildLocalPublicUrl(item.path));

      for (const url of candidateUrls) {
        try {
          const response = await fetch(url, { cache: 'no-store' });
          if (!response.ok) continue;

          // Respect device storage safety limit for huge video files
          const contentLength = Number(response.headers.get('content-length') || '0');
          if (kind === 'video' && contentLength > MAX_CACHED_VIDEO_BYTES) {
            // Stream directly from GitHub raw URL without blowing device IndexedDB quota
            this.snapshot.videoUrlById[item.id] = url;
            this.emit();
            return url;
          }

          const blob = await response.blob();
          if (!blob || blob.size === 0) continue;

          if (kind === 'video' && blob.size > MAX_CACHED_VIDEO_BYTES) {
            this.snapshot.videoUrlById[item.id] = url;
            this.emit();
            return url;
          }

          const record: CachedMediaRecord = {
            key: cacheKey,
            id: item.id,
            kind,
            name: item.name,
            path: item.path,
            version: item.version,
            updatedAt: item.updatedAt,
            mimeType: item.mimeType || blob.type || (kind === 'video' ? 'video/mp4' : 'image/jpeg'),
            blob,
            cachedAt: Date.now(),
          };

          await saveCachedAsset(record);
          const blobUrl = URL.createObjectURL(blob);
          this.registerObjectUrl(kind, item.id, item.name, item.path, blobUrl);
          this.emit();
          return blobUrl;
        } catch {
          // Try next fallback URL safely
        }
      }
      return null;
    })();

    this.inFlightDownloads.set(cacheKey, task);
    try {
      return await task;
    } finally {
      this.inFlightDownloads.delete(cacheKey);
    }
  }

  /**
   * Resolves any image source (manifest id, remote path, or original bundled path)
   * Priority:
   * 1. Locally cached Blob URL from IndexedDB (offline-ready, auto-updated on version change)
   * 2. GitHub raw content URL (when repository is configured & image is in manifest)
   * 3. Original local path (preserves original uploaded/bundled images)
   */
  public resolveImageSrc(originalSrc: string): string {
    if (!originalSrc) return '';
    if (originalSrc.startsWith('blob:') || originalSrc.startsWith('data:')) {
      return originalSrc;
    }

    const filename = normalizeLookupKey(originalSrc);
    const matchedId =
      this.snapshot.pathToId[originalSrc] || this.snapshot.pathToId[filename];

    if (matchedId) {
      const cacheKey = makeCacheKey('image', matchedId);
      const cachedBlobUrl = this.snapshot.objectUrls[cacheKey];
      if (cachedBlobUrl) return cachedBlobUrl;

      const manifestItem = this.snapshot.remoteImages.find((img) => img.id === matchedId);
      if (manifestItem) {
        const ghRaw = buildGitHubRawUrl(
          this.activeConfig,
          manifestItem.path,
          manifestItem.version
        );
        if (ghRaw) return ghRaw;
        return buildLocalPublicUrl(manifestItem.path);
      }
    }

    return this.snapshot.objectUrls[originalSrc] || this.snapshot.objectUrls[filename] || originalSrc;
  }

  /**
   * Resolves a remote GitHub-hosted video stream by video ID or path.
   * Returns locally cached Blob URL when offline/cached, or GitHub Raw URL if available.
   */
  public resolveVideoSrc(videoId: string, existingUrl?: string): string | undefined {
    if (existingUrl && existingUrl.startsWith('blob:')) {
      return existingUrl;
    }

    const cacheKey = makeCacheKey('video', videoId);
    if (this.snapshot.objectUrls[cacheKey]) {
      return this.snapshot.objectUrls[cacheKey];
    }

    if (this.snapshot.videoUrlById[videoId]) {
      return this.snapshot.videoUrlById[videoId];
    }

    const manifestItem = this.snapshot.remoteVideos.find((v) => v.id === videoId);
    if (manifestItem) {
      const ghRaw = buildGitHubRawUrl(
        this.activeConfig,
        manifestItem.path,
        manifestItem.version
      );
      return ghRaw || buildLocalPublicUrl(manifestItem.path);
    }

    return existingUrl;
  }

  public dispose() {
    if (typeof window !== 'undefined') {
      window.removeEventListener('online', this.handleAutoRefreshTrigger);
      window.removeEventListener('focus', this.handleAutoRefreshTrigger);
      document.removeEventListener('visibilitychange', this.handleVisibilityChange);
      if (this.refreshIntervalId !== null) {
        window.clearInterval(this.refreshIntervalId);
        this.refreshIntervalId = null;
      }
    }
  }
}

export const githubMediaManager = new GitHubMediaManager();
