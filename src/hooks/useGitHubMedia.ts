import { useEffect, useState } from 'react';
import {
  githubMediaManager,
  MediaManagerSnapshot,
} from '../services/githubMediaManager';

export function useGitHubMedia(): MediaManagerSnapshot {
  const [snapshot, setSnapshot] = useState<MediaManagerSnapshot>(() =>
    githubMediaManager.getSnapshot()
  );

  useEffect(() => {
    return githubMediaManager.subscribe(setSnapshot);
  }, []);

  return snapshot;
}

export function useResolvedImageSrc(originalSrc: string): string {
  const snapshot = useGitHubMedia();
  // Referencing snapshot ensures re-render whenever a new/updated blob URL arrives
  void snapshot.objectUrls;
  void snapshot.lastSyncedAt;
  return githubMediaManager.resolveImageSrc(originalSrc);
}

export function useResolvedVideoSrc(
  videoId: string,
  fallbackUrl?: string
): string | undefined {
  const snapshot = useGitHubMedia();
  void snapshot.videoUrlById;
  void snapshot.objectUrls;
  void snapshot.lastSyncedAt;
  return githubMediaManager.resolveVideoSrc(videoId, fallbackUrl);
}
