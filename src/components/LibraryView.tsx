import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { Creator, LibraryTab, Video, WatchHistoryEntry } from '../types/ethiohub';
import { formatCompactNumber, formatDuration } from '../utils/formatters';
import { MediaImage } from './MediaImage';
import { VideoCard } from './VideoCard';

interface LibraryViewProps {
  allVideos: Video[];
  allCreators: Creator[];
  watchlistIds: string[];
  likedVideoIds: string[];
  subscribedCreatorIds: string[];
  history: WatchHistoryEntry[];
  userVideos: Video[];
  getCreatorById: (id: string) => Creator;
  onSelectVideo: (videoId: string) => void;
  onSelectCreator: (creatorId: string) => void;
  onToggleWatchlist: (videoId: string) => void;
  onToggleSubscribe: (creatorId: string) => void;
  onClearHistory: () => void;
  onDeleteUserVideo: (videoId: string) => void;
  onOpenPublish: () => void;
  onNavigateDiscover: () => void;
  getResumeProgress: (videoId: string) => number;
}

const TABS: { id: LibraryTab; label: string }[] = [
  { id: 'watchlist', label: 'Watchlist' },
  { id: 'liked', label: 'Liked Videos' },
  { id: 'history', label: 'Watch History' },
  { id: 'subscriptions', label: 'Subscriptions' },
  { id: 'uploads', label: 'My Uploads' },
];

