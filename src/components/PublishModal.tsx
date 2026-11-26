import { ChangeEvent, FormEvent, useMemo, useState } from 'react';
import { Upload, X } from 'lucide-react';
import { THUMBNAIL_PRESETS } from '../data/catalog';
import { useGitHubMedia } from '../hooks/useGitHubMedia';
import { buildLocalPublicUrl } from '../services/githubMediaManager';
import { EthioRegion, QenetMode, Video, VideoCategory } from '../types/ethiohub';
import { MediaImage } from './MediaImage';

interface PublishModalProps {
  isOpen: boolean;
  defaultCreatorName: string;
  onClose: () => void;
  onPublish: (video: Video) => void;
}

const CATEGORIES: VideoCategory[] = [
  'Music',
  'Culture',
  'Culinary',
  'Documentary',
  'Dance',
  'Street & Travel',
];

const REGIONS: EthioRegion[] = [
  'Addis Ababa',
  'Gondar',
  'Lalibela',
  'Harar',
  'Bahir Dar',
  'Hawassa',
  'Jimma',
];

const LANGUAGES = [
  'Amharic · English CC',
  'Afaan Oromo · English CC',
  'Tigrigna · English CC',
  'Harari · Amharic',
  'Sidamu Afoo · Amharic',
  'English',
];

