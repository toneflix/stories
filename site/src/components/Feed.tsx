'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { themeLabel, type ReleasedStory } from '@/content/stories';
import { api, compact } from '@/lib/client';
import type { StoryState } from '@/lib/social';
import { CommentsPanel } from './CommentsPanel';
import {
  BookmarkIcon,
  ChevronIcon,
  CommentIcon,
  CubeIcon,
  ForkIcon,
  HeartIcon,
  PauseIcon,
  PlayIcon,
  ShareIcon,
  VolumeIcon,
} from './Icons';
import { useAuthGate } from './Providers';
import { ShareSheet } from './ShareSheet';

const emptyState: StoryState = { likes: 0, comments: 0, saves: 0, shares: 0, liked: false, saved: false };

export function Feed({ stories, startSlug }: { stories: ReleasedStory[]; startSlug?: string }) {
  const scroller = useRef<HTMLDivElement>(null);
  const [muted, setMuted] = useState(false);
  // Set when the browser refused to autoplay with sound; the first tap or key press turns sound back on.
  const [autoMuted, setAutoMuted] = useState(false);
  const [active, setActive] = useState(0);
  const [comments, setComments] = useState<ReleasedStory | null>(null);
  const [share, setShare] = useState<ReleasedStory | null>(null);
  const [states, setStates] = useState<Record<string, StoryState>>({});

  const setState = useCallback((slug: string, s: StoryState) => setStates((all) => ({ ...all, [slug]: s })), []);

  useEffect(() => {
    stories.forEach((s) => api.state(s.slug).then((st) => setState(s.slug, st)).catch(() => {}));
  }, [stories, setState]);

  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const start = startSlug ? stories.findIndex((s) => s.slug === startSlug) : 0;
    if (start > 0) el.children[start]?.scrollIntoView({ behavior: 'instant' as ScrollBehavior });
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) setActive(Number((e.target as HTMLElement).dataset.index));
        }
      },
      { root: el, threshold: 0.6 },
    );
    Array.from(el.children).forEach((c) => io.observe(c));
    return () => io.disconnect();
  }, [stories, startSlug]);

  const autoplayBlocked = useCallback(() => {
    setMuted(true);
    setAutoMuted(true);
  }, []);

  useEffect(() => {
    if (!autoMuted) return;
    const unmute = () => {
      setMuted(false);
      setAutoMuted(false);
    };
    window.addEventListener('pointerdown', unmute, { once: true });
    window.addEventListener('keydown', unmute, { once: true });
    return () => {
      window.removeEventListener('pointerdown', unmute);
      window.removeEventListener('keydown', unmute);
    };
  }, [autoMuted]);

  const go = (delta: number) => {
    const el = scroller.current;
    const next = Math.min(Math.max(active + delta, 0), el ? el.children.length - 1 : 0);
    el?.children[next]?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className="feed">
      <div className="feed-scroller" ref={scroller}>
        {stories.map((story, i) => (
          <FeedItem
            key={story.slug}
            index={i}
            story={story}
            active={i === active}
            muted={muted}
            onToggleMute={() => {
              setAutoMuted(false);
              setMuted((m) => !m);
            }}
            onAutoplayBlocked={autoplayBlocked}
            state={states[story.slug] ?? emptyState}
            onState={(s) => setState(story.slug, s)}
            onComments={() => setComments(story)}
            onShare={() => setShare(story)}
          />
        ))}
        <section className="feed-item" data-index={stories.length} aria-label="End of feed">
          <div className="feed-frame feed-end">
            <h2>More coming soon</h2>
            <Link href="/stories" className="btn btn-light">
              See all stories
            </Link>
          </div>
        </section>
      </div>

      <div className="feed-nav">
        <button type="button" className="round-btn" aria-label="Previous story" onClick={() => go(-1)} disabled={active === 0}>
          <ChevronIcon dir="up" />
        </button>
        <button
          type="button"
          className="round-btn"
          aria-label="Next story"
          onClick={() => go(1)}
          disabled={active >= stories.length}
        >
          <ChevronIcon />
        </button>
      </div>

      {comments && (
        <CommentsPanel
          story={comments}
          onClose={() => setComments(null)}
          onCount={(n) =>
            setStates((all) => ({ ...all, [comments.slug]: { ...(all[comments.slug] ?? emptyState), comments: n } }))
          }
        />
      )}
      {share && (
        <ShareSheet story={share} onClose={() => setShare(null)} onShared={(s) => setState(share.slug, s)} />
      )}
    </div>
  );
}

