import { ArrowLeft } from 'lucide-react';
import { Creator, Video } from '../types/ethiohub';
import { formatCompactNumber } from '../utils/formatters';
import { MediaImage } from './MediaImage';
import { VideoCard } from './VideoCard';

interface CreatorChannelViewProps {
  creator: Creator;
  videos: Video[];
  isSubscribed: boolean;
  watchlistIds: string[];
  onBack: () => void;
  onToggleSubscribe: (creatorId: string) => void;
  onSelectVideo: (videoId: string) => void;
  onSelectCreator: (creatorId: string) => void;
  onToggleWatchlist: (videoId: string) => void;
  getResumeProgress: (videoId: string) => number;
}

export function CreatorChannelView({
  creator,
  videos,
  isSubscribed,
  watchlistIds,
  onBack,
  onToggleSubscribe,
  onSelectVideo,
  onSelectCreator,
  onToggleWatchlist,
  getResumeProgress,
}: CreatorChannelViewProps) {
  const totalViews = videos.reduce((acc, v) => acc + v.views, 0);

  return (
    <div className="max-w-[1440px] mx-auto px-4 sm:px-8 py-6">
      <button
        type="button"
        onClick={onBack}
        className="inline-flex items-center gap-2 text-sm text-zinc-400 hover:text-zinc-100 transition-colors mb-5"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Back to Creators</span>
      </button>

      {/* Channel Banner */}
      <div className="relative h-48 sm:h-64 rounded-2xl overflow-hidden border border-white/[0.07] bg-[#121216]">
        <MediaImage
          src={creator.bannerUrl}
          alt={`${creator.name} channel banner`}
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#09090B] via-[#09090B]/40 to-transparent" />
      </div>

      {/* Creator Identity Row */}
      <div className="mt-6 flex flex-col sm:flex-row sm:items-end justify-between gap-6 pb-8 border-b border-white/[0.07]">
        <div className="flex flex-col sm:flex-row sm:items-center gap-5">
          <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl overflow-hidden border border-white/15 bg-[#141418] shrink-0">
            <MediaImage
              src={creator.avatarUrl}
              alt={creator.name}
              className="w-full h-full object-cover"
            />
          </div>
          <div>
            <p className="text-xs font-medium text-[#E5A91A]">{creator.specialty}</p>
            <h1 className="mt-1 font-display text-3xl sm:text-4xl font-bold tracking-tight text-zinc-50">
              {creator.name}
            </h1>
            <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-zinc-400 tabular-nums">
              <span>{creator.handle}</span>
              <span aria-hidden="true">·</span>
              <span>{creator.region}</span>
              <span aria-hidden="true">·</span>
              <span>{formatCompactNumber(creator.subscribers)} subscribers</span>
              <span aria-hidden="true">·</span>
              <span>{formatCompactNumber(totalViews)} total views</span>
              <span aria-hidden="true">·</span>
              <span>Joined {creator.joinedYear}</span>
            </div>
            <p className="mt-3 text-sm text-zinc-300 leading-relaxed max-w-[68ch]">
              {creator.bio}
            </p>
            <p className="mt-2 text-xs text-zinc-500">
              Languages: {creator.languages.join(' · ')}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => onToggleSubscribe(creator.id)}
          className={`px-6 py-2.5 rounded-lg text-sm font-semibold transition-colors min-h-[44px] whitespace-nowrap shrink-0 self-start sm:self-center ${
            isSubscribed
              ? 'bg-[#18181E] text-zinc-100 border border-white/15 hover:bg-[#23232C]'
              : 'bg-[#E5A91A] text-zinc-950 hover:bg-[#F2B705]'
          }`}
        >
          {isSubscribed ? 'Subscribed' : 'Subscribe'}
        </button>
      </div>

      {/* Creator Videos */}
      <section className="mt-8">
        <div className="flex items-baseline justify-between mb-6">
          <h2 className="font-display text-2xl font-semibold text-zinc-100">
            Published Films & Sessions
          </h2>
          <span className="text-sm text-zinc-500 tabular-nums">
            {videos.length} {videos.length === 1 ? 'video' : 'videos'}
          </span>
        </div>

        {videos.length === 0 ? (
          <p className="text-sm text-zinc-400 py-12 text-center border border-dashed border-white/[0.08] rounded-xl">
            No videos published on this channel yet.
          </p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-9">
            {videos.map((v) => (
              <VideoCard
                key={v.id}
                video={v}
                creator={creator}
                isSaved={watchlistIds.includes(v.id)}
                resumeProgressSec={getResumeProgress(v.id)}
                onSelectVideo={onSelectVideo}
                onSelectCreator={onSelectCreator}
                onToggleWatchlist={onToggleWatchlist}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
