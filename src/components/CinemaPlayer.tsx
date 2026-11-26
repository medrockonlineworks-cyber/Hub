import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Captions,
  Maximize,
  Minimize,
  Pause,
  Play,
  RectangleHorizontal,
  RotateCcw,
  RotateCw,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { useResolvedImageSrc, useResolvedVideoSrc } from '../hooks/useGitHubMedia';
import { Video } from '../types/ethiohub';
import { EthioSoundscapeEngine } from '../utils/ethioAudio';
import { formatDuration, qenetLabel } from '../utils/formatters';
import { MediaImage } from './MediaImage';

interface CinemaPlayerProps {
  video: Video;
  initialTimeSec?: number;
  seekRequest?: { time: number; seq: number } | null;
  theaterMode: boolean;
  onToggleTheater: () => void;
  onProgress: (timeSec: number) => void;
  onEnded: () => void;
}

const SPEED_OPTIONS = [0.75, 1, 1.25, 1.5, 2];

export function CinemaPlayer({
  video,
  initialTimeSec = 0,
  seekRequest,
  theaterMode,
  onToggleTheater,
  onProgress,
  onEnded,
}: CinemaPlayerProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const htmlVideoRef = useRef<HTMLVideoElement | null>(null);
  const soundEngineRef = useRef<EthioSoundscapeEngine | null>(null);
  const lastSavedRef = useRef<number>(0);

  const resolvedVideoUrl = useResolvedVideoSrc(video.id, video.videoUrl);
  const resolvedPosterUrl = useResolvedImageSrc(video.thumbnailUrl);
  const [directVideoFailed, setDirectVideoFailed] = useState<boolean>(false);

  const hasDirectVideo = Boolean(resolvedVideoUrl) && !directVideoFailed;
  const [duration, setDuration] = useState<number>(video.durationSec);
  const [currentTime, setCurrentTime] = useState<number>(
    initialTimeSec > 0 && initialTimeSec < video.durationSec - 5 ? initialTimeSec : 0
  );
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [volume, setVolume] = useState<number>(0.65);
  const [playbackRate, setPlaybackRate] = useState<number>(1);
  const [showCaptions, setShowCaptions] = useState<boolean>(true);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [showSpeedMenu, setShowSpeedMenu] = useState<boolean>(false);
  const [controlsVisible, setControlsVisible] = useState<boolean>(true);
  const hideTimerRef = useRef<number | null>(null);

  // Reset state when video or resolved stream source changes
  useEffect(() => {
    setDirectVideoFailed(false);
    setDuration(video.durationSec);
    const startAt =
      initialTimeSec > 0 && initialTimeSec < video.durationSec - 5 ? initialTimeSec : 0;
    setCurrentTime(startAt);
    setIsPlaying(true);
    lastSavedRef.current = startAt;
  }, [video.id, video.durationSec, initialTimeSec, resolvedVideoUrl]);

  // Initialize and dispose EthioSoundscapeEngine for curated cinema streams
  useEffect(() => {
    if (hasDirectVideo) return;
    const engine = new EthioSoundscapeEngine();
    soundEngineRef.current = engine;
    return () => {
      engine.dispose();
      soundEngineRef.current = null;
    };
  }, [hasDirectVideo]);

  // Sync Web Audio soundscape with playback state
  useEffect(() => {
    if (hasDirectVideo) return;
    const engine = soundEngineRef.current;
    if (!engine) return;
    engine.configure(video.qenetMode, volume, isMuted, playbackRate);
    if (isPlaying) {
      engine.start(video.qenetMode, volume, isMuted, playbackRate);
    } else {
      engine.stop();
    }
  }, [hasDirectVideo, isPlaying, isMuted, volume, playbackRate, video.qenetMode]);

  // Handle external chapter seek requests
  useEffect(() => {
    if (!seekRequest) return;
    const clamped = Math.max(0, Math.min(duration, seekRequest.time));
    setCurrentTime(clamped);
    if (htmlVideoRef.current) {
      htmlVideoRef.current.currentTime = clamped;
    }
    setIsPlaying(true);
  }, [seekRequest, duration]);

  // Synthetic cinema timeline loop for curated streams
  useEffect(() => {
    if (hasDirectVideo || !isPlaying) return;
    let lastTick = performance.now();
    const timer = window.setInterval(() => {
      const now = performance.now();
      const delta = ((now - lastTick) / 1000) * playbackRate;
      lastTick = now;
      setCurrentTime((prev) => {
        const next = prev + delta;
        if (next >= duration) {
          setIsPlaying(false);
          onEnded();
          return duration;
        }
        return next;
      });
    }, 100);
    return () => window.clearInterval(timer);
  }, [hasDirectVideo, isPlaying, playbackRate, duration, onEnded]);

  // Sync HTML5 video element when present
  useEffect(() => {
    const el = htmlVideoRef.current;
    if (!el || !hasDirectVideo) return;
    el.muted = isMuted;
    el.volume = volume;
    el.playbackRate = playbackRate;
    if (isPlaying) {
      void el.play().catch(() => setIsPlaying(false));
    } else {
      el.pause();
    }
  }, [hasDirectVideo, isPlaying, isMuted, volume, playbackRate]);

  // Periodically report progress to Watch History
  useEffect(() => {
    if (Math.abs(currentTime - lastSavedRef.current) >= 4) {
      lastSavedRef.current = currentTime;
      onProgress(currentTime);
    }
  }, [currentTime, onProgress]);

  const seekTo = useCallback(
    (targetSec: number) => {
      const clamped = Math.max(0, Math.min(duration, targetSec));
      setCurrentTime(clamped);
      if (htmlVideoRef.current) {
        htmlVideoRef.current.currentTime = clamped;
      }
      onProgress(clamped);
    },
    [duration, onProgress]
  );

  const togglePlay = useCallback(() => {
    setIsPlaying((prev) => {
      if (!prev && currentTime >= duration - 1) {
        setCurrentTime(0);
        if (htmlVideoRef.current) htmlVideoRef.current.currentTime = 0;
      }
      return !prev;
    });
  }, [currentTime, duration]);

  const toggleFullscreen = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    if (!document.fullscreenElement) {
      void el.requestFullscreen?.().catch(() => {});
    } else {
      void document.exitFullscreen?.().catch(() => {});
    }
  }, []);

  useEffect(() => {
    const onFsChange = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);

  // Keyboard shortcuts when not typing in an input
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)
      ) {
        return;
      }
      if (e.code === 'Space') {
        e.preventDefault();
        togglePlay();
      } else if (e.key === 'm' || e.key === 'M') {
        setIsMuted((m) => !m);
      } else if (e.key === 'c' || e.key === 'C') {
        setShowCaptions((c) => !c);
      } else if (e.key === 'f' || e.key === 'F') {
        toggleFullscreen();
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        seekTo(currentTime + 10);
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        seekTo(currentTime - 10);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [togglePlay, toggleFullscreen, seekTo, currentTime]);

  const handleMouseMove = () => {
    setControlsVisible(true);
    if (hideTimerRef.current) window.clearTimeout(hideTimerRef.current);
    if (isPlaying) {
      hideTimerRef.current = window.setTimeout(() => setControlsVisible(false), 3200);
    }
  };

  // Current visual scene & smooth cinematic pan progress
  const scenes = video.sceneImages.length > 0 ? video.sceneImages : [video.thumbnailUrl];
  const sceneSpan = 28; // seconds per camera cut
  const activeSceneIndex = Math.floor(currentTime / sceneSpan) % scenes.length;
  const sceneLocalProgress = (currentTime % sceneSpan) / sceneSpan;
  const kenBurnsScale = isPlaying ? 1.0 + sceneLocalProgress * 0.075 : 1.02;
  const kenBurnsX = activeSceneIndex % 2 === 0 ? -sceneLocalProgress * 1.8 : sceneLocalProgress * 1.8;

  // Active bilingual subtitle cue (loops gracefully across video length)
  const activeSubtitle = useMemo(() => {
    if (!video.subtitles || video.subtitles.length === 0) return null;
    const direct = video.subtitles.find((s) => currentTime >= s.start && currentTime <= s.end);
    if (direct) return direct;
    // Cycle cues softly on longer playback spans so captions stay alive
    const lastEnd = video.subtitles[video.subtitles.length - 1].end;
    if (lastEnd > 0) {
      const modTime = currentTime % lastEnd;
      return video.subtitles.find((s) => modTime >= s.start && modTime <= s.end) || null;
    }
    return null;
  }, [video.subtitles, currentTime]);

  // Active chapter title
  const activeChapter = useMemo(() => {
    if (!video.chapters || video.chapters.length === 0) return null;
    let found = video.chapters[0];
    for (const ch of video.chapters) {
      if (currentTime >= ch.time) found = ch;
    }
    return found;
  }, [video.chapters, currentTime]);

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div
      ref={containerRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={() => isPlaying && setControlsVisible(false)}
      className="relative w-full aspect-video bg-black rounded-2xl overflow-hidden border border-white/[0.08] select-none group"
    >
      {/* Video / Cinema Visual Canvas */}
      {hasDirectVideo ? (
        <video
          ref={htmlVideoRef}
          src={resolvedVideoUrl}
          poster={resolvedPosterUrl}
          playsInline
          onClick={togglePlay}
          onError={() => setDirectVideoFailed(true)}
          onLoadedMetadata={(e) => {
            const d = e.currentTarget.duration;
            if (Number.isFinite(d) && d > 0) setDuration(d);
          }}
          onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
          onEnded={() => {
            setIsPlaying(false);
            onEnded();
          }}
          className="w-full h-full object-contain bg-black cursor-pointer"
        />
      ) : (
        <div onClick={togglePlay} className="relative w-full h-full overflow-hidden cursor-pointer">
          {scenes.map((src, idx) => {
            const isCurrent = idx === activeSceneIndex;
            return (
              <div
                key={`${src}-${idx}`}
                className={`absolute inset-0 transition-opacity duration-1000 ${
                  isCurrent ? 'opacity-100' : 'opacity-0 pointer-events-none'
                }`}
              >
                <div
                  className="w-full h-full transition-transform duration-300 ease-linear"
                  style={{
                    transform: isCurrent
                      ? `scale(${kenBurnsScale.toFixed(4)}) translateX(${kenBurnsX.toFixed(2)}%)`
                      : 'scale(1.02)',
                  }}
                >
                  <MediaImage
                    src={src}
                    alt={video.title}
                    fallbackTitle={video.title}
                    className="w-full h-full object-cover"
                  />
                </div>
              </div>
            );
          })}

          {/* Measured cinema vignette scrim */}
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/85 via-black/15 to-black/45" />

          {/* Subtle top-left active chapter & qenet indicator while controls visible */}
          <div
            className={`pointer-events-none absolute top-4 left-5 right-5 flex items-center justify-between text-xs text-zinc-200/90 transition-opacity duration-200 ${
              controlsVisible || !isPlaying ? 'opacity-100' : 'opacity-0'
            }`}
          >
            <div className="flex items-center gap-2 min-w-0">
              {activeChapter && (
                <span className="truncate font-medium text-zinc-100">{activeChapter.title}</span>
              )}
              <span aria-hidden="true" className="text-zinc-400">·</span>
              <span className="text-zinc-300 whitespace-nowrap shrink-0">
                {qenetLabel(video.qenetMode)} Soundscape
              </span>
            </div>
            <span className="font-mono text-[11px] text-zinc-300 hidden sm:inline whitespace-nowrap shrink-0">
              1080p HD
            </span>
          </div>
        </div>
      )}

      {/* Center Play Overlay when Paused */}
      {!isPlaying && (
        <button
          type="button"
          onClick={togglePlay}
          aria-label="Play video"
          className="absolute inset-0 m-auto w-20 h-20 rounded-full bg-[#E5A91A] text-zinc-950 flex items-center justify-center shadow-2xl hover:bg-[#F2B705] hover:scale-105 transition-all duration-150 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#E5A91A]/50"
        >
          <Play className="w-8 h-8 fill-current ml-1" />
        </button>
      )}

      {/* Bilingual Closed Captions (Amharic + English) */}
      {showCaptions && activeSubtitle && (
        <div
          className={`pointer-events-none absolute left-4 right-4 flex justify-center transition-all duration-200 ${
            controlsVisible || !isPlaying ? 'bottom-20 sm:bottom-24' : 'bottom-6'
          }`}
        >
          <div className="max-w-2xl px-4 py-2 rounded-lg bg-black/80 backdrop-blur-sm text-center">
            <p className="text-sm sm:text-base font-medium text-[#F2B705] leading-snug">
              {activeSubtitle.amharic}
            </p>
            <p className="text-xs sm:text-sm text-zinc-100 mt-0.5 leading-snug">
              {activeSubtitle.english}
            </p>
          </div>
        </div>
      )}

      {/* Bottom Controls Bar */}
      <div
        className={`absolute bottom-0 left-0 right-0 px-4 sm:px-5 pb-3.5 pt-10 bg-gradient-to-t from-black/95 via-black/75 to-transparent transition-opacity duration-200 ${
          controlsVisible || !isPlaying ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
      >
        {/* Interactive Timeline Scrubber with Chapter Markers */}
        <div className="relative mb-3 group/bar">
          <input
            type="range"
            min={0}
            max={duration}
            step={1}
            value={Math.floor(currentTime)}
            aria-label="Seek video timeline"
            onChange={(e) => seekTo(Number(e.target.value))}
            className="w-full h-1.5 appearance-none bg-white/25 rounded-full cursor-pointer accent-[#E5A91A] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E5A91A]"
            style={{
              background: `linear-gradient(to right, #E5A91A 0%, #E5A91A ${progressPercent}%, rgba(255,255,255,0.22) ${progressPercent}%, rgba(255,255,255,0.22) 100%)`,
            }}
          />
          {/* Chapter notch indicators */}
          {video.chapters.slice(1).map((ch) => {
            const leftPct = duration > 0 ? (ch.time / duration) * 100 : 0;
            return (
              <span
                key={ch.time}
                title={ch.title}
                aria-hidden="true"
                className="pointer-events-none absolute top-[7px] w-[2px] h-2 bg-black/90"
                style={{ left: `${leftPct}%` }}
              />
            );
          })}
        </div>

        {/* Control Buttons Row */}
        <div className="flex items-center justify-between gap-2 text-zinc-100">
          <div className="flex items-center gap-1.5 sm:gap-2.5">
            <button
              type="button"
              onClick={togglePlay}
              aria-label={isPlaying ? 'Pause' : 'Play'}
              className="w-9 h-9 rounded-lg hover:bg-white/10 flex items-center justify-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E5A91A]"
            >
              {isPlaying ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current ml-0.5" />}
            </button>

            <button
              type="button"
              onClick={() => seekTo(currentTime - 10)}
              aria-label="Rewind 10 seconds"
              title="Rewind 10s (Left Arrow)"
              className="w-9 h-9 rounded-lg hover:bg-white/10 hidden sm:flex items-center justify-center transition-colors"
            >
              <RotateCcw className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={() => seekTo(currentTime + 10)}
              aria-label="Forward 10 seconds"
              title="Forward 10s (Right Arrow)"
              className="w-9 h-9 rounded-lg hover:bg-white/10 hidden sm:flex items-center justify-center transition-colors"
            >
              <RotateCw className="w-4 h-4" />
            </button>

            {/* Volume Controls */}
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setIsMuted((m) => !m)}
                aria-label={isMuted ? 'Unmute audio' : 'Mute audio'}
                title="Mute / Unmute (M)"
                className="w-9 h-9 rounded-lg hover:bg-white/10 flex items-center justify-center transition-colors"
              >
                {isMuted || volume === 0 ? <VolumeX className="w-4 h-4 text-zinc-400" /> : <Volume2 className="w-4 h-4" />}
              </button>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={isMuted ? 0 : volume}
                aria-label="Volume"
                onChange={(e) => {
                  const val = Number(e.target.value);
                  setVolume(val);
                  if (val > 0 && isMuted) setIsMuted(false);
                }}
                className="w-16 sm:w-20 h-1 appearance-none bg-white/25 rounded-full cursor-pointer accent-[#E5A91A]"
              />
            </div>

            {/* Timecode */}
            <span className="ml-1 text-xs font-mono tabular-nums text-zinc-200 whitespace-nowrap">
              {formatDuration(currentTime)}{' '}
              <span className="text-zinc-500">/ {formatDuration(duration)}</span>
            </span>
          </div>

          <div className="flex items-center gap-1 sm:gap-1.5 relative">
            {/* Captions toggle */}
            <button
              type="button"
              onClick={() => setShowCaptions((c) => !c)}
              aria-label="Toggle bilingual captions"
              title="Amharic / English Captions (C)"
              className={`h-9 px-2.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors ${
                showCaptions
                  ? 'text-[#E5A91A] bg-white/10'
                  : 'text-zinc-300 hover:bg-white/10 hover:text-white'
              }`}
            >
              <Captions className="w-4 h-4" />
              <span className="hidden sm:inline">CC</span>
            </button>

            {/* Speed Menu */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowSpeedMenu((s) => !s)}
                aria-label="Playback speed"
                className="h-9 px-2.5 rounded-lg text-xs font-mono tabular-nums text-zinc-200 hover:bg-white/10 transition-colors"
              >
                {playbackRate}x
              </button>
              {showSpeedMenu && (
                <div className="absolute bottom-11 right-0 bg-[#141418] border border-white/10 rounded-xl p-1 shadow-2xl min-w-[84px] z-20">
                  {SPEED_OPTIONS.map((rate) => (
                    <button
                      key={rate}
                      type="button"
                      onClick={() => {
                        setPlaybackRate(rate);
                        setShowSpeedMenu(false);
                      }}
                      className={`w-full text-left px-3 py-1.5 text-xs font-mono tabular-nums rounded-lg transition-colors ${
                        playbackRate === rate
                          ? 'bg-[#E5A91A] text-zinc-950 font-semibold'
                          : 'text-zinc-300 hover:bg-white/[0.06]'
                      }`}
                    >
                      {rate}x
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Theater Mode */}
            <button
              type="button"
              onClick={onToggleTheater}
              aria-label={theaterMode ? 'Exit theater mode' : 'Enter theater mode'}
              title="Theater Mode"
              className={`hidden lg:flex w-9 h-9 rounded-lg items-center justify-center transition-colors ${
                theaterMode ? 'text-[#E5A91A] bg-white/10' : 'text-zinc-200 hover:bg-white/10'
              }`}
            >
              <RectangleHorizontal className="w-4 h-4" />
            </button>

            {/* Fullscreen */}
            <button
              type="button"
              onClick={toggleFullscreen}
              aria-label={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
              title="Fullscreen (F)"
              className="w-9 h-9 rounded-lg hover:bg-white/10 flex items-center justify-center transition-colors"
            >
              {isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
