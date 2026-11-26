import { useMemo, useState } from 'react';
import { Creator, EthioRegion, Video } from '../types/ethiohub';
import { formatCompactNumber } from '../utils/formatters';
import { MediaImage } from './MediaImage';

interface CreatorDirectoryProps {
  creators: Creator[];
  videos: Video[];
  subscribedCreatorIds: string[];
  onSelectCreator: (creatorId: string) => void;
  onToggleSubscribe: (creatorId: string) => void;
}

const REGION_FILTERS: ('All' | EthioRegion)[] = [
  'All',
  'Addis Ababa',
  'Gondar',
  'Jimma',
  'Lalibela',
  'Harar',
  'Hawassa',
];

export function CreatorDirectory({
  creators,
  videos,
  subscribedCreatorIds,
  onSelectCreator,
  onToggleSubscribe,
}: CreatorDirectoryProps) {
  const [selectedRegion, setSelectedRegion] = useState<'All' | EthioRegion>('All');

  const filteredCreators = useMemo(() => {
    if (selectedRegion === 'All') return creators;
    return creators.filter((c) => c.region === selectedRegion);
  }, [creators, selectedRegion]);

  return (
    <div className="max-w-[1440px] mx-auto px-4 sm:px-8 py-10">
      <div className="max-w-3xl">
        <p className="text-sm text-[#E5A91A] font-medium">
          Ethiopian Storytellers · Musicians · Cultural Archivists
        </p>
        <h1 className="mt-2 font-display text-3xl sm:text-5xl font-bold tracking-tight text-zinc-50 [text-wrap:balance]">
          Local Voices Across Ethiopia
        </h1>
        <p className="mt-3 text-base text-zinc-400 leading-relaxed max-w-[65ch]">
          Discover independent filmmakers, krar virtuosos, choreographers, and culinary historians
          documenting living Ethiopian culture from Addis Ababa to Harar and the Northern Highlands.
        </p>
      </div>

      {/* Regional filter bar */}
      <div className="mt-8 flex flex-wrap items-center gap-1.5 p-1 bg-[#121216] border border-white/[0.06] rounded-xl w-fit">
        {REGION_FILTERS.map((region) => {
          const active = selectedRegion === region;
          return (
            <button
              key={region}
              type="button"
              onClick={() => setSelectedRegion(region)}
              className={`px-3.5 py-2 text-xs font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 ${
                active
                  ? 'bg-zinc-100 text-zinc-950 font-semibold'
                  : 'text-zinc-400 hover:text-zinc-100 hover:bg-white/[0.04]'
              }`}
            >
              {region}
            </button>
          );
        })}
      </div>

      {/* 3-in-a-row desktop creator showcase grid */}
      <div className="mt-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredCreators.map((creator) => {
          const videoCount = videos.filter((v) => v.creatorId === creator.id).length;
          const isSub = subscribedCreatorIds.includes(creator.id);

          return (
            <article
              key={creator.id}
              className="bg-[#121216] border border-white/[0.07] rounded-2xl p-6 flex flex-col justify-between hover:border-white/[0.15] transition-colors"
            >
              <div>
                <div className="flex items-start gap-4">
                  <button
                    type="button"
                    onClick={() => onSelectCreator(creator.id)}
                    className="w-24 h-24 rounded-xl overflow-hidden border border-white/10 shrink-0 bg-[#18181E] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E5A91A]"
                  >
                    <MediaImage
                      src={creator.avatarUrl}
                      alt={creator.name}
                      className="w-full h-full object-cover"
                    />
                  </button>

                  <div className="min-w-0 flex-1 pt-0.5">
                    <button
                      type="button"
                      onClick={() => onSelectCreator(creator.id)}
                      className="text-left block w-full"
                    >
                      <h2 className="font-display text-lg font-semibold text-zinc-50 hover:text-[#E5A91A] transition-colors truncate">
                        {creator.name}
                      </h2>
                    </button>
                    <p className="text-xs text-zinc-400 mt-0.5 truncate">
                      {creator.handle} · {creator.region}
                    </p>
                    <p className="text-xs text-[#E5A91A] mt-2 font-medium">
                      {creator.specialty}
                    </p>
                    <div className="mt-2 flex items-center gap-1.5 text-xs text-zinc-400 tabular-nums">
                      <span>{formatCompactNumber(creator.subscribers)} subscribers</span>
                      <span aria-hidden="true">·</span>
                      <span>
                        {videoCount} {videoCount === 1 ? 'film' : 'films'}
                      </span>
                    </div>
                  </div>
                </div>

                <p className="mt-4 text-sm text-zinc-400 leading-relaxed line-clamp-3">
                  {creator.bio}
                </p>
              </div>

              <div className="mt-6 pt-4 border-t border-white/[0.06] flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => onSelectCreator(creator.id)}
                  className="text-sm font-medium text-zinc-200 hover:text-[#E5A91A] transition-colors whitespace-nowrap"
                >
                  Open Channel
                </button>
                <button
                  type="button"
                  onClick={() => onToggleSubscribe(creator.id)}
                  className={`px-4 py-2 rounded-lg text-xs font-semibold transition-colors min-h-[38px] whitespace-nowrap shrink-0 ${
                    isSub
                      ? 'bg-[#1B1B22] text-zinc-200 border border-white/15 hover:bg-[#24242D]'
                      : 'bg-[#E5A91A] text-zinc-950 hover:bg-[#F2B705]'
                  }`}
                >
                  {isSub ? 'Subscribed' : 'Subscribe'}
                </button>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
