import { useMemo, useState } from 'react';
import { Bookmark, Check, Play, Search, X } from 'lucide-react';
import { Creator, EthioRegion, Video, VideoCategory } from '../types/ethiohub';
import { formatCompactNumber, formatDuration } from '../utils/formatters';
import { MediaImage } from './MediaImage';
import { VideoCard } from './VideoCard';

interface DiscoverViewProps {
  videos: Video[];
  creators: Creator[];
  watchlistIds: string[];
  getCreatorById: (id: string) => Creator;
  getResumeProgress: (videoId: string) => number;
  onSelectVideo: (videoId: string) => void;
  onSelectCreator: (creatorId: string) => void;
  onToggleWatchlist: (videoId: string) => void;
  onOpenCreators: () => void;
}

const CATEGORY_TABS: ('All' | VideoCategory)[] = [
  'All',
  'Music',
  'Culture',
  'Culinary',
  'Documentary',
  'Dance',
  'Street & Travel',
];

const REGION_OPTIONS: ('All Regions' | EthioRegion)[] = [
  'All Regions',
  'Addis Ababa',
  'Lalibela',
  'Gondar',
  'Harar',
  'Jimma',
  'Bahir Dar',
  'Hawassa',
];

type SortOption = 'trending' | 'newest' | 'most-watched';

