import { useState } from 'react';
import { Menu, X } from 'lucide-react';
import { AppSection } from '../types/ethiohub';

interface TopNavProps {
  activeSection: AppSection;
  onNavigate: (section: AppSection) => void;
  onOpenPublish: () => void;
}

const NAV_ITEMS: { id: AppSection; label: string }[] = [
  { id: 'discover', label: 'Discover' },
  { id: 'music', label: 'Music' },
  { id: 'culture', label: 'Culture' },
  { id: 'creators', label: 'Creators' },
  { id: 'library', label: 'Library' },
];

export function TopNav({ activeSection, onNavigate, onOpenPublish }: TopNavProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleSelect = (section: AppSection) => {
    onNavigate(section);
    setMobileMenuOpen(false);
  };

  return (
    <header className="sticky top-0 z-40 bg-[#09090B]/92 backdrop-blur-md border-b border-white/[0.07]">
      <div className="max-w-[1440px] mx-auto px-4 sm:px-8 h-16 flex items-center justify-between gap-8">
        {/* Zone 1: Single text element wordmark */}
        <button
          type="button"
          onClick={() => handleSelect('discover')}
          className="font-display text-xl font-bold tracking-tight text-zinc-50 hover:text-[#E5A91A] transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E5A91A] rounded-sm"
        >
          EthioHub
        </button>

        {/* Zone 2: 5 clean single-line text navigation links */}
        <nav
          aria-label="Primary"
          className="hidden md:flex items-center gap-7 text-sm font-medium text-zinc-400"
        >
          {NAV_ITEMS.map((item) => {
            const isActive = activeSection === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleSelect(item.id)}
                className={`relative py-2 transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E5A91A] rounded-sm ${
                  isActive
                    ? 'text-zinc-50'
                    : 'text-zinc-400 hover:text-zinc-100'
                }`}
              >
                {item.label}
                <span
                  aria-hidden="true"
                  className={`absolute left-0 right-0 -bottom-[17px] h-[2px] bg-[#E5A91A] transition-opacity duration-150 ${
                    isActive ? 'opacity-100' : 'opacity-0'
                  }`}
                />
              </button>
            );
          })}
        </nav>

        {/* Zone 3: 1 primary action (with mobile drawer trigger on small screens) */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={onOpenPublish}
            className="px-4 py-2 text-sm font-semibold text-zinc-950 bg-[#E5A91A] hover:bg-[#F2B705] active:scale-[0.98] rounded-lg transition-all duration-150 whitespace-nowrap shrink-0 min-h-[40px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E5A91A] focus-visible:ring-offset-2 focus-visible:ring-offset-[#09090B]"
          >
            Publish Video
          </button>

          <button
            type="button"
            onClick={() => setMobileMenuOpen((v) => !v)}
            aria-label={mobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
            aria-expanded={mobileMenuOpen}
            className="md:hidden inline-flex items-center justify-center w-11 h-11 rounded-lg text-zinc-300 hover:text-white hover:bg-white/[0.06] transition-colors"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile navigation drawer */}
      {mobileMenuOpen && (
        <nav
          aria-label="Mobile Navigation"
          className="md:hidden border-t border-white/[0.07] bg-[#0D0D11] px-4 py-3 flex flex-col gap-1"
        >
          {NAV_ITEMS.map((item) => {
            const isActive = activeSection === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleSelect(item.id)}
                className={`w-full text-left px-3 py-3 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-white/[0.06] text-[#E5A91A]'
                    : 'text-zinc-300 hover:bg-white/[0.04] hover:text-white'
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </nav>
      )}
    </header>
  );
}
