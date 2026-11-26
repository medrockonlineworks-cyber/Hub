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
  repoConfig: GitHubRepoConfig;
  objectUrls: Record<string, string>;
  pathToId: Record<string, string>;
  videoUrlById: Record<string, string>;
  remoteImages: RemoteImageManifestItem[];
  remoteVideos: RemoteVideoManifestItem[];
  lastSyncedAt: number | null;
  isSyncing: boolean;
  isOfflineFallback: boolean;
}

type Listener = (snapshot: MediaManagerSnapshot) => void;

const AUTO_REFRESH_INTERVAL_MS = 5 * 60 * 1000;
const MIN_SYNC_GAP_MS = 10 * 1000;
const MAX_CACHED_VIDEO_BYTES = 85 * 1024 * 1024;

const IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.avif', '.gif', '.svg']);
const VIDEO_EXTENSIONS = new Set(['.mp4', '.webm', '.mov', '.m4v']);

const WORD_NUMBERS: Record<string, number> = {
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
  thirteen: 13,
  fourteen: 14,
  fifteen: 15,
  sixteen: 16,
  seventeen: 17,
  eighteen: 18,
  nineteen: 19,
  twenty: 20,
};

const NUMBER_WORDS = [
  '',
  'one',
  'two',
  'three',
  'four',
  'five',
  'six',
  'seven',
  'eight',
  'nine',
  'ten',
  'eleven',
  'twelve',
  'thirteen',
  'fourteen',
  'fifteen',
  'sixteen',
  'seventeen',
  'eighteen',
  'nineteen',
  'twenty',
];

export function formatNumberWord(n: number): string {
  if (n >= 1 && n < NUMBER_WORDS.length) return NUMBER_WORDS[n];
  return String(n);
}

export function extractMediaSequenceNumber(nameOrTitle: string): number {
  const clean = nameOrTitle.replace(/\.[^.]+$/, '').toLowerCase();
  const digitMatch = clean.match(/(?:^|[\s_-])(\d+)(?:$|[\s_-])/);
  if (digitMatch) return Number(digitMatch[1]);
  const tokens = clean.split(/[\s_-]+/);
  for (let i = tokens.length - 1; i >= 0; i--) {
    const val = WORD_NUMBERS[tokens[i]];
    if (val !== undefined) return val;
  }
  return Number.MAX_SAFE_INTEGER;
}

