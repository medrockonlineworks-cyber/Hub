export type VideoCategory =
  | 'Music'
  | 'Culture'
  | 'Culinary'
  | 'Documentary'
  | 'Dance'
  | 'Street & Travel';

export type MusicSubgenre =
  | 'All'
  | 'Ethio-Jazz'
  | 'Tizita'
  | 'Azmari & Krar'
  | 'Eskista & Folk'
  | 'Modern Addis';

export type CultureTopic =
  | 'All'
  | 'Coffee Ceremony'
  | 'Heritage & Architecture'
  | 'Culinary Arts'
  | 'Craft & Markets'
  | 'Festivals & Ritual';

export type EthioRegion =
  | 'Addis Ababa'
  | 'Lalibela'
  | 'Gondar'
  | 'Harar'
  | 'Bahir Dar'
  | 'Hawassa'
  | 'Jimma';

export type QenetMode = 'tizita' | 'bati' | 'ambassel' | 'anchihoye';

export type AppSection = 'discover' | 'music' | 'culture' | 'creators' | 'library';

export type LibraryTab = 'watchlist' | 'liked' | 'history' | 'subscriptions' | 'uploads';

export interface Chapter {
  time: number; // seconds
  title: string;
}

export interface SubtitleCue {
  start: number;
  end: number;
  amharic: string;
  english: string;
}

export interface Creator {
  id: string;
  name: string;
  handle: string;
  region: EthioRegion;
  specialty: string;
  bio: string;
  avatarUrl: string;
  bannerUrl: string;
  subscribers: number;
  joinedYear: number;
  languages: string[];
}

export interface Video {
  id: string;
  title: string;
  subtitle?: string;
  description: string;
  creatorId: string;
  category: VideoCategory;
  subgenre?: string;
  region: EthioRegion;
  language: string;
  durationSec: number;
  views: number;
  likes: number;
  publishedLabel: string;
  publishedIso: string;
  thumbnailUrl: string;
  sceneImages: string[];
  qenetMode: QenetMode;
  featured?: boolean;
  chapters: Chapter[];
  subtitles: SubtitleCue[];
  videoUrl?: string; // Optional direct/local uploaded video URL
  isUserUpload?: boolean;
}

export interface CommentItem {
  id: string;
  videoId: string;
  authorName: string;
  authorHandle: string;
  body: string;
  createdAtLabel: string;
  likes: number;
  isMine?: boolean;
}

export interface WatchHistoryEntry {
  videoId: string;
  progressSec: number;
  watchedAt: number;
}

export interface UserLibraryState {
  likedVideoIds: string[];
  watchlistIds: string[];
  subscribedCreatorIds: string[];
  history: WatchHistoryEntry[];
  userVideos: Video[];
  commentsByVideo: Record<string, CommentItem[]>;
  likedCommentIds: string[];
  extraViewsByVideo: Record<string, number>;
  viewerName: string;
}