function FeedItem({
  index,
  story,
  active,
  muted,
  onToggleMute,
  onAutoplayBlocked,
  state,
  onState,
  onComments,
  onShare,
}: {
  index: number;
  story: ReleasedStory;
  active: boolean;
  muted: boolean;
  onToggleMute: () => void;
  onAutoplayBlocked: () => void;
  state: StoryState;
  onState: (s: StoryState) => void;
  onComments: () => void;
  onShare: () => void;
}) {
  const video = useRef<HTMLVideoElement>(null);
  const { requireAuth } = useAuthGate();
  const [paused, setPaused] = useState(false);
  const [progress, setProgress] = useState(0);
  const [captionHidden, setCaptionHidden] = useState(false);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    const v = video.current;
    if (!v) return;
    if (!active || paused) {
      v.pause();
      return;
    }
    v.muted = muted;
    v.play().catch((err: DOMException) => {
      if (err.name === 'NotAllowedError' && !muted) onAutoplayBlocked();
      else if (err.name !== 'AbortError') setPaused(true);
    });
  }, [active, paused, muted, onAutoplayBlocked]);

  const toggle = (key: 'liked' | 'saved') =>
    requireAuth(async () => {
      const on = !state[key];
      const countKey = key === 'liked' ? 'likes' : 'saves';
      onState({ ...state, [key]: on, [countKey]: state[countKey] + (on ? 1 : -1) });
      try {
        onState(await (key === 'liked' ? api.like : api.save)(story.slug, on));
      } catch {
        onState(state);
      }
    });

  return (
    <section className="feed-item" data-index={index} aria-label={story.title}>
      <div className="feed-frame">
        <video
          ref={video}
          className="feed-video"
          src={story.video}
          poster={story.poster}
          muted={muted}
          loop
          playsInline
          preload={index === 0 ? 'auto' : 'metadata'}
          onTimeUpdate={(e) => setProgress(e.currentTarget.currentTime / (e.currentTarget.duration || 1))}
          onClick={() => setPaused((p) => !p)}
        />
        {paused && (
          <button type="button" className="feed-paused" aria-label="Play" onClick={() => setPaused(false)}>
            <PlayIcon size={34} />
          </button>
        )}

        <div className="feed-top">
          <button type="button" className="round-btn glass" aria-label={paused ? 'Play' : 'Pause'} onClick={() => setPaused((p) => !p)}>
            {paused ? <PlayIcon /> : <PauseIcon />}
          </button>
          <button type="button" className="round-btn glass" aria-label={muted ? 'Unmute' : 'Mute'} onClick={onToggleMute}>
            <VolumeIcon muted={muted} />
          </button>
        </div>

        {captionHidden ? (
          <button type="button" className="caption-pill" onClick={() => setCaptionHidden(false)}>
            <ChevronIcon dir="up" size={14} />
            {story.title}
          </button>
        ) : (
          <div className="caption">
            <div className="caption-meta">
              <span>
                <strong>@toneflix</strong> · {themeLabel(story.theme)}
              </span>
              <button type="button" className="caption-hide" onClick={() => setCaptionHidden(true)}>
                <ChevronIcon size={14} />
                Hide
              </button>
            </div>
            <h2 className="caption-title">{story.title}</h2>
            <p className={expanded ? 'caption-text' : 'caption-text clamp'} onClick={() => setExpanded((x) => !x)}>
              {story.caption}
            </p>
            <a className="btn btn-primary btn-sm" href={story.liveUrl} target="_blank" rel="noopener">
              <CubeIcon size={16} />
              Play it live
            </a>
          </div>
        )}

        <Scrubber video={video} progress={progress} onSeek={setProgress} />
      </div>

      <div className="rail">
        <button type="button" className="rail-btn" aria-pressed={state.liked} aria-label="Like" onClick={() => toggle('liked')}>
          <span className={state.liked ? 'rail-icon liked' : 'rail-icon'}>
            <HeartIcon size={26} filled={state.liked} />
          </span>
          {compact(state.likes)}
        </button>
        <button type="button" className="rail-btn" aria-label="Comments" onClick={onComments}>
          <span className="rail-icon">
            <CommentIcon size={24} />
          </span>
          {compact(state.comments)}
        </button>
        <button type="button" className="rail-btn" aria-pressed={state.saved} aria-label="Save" onClick={() => toggle('saved')}>
          <span className={state.saved ? 'rail-icon saved' : 'rail-icon'}>
            <BookmarkIcon size={24} filled={state.saved} />
          </span>
          {compact(state.saves)}
        </button>
        <a className="rail-btn" href={story.sourceUrl} target="_blank" rel="noopener" aria-label="View the code on GitHub">
          <span className="rail-icon">
            <ForkIcon size={24} />
          </span>
        </a>
        <button type="button" className="rail-btn" aria-label="Share" onClick={onShare}>
          <span className="rail-icon">
            <ShareIcon size={24} />
          </span>
          {compact(state.shares)}
        </button>
      </div>
    </section>
  );
}

function Scrubber({
  video,
  progress,
  onSeek,
}: {
  video: React.RefObject<HTMLVideoElement | null>;
  progress: number;
  onSeek: (p: number) => void;
}) {
  const bar = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);

  const seekTo = (p: number) => {
    const v = video.current;
    if (!v || !v.duration) return;
    const clamped = Math.min(Math.max(p, 0), 1);
    v.currentTime = clamped * v.duration;
    onSeek(clamped);
  };
  const seekToPointer = (e: React.PointerEvent) => {
    const r = bar.current?.getBoundingClientRect();
    if (r) seekTo((e.clientX - r.left) / r.width);
  };

  return (
    <div
      ref={bar}
      className={dragging ? 'scrubber dragging' : 'scrubber'}
      role="slider"
      tabIndex={0}
      aria-label="Seek"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(progress * 100)}
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        setDragging(true);
        seekToPointer(e);
      }}
      onPointerMove={(e) => dragging && seekToPointer(e)}
      onPointerUp={() => setDragging(false)}
      onPointerCancel={() => setDragging(false)}
      onKeyDown={(e) => {
        const d = video.current?.duration;
        if (!d) return;
        if (e.key === 'ArrowRight') seekTo(progress + 5 / d);
        else if (e.key === 'ArrowLeft') seekTo(progress - 5 / d);
        else return;
        e.preventDefault();
      }}
    >
      <div className="scrubber-track">
        <div className="scrubber-fill" style={{ width: `${progress * 100}%` }} />
        <div className="scrubber-thumb" style={{ left: `${progress * 100}%` }} />
      </div>
    </div>
  );
}
