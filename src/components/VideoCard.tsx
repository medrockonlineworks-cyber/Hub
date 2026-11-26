import { Bookmark, Check, Play } from 'lucide-react';
import { Creator, Video } from '../types/ethiohub';
import { formatCompactNumber, formatDuration } from '../utils/formatters';
import { MediaImage } from './MediaImage';

interface VideoCardProps {
  video: Video;
  creator: Creator;
  isSaved: boolean;
  resumeProgressSec?: number;
  onSelectVideo: (videoId: string) => void;
  onSelectCreator: (creatorId: string) => void;
  onToggleWatchlist: (videoId: string) => void;
  compact?: boolean;
}

export function VideoCard({
  video,
  creator,
  isSaved,
  resumeProgressSec = 0,
  onSelectVideo,
  onSelectCreator,
  onToggleWatchlist,
  compact = false,
}: VideoCardProps) {
  const progressPct =
    resumeProgressSec > 5 && video.durationSec > 0
      ? Math.min(100, Math.round((resumeProgressSec / video.durationSec) * 100))
      : 0;

  if (compact) {
    return (
      <article className="group flex gap-3.5 items-start">
        <button
          type="button"
          onClick={() => onSelectVideo(video.id)}
          className="relative w-40 shrink-0 aspect-video rounded-xl overflow-hidden bg-[#141418] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E5A91A]"
        >
          <MediaImage
            src={video.thumbnailUrl}
            alt={video.title}
            fallbackTitle={video.title}
            className="w-full h-full object-cover transition-transform duration-200 ease-out group-hover:scale-[1.04]"
          />
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/25 transition-colors flex items-center justify-center">
            <span className="w-9 h-9 rounded-full bg-black/75 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
              <Play className="w-4 h-4 fill-current ml-0.5" />
            </span>
          </div>
          <span className="absolute bottom-1.5 right-1.5 px-1.5 py-0.5 text-[11px] font-mono tabular-nums bg-black/80 text-zinc-100 rounded">
            {formatDuration(video.durationSec)}
          </span>
          {progressPct > 0 && (
            <div className="absolute bottom-0 left-0 right-0 h-[3px] bg-white/20">
              <div className="h-full bg-[#E5A91A]" style={{ width: `${progressPct}%` }} />
            </div>
          )}
        </button>

        <div className="min-w-0 flex-1 py-0.5">
          <button
            type="button"
            onClick={() => onSelectVideo(video.id)}
            className="text-left block w-full focus-visible:outline-none focus-visible:text-[#E5A91A]"
          >
            <h4 className="text-sm font-semibold text-zinc-100 group-hover:text-[#E5A91A] transition-colors leading-snug line-clamp-2">
              {video.title}
            </h4>
          </button>
          <button
            type="button"
            onClick={() => onSelectCreator(creator.id)}
            className="mt-1.5 text-xs text-zinc-400 hover:text-zinc-200 transition-colors block truncate"
          >
            {creator.name}
          </button>
          <div className="mt-1 flex items-center gap-1.5 text-xs text-zinc-500 tabular-nums">
            <span>{formatCompactNumber(video.views)} views</span>
            <span aria-hidden="true">·</span>
            <span>{video.region}</span>
          </div>
        </div>
      </article>
    );
  }

  return (
    <article className="group flex flex-col">
      <div className="relative aspect-video rounded-xl overflow-hidden bg-[#141418] border border-white/[0.06]">
        <button
          type="button"
          onClick={() => onSelectVideo(video.id)}
          aria-label={`Play ${video.title}`}
          className="w-full h-full block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#E5A91A]"
        >
          <MediaImage
            src={video.thumbnailUrl}
            alt={video.title}
            fallbackTitle={video.title}
            className="w-full h-full object-cover transition-transform duration-200 ease-out group-hover:scale-[1.03]"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-transparent to-transparent opacity-80 group-hover:opacity-95 transition-opacity" />
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="w-12 h-12 rounded-full bg-black/70 border border-white/20 text-white flex items-center justify-center opacity-0 scale-95 group-hover:opacity-100 group-hover:scale-100 transition-all duration-150">
              <Play className="w-5 h-5 fill-current ml-0.5" />
            </span>
          </div>
        </button>

        {/* Save to watchlist button */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onToggleWatchlist(video.id);
          }}
          aria-label={isSaved ? 'Remove from watchlist' : 'Save to watchlist'}
          title={isSaved ? 'Saved in Watchlist' : 'Save to Watchlist'}
          className={`absolute top-2.5 right-2.5 w-9 h-9 rounded-lg flex items-center justify-center backdrop-blur-md transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E5A91A] ${
            isSaved
              ? 'bg-[#E5A91A] text-zinc-950 opacity-100'
              : 'bg-black/65 text-zinc-200 hover:bg-black/85 hover:text-white opacity-0 group-hover:opacity-100 focus-visible:opacity-100'
          }`}
        >
          {isSaved ? <Check className="w-4 h-4 stroke-[2.5]" /> : <Bookmark className="w-4 h-4" />}
        </button>

        {/* Bottom timecode */}
        <span className="pointer-events-none absolute bottom-2.5 right-2.5 px-2 py-0.5 text-xs font-mono tabular-nums bg-black/80 text-zinc-100 rounded">
          {formatDuration(video.durationSec)}
        </span>

        {/* Resume progress bar */}
        {progressPct > 0 && (
          <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-[3px] bg-white/20">
            <div className="h-full bg-[#E5A91A]" style={{ width: `${progressPct}%` }} />
          </div>
        )}
      </div>

      {/* Metadata strictly unboxed with typographic separators */}
      <div className="mt-3.5 flex gap-3 items-start">
        <button
          type="button"
          onClick={() => onSelectCreator(creator.id)}
          aria-label={`Visit ${creator.name}'s channel`}
          className="w-9 h-9 rounded-full overflow-hidden shrink-0 border border-white/10 bg-[#141418] mt-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E5A91A]"
        >
          <MediaImage
            src={creator.avatarUrl}
            alt={creator.name}
            className="w-full h-full object-cover"
          />
        </button>

        <div className="min-w-0 flex-1">
          <button
            type="button"
            onClick={() => onSelectVideo(video.id)}
            className="text-left block w-full focus-visible:outline-none"
          >
            <h3 className="text-[15px] font-semibold text-zinc-100 group-hover:text-[#E5A91A] transition-colors leading-snug line-clamp-2">
              {video.title}
            </h3>
          </button>

          <div className="mt-1.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[13px] text-zinc-400">
            <button
              type="button"
              onClick={() => onSelectCreator(creator.id)}
              className="hover:text-zinc-100 transition-colors truncate max-w-[160px]"
            >
              {creator.name}
            </button>
            <span aria-hidden="true" className="text-zinc-600">·</span>
            <span>{video.region}</span>
          </div>

          <div className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-xs text-zinc-500 tabular-nums">
            <span>{video.category}</span>
            <span aria-hidden="true">·</span>
            <span>{formatCompactNumber(video.views)} views</span>
            <span aria-hidden="true">·</span>
            <span>{video.publishedLabel}</span>
          </div>
        </div>
      </div>
    </article>
  );
}
