'use client';

import { useEffect, useState } from 'react';
import type { ReleasedStory } from '@/content/stories';
import { api } from '@/lib/client';
import type { StoryState } from '@/lib/social';
import { CloseIcon, LinkIcon, MailIcon, ShareIcon } from './Icons';
import { Sheet } from './Sheet';

type Target = { id: string; label: string; mark?: string; href?: (url: string, text: string) => string };

const targets: Target[] = [
  { id: 'whatsapp', label: 'WhatsApp', mark: 'W', href: (u, t) => `https://wa.me/?text=${encodeURIComponent(`${t} ${u}`)}` },
  { id: 'x', label: 'X', mark: 'X', href: (u, t) => `https://x.com/intent/post?url=${encodeURIComponent(u)}&text=${encodeURIComponent(t)}` },
  { id: 'facebook', label: 'Facebook', mark: 'f', href: (u) => `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(u)}` },
  { id: 'telegram', label: 'Telegram', mark: 'T', href: (u, t) => `https://t.me/share/url?url=${encodeURIComponent(u)}&text=${encodeURIComponent(t)}` },
  { id: 'email', label: 'Email', href: (u, t) => `mailto:?subject=${encodeURIComponent(t)}&body=${encodeURIComponent(u)}` },
];

export function ShareSheet({
  story,
  onClose,
  onShared,
}: {
  story: ReleasedStory;
  onClose: () => void;
  onShared: (s: StoryState) => void;
}) {
  const [url, setUrl] = useState('');
  const [copied, setCopied] = useState(false);
  const [canNative, setCanNative] = useState(false);
  const text = `${story.title} on Toneflix Stories`;

  useEffect(() => {
    setUrl(`${window.location.origin}/s/${story.slug}`);
    setCanNative(typeof navigator.share === 'function');
  }, [story.slug]);

  const record = (channel: string) => api.share(story.slug, channel).then(onShared).catch(() => {});

  async function copy() {
    await navigator.clipboard.writeText(url).catch(() => {});
    setCopied(true);
    record('link');
  }

  async function native() {
    try {
      await navigator.share({ title: story.title, text, url });
      record('native');
    } catch {}
  }

  return (
    <Sheet label={`Share ${story.title}`} onClose={onClose} variant="dialog">
      <div className="share">
        <header className="share-head">
          <h2>Share {story.title}</h2>
          <button type="button" className="icon-btn" aria-label="Close" onClick={onClose}>
            <CloseIcon />
          </button>
        </header>
        <div className="share-grid">
          {targets.map((t) => (
            <a
              key={t.id}
              className="share-target"
              href={t.href?.(url, text)}
              target="_blank"
              rel="noopener"
              onClick={() => record(t.id)}
            >
              <span className={`share-mark mark-${t.id}`}>{t.mark ?? <MailIcon size={20} />}</span>
              {t.label}
            </a>
          ))}
          {canNative && (
            <button type="button" className="share-target" onClick={native}>
              <span className="share-mark mark-more">
                <ShareIcon size={20} />
              </span>
              More
            </button>
          )}
        </div>
        <div className="share-link">
          <LinkIcon size={18} />
          <span>{url.replace(/^https?:\/\//, '')}</span>
          <button type="button" className="btn btn-primary btn-sm" onClick={copy}>
            {copied ? 'Copied' : 'Copy link'}
          </button>
        </div>
      </div>
    </Sheet>
  );
}
