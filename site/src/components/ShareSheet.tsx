'use client';

import { type ReactNode, useEffect, useState } from 'react';
import type { ReleasedStory } from '@/content/stories';
import { api } from '@/lib/client';
import type { StoryState } from '@/lib/social';
import { CloseIcon, DownloadIcon, FacebookIcon, LinkIcon, MailIcon, ShareIcon, TelegramIcon, WhatsAppIcon, XIcon } from './Icons';
import { Sheet } from './Sheet';

type Target = { id: string; label: string; Icon: (p: { size?: number }) => ReactNode; size: number; href: (url: string, text: string) => string };

const targets: Target[] = [
  { id: 'whatsapp', label: 'WhatsApp', Icon: WhatsAppIcon, size: 30, href: (u, t) => `https://wa.me/?text=${encodeURIComponent(`${t} ${u}`)}` },
  { id: 'x', label: 'X', Icon: XIcon, size: 22, href: (u, t) => `https://x.com/intent/post?url=${encodeURIComponent(u)}&text=${encodeURIComponent(t)}` },
  { id: 'facebook', label: 'Facebook', Icon: FacebookIcon, size: 56, href: (u) => `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(u)}` },
  { id: 'telegram', label: 'Telegram', Icon: TelegramIcon, size: 56, href: (u, t) => `https://t.me/share/url?url=${encodeURIComponent(u)}&text=${encodeURIComponent(t)}` },
  { id: 'email', label: 'Email', Icon: MailIcon, size: 22, href: (u, t) => `mailto:?subject=${encodeURIComponent(t)}&body=${encodeURIComponent(u)}` },
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
              href={t.href(url, text)}
              target="_blank"
              rel="noopener"
              onClick={() => record(t.id)}
            >
              <span className={`share-mark mark-${t.id}`}><t.Icon size={t.size} /></span>
              {t.label}
            </a>
          ))}
          <a className="share-target" href={story.video} download={`${story.slug}.mp4`}>
            <span className="share-mark">
              <DownloadIcon size={22} />
            </span>
            Download
          </a>
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
