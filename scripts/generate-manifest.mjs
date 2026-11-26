import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const PUBLIC_DIR = path.join(ROOT, 'public');
const REMOTE_IMAGES_DIR = path.join(PUBLIC_DIR, 'remote-images');
const REMOTE_VIDEOS_DIR = path.join(PUBLIC_DIR, 'remote-videos');
const MANIFEST_PATH = path.join(PUBLIC_DIR, 'manifest.json');

const IMAGE_MIME_BY_EXT = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
};

const VIDEO_MIME_BY_EXT = {
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.mov': 'video/quicktime',
  '.m4v': 'video/mp4',
};

function fileShortHash(filePath) {
  const buf = fs.readFileSync(filePath);
  return crypto.createHash('sha256').update(buf).digest('hex').slice(0, 12);
}

function toAssetId(filename) {
  return filename
    .replace(/\.[^.]+$/, '')
    .replace(/_\d{10,}$/, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function toReadableLabel(filename) {
  return filename
    .replace(/\.[^.]+$/, '')
    .replace(/_\d{10,}$/, '')
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (ch) => ch.toUpperCase());
}

function loadExistingManifest() {
  if (!fs.existsSync(MANIFEST_PATH)) {
    return {
      schemaVersion: 1,
      repository: { owner: '', repo: '', branch: 'main' },
      updatedAt: new Date().toISOString(),
      images: [],
      videos: [],
    };
  }
  try {
    return JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
  } catch {
    return {
      schemaVersion: 1,
      repository: { owner: '', repo: '', branch: 'main' },
      updatedAt: new Date().toISOString(),
      images: [],
      videos: [],
    };
  }
}

function bumpPatchVersion(version) {
  const parts = String(version || '1.0.0').split('.').map((n) => Number(n));
  if (parts.length === 3 && parts.every((n) => Number.isFinite(n))) {
    return `${parts[0]}.${parts[1]}.${parts[2] + 1}`;
  }
  return '1.0.1';
}

function scanDirectory(dirPath, mimeMap, repoPrefix, existingList, nowIso) {
  if (!fs.existsSync(dirPath)) return { list: existingList || [], changed: false };

  const existingByName = new Map();
  const existingByPath = new Map();
  for (const item of existingList || []) {
    if (item.name) existingByName.set(item.name, item);
    if (item.path) existingByPath.set(item.path, item);
  }

  const files = fs
    .readdirSync(dirPath)
    .filter((f) => {
      const ext = path.extname(f).toLowerCase();
      return Boolean(mimeMap[ext]);
    })
    .sort();

  let changed = false;
  const result = [];

  for (const filename of files) {
    const absPath = path.join(dirPath, filename);
    const relPath = `${repoPrefix}/${filename}`;
    const ext = path.extname(filename).toLowerCase();
    const hash = fileShortHash(absPath);
    const prev = existingByPath.get(relPath) || existingByName.get(filename);

    if (prev) {
      // Preserve unchanged entries verbatim so devices skip re-downloading unchanged files
      if (prev.sha256 === hash) {
        result.push(prev);
        continue;
      }

      // First hash backfill without forcing unnecessary version bump if already synced
      if (!prev.sha256) {
        changed = true;
        result.push({
          ...prev,
          path: relPath,
          mimeType: prev.mimeType || mimeMap[ext],
          sha256: hash,
        });
        continue;
      }

      // Content changed -> bump version & updatedAt automatically so devices refresh only this file
      changed = true;
      result.push({
        ...prev,
        name: filename,
        path: relPath,
        version: bumpPatchVersion(prev.version),
        updatedAt: nowIso,
        mimeType: mimeMap[ext],
        sha256: hash,
      });
    } else {
      // Newly uploaded image or video detected
      changed = true;
      result.push({
        id: toAssetId(filename),
        name: filename,
        path: relPath,
        version: '1.0.0',
        updatedAt: nowIso,
        mimeType: mimeMap[ext],
        label: toReadableLabel(filename),
        sha256: hash,
      });
    }
  }

  if ((existingList || []).length !== result.length) {
    changed = true;
  }

  return { list: result, changed };
}

const nowIso = new Date().toISOString();
const current = loadExistingManifest();

const repoOwner = process.env.GITHUB_REPOSITORY_OWNER || current.repository?.owner || '';
const fullRepo = process.env.GITHUB_REPOSITORY || '';
const repoName = fullRepo.includes('/')
  ? fullRepo.split('/')[1]
  : current.repository?.repo || '';
const repoBranch = process.env.GITHUB_REF_NAME || current.repository?.branch || 'main';

const imageScan = scanDirectory(
  REMOTE_IMAGES_DIR,
  IMAGE_MIME_BY_EXT,
  'public/remote-images',
  current.images,
  nowIso
);
const videoScan = scanDirectory(
  REMOTE_VIDEOS_DIR,
  VIDEO_MIME_BY_EXT,
  'public/remote-videos',
  current.videos,
  nowIso
);

const repoChanged =
  repoOwner !== (current.repository?.owner || '') ||
  repoName !== (current.repository?.repo || '') ||
  repoBranch !== (current.repository?.branch || 'main');

const nextManifest = {
  schemaVersion: 1,
  repository: {
    owner: repoOwner,
    repo: repoName,
    branch: repoBranch,
  },
  updatedAt: imageScan.changed || videoScan.changed ? nowIso : current.updatedAt || nowIso,
  images: imageScan.list,
  videos: videoScan.list,
};

if (imageScan.changed || videoScan.changed || repoChanged || !fs.existsSync(MANIFEST_PATH)) {
  fs.writeFileSync(MANIFEST_PATH, `${JSON.stringify(nextManifest, null, 2)}\n`, 'utf8');
  console.log(
    `Updated public/manifest.json (${nextManifest.images.length} images, ${nextManifest.videos.length} videos).`
  );
} else {
  console.log('public/manifest.json is already up to date.');
}
