import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  Bookmark,
  Check,
  ChevronDown,
  ChevronUp,
  Share2,
  ThumbsUp,
  Trash2,
} from 'lucide-react';
import { CommentItem, Creator, Video } from '../types/ethiohub';
import { formatCompactNumber, formatDuration } from '../utils/formatters';
import { CinemaPlayer } from './CinemaPlayer';
import { MediaImage } from './MediaImage';
import { VideoCard } from './VideoCard';

interface WatchViewProps {
  video: Video;
  creator: Creator;
  allVideos: Video[];
  getCreatorById: (id: string) => Creator;
  isLiked: boolean;
  isSaved: boolean;
  isSubscribed: boolean;
  initialProgressSec: number;
  comments: CommentItem[];
  likedCommentIds: string[];
  defaultViewerName: string;
  onBack: () => void;
  onSelectVideo: (videoId: string) => void;
  onSelectCreator: (creatorId: string) => void;
  onToggleLike: (videoId: string) => void;
  onToggleWatchlist: (videoId: string) => void;
  onToggleSubscribe: (creatorId: string) => void;
  onRecordProgress: (videoId: string, sec: number, incrementView?: boolean) => void;
  onAddComment: (videoId: string, authorName: string, body: string) => void;
  onDeleteComment: (videoId: string, commentId: string) => void;
  onToggleLikeComment: (videoId: string, commentId: string) => void;
  getResumeProgress: (videoId: string) => number;
  watchlistIds: string[];
}

