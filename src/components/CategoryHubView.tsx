import { useMemo, useState } from 'react';
import { Play } from 'lucide-react';
import { Creator, Video } from '../types/ethiohub';
import { formatCompactNumber, formatDuration } from '../utils/formatters';
import { MediaImage } from './MediaImage';
import { VideoCard } from './VideoCard';

interface CategoryHubViewProps {
  mode: 'music' | 'culture';
  videos: Video[];
  watchlistIds: string[];
  getCreatorById: (id: string) => Creator;
  getResumeProgress: (videoId: string) => number;
  onSelectVideo: (videoId: string) => void;
  onSelectCreator: (creatorId: string) => void;
  onToggleWatchlist: (videoId: string) => void;
}

const MUSIC_FILTERS = ['All', 'Ethio-Jazz', 'Azmari & Krar', 'Eskista & Folk', 'Modern Addis'];
const CULTURE_FILTERS = [
  'All',
  'Coffee Ceremony',
  'Heritage & Architecture',
  'Culinary Arts',
  'Craft & Markets',
];

export function CategoryHubView({
  mode,
  videos,
  watchlistIds,
  getCreatorById,
  getResumeProgress,
  onSelectVideo,
  onSelectCreator,
  onToggleWatchlist,
}: CategoryHubViewProps) {
  const [subFilter, setSubFilter] = useState('All');

  const isMusic = mode === 'music';
  const filters = isMusic ? MUSIC_FILTERS : CULTURE_FILTERS;

  const baseVideos = useMemo(() => {
    if (isMusic) {
      return videos.filter((v) => v.category === 'Music' || v.category === 'Dance');
    }
    return videos.filter(
      (v) =>
        v.category === 'Culture' ||
        v.category === 'Culinary' ||
        v.category === 'Documentary' ||
        v.category === 'Street & Travel'
    );
  }, [videos, isMusic]);

  const displayedVideos = useMemo(() => {
    if (subFilter === 'All') return baseVideos;
    return baseVideos.filter((v) => v.subgenre === subFilter);
  }, [baseVideos, subFilter]);

  const leadVideo = baseVideos[0];
  const leadCreator = leadVideo ? getCreatorById(leadVideo.creatorId) : null;

  return (
    <div className="max-w-[1440px] mx-auto px-4 sm:px-8 py-10">
      {/* Editorial Hub Banner */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch pb-10 border-b border-white/[0.07]">
        <div className="lg:col-span-6 flex flex-col justify-center">
          <p className="text-sm font-medium text-[#E5A91A]">
            {isMusic
              ? 'Ethio-Jazz · Tizita · Krar · Eskista'
              : 'Buna · Architecture · Culinary · Living Craft'}
          </p>
          <h1 className="mt-2 font-display text-3xl sm:text-5xl font-bold tracking-tight text-zinc-50 leading-tight [text-wrap:balance]">
            {isMusic
              ? 'The Soundscape of Modern & Traditional Ethiopia'
              : 'Living Ethiopian Heritage on Film'}
          </h1>
          <p className="mt-3.5 text-base text-zinc-400 leading-relaxed max-w-[60ch]">
            {isMusic
              ? 'Live acoustic krar recordings, Addis Ababa late-night jazz ensembles, and regional Eskista choreography presented with authentic pentatonic fidelity.'
              : 'Slow cinema and field documentaries exploring coffee rituals, ancient carved stone sanctuaries, heirloom spices, and historic Ethiopian cities.'}
          </p>

          {leadVideo && (
            <div className="mt-6">
              <button
                type="button"
                onClick={() => onSelectVideo(leadVideo.id)}
                className="inline-flex items-center gap-2.5 px-5 py-2.5 rounded-lg bg-[#E5A91A] hover:bg-[#F2B705] text-zinc-950 text-sm font-semibold transition-colors min-h-[44px]"
              >
                <Play className="w-4 h-4 fill-current" />
                <span>Play Spotlight Session</span>
              </button>
            </div>
          )}
        </div>

        {leadVideo && leadCreator && (
          <div className="lg:col-span-6">
            <button
              type="button"
              onClick={() => onSelectVideo(leadVideo.id)}
              className="group relative w-full h-full min-h-[260px] rounded-2xl overflow-hidden border border-white/[0.08] bg-[#121216] block text-left"
            >
              <MediaImage
                src={leadVideo.thumbnailUrl}
                alt={leadVideo.title}
                fallbackTitle={leadVideo.title}
                className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-transparent" />
              <div className="absolute bottom-5 left-5 right-5">
                <p className="text-xs text-[#E5A91A] font-medium">
                  Spotlight · {leadVideo.region} · {formatDuration(leadVideo.durationSec)}
                </p>
                <h2 className="mt-1 font-display text-xl font-semibold text-zinc-50 line-clamp-2">
                  {leadVideo.title}
                </h2>
                <p className="mt-1 text-xs text-zinc-300 tabular-nums">
                  {leadCreator.name} · {formatCompactNumber(leadVideo.views)} views
                </p>
              </div>
            </button>
          </div>
        )}
      </div>

      {/* Subgenre Segmented Filter */}
      <div className="mt-8 flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-1.5 p-1 bg-[#121216] border border-white/[0.06] rounded-xl">
          {filters.map((item) => {
            const active = subFilter === item;
            return (
              <button
                key={item}
                type="button"
                onClick={() => setSubFilter(item)}
                className={`px-3.5 py-2 text-xs font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 ${
                  active
                    ? 'bg-zinc-100 text-zinc-950 font-semibold'
                    : 'text-zinc-400 hover:text-zinc-100 hover:bg-white/[0.04]'
                }`}
              >
                {item}
              </button>
            );
          })}
        </div>

        <span className="text-xs text-zinc-500 tabular-nums">
          {displayedVideos.length} {displayedVideos.length === 1 ? 'stream' : 'streams'}
        </span>
      </div>

      {/* Grid */}
      <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-10">
        {displayedVideos.map((video) => (
          <VideoCard
            key={video.id}
            video={video}
            creator={getCreatorById(video.creatorId)}
            isSaved={watchlistIds.includes(video.id)}
            resumeProgressSec={getResumeProgress(video.id)}
            onSelectVideo={onSelectVideo}
            onSelectCreator={onSelectCreator}
            onToggleWatchlist={onToggleWatchlist}
          />
        ))}
      </div>
    </div>
  );
}