export function PublishModal({
  isOpen,
  defaultCreatorName,
  onClose,
  onPublish,
}: PublishModalProps) {
  const mediaSnapshot = useGitHubMedia();
  const coverPresets = useMemo(() => {
    const existingUrls = new Set<string>(THUMBNAIL_PRESETS.map((p) => p.url));
    const extras = mediaSnapshot.remoteImages
      .filter((img) => !img.id.startsWith('creator_'))
      .map((img) => ({
        label: img.label || img.name,
        url: buildLocalPublicUrl(img.path),
      }))
      .filter((p) => !existingUrls.has(p.url));
    return [...THUMBNAIL_PRESETS, ...extras];
  }, [mediaSnapshot.remoteImages]);

  const [title, setTitle] = useState('');
  const [creatorName, setCreatorName] = useState(defaultCreatorName || 'Amanuel Tesfaye');
  const [category, setCategory] = useState<VideoCategory>('Music');
  const [region, setRegion] = useState<EthioRegion>('Addis Ababa');
  const [language, setLanguage] = useState(LANGUAGES[0]);
  const [qenetMode, setQenetMode] = useState<QenetMode>('tizita');
  const [description, setDescription] = useState('');
  const [selectedThumb, setSelectedThumb] = useState<string>(THUMBNAIL_PRESETS[0].url);
  const [localVideoUrl, setLocalVideoUrl] = useState<string | undefined>(undefined);
  const [localVideoName, setLocalVideoName] = useState<string>('');
  const [detectedDuration, setDetectedDuration] = useState<number>(360);
  const [error, setError] = useState<string>('');

  if (!isOpen) return null;

  const handleVideoFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('video/')) {
      setError('Please select a valid video file (MP4, WebM, or MOV).');
      return;
    }
    setError('');
    const objectUrl = URL.createObjectURL(file);
    setLocalVideoUrl(objectUrl);
    setLocalVideoName(file.name);

    // Probe actual video duration cleanly
    const probe = document.createElement('video');
    probe.preload = 'metadata';
    probe.onloadedmetadata = () => {
      if (Number.isFinite(probe.duration) && probe.duration > 0) {
        setDetectedDuration(Math.round(probe.duration));
      }
    };
    probe.src = objectUrl;
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError('Please enter a title for your video.');
      return;
    }
    if (!description.trim()) {
      setError('Please add a short description.');
      return;
    }

    const cleanCreator = creatorName.trim() || 'Independent Creator';
    const creatorSlug =
      'creator-user-' + cleanCreator.toLowerCase().replace(/[^a-z0-9]+/g, '-');

    const newVideo: Video = {
      id: `vid-user-${Date.now()}`,
      title: title.trim(),
      subtitle: `Channel: ${cleanCreator}`,
      description: description.trim(),
      creatorId: creatorSlug,
      category,
      subgenre: category,
      region,
      language,
      durationSec: detectedDuration,
      views: 1,
      likes: 0,
      publishedLabel: 'Just now',
      publishedIso: new Date().toISOString().slice(0, 10),
      thumbnailUrl: selectedThumb,
      sceneImages: [selectedThumb],
      qenetMode,
      chapters: [{ time: 0, title: 'Opening' }],
      subtitles: [
        {
          start: 0,
          end: 25,
          amharic: title.trim(),
          english: `${cleanCreator} · ${region}`,
        },
      ],
      videoUrl: localVideoUrl,
      isUserUpload: true,
    };

    onPublish(newVideo);
    setTitle('');
    setDescription('');
    setLocalVideoUrl(undefined);
    setLocalVideoName('');
    setError('');
    onClose();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="publish-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl bg-[#121216] border border-white/[0.1] rounded-2xl p-6 sm:p-7 my-8 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 pb-4 border-b border-white/[0.07]">
          <div>
            <h2
              id="publish-modal-title"
              className="font-display text-2xl font-bold text-zinc-50"
            >
              Publish to EthioHub
            </h2>
            <p className="text-sm text-zinc-400 mt-1">
              Share your Ethiopian music session, cultural film, or local story.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close publish dialog"
            className="w-10 h-10 rounded-lg text-zinc-400 hover:text-white hover:bg-white/[0.06] flex items-center justify-center transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-5 space-y-5">
          {error && (
            <div className="px-4 py-3 rounded-lg bg-[#C93B2B]/15 border border-[#C93B2B]/40 text-sm text-red-200">
              {error}
            </div>
          )}

          {/* Optional Local Video File Upload */}
          <div>
            <label className="block text-xs font-semibold text-zinc-300 mb-2">
              Video File (Optional — MP4 / WebM plays directly in Cinema Player)
            </label>
            <label className="flex items-center justify-between gap-4 px-4 py-3.5 rounded-xl border border-dashed border-white/15 bg-[#09090B] hover:border-[#E5A91A]/60 cursor-pointer transition-colors">
              <div className="flex items-center gap-3 min-w-0">
                <Upload className="w-4 h-4 text-[#E5A91A] shrink-0" />
                <span className="text-sm text-zinc-300 truncate">
                  {localVideoName || 'Select a local MP4 or WebM video, or stream with studio visuals'}
                </span>
              </div>
              <span className="text-xs font-medium text-[#E5A91A] whitespace-nowrap shrink-0">
                Choose File
              </span>
              <input
                type="file"
                accept="video/mp4,video/webm,video/quicktime"
                onChange={handleVideoFileChange}
                className="sr-only"
              />
            </label>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <label className="block sm:col-span-2">
              <span className="block text-xs font-semibold text-zinc-300 mb-1.5">
                Video Title
              </span>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Evening Krar Improvisation in Piazza"
                maxLength={120}
                className="w-full px-3.5 py-2.5 text-sm bg-[#09090B] border border-white/[0.1] rounded-lg text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-[#E5A91A]"
              />
            </label>

            <label className="block">
              <span className="block text-xs font-semibold text-zinc-300 mb-1.5">
                Creator / Channel Name
              </span>
              <input
                type="text"
                value={creatorName}
                onChange={(e) => setCreatorName(e.target.value)}
                placeholder="Your channel name"
                maxLength={60}
                className="w-full px-3.5 py-2.5 text-sm bg-[#09090B] border border-white/[0.1] rounded-lg text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-[#E5A91A]"
              />
            </label>

            <label className="block">
              <span className="block text-xs font-semibold text-zinc-300 mb-1.5">
                Category
              </span>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as VideoCategory)}
                className="w-full px-3.5 py-2.5 text-sm bg-[#09090B] border border-white/[0.1] rounded-lg text-zinc-100 focus:outline-none focus:border-[#E5A91A]"
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="block text-xs font-semibold text-zinc-300 mb-1.5">
                Region in Ethiopia
              </span>
              <select
                value={region}
                onChange={(e) => setRegion(e.target.value as EthioRegion)}
                className="w-full px-3.5 py-2.5 text-sm bg-[#09090B] border border-white/[0.1] rounded-lg text-zinc-100 focus:outline-none focus:border-[#E5A91A]"
              >
                {REGIONS.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="block text-xs font-semibold text-zinc-300 mb-1.5">
                Language & Captions
              </span>
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                className="w-full px-3.5 py-2.5 text-sm bg-[#09090B] border border-white/[0.1] rounded-lg text-zinc-100 focus:outline-none focus:border-[#E5A91A]"
              >
                {LANGUAGES.map((l) => (
                  <option key={l} value={l}>
                    {l}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {!localVideoUrl && (
            <div>
              <span className="block text-xs font-semibold text-zinc-300 mb-1.5">
                Ambient Qenet Mode (for Cinema Canvas playback)
              </span>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {(['tizita', 'bati', 'ambassel', 'anchihoye'] as QenetMode[]).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setQenetMode(mode)}
                    className={`px-3 py-2 rounded-lg text-xs font-medium capitalize border transition-colors ${
                      qenetMode === mode
                        ? 'bg-[#E5A91A]/15 border-[#E5A91A] text-[#F2B705]'
                        : 'bg-[#09090B] border-white/[0.08] text-zinc-400 hover:text-zinc-100'
                    }`}
                  >
                    {mode}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Cover Thumbnail Selection */}
          <div>
            <span className="block text-xs font-semibold text-zinc-300 mb-2">
              Cover Frame
            </span>
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
              {coverPresets.map((preset) => {
                const active = selectedThumb === preset.url;
                return (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() => setSelectedThumb(preset.url)}
                    title={preset.label}
                    className={`relative aspect-video rounded-lg overflow-hidden border-2 transition-all ${
                      active
                        ? 'border-[#E5A91A] ring-2 ring-[#E5A91A]/30'
                        : 'border-transparent opacity-70 hover:opacity-100'
                    }`}
                  >
                    <MediaImage
                      src={preset.url}
                      alt={preset.label}
                      className="w-full h-full object-cover"
                    />
                  </button>
                );
              })}
            </div>
          </div>

          <label className="block">
            <span className="block text-xs font-semibold text-zinc-300 mb-1.5">
              Description
            </span>
            <textarea
              required
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Tell viewers about the musicians, region, or cultural story behind this video..."
              maxLength={600}
              className="w-full px-3.5 py-2.5 text-sm bg-[#09090B] border border-white/[0.1] rounded-lg text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-[#E5A91A] resize-none"
            />
          </label>

          <div className="pt-3 border-t border-white/[0.07] flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 text-sm font-medium text-zinc-300 hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2.5 text-sm font-semibold rounded-lg bg-[#E5A91A] text-zinc-950 hover:bg-[#F2B705] transition-colors"
            >
              Publish Video
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