export function WatchView({
  video,
  creator,
  allVideos,
  getCreatorById,
  isLiked,
  isSaved,
  isSubscribed,
  initialProgressSec,
  comments,
  likedCommentIds,
  defaultViewerName,
  onBack,
  onSelectVideo,
  onSelectCreator,
  onToggleLike,
  onToggleWatchlist,
  onToggleSubscribe,
  onRecordProgress,
  onAddComment,
  onDeleteComment,
  onToggleLikeComment,
  getResumeProgress,
  watchlistIds,
}: WatchViewProps) {
  const [theaterMode, setTheaterMode] = useState(false);
  const [autoplayNext, setAutoplayNext] = useState(true);
  const [showFullDesc, setShowFullDesc] = useState(true);
  const [seekRequest, setSeekRequest] = useState<{ time: number; seq: number } | null>(null);
  const [copiedShare, setCopiedShare] = useState(false);

  const [commentAuthor, setCommentAuthor] = useState(defaultViewerName);
  const [commentBody, setCommentBody] = useState('');

  // Count a view once when opening a video
  useEffect(() => {
    onRecordProgress(video.id, initialProgressSec, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [video.id]);

  const upNextVideos = useMemo(() => {
    const others = allVideos.filter((v) => v.id !== video.id);
    // Prioritize same category or same region first
    return [...others].sort((a, b) => {
      const scoreA =
        (a.category === video.category ? 2 : 0) + (a.region === video.region ? 1 : 0);
      const scoreB =
        (b.category === video.category ? 2 : 0) + (b.region === video.region ? 1 : 0);
      return scoreB - scoreA;
    });
  }, [allVideos, video.id, video.category, video.region]);

  const handleEnded = useCallback(() => {
    if (autoplayNext && upNextVideos.length > 0) {
      onSelectVideo(upNextVideos[0].id);
    }
  }, [autoplayNext, upNextVideos, onSelectVideo]);

  const handleProgress = useCallback(
    (sec: number) => {
      onRecordProgress(video.id, sec, false);
    },
    [onRecordProgress, video.id]
  );

  const handleJumpToChapter = (time: number) => {
    setSeekRequest({ time, seq: Date.now() });
  };

  const handleShare = () => {
    const shareText = `${video.title} — Watch on EthioHub`;
    if (navigator.clipboard?.writeText) {
      void navigator.clipboard.writeText(shareText).catch(() => {});
    }
    setCopiedShare(true);
    window.setTimeout(() => setCopiedShare(false), 2200);
  };

  const handleCommentSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!commentBody.trim()) return;
    onAddComment(video.id, commentAuthor, commentBody);
    setCommentBody('');
  };

  return (
    <div className="max-w-[1440px] mx-auto px-4 sm:px-8 py-6">
      {/* Back navigation */}
      <button
        type="button"
        onClick={onBack}
        className="inline-flex items-center gap-2 text-sm text-zinc-400 hover:text-zinc-100 transition-colors mb-5 focus-visible:outline-none focus-visible:text-[#E5A91A]"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Back to Browse</span>
      </button>

      {/* Theater mode spans full width above details; standard mode sits in left 8 cols */}
      {theaterMode && (
        <div className="mb-8">
          <CinemaPlayer
            video={video}
            initialTimeSec={initialProgressSec}
            seekRequest={seekRequest}
            theaterMode={theaterMode}
            onToggleTheater={() => setTheaterMode((v) => !v)}
            onProgress={handleProgress}
            onEnded={handleEnded}
          />
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Primary Column */}
        <div className={theaterMode ? 'lg:col-span-8' : 'lg:col-span-8'}>
          {!theaterMode && (
            <CinemaPlayer
              video={video}
              initialTimeSec={initialProgressSec}
              seekRequest={seekRequest}
              theaterMode={theaterMode}
              onToggleTheater={() => setTheaterMode((v) => !v)}
              onProgress={handleProgress}
              onEnded={handleEnded}
            />
          )}

          {/* Video Header & Metadata */}
          <div className="mt-5">
            <h1 className="font-display text-2xl sm:text-[28px] font-bold tracking-tight text-zinc-50 leading-tight [text-wrap:balance]">
              {video.title}
            </h1>

            <div className="mt-2.5 flex flex-wrap items-center justify-between gap-4">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-zinc-400 tabular-nums">
                <span>{formatCompactNumber(video.views)} views</span>
                <span aria-hidden="true" className="text-zinc-600">·</span>
                <span>{video.publishedLabel}</span>
                <span aria-hidden="true" className="text-zinc-600">·</span>
                <span>{video.region}</span>
                <span aria-hidden="true" className="text-zinc-600">·</span>
                <span>{video.language}</span>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => onToggleLike(video.id)}
                  className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border transition-colors min-h-[40px] whitespace-nowrap shrink-0 ${
                    isLiked
                      ? 'bg-[#E5A91A]/15 border-[#E5A91A]/50 text-[#F2B705]'
                      : 'bg-[#121216] border-white/[0.08] text-zinc-200 hover:bg-[#1A1A20]'
                  }`}
                >
                  <ThumbsUp className={`w-4 h-4 ${isLiked ? 'fill-current' : ''}`} />
                  <span className="tabular-nums">{formatCompactNumber(video.likes)}</span>
                </button>

                <button
                  type="button"
                  onClick={() => onToggleWatchlist(video.id)}
                  className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border transition-colors min-h-[40px] whitespace-nowrap shrink-0 ${
                    isSaved
                      ? 'bg-zinc-100 text-zinc-950 border-zinc-100'
                      : 'bg-[#121216] border-white/[0.08] text-zinc-200 hover:bg-[#1A1A20]'
                  }`}
                >
                  {isSaved ? <Check className="w-4 h-4" /> : <Bookmark className="w-4 h-4" />}
                  <span>{isSaved ? 'Saved' : 'Save'}</span>
                </button>

                <button
                  type="button"
                  onClick={handleShare}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-[#121216] border border-white/[0.08] text-zinc-200 hover:bg-[#1A1A20] transition-colors min-h-[40px] whitespace-nowrap shrink-0"
                >
                  {copiedShare ? <Check className="w-4 h-4 text-[#1F8A5B]" /> : <Share2 className="w-4 h-4" />}
                  <span>{copiedShare ? 'Link Copied' : 'Share'}</span>
                </button>
              </div>
            </div>
          </div>

          {/* Creator Channel Strip */}
          <div className="mt-6 py-4 border-y border-white/[0.07] flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3.5 min-w-0">
              <button
                type="button"
                onClick={() => onSelectCreator(creator.id)}
                className="w-12 h-12 rounded-full overflow-hidden border border-white/10 shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E5A91A]"
              >
                <MediaImage
                  src={creator.avatarUrl}
                  alt={creator.name}
                  className="w-full h-full object-cover"
                />
              </button>
              <div className="min-w-0">
                <button
                  type="button"
                  onClick={() => onSelectCreator(creator.id)}
                  className="font-semibold text-zinc-100 hover:text-[#E5A91A] transition-colors text-base block truncate"
                >
                  {creator.name}
                </button>
                <div className="flex items-center gap-1.5 text-xs text-zinc-400 tabular-nums mt-0.5">
                  <span>{creator.handle}</span>
                  <span aria-hidden="true">·</span>
                  <span>{formatCompactNumber(creator.subscribers)} subscribers</span>
                  <span aria-hidden="true">·</span>
                  <span>{creator.region}</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3 shrink-0">
              <button
                type="button"
                onClick={() => onSelectCreator(creator.id)}
                className="px-3.5 py-2 text-sm font-medium text-zinc-300 hover:text-white transition-colors whitespace-nowrap"
              >
                Visit Channel
              </button>
              <button
                type="button"
                onClick={() => onToggleSubscribe(creator.id)}
                className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors min-h-[40px] whitespace-nowrap shrink-0 ${
                  isSubscribed
                    ? 'bg-[#18181E] text-zinc-200 border border-white/15 hover:bg-[#22222A]'
                    : 'bg-[#E5A91A] text-zinc-950 hover:bg-[#F2B705]'
                }`}
              >
                {isSubscribed ? 'Subscribed' : 'Subscribe'}
              </button>
            </div>
          </div>

          {/* Synopsis & Clickable Chapters */}
          <div className="mt-6 bg-[#121216] border border-white/[0.06] rounded-xl p-5">
            <div className="flex items-center justify-between gap-4">
              <h2 className="text-sm font-semibold text-zinc-100">About this Film</h2>
              <button
                type="button"
                onClick={() => setShowFullDesc((v) => !v)}
                className="inline-flex items-center gap-1 text-xs font-medium text-zinc-400 hover:text-zinc-200 transition-colors"
              >
                <span>{showFullDesc ? 'Collapse' : 'Expand'}</span>
                {showFullDesc ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </button>
            </div>

            <p
              className={`mt-2.5 text-[15px] text-zinc-300 leading-relaxed max-w-[72ch] ${
                showFullDesc ? '' : 'line-clamp-2'
              }`}
            >
              {video.description}
            </p>

            {showFullDesc && video.chapters.length > 0 && (
              <div className="mt-5 pt-4 border-t border-white/[0.06]">
                <h3 className="text-xs font-semibold text-zinc-400 mb-2.5">Chapters</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {video.chapters.map((chapter) => (
                    <button
                      key={chapter.time}
                      type="button"
                      onClick={() => handleJumpToChapter(chapter.time)}
                      className="flex items-center gap-3 px-3 py-2 rounded-lg text-left bg-white/[0.02] hover:bg-white/[0.06] transition-colors group"
                    >
                      <span className="font-mono text-xs tabular-nums text-[#E5A91A] shrink-0">
                        {formatDuration(chapter.time)}
                      </span>
                      <span className="text-sm text-zinc-300 group-hover:text-zinc-50 truncate">
                        {chapter.title}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Community Discussion */}
          <section className="mt-10" aria-label="Community Comments">
            <div className="flex items-baseline justify-between mb-5">
              <h2 className="font-display text-xl font-semibold text-zinc-100">
                Community Discussion
              </h2>
              <span className="text-sm text-zinc-500 tabular-nums">
                {comments.length} {comments.length === 1 ? 'comment' : 'comments'}
              </span>
            </div>

            <form
              onSubmit={handleCommentSubmit}
              className="bg-[#121216] border border-white/[0.07] rounded-xl p-4 mb-6"
            >
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
                <label className="block sm:col-span-1">
                  <span className="sr-only">Your Display Name</span>
                  <input
                    type="text"
                    value={commentAuthor}
                    onChange={(e) => setCommentAuthor(e.target.value)}
                    placeholder="Your name"
                    maxLength={40}
                    className="w-full px-3.5 py-2 text-sm bg-[#09090B] border border-white/[0.08] rounded-lg text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-[#E5A91A]"
                  />
                </label>
                <label className="block sm:col-span-2">
                  <span className="sr-only">Write a comment</span>
                  <input
                    type="text"
                    value={commentBody}
                    onChange={(e) => setCommentBody(e.target.value)}
                    placeholder="Share your thoughts on this performance or film..."
                    maxLength={400}
                    className="w-full px-3.5 py-2 text-sm bg-[#09090B] border border-white/[0.08] rounded-lg text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-[#E5A91A]"
                  />
                </label>
              </div>
              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={!commentBody.trim()}
                  className="px-4 py-2 text-sm font-semibold rounded-lg bg-[#E5A91A] text-zinc-950 hover:bg-[#F2B705] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  Post Comment
                </button>
              </div>
            </form>

            {comments.length === 0 ? (
              <p className="text-sm text-zinc-500 py-6 text-center border border-dashed border-white/[0.08] rounded-xl">
                Be the first to share a reflection on this film.
              </p>
            ) : (
              <div className="divide-y divide-white/[0.06]">
                {comments.map((c) => {
                  const liked = likedCommentIds.includes(c.id);
                  return (
                    <div key={c.id} className="py-4 flex items-start justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 text-xs text-zinc-400">
                          <span className="font-semibold text-zinc-100 text-sm">
                            {c.authorName}
                          </span>
                          <span>{c.authorHandle}</span>
                          <span aria-hidden="true">·</span>
                          <span>{c.createdAtLabel}</span>
                        </div>
                        <p className="mt-1.5 text-sm text-zinc-300 leading-relaxed max-w-[68ch]">
                          {c.body}
                        </p>
                        <div className="mt-2.5 flex items-center gap-4">
                          <button
                            type="button"
                            onClick={() => onToggleLikeComment(video.id, c.id)}
                            className={`inline-flex items-center gap-1.5 text-xs transition-colors ${
                              liked ? 'text-[#E5A91A]' : 'text-zinc-500 hover:text-zinc-200'
                            }`}
                          >
                            <ThumbsUp className={`w-3.5 h-3.5 ${liked ? 'fill-current' : ''}`} />
                            <span className="tabular-nums">{c.likes}</span>
                          </button>

                          {c.isMine && (
                            <button
                              type="button"
                              onClick={() => onDeleteComment(video.id, c.id)}
                              className="inline-flex items-center gap-1 text-xs text-zinc-500 hover:text-red-400 transition-colors"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              <span>Delete</span>
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </div>

        {/* Right Sidebar: Up Next Queue */}
        <aside className="lg:col-span-4 space-y-5">
          <div className="flex items-center justify-between pb-3 border-b border-white/[0.07]">
            <h2 className="font-display text-lg font-semibold text-zinc-100">Up Next</h2>
            <button
              type="button"
              role="switch"
              aria-checked={autoplayNext}
              onClick={() => setAutoplayNext((v) => !v)}
              className="inline-flex items-center gap-2 text-xs text-zinc-400 hover:text-zinc-200 transition-colors"
            >
              <span>Autoplay</span>
              <span
                className={`w-8 h-4.5 rounded-full p-0.5 transition-colors flex items-center ${
                  autoplayNext ? 'bg-[#E5A91A] justify-end' : 'bg-zinc-700 justify-start'
                }`}
              >
                <span className="w-3.5 h-3.5 rounded-full bg-zinc-950 block" />
              </span>
            </button>
          </div>

          <div className="space-y-4">
            {upNextVideos.map((nextVid) => (
              <VideoCard
                key={nextVid.id}
                video={nextVid}
                creator={getCreatorById(nextVid.creatorId)}
                isSaved={watchlistIds.includes(nextVid.id)}
                resumeProgressSec={getResumeProgress(nextVid.id)}
                onSelectVideo={onSelectVideo}
                onSelectCreator={onSelectCreator}
                onToggleWatchlist={onToggleWatchlist}
                compact
              />
            ))}
          </div>
        </aside>
      </div>
    </div>
  );
}
