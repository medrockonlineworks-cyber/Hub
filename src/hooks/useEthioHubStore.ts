import { useCallback, useEffect, useMemo, useState } from 'react';
import { ASSETS, CATALOG_VIDEOS, CREATORS, INITIAL_COMMENTS } from '../data/catalog';
import { githubMediaManager } from '../services/githubMediaManager';
import { CommentItem, Creator, UserLibraryState, Video } from '../types/ethiohub';
import { useGitHubMedia } from './useGitHubMedia';

const STORAGE_KEY = 'ethiohub_library_v1';

const DEFAULT_STATE: UserLibraryState = {
  likedVideoIds: ['vid-midnight-tizita'],
  watchlistIds: ['vid-buna-three-rounds', 'vid-lalibela-stone-light'],
  subscribedCreatorIds: ['creator-selam', 'creator-tigist'],
  history: [],
  userVideos: [],
  commentsByVideo: INITIAL_COMMENTS,
  likedCommentIds: [],
  extraViewsByVideo: {},
  viewerName: 'Amanuel',
};

function loadState(): UserLibraryState {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_STATE;
    const parsed = JSON.parse(raw) as Partial<UserLibraryState>;
    return {
      ...DEFAULT_STATE,
      ...parsed,
      commentsByVideo: {
        ...INITIAL_COMMENTS,
        ...(parsed.commentsByVideo || {}),
      },
    };
  } catch {
    return DEFAULT_STATE;
  }
}