export function LibraryView({
  allVideos,
  allCreators,
  watchlistIds,
  likedVideoIds,
  subscribedCreatorIds,
  history,
  userVideos,
  getCreatorById,
  onSelectVideo,
  onSelectCreator,
  onToggleWatchlist,
  onToggleSubscribe,
  onClearHistory,
  onDeleteUserVideo,
  onOpenPublish,
  onNavigateDiscover,
  getResumeProgress,
}: LibraryViewProps) {
  const [activeTab, setActiveTab] = useState<LibraryTab>('watchlist');

  const watchlistVideos = watchlistIds
    .map((id) => allVideos.find((v) => v.id === id))
    .filter((v): v is Video => Boolean(v));

  const likedVideos = likedVideoIds
    .map((id) => allVideos.find((v) => v.id === id))
    .filter((v): v is Video => Boolean(v));

  const historyItems = history
    .map((entry) => {
      const video = allVideos.find((v) => v.id === entry.videoId);
      return video ? { video, entry } : null;
    })
    .filter((x): x is { video: Video; entry: WatchHistoryEntry } => Boolean(x));

  const subscribedCreators = subscribedCreatorIds
    .map((id) => allCreators.find((c) => c.id === id))
    .filter((c): c is Creator => Boolean(c));

  const myUploadedVideos = userVideos
    .map((uv) => allVideos.find((v) => v.id === uv.id) || uv);

  return (
    <div className="max-w-[1440px] mx-auto px-4 sm:px-8 py-10">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <p className="text-sm text-[#E5A91A] font-medium">Personal Archive · Saved on Device</p>
          <h1 className="mt-1.5 font-display text-3xl sm:text-5xl font-bold tracking-tight text-zinc-50">
            Your Library
          </h1>
        </div>

        <div className="flex items-center gap-5 text-sm text-zinc-400 tabular-nums">
          <span>{watchlistVideos.length} saved</span>
          <span aria-hidden="true">·</span>
          <span>{subscribedCreators.length} subscriptions</span>
          <span aria-hidden="true">·</span>
          <span>{myUploadedVideos.length} uploads</span>
        </div>
      </div>

      {/* Segmented Tab Controls */}
      <div className="mt-8 flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-1.5 p-1 bg-[#121216] border border-white/[0.06] rounded-xl">
          {TABS.map((tab) => {
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-2 text-xs font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 ${
                  active
                    ? 'bg-zinc-100 text-zinc-950 font-semibold'
                    : 'text-zinc-400 hover:text-zinc-100 hover:bg-white/[0.04]'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        {activeTab === 'history' && historyItems.length > 0 && (
          <button
            type="button"
            onClick={onClearHistory}
            className="text-xs font-medium text-zinc-400 hover:text-red-400 transition-colors"
          >
            Clear Watch History
          </button>
        )}
      </div>

      {/* Tab Content */}
      <div className="mt-8">
        {activeTab === 'watchlist' && (
          watchlistVideos.length === 0 ? (
            <EmptyLibraryState
              title="Your watchlist is empty"
              description="Bookmark music sessions, cultural films, and documentaries to return to them anytime."
              actionLabel="Browse Discover"
              onAction={onNavigateDiscover}
            />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-9">
              {watchlistVideos.map((v) => (
                <VideoCard
                  key={v.id}
                  video={v}
                  creator={getCreatorById(v.creatorId)}
                  isSaved={true}
                  resumeProgressSec={getResumeProgress(v.id)}
                  onSelectVideo={onSelectVideo}
                  onSelectCreator={onSelectCreator}
                  onToggleWatchlist={onToggleWatchlist}
                />
              ))}
            </div>
          )
        )}

        {activeTab === 'liked' && (
          likedVideos.length === 0 ? (
            <EmptyLibraryState
              title="No liked videos yet"
              description="Tap the like button while watching any EthioHub session to collect your favorites here."
              actionLabel="Explore Videos"
              onAction={onNavigateDiscover}
            />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-9">
              {likedVideos.map((v) => (
                <VideoCard
                  key={v.id}
                  video={v}
                  creator={getCreatorById(v.creatorId)}
                  isSaved={watchlistIds.includes(v.id)}
                  resumeProgressSec={getResumeProgress(v.id)}
                  onSelectVideo={onSelectVideo}
                  onSelectCreator={onSelectCreator}
                  onToggleWatchlist={onToggleWatchlist}
                />
              ))}
            </div>
          )
        )}

        {activeTab === 'history' && (
          historyItems.length === 0 ? (
            <EmptyLibraryState
              title="No watch history yet"
              description="Films and music sessions you watch will appear here with your saved playback position."
              actionLabel="Start Watching"
              onAction={onNavigateDiscover}
            />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-9">
              {historyItems.map(({ video, entry }) => (
                <div key={video.id}>
                  <VideoCard
                    video={video}
                    creator={getCreatorById(video.creatorId)}
                    isSaved={watchlistIds.includes(video.id)}
                    resumeProgressSec={entry.progressSec}
                    onSelectVideo={onSelectVideo}
                    onSelectCreator={onSelectCreator}
                    onToggleWatchlist={onToggleWatchlist}
                  />
                  {entry.progressSec > 5 && (
                    <p className="mt-2 ml-12 text-xs text-[#E5A91A] font-mono tabular-nums">
                      Resume at {formatDuration(entry.progressSec)}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )
        )}

        {activeTab === 'subscriptions' && (
          subscribedCreators.length === 0 ? (
            <EmptyLibraryState
              title="No channel subscriptions yet"
              description="Subscribe to Ethiopian creators to keep their latest films and recordings close."
              actionLabel="Discover Creators"
              onAction={onNavigateDiscover}
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {subscribedCreators.map((c) => (
                <div
                  key={c.id}
                  className="bg-[#121216] border border-white/[0.07] rounded-2xl p-5 flex items-center justify-between gap-4"
                >
                  <button
                    type="button"
                    onClick={() => onSelectCreator(c.id)}
                    className="flex items-center gap-3.5 min-w-0 text-left"
                  >
                    <div className="w-14 h-14 rounded-xl overflow-hidden border border-white/10 shrink-0">
                      <MediaImage
                        src={c.avatarUrl}
                        alt={c.name}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-semibold text-zinc-100 hover:text-[#E5A91A] transition-colors truncate">
                        {c.name}
                      </h3>
                      <p className="text-xs text-zinc-400 truncate mt-0.5">
                        {c.region} · {formatCompactNumber(c.subscribers)} subscribers
                      </p>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => onToggleSubscribe(c.id)}
                    className="px-3.5 py-2 text-xs font-medium text-zinc-300 bg-[#1B1B22] border border-white/10 rounded-lg hover:bg-[#25252F] transition-colors whitespace-nowrap shrink-0"
                  >
                    Subscribed
                  </button>
                </div>
              ))}
            </div>
          )
        )}

        {activeTab === 'uploads' && (
          myUploadedVideos.length === 0 ? (
            <EmptyLibraryState
              title="You haven’t published a video yet"
              description="Share a music performance, cultural documentary, or local story from anywhere in Ethiopia."
              actionLabel="Publish Video"
              onAction={onOpenPublish}
            />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-9">
              {myUploadedVideos.map((v) => (
                <div key={v.id} className="flex flex-col">
                  <VideoCard
                    video={v}
                    creator={getCreatorById(v.creatorId)}
                    isSaved={watchlistIds.includes(v.id)}
                    resumeProgressSec={getResumeProgress(v.id)}
                    onSelectVideo={onSelectVideo}
                    onSelectCreator={onSelectCreator}
                    onToggleWatchlist={onToggleWatchlist}
                  />
                  <div className="mt-2.5 ml-12">
                    <button
                      type="button"
                      onClick={() => onDeleteUserVideo(v.id)}
                      className="inline-flex items-center gap-1.5 text-xs text-zinc-500 hover:text-red-400 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Remove Upload</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )
        )}
      </div>
    </div>
  );
}

function EmptyLibraryState({
  title,
  description,
  actionLabel,
  onAction,
}: {
  title: string;
  description: string;
  actionLabel: string;
  onAction: () => void;
}) {
  return (
    <div className="border border-dashed border-white/[0.1] rounded-2xl px-6 py-16 text-center max-w-xl mx-auto">
      <h2 className="font-display text-xl font-semibold text-zinc-100">{title}</h2>
      <p className="mt-2 text-sm text-zinc-400 leading-relaxed">{description}</p>
      <button
        type="button"
        onClick={onAction}
        className="mt-6 px-5 py-2.5 text-sm font-semibold rounded-lg bg-[#E5A91A] text-zinc-950 hover:bg-[#F2B705] transition-colors"
      >
        {actionLabel}
      </button>
    </div>
  );
}