export function normalizeAssetId(filename: string): string {
  return filename
    .replace(/\.[^.]+$/, '')
    .replace(/_\d{10,}$/, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

export function toReadableTitle(filename: string): string {
  return filename
    .replace(/\.[^.]+$/, '')
    .replace(/_\d{10,}$/, '')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (ch) => ch.toUpperCase());
}

function getFileExtension(name: string): string {
  const idx = name.lastIndexOf('.');
  return idx >= 0 ? name.slice(idx).toLowerCase() : '';
}

function encodePathSegments(rawPath: string): string {
  return rawPath
    .replace(/^\/+/, '')
    .split('/')
    .map((segment) => encodeURIComponent(decodeURIComponentSafe(segment)))
    .join('/');
}

function decodeURIComponentSafe(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

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
  const encodedPath = encodePathSegments(repoRelativePath);
  const base = `https://raw.githubusercontent.com/${encodeURIComponent(config.owner)}/${encodeURIComponent(config.repo)}/${encodeURIComponent(config.branch)}/${encodedPath}`;
  if (!cacheBustVersion) return base;
  return `${base}?v=${encodeURIComponent(cacheBustVersion)}`;
}

export function buildLocalPublicUrl(repoRelativePath: string): string {
  const clean = repoRelativePath.replace(/^\/+/, '');
  const withoutPublic = clean.startsWith('public/') ? clean.slice('public/'.length) : clean;
  return `/${encodePathSegments(withoutPublic)}`;
}

function normalizeLookupKey(rawUrlOrPath: string): string {
  const withoutQuery = rawUrlOrPath.split('?')[0].trim();
  const segments = withoutQuery.split('/');
  const last = segments[segments.length - 1] || withoutQuery;
  return decodeURIComponentSafe(last);
}

interface GitHubContentsEntry {
  type: 'file' | 'dir';
  name: string;
  path: string;
  sha: string;
  size: number;
  download_url: string | null;
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
    repoConfig: { ...this.envConfig },
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

  public getUploadUrls(): { videosUrl: string | null; imagesUrl: string | null } {
    const { owner, repo, branch } = this.activeConfig;
    if (!owner || !repo) return { videosUrl: null, imagesUrl: null };
    const base = `https://github.com/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/upload/${encodeURIComponent(branch)}`;
    return {
      videosUrl: `${base}/public/remote-videos`,
      imagesUrl: `${base}/public/remote-images`,
    };
  }

  private emit() {
    const nextSnapshot: MediaManagerSnapshot = {
      ...this.snapshot,
      repoConfig: { ...this.activeConfig },
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
      // Safe startup fallback
    }

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
    const videos = Array.isArray(manifest.videos)
      ? [...manifest.videos].sort((a, b) => {
          const numA = extractMediaSequenceNumber(a.title || a.name);
          const numB = extractMediaSequenceNumber(b.title || b.name);
          if (numA !== numB) return numA - numB;
          return (a.title || a.name).localeCompare(b.title || b.name, undefined, {
            numeric: true,
            sensitivity: 'base',
          });
        })
      : [];

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

    this.snapshot.manifest = { ...manifest, images, videos };
    this.snapshot.remoteImages = images;
    this.snapshot.remoteVideos = videos;
    this.snapshot.pathToId = nextPathToId;
    this.snapshot.videoUrlById = nextVideoUrlById;
  }

  private async fetchManifestFromNetwork(): Promise<GitHubMediaManifest | null> {
    const cacheBuster = `${Date.now()}`;
    const candidateUrls: string[] = [];

    const ghManifestUrl = buildGitHubRawUrl(
      this.activeConfig,
      this.activeConfig.manifestPath,
      cacheBuster
    );
    if (ghManifestUrl) {
      candidateUrls.push(ghManifestUrl);
    }

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
        // Try next candidate
      }
    }

    return null;
  }

  /**
   * Direct GitHub folder discovery for public repos:
   * Automatically discovers newly uploaded images in public/remote-images/ and
   * videos in public/remote-videos/ (e.g. "full video one.mp4", "full video two.mp4")
   * immediately upon upload inside GitHub — even before manifest.json CI finishes.
   */
  private async discoverFromGitHubFolders(
    baseManifest: GitHubMediaManifest
  ): Promise<GitHubMediaManifest> {
    const { owner, repo, branch } = this.activeConfig;
    if (!owner || !repo) return baseManifest;

    const fetchFolder = async (folder: string): Promise<GitHubContentsEntry[]> => {
      try {
        const apiUrl = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${folder}?ref=${encodeURIComponent(branch)}`;
        const res = await fetch(apiUrl, {
          headers: { Accept: 'application/vnd.github+json' },
          cache: 'no-store',
        });
        if (!res.ok) return [];
        const data = (await res.json()) as unknown;
        return Array.isArray(data) ? (data as GitHubContentsEntry[]) : [];
      } catch {
        return [];
      }
    };

    const [ghImageFiles, ghVideoFiles] = await Promise.all([
      fetchFolder('public/remote-images'),
      fetchFolder('public/remote-videos'),
    ]);

    if (ghImageFiles.length === 0 && ghVideoFiles.length === 0) {
      return baseManifest;
    }

    const mergedImages = new Map<string, RemoteImageManifestItem>();
    for (const img of baseManifest.images) {
      mergedImages.set(img.name, img);
    }

    for (const entry of ghImageFiles) {
      if (entry.type !== 'file') continue;
      const ext = getFileExtension(entry.name);
      if (!IMAGE_EXTENSIONS.has(ext)) continue;

      const existing = mergedImages.get(entry.name);
      const id = existing?.id || normalizeAssetId(entry.name);
      mergedImages.set(entry.name, {
        id,
        name: entry.name,
        path: entry.path,
        version: existing ? `${existing.version}-${entry.sha.slice(0, 8)}` : entry.sha.slice(0, 10),
        updatedAt: existing?.updatedAt || baseManifest.updatedAt,
        label: existing?.label || toReadableTitle(entry.name),
      });
    }

    const imageList = Array.from(mergedImages.values());
    const imageIdLookup = new Map<string, RemoteImageManifestItem>();
    for (const img of imageList) {
      imageIdLookup.set(img.id, img);
    }

    const mergedVideos = new Map<string, RemoteVideoManifestItem>();
    for (const vid of baseManifest.videos) {
      mergedVideos.set(vid.name, vid);
    }

    for (const entry of ghVideoFiles) {
      if (entry.type !== 'file') continue;
      const ext = getFileExtension(entry.name);
      if (!VIDEO_EXTENSIONS.has(ext)) continue;

      const existing = mergedVideos.get(entry.name);
      const id = existing?.id || normalizeAssetId(entry.name);
      const matchedThumb = imageIdLookup.get(id);

      mergedVideos.set(entry.name, {
        ...existing,
        id,
        name: entry.name,
        path: entry.path,
        version: existing ? `${existing.version}-${entry.sha.slice(0, 8)}` : entry.sha.slice(0, 10),
        updatedAt: existing?.updatedAt || new Date().toISOString(),
        title: existing?.title || toReadableTitle(entry.name),
        thumbnailId: existing?.thumbnailId || matchedThumb?.id,
      });
    }

    return {
      ...baseManifest,
      images: imageList,
      videos: Array.from(mergedVideos.values()),
    };
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

        // Auto-discover any newly uploaded files directly from GitHub public folders
        effectiveManifest = await this.discoverFromGitHubFolders(effectiveManifest);
        this.applyManifestMetadata(effectiveManifest);

        await saveCachedManifest(effectiveManifest);
        this.snapshot.isOfflineFallback = false;
        this.snapshot.lastSyncedAt = Date.now();
        this.emit();

        await this.syncChangedItems('image', effectiveManifest.images);
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
          const cacheKey = makeCacheKey(kind, item.id);
          if (cached && !this.snapshot.objectUrls[cacheKey]) {
            const blobUrl = URL.createObjectURL(cached.blob);
            this.registerObjectUrl(kind, item.id, item.name, item.path, blobUrl);
            this.emit();
          }
          return;
        }

        await this.downloadAndCacheAsset(kind, item);
      } catch {
        // Safe per-item isolation; preserve existing cache if network fails
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

          const contentLength = Number(response.headers.get('content-length') || '0');
          if (kind === 'video' && contentLength > MAX_CACHED_VIDEO_BYTES) {
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
          // Try next fallback safely
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

  public resolveImageSrc(originalSrc: string): string {
    if (!originalSrc) return '';
    if (originalSrc.startsWith('blob:') || originalSrc.startsWith('data:')) {
      return originalSrc;
    }

    const filename = normalizeLookupKey(originalSrc);
    const matchedId =
      this.snapshot.pathToId[originalSrc] ||
      this.snapshot.pathToId[filename] ||
      this.snapshot.pathToId[normalizeAssetId(filename)];

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

    return (
      this.snapshot.objectUrls[originalSrc] ||
      this.snapshot.objectUrls[filename] ||
      originalSrc
    );
  }

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