export function useEthioHubStore() {
  const [state, setState] = useState<UserLibraryState>(loadState);
  const mediaSnapshot = useGitHubMedia();

  useEffect(() => {
    try {
      // Avoid persisting temporary blob URLs that expire across reloads
      const serializable: UserLibraryState = {
        ...state,
        userVideos: state.userVideos.map((v) =>
          v.videoUrl?.startsWith('blob:') ? { ...v, videoUrl: undefined } : v
        ),
      };
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(serializable));
    } catch {
      // Ignore storage quota errors gracefully
    }
  }, [state]);

  const allVideos: Video[] = useMemo(() => {
    const remoteVideosById = new Map(
      mediaSnapshot.remoteVideos.map((rv) => [rv.id, rv])
    );

    // 1. Attach any GitHub-hosted video streams to matching existing catalog videos
    const catalogWithRemote = CATALOG_VIDEOS.map((video) => {
      const remoteMatch = remoteVideosById.get(video.id);
      if (!remoteMatch) return video;
      const resolvedVideoUrl = githubMediaManager.resolveVideoSrc(video.id, video.videoUrl);
      const resolvedThumb = remoteMatch.thumbnailPath
        ? githubMediaManager.resolveImageSrc(remoteMatch.thumbnailPath)
        : remoteMatch.thumbnailId
          ? githubMediaManager.resolveImageSrc(remoteMatch.thumbnailId)
          : video.thumbnailUrl;
      return {
        ...video,
        title: remoteMatch.title || video.title,
        subtitle: remoteMatch.subtitle || video.subtitle,
        description: remoteMatch.description || video.description,
        durationSec: remoteMatch.durationSec || video.durationSec,
        thumbnailUrl: resolvedThumb || video.thumbnailUrl,
        videoUrl: resolvedVideoUrl,
      };
    });

    // 2. Automatically detect newly uploaded videos added in GitHub manifest.json
    const existingIds = new Set([
      ...CATALOG_VIDEOS.map((v) => v.id),
      ...state.userVideos.map((v) => v.id),
    ]);

    const newlyUploadedRemoteVideos: Video[] = mediaSnapshot.remoteVideos
      .filter((rv) => !existingIds.has(rv.id))
      .map((rv, index) => {
        // Match thumbnail by explicit thumbnailPath/thumbnailId, matching image id (e.g. "full video one.jpg"), or clean fallback
        const matchedImageById = mediaSnapshot.remoteImages.find((img) => img.id === rv.id);
        const fallbackCovers = [
          ASSETS.ethioJazz,
          ASSETS.coffeeCeremony,
          ASSETS.lalibelaDawn,
          ASSETS.eskistaDance,
          ASSETS.addisCulinary,
          ASSETS.hararJugol,
        ];
        const fallbackThumb = fallbackCovers[index % fallbackCovers.length];
        const thumbSource = rv.thumbnailPath
          ? rv.thumbnailPath
          : rv.thumbnailId
            ? rv.thumbnailId
            : matchedImageById
              ? matchedImageById.id
              : fallbackThumb;
        const resolvedThumb = githubMediaManager.resolveImageSrc(thumbSource) || fallbackThumb;
        const resolvedVideoUrl = githubMediaManager.resolveVideoSrc(rv.id);
        const cleanTitle =
          rv.title ||
          rv.name
            .replace(/\.[^.]+$/, '')
            .replace(/[_-]+/g, ' ')
            .replace(/\s+/g, ' ')
            .trim()
            .replace(/\b\w/g, (ch) => ch.toUpperCase());

        return {
          id: rv.id,
          title: cleanTitle,
          subtitle: rv.subtitle || 'EthioHub Full Video',
          description:
            rv.description ||
            `${cleanTitle} — streamed directly from the EthioHub GitHub repository and cached locally on your device for offline playback.`,
          creatorId: rv.creatorId || 'creator-selam',
          category: rv.category || 'Culture',
          subgenre: rv.subgenre || rv.category || 'Culture',
          region: rv.region || 'Addis Ababa',
          language: rv.language || 'Amharic · English CC',
          durationSec: rv.durationSec || 300,
          views: 1,
          likes: 0,
          publishedLabel: 'New',
          publishedIso: rv.updatedAt.slice(0, 10),
          thumbnailUrl: resolvedThumb,
          sceneImages: [resolvedThumb],
          qenetMode: 'tizita',
          chapters: [{ time: 0, title: cleanTitle }],
          subtitles: [],
          videoUrl: resolvedVideoUrl,
        };
      });

    const combined = [...newlyUploadedRemoteVideos, ...state.userVideos, ...catalogWithRemote];
    return combined.map((video) => {
      const extraViews = state.extraViewsByVideo[video.id] || 0;
      const isLiked = state.likedVideoIds.includes(video.id);
      const baseLiked = DEFAULT_STATE.likedVideoIds.includes(video.id);
      const likeDelta = isLiked === baseLiked ? 0 : isLiked ? 1 : -1;
      return {
        ...video,
        views: video.views + extraViews,
        likes: Math.max(0, video.likes + likeDelta),
      };
    });
  }, [
    state.userVideos,
    state.extraViewsByVideo,
    state.likedVideoIds,
    mediaSnapshot.remoteVideos,
    mediaSnapshot.videoUrlById,
    mediaSnapshot.objectUrls,
  ]);

  const allCreators: Creator[] = useMemo(() => {
    // Include dynamic creators for user-published videos if not in CREATORS
    const map = new Map<string, Creator>();
    for (const c of CREATORS) {
      const isSub = state.subscribedCreatorIds.includes(c.id);
      const baseSub = DEFAULT_STATE.subscribedCreatorIds.includes(c.id);
      const subDelta = isSub === baseSub ? 0 : isSub ? 1 : -1;
      map.set(c.id, { ...c, subscribers: Math.max(0, c.subscribers + subDelta) });
    }
    for (const uv of state.userVideos) {
      if (!map.has(uv.creatorId)) {
        const displayName = uv.subtitle?.replace(/^Channel:\s*/i, '') || state.viewerName || 'Local Creator';
        const handle = '@' + displayName.toLowerCase().replace(/[^a-z0-9]+/g, '');
        map.set(uv.creatorId, {
          id: uv.creatorId,
          name: displayName,
          handle,
          region: uv.region,
          specialty: uv.category,
          bio: 'Independent Ethiopian creator publishing original films and music on EthioHub.',
          avatarUrl: uv.thumbnailUrl,
          bannerUrl: uv.thumbnailUrl,
          subscribers: state.subscribedCreatorIds.includes(uv.creatorId) ? 1 : 0,
          joinedYear: 2026,
          languages: [uv.language],
        });
      }
    }
    return Array.from(map.values());
  }, [state.subscribedCreatorIds, state.userVideos, state.viewerName]);

  const getCreatorById = useCallback(
    (creatorId: string): Creator => {
      return (
        allCreators.find((c) => c.id === creatorId) ||
        allCreators[0]
      );
    },
    [allCreators]
  );

  const toggleLikeVideo = useCallback((videoId: string) => {
    setState((prev) => {
      const exists = prev.likedVideoIds.includes(videoId);
      return {
        ...prev,
        likedVideoIds: exists
          ? prev.likedVideoIds.filter((id) => id !== videoId)
          : [videoId, ...prev.likedVideoIds],
      };
    });
  }, []);

  const toggleWatchlist = useCallback((videoId: string) => {
    setState((prev) => {
      const exists = prev.watchlistIds.includes(videoId);
      return {
        ...prev,
        watchlistIds: exists
          ? prev.watchlistIds.filter((id) => id !== videoId)
          : [videoId, ...prev.watchlistIds],
      };
    });
  }, []);

  const toggleSubscribe = useCallback((creatorId: string) => {
    setState((prev) => {
      const exists = prev.subscribedCreatorIds.includes(creatorId);
      return {
        ...prev,
        subscribedCreatorIds: exists
          ? prev.subscribedCreatorIds.filter((id) => id !== creatorId)
          : [creatorId, ...prev.subscribedCreatorIds],
      };
    });
  }, []);

  const recordWatchProgress = useCallback((videoId: string, progressSec: number, incrementView = false) => {
    setState((prev) => {
      const filtered = prev.history.filter((h) => h.videoId !== videoId);
      const nextHistory = [
        { videoId, progressSec: Math.floor(progressSec), watchedAt: Date.now() },
        ...filtered,
      ].slice(0, 40);

      const nextViews = incrementView
        ? {
            ...prev.extraViewsByVideo,
            [videoId]: (prev.extraViewsByVideo[videoId] || 0) + 1,
          }
        : prev.extraViewsByVideo;

      return {
        ...prev,
        history: nextHistory,
        extraViewsByVideo: nextViews,
      };
    });
  }, []);

  const clearHistory = useCallback(() => {
    setState((prev) => ({ ...prev, history: [] }));
  }, []);

  const addComment = useCallback((videoId: string, authorName: string, body: string) => {
    const cleanName = authorName.trim() || 'EthioHub Viewer';
    const cleanBody = body.trim();
    if (!cleanBody) return;
    const handle = '@' + cleanName.toLowerCase().replace(/[^a-z0-9]+/g, '');
    const newComment: CommentItem = {
      id: `comment-${Date.now()}`,
      videoId,
      authorName: cleanName,
      authorHandle: handle,
      body: cleanBody,
      createdAtLabel: 'Just now',
      likes: 0,
      isMine: true,
    };
    setState((prev) => ({
      ...prev,
      viewerName: cleanName,
      commentsByVideo: {
        ...prev.commentsByVideo,
        [videoId]: [newComment, ...(prev.commentsByVideo[videoId] || [])],
      },
    }));
  }, []);

  const deleteComment = useCallback((videoId: string, commentId: string) => {
    setState((prev) => ({
      ...prev,
      commentsByVideo: {
        ...prev.commentsByVideo,
        [videoId]: (prev.commentsByVideo[videoId] || []).filter((c) => c.id !== commentId),
      },
    }));
  }, []);

  const toggleLikeComment = useCallback((videoId: string, commentId: string) => {
    setState((prev) => {
      const already = prev.likedCommentIds.includes(commentId);
      const nextLikedIds = already
        ? prev.likedCommentIds.filter((id) => id !== commentId)
        : [...prev.likedCommentIds, commentId];

      const list = prev.commentsByVideo[videoId] || [];
      const nextList = list.map((c) =>
        c.id === commentId ? { ...c, likes: Math.max(0, c.likes + (already ? -1 : 1)) } : c
      );

      return {
        ...prev,
        likedCommentIds: nextLikedIds,
        commentsByVideo: {
          ...prev.commentsByVideo,
          [videoId]: nextList,
        },
      };
    });
  }, []);

  const publishVideo = useCallback((video: Video) => {
    setState((prev) => ({
      ...prev,
      userVideos: [video, ...prev.userVideos],
    }));
  }, []);

  const deleteUserVideo = useCallback((videoId: string) => {
    setState((prev) => ({
      ...prev,
      userVideos: prev.userVideos.filter((v) => v.id !== videoId),
      watchlistIds: prev.watchlistIds.filter((id) => id !== videoId),
      likedVideoIds: prev.likedVideoIds.filter((id) => id !== videoId),
      history: prev.history.filter((h) => h.videoId !== videoId),
    }));
  }, []);

  const getResumeProgress = useCallback(
    (videoId: string): number => {
      return state.history.find((h) => h.videoId === videoId)?.progressSec || 0;
    },
    [state.history]
  );

  return {
    state,
    allVideos,
    allCreators,
    getCreatorById,
    toggleLikeVideo,
    toggleWatchlist,
    toggleSubscribe,
    recordWatchProgress,
    clearHistory,
    addComment,
    deleteComment,
    toggleLikeComment,
    publishVideo,
    deleteUserVideo,
    getResumeProgress,
  };
}