export function DiscoverView({
  videos,
  creators,
  watchlistIds,
  getCreatorById,
  getResumeProgress,
  onSelectVideo,
  onSelectCreator,
  onToggleWatchlist,
  onOpenCreators,
}: DiscoverViewProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<'All' | VideoCategory>('All');
  const [selectedRegion, setSelectedRegion] = useState<'All Regions' | EthioRegion>('All Regions');
  const [sortBy, setSortBy] = useState<SortOption>('trending');

  const featuredVideo = useMemo(
    () => videos.find((v) => v.featured) || videos[0],
    [videos]
  );
  const featuredCreator = getCreatorById(featuredVideo.creatorId);
  const featuredSaved = watchlistIds.includes(featuredVideo.id);

  const filteredVideos = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const list = videos.filter((v) => {
      if (selectedCategory !== 'All' && v.category !== selectedCategory) return false;
      if (selectedRegion !== 'All Regions' && v.region !== selectedRegion) return false;
      if (q) {
        const creator = getCreatorById(v.creatorId);
        const hay = `${v.title} ${v.description} ${v.region} ${v.category} ${v.language} ${creator.name}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });

    if (sortBy === 'newest') {
      return [...list].sort((a, b) => b.publishedIso.localeCompare(a.publishedIso));
    }
    if (sortBy === 'most-watched') {
      return [...list].sort((a, b) => b.views - a.views);
    }
    return list;
  }, [videos, searchQuery, selectedCategory, selectedRegion, sortBy, getCreatorById]);

  const totalStreams = useMemo(
    () => videos.reduce((sum, v) => sum + v.views, 0),
    [videos]
  );

  const isFiltered =
    searchQuery.trim().length > 0 ||
    selectedCategory !== 'All' ||
    selectedRegion !== 'All Regions';

  return (
    <div className="max-w-[1440px] mx-auto px-4 sm:px-8 pt-8 pb-20">
      {/* Split-Screen Featured Premiere Hero (items-stretch) */}
      <section
        aria-label="Featured Premiere"
        className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-stretch"
      >
        {/* Left Column: Typographic Hierarchy */}
        <div className="lg:col-span-5 flex flex-col justify-between py-1">
          <div>
            <p className="text-xs sm:text-[13px] font-medium text-[#E5A91A] tabular-nums">
              Featured Premiere · {featuredVideo.region} · {formatDuration(featuredVideo.durationSec)}
            </p>

            <h1 className="mt-3 font-display text-[clamp(2.1rem,3.6vw,3.35rem)] font-bold tracking-tight text-zinc-50 leading-[1.08] [text-wrap:balance]">
              {featuredVideo.title}
            </h1>

            <p className="mt-4 text-[15px] text-zinc-400 leading-relaxed max-w-[54ch]">
              {featuredVideo.description}
            </p>

            <div className="mt-5 flex items-center gap-3">
              <button
                type="button"
                onClick={() => onSelectCreator(featuredCreator.id)}
                className="w-10 h-10 rounded-full overflow-hidden border border-white/10 shrink-0"
              >
                <MediaImage
                  src={featuredCreator.avatarUrl}
                  alt={featuredCreator.name}
                  className="w-full h-full object-cover"
                />
              </button>
              <div className="min-w-0">
                <button
                  type="button"
                  onClick={() => onSelectCreator(featuredCreator.id)}
                  className="text-sm font-semibold text-zinc-100 hover:text-[#E5A91A] transition-colors block truncate"
                >
                  {featuredCreator.name}
                </button>
                <p className="text-xs text-zinc-500 tabular-nums">
                  {formatCompactNumber(featuredVideo.views)} views · {featuredVideo.language}
                </p>
              </div>
            </div>
          </div>

          <div className="mt-7 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => onSelectVideo(featuredVideo.id)}
              className="inline-flex items-center gap-2.5 px-6 py-3 rounded-lg bg-[#E5A91A] hover:bg-[#F2B705] text-zinc-950 text-sm font-semibold transition-colors min-h-[44px] whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E5A91A] focus-visible:ring-offset-2 focus-visible:ring-offset-[#09090B]"
            >
              <Play className="w-4 h-4 fill-current" />
              <span>Watch Premiere</span>
            </button>

            <button
              type="button"
              onClick={() => onToggleWatchlist(featuredVideo.id)}
              className={`inline-flex items-center gap-2 px-5 py-3 rounded-lg text-sm font-medium border transition-colors min-h-[44px] whitespace-nowrap shrink-0 ${
                featuredSaved
                  ? 'bg-zinc-100 text-zinc-950 border-zinc-100'
                  : 'bg-[#121216] text-zinc-200 border-white/[0.1] hover:bg-[#1B1B22]'
              }`}
            >
              {featuredSaved ? <Check className="w-4 h-4" /> : <Bookmark className="w-4 h-4" />}
              <span>{featuredSaved ? 'Saved to Watchlist' : 'Save to Watchlist'}</span>
            </button>
          </div>
        </div>

        {/* Right Column: Full-height Media Visual */}
        <div className="lg:col-span-7">
          <button
            type="button"
            onClick={() => onSelectVideo(featuredVideo.id)}
            aria-label={`Play featured premiere: ${featuredVideo.title}`}
            className="group relative w-full h-full min-h-[280px] sm:min-h-[380px] rounded-2xl overflow-hidden border border-white/[0.08] bg-[#121216] block text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E5A91A]"
          >
            <MediaImage
              src={featuredVideo.thumbnailUrl}
              alt={featuredVideo.title}
              fallbackTitle={featuredVideo.title}
              className="w-full h-full lg:h-full object-cover transition-transform duration-300 ease-out group-hover:scale-[1.03]"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-transparent" />

            <div className="absolute inset-0 flex items-center justify-center">
              <span className="w-16 h-16 rounded-full bg-[#E5A91A] text-zinc-950 flex items-center justify-center shadow-2xl transition-transform duration-200 group-hover:scale-105">
                <Play className="w-7 h-7 fill-current ml-1" />
              </span>
            </div>

            <div className="absolute bottom-5 left-5 right-5 flex items-end justify-between gap-4">
              <div>
                <p className="text-xs text-zinc-300">{featuredVideo.subtitle}</p>
                <p className="text-xs text-zinc-400 mt-1 tabular-nums">
                  {featuredVideo.chapters.length} chapters · Bilingual Amharic & English captions
                </p>
              </div>
              <span className="px-2.5 py-1 text-xs font-mono tabular-nums bg-black/80 text-zinc-100 rounded-md shrink-0">
                {formatDuration(featuredVideo.durationSec)}
              </span>
            </div>
          </button>
        </div>
      </section>

      {/* Full-Width 4-Column Editorial Proof Strip below Hero Split */}
      <section
        aria-label="Platform Highlights"
        className="mt-10 grid grid-cols-2 lg:grid-cols-4 gap-6 py-6 border-y border-white/[0.07]"
      >
        <div>
          <p className="font-mono text-2xl font-medium text-zinc-50 tabular-nums">
            {formatCompactNumber(totalStreams)}
          </p>
          <p className="mt-1 text-xs text-zinc-400">Streams Across Curated Catalog</p>
        </div>
        <div>
          <p className="font-mono text-2xl font-medium text-zinc-50 tabular-nums">
            {creators.length} Channels
          </p>
          <p className="mt-1 text-xs text-zinc-400">Independent Ethiopian Creators</p>
        </div>
        <div>
          <p className="font-mono text-2xl font-medium text-zinc-50 tabular-nums">
            7 Regions
          </p>
          <p className="mt-1 text-xs text-zinc-400">Addis to Lalibela, Harar & Hawassa</p>
        </div>
        <div>
          <p className="font-mono text-2xl font-medium text-zinc-50 tabular-nums">
            Amharic + EN
          </p>
          <p className="mt-1 text-xs text-zinc-400">Synced Bilingual Closed Captions</p>
        </div>
      </section>

      {/* Workspace Filter, Region & Search Toolbar */}
      <section className="mt-10" aria-label="Browse Ethiopian Videos">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          {/* Interactive Category Segmented Filter */}
          <div className="flex items-center gap-1 p-1 bg-[#121216] border border-white/[0.06] rounded-xl overflow-x-auto">
            {CATEGORY_TABS.map((cat) => {
              const active = selectedCategory === cat;
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-3.5 py-2 text-xs font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 ${
                    active
                      ? 'bg-zinc-100 text-zinc-950 font-semibold'
                      : 'text-zinc-400 hover:text-zinc-100 hover:bg-white/[0.04]'
                  }`}
                >
                  {cat}
                </button>
              );
            })}
          </div>

          {/* Search, Region & Sort Controls */}
          <div className="flex flex-wrap sm:flex-nowrap items-center gap-2.5">
            <div className="relative flex-1 sm:w-64">
              <Search className="w-4 h-4 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search films, music, cities..."
                aria-label="Search videos"
                className="w-full pl-10 pr-8 py-2 text-sm bg-[#121216] border border-white/[0.08] rounded-lg text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-[#E5A91A]"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  aria-label="Clear search"
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-200"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <select
              value={selectedRegion}
              onChange={(e) => setSelectedRegion(e.target.value as 'All Regions' | EthioRegion)}
              aria-label="Filter by region"
              className="px-3 py-2 text-xs font-medium bg-[#121216] border border-white/[0.08] rounded-lg text-zinc-200 focus:outline-none focus:border-[#E5A91A] min-h-[38px]"
            >
              {REGION_OPTIONS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>

            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortOption)}
              aria-label="Sort videos"
              className="px-3 py-2 text-xs font-medium bg-[#121216] border border-white/[0.08] rounded-lg text-zinc-200 focus:outline-none focus:border-[#E5A91A] min-h-[38px]"
            >
              <option value="trending">Trending</option>
              <option value="most-watched">Most Watched</option>
              <option value="newest">Newest</option>
            </select>
          </div>
        </div>

        {/* Section Heading */}
        <div className="mt-8 mb-6 flex items-baseline justify-between gap-4">
          <h2 className="font-display text-2xl font-semibold text-zinc-50">
            {isFiltered
              ? `Matching Streams (${filteredVideos.length})`
              : 'Now Streaming on EthioHub'}
          </h2>
          {isFiltered && (
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setSelectedCategory('All');
                setSelectedRegion('All Regions');
              }}
              className="text-xs font-medium text-[#E5A91A] hover:underline"
            >
              Reset Filters
            </button>
          )}
        </div>

        {/* Video Grid */}
        {filteredVideos.length === 0 ? (
          <div className="border border-dashed border-white/[0.1] rounded-2xl py-16 px-6 text-center">
            <h3 className="font-display text-lg font-semibold text-zinc-200">
              No videos match your filter
            </h3>
            <p className="mt-1.5 text-sm text-zinc-400">
              Try searching for Ethio-Jazz, Buna, Lalibela, Eskista, or Harar.
            </p>
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setSelectedCategory('All');
                setSelectedRegion('All Regions');
              }}
              className="mt-5 px-4 py-2 text-sm font-semibold rounded-lg bg-[#E5A91A] text-zinc-950 hover:bg-[#F2B705]"
            >
              Show All Videos
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-10">
            {filteredVideos.map((video) => (
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
        )}
      </section>

      {/* Spotlight: Local Ethiopian Creators */}
      <section className="mt-16 pt-12 border-t border-white/[0.07]" aria-label="Featured Creators">
        <div className="flex items-end justify-between gap-4 mb-6">
          <div>
            <p className="text-xs font-medium text-[#E5A91A]">Local Content Creators</p>
            <h2 className="mt-1 font-display text-2xl sm:text-3xl font-semibold text-zinc-50">
              Meet the Voices Behind the Camera
            </h2>
          </div>
          <button
            type="button"
            onClick={onOpenCreators}
            className="text-sm font-medium text-zinc-300 hover:text-[#E5A91A] transition-colors whitespace-nowrap shrink-0"
          >
            View All Creators
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {creators.slice(0, 3).map((creator) => (
            <button
              key={creator.id}
              type="button"
              onClick={() => onSelectCreator(creator.id)}
              className="group text-left bg-[#121216] border border-white/[0.07] hover:border-white/[0.16] rounded-2xl p-5 flex items-center gap-4 transition-colors"
            >
              <div className="w-20 h-20 rounded-xl overflow-hidden border border-white/10 shrink-0">
                <MediaImage
                  src={creator.avatarUrl}
                  alt={creator.name}
                  className="w-full h-full object-cover transition-transform duration-200 group-hover:scale-105"
                />
              </div>
              <div className="min-w-0">
                <h3 className="font-display text-base font-semibold text-zinc-100 group-hover:text-[#E5A91A] transition-colors truncate">
                  {creator.name}
                </h3>
                <p className="text-xs text-zinc-400 mt-0.5 truncate">{creator.specialty}</p>
                <p className="text-xs text-zinc-500 mt-2 tabular-nums">
                  {creator.region} · {formatCompactNumber(creator.subscribers)} subscribers
                </p>
              </div>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
