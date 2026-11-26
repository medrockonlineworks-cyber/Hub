import { useCallback, useState } from 'react';
import { CategoryHubView } from './components/CategoryHubView';
import { CreatorChannelView } from './components/CreatorChannelView';
import { CreatorDirectory } from './components/CreatorDirectory';
import { DiscoverView } from './components/DiscoverView';
import { LibraryView } from './components/LibraryView';
import { PublishModal } from './components/PublishModal';
import { TopNav } from './components/TopNav';
import { WatchView } from './components/WatchView';
import { useEthioHubStore } from './hooks/useEthioHubStore';
import { AppSection, Video } from './types/ethiohub';

export default function App() {
  const {
    state,
    allVideos,
    allCreators,
    getCreatorById,
    toggleLikeVideo,
    toggleWatchlist,
    toggleSubscribe,
    recordWatchProgress,
    clearHistory,
    addComment,
    deleteComment,
    toggleLikeComment,
    publishVideo,
    deleteUserVideo,
    getResumeProgress,
  } = useEthioHubStore();

  const [activeSection, setActiveSection] = useState<AppSection>('discover');
  const [activeVideoId, setActiveVideoId] = useState<string | null>(null);
  const [activeCreatorId, setActiveCreatorId] = useState<string | null>(null);
  const [publishOpen, setPublishOpen] = useState(false);

  const handleNavigate = useCallback((section: AppSection) => {
    setActiveSection(section);
    setActiveVideoId(null);
    setActiveCreatorId(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const handleSelectVideo = useCallback((videoId: string) => {
    setActiveVideoId(videoId);
    setActiveCreatorId(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const handleSelectCreator = useCallback((creatorId: string) => {
    setActiveCreatorId(creatorId);
    setActiveVideoId(null);
    setActiveSection('creators');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const handlePublishVideo = useCallback(
    (newVideo: Video) => {
      publishVideo(newVideo);
      setActiveVideoId(newVideo.id);
      setActiveCreatorId(null);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    },
    [publishVideo]
  );

  const activeVideo = activeVideoId
    ? allVideos.find((v) => v.id === activeVideoId) || null
    : null;

  const activeCreator = activeCreatorId
    ? allCreators.find((c) => c.id === activeCreatorId) || null
    : null;

  return (
    <div className="min-h-screen flex flex-col bg-[#09090B] text-zinc-100">
      <TopNav
        activeSection={activeSection}
        onNavigate={handleNavigate}
        onOpenPublish={() => setPublishOpen(true)}
      />

      <main className="flex-1">
        {activeVideo ? (
          <WatchView
            video={activeVideo}
            creator={getCreatorById(activeVideo.creatorId)}
            allVideos={allVideos}
            getCreatorById={getCreatorById}
            isLiked={state.likedVideoIds.includes(activeVideo.id)}
            isSaved={state.watchlistIds.includes(activeVideo.id)}
            isSubscribed={state.subscribedCreatorIds.includes(activeVideo.creatorId)}
            initialProgressSec={getResumeProgress(activeVideo.id)}
            comments={state.commentsByVideo[activeVideo.id] || []}
            likedCommentIds={state.likedCommentIds}
            defaultViewerName={state.viewerName}
            onBack={() => setActiveVideoId(null)}
            onSelectVideo={handleSelectVideo}
            onSelectCreator={handleSelectCreator}
            onToggleLike={toggleLikeVideo}
            onToggleWatchlist={toggleWatchlist}
            onToggleSubscribe={toggleSubscribe}
            onRecordProgress={recordWatchProgress}
            onAddComment={addComment}
            onDeleteComment={deleteComment}
            onToggleLikeComment={toggleLikeComment}
            getResumeProgress={getResumeProgress}
            watchlistIds={state.watchlistIds}
          />
        ) : activeCreator ? (
          <CreatorChannelView
            creator={activeCreator}
            videos={allVideos.filter((v) => v.creatorId === activeCreator.id)}
            isSubscribed={state.subscribedCreatorIds.includes(activeCreator.id)}
            watchlistIds={state.watchlistIds}
            onBack={() => setActiveCreatorId(null)}
            onToggleSubscribe={toggleSubscribe}
            onSelectVideo={handleSelectVideo}
            onSelectCreator={handleSelectCreator}
            onToggleWatchlist={toggleWatchlist}
            getResumeProgress={getResumeProgress}
          />
        ) : activeSection === 'discover' ? (
          <DiscoverView
            videos={allVideos}
            creators={allCreators}
            watchlistIds={state.watchlistIds}
            getCreatorById={getCreatorById}
            getResumeProgress={getResumeProgress}
            onSelectVideo={handleSelectVideo}
            onSelectCreator={handleSelectCreator}
            onToggleWatchlist={toggleWatchlist}
            onOpenCreators={() => handleNavigate('creators')}
          />
        ) : activeSection === 'music' ? (
          <CategoryHubView
            key="music"
            mode="music"
            videos={allVideos}
            watchlistIds={state.watchlistIds}
            getCreatorById={getCreatorById}
            getResumeProgress={getResumeProgress}
            onSelectVideo={handleSelectVideo}
            onSelectCreator={handleSelectCreator}
            onToggleWatchlist={toggleWatchlist}
          />
        ) : activeSection === 'culture' ? (
          <CategoryHubView
            key="culture"
            mode="culture"
            videos={allVideos}
            watchlistIds={state.watchlistIds}
            getCreatorById={getCreatorById}
            getResumeProgress={getResumeProgress}
            onSelectVideo={handleSelectVideo}
            onSelectCreator={handleSelectCreator}
            onToggleWatchlist={toggleWatchlist}
          />
        ) : activeSection === 'creators' ? (
          <CreatorDirectory
            creators={allCreators}
            videos={allVideos}
            subscribedCreatorIds={state.subscribedCreatorIds}
            onSelectCreator={handleSelectCreator}
            onToggleSubscribe={toggleSubscribe}
          />
        ) : (
          <LibraryView
            allVideos={allVideos}
            allCreators={allCreators}
            watchlistIds={state.watchlistIds}
            likedVideoIds={state.likedVideoIds}
            subscribedCreatorIds={state.subscribedCreatorIds}
            history={state.history}
            userVideos={state.userVideos}
            getCreatorById={getCreatorById}
            onSelectVideo={handleSelectVideo}
            onSelectCreator={handleSelectCreator}
            onToggleWatchlist={toggleWatchlist}
            onToggleSubscribe={toggleSubscribe}
            onClearHistory={clearHistory}
            onDeleteUserVideo={deleteUserVideo}
            onOpenPublish={() => setPublishOpen(true)}
            onNavigateDiscover={() => handleNavigate('discover')}
            getResumeProgress={getResumeProgress}
          />
        )}
      </main>

      {/* Quiet Editorial Footer */}
      <footer className="border-t border-white/[0.07] bg-[#09090B]">
        <div className="max-w-[1440px] mx-auto px-4 sm:px-8 py-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-xs text-zinc-500">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="font-display font-semibold text-zinc-200 text-sm">EthioHub</span>
            <span aria-hidden="true">·</span>
            <span>Ethiopian Culture, Music & Independent Creators</span>
            <span aria-hidden="true">·</span>
            <span>Addis Ababa & Worldwide</span>
          </div>

          <div className="flex flex-wrap items-center gap-5">
            <button
              type="button"
              onClick={() => handleNavigate('discover')}
              className="hover:text-zinc-200 transition-colors"
            >
              Discover
            </button>
            <button
              type="button"
              onClick={() => handleNavigate('music')}
              className="hover:text-zinc-200 transition-colors"
            >
              Music
            </button>
            <button
              type="button"
              onClick={() => handleNavigate('culture')}
              className="hover:text-zinc-200 transition-colors"
            >
              Culture
            </button>
            <button
              type="button"
              onClick={() => handleNavigate('creators')}
              className="hover:text-zinc-200 transition-colors"
            >
              Creators
            </button>
            <button
              type="button"
              onClick={() => setPublishOpen(true)}
              className="text-[#E5A91A] hover:underline"
            >
              Publish Video
            </button>
          </div>
        </div>
      </footer>

      <PublishModal
        isOpen={publishOpen}
        defaultCreatorName={state.viewerName}
        onClose={() => setPublishOpen(false)}
        onPublish={handlePublishVideo}
      />
    </div>
  );
}
