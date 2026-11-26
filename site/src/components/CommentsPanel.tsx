'use client';

import { useEffect, useState, type FormEvent } from 'react';
import type { ReleasedStory } from '@/content/stories';
import { api, compact, timeAgo } from '@/lib/client';
import type { CommentView } from '@/lib/social';
import { CloseIcon, HeartIcon, SendIcon, TrashIcon } from './Icons';
import { useAuthGate } from './Providers';
import { Sheet } from './Sheet';

const palette = ['#56BCF9', '#F2B705', '#00CDFF', '#9DB2FF', '#7FD8A0', '#FF8FA0'];
const colorFor = (name: string) => palette[[...name].reduce((a, c) => a + c.charCodeAt(0), 0) % palette.length];

export function CommentsPanel({
  story,
  onClose,
  onCount,
}: {
  story: ReleasedStory;
  onClose: () => void;
  onCount: (n: number) => void;
}) {
  const { signedIn, requireAuth } = useAuthGate();
  const [items, setItems] = useState<CommentView[] | null>(null);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.comments(story.slug).then(setItems).catch(() => setItems([]));
  }, [story.slug, signedIn]);

  const update = (next: CommentView[]) => {
    setItems(next);
    onCount(next.length);
  };

  function post(e: FormEvent) {
    e.preventDefault();
    requireAuth(async () => {
      if (!draft.trim()) return;
      setBusy(true);
      setError('');
      try {
        update(await api.comment(story.slug, draft));
        setDraft('');
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setBusy(false);
      }
    });
  }

  const like = (c: CommentView) =>
    requireAuth(async () => {
      const on = !c.liked;
      setItems((all) => all?.map((x) => (x.id === c.id ? { ...x, liked: on, likes: x.likes + (on ? 1 : -1) } : x)) ?? null);
      await api.likeComment(c.id, on).catch(() => {});
    });

  async function remove(c: CommentView) {
    await api.deleteComment(c.id);
    update((items ?? []).filter((x) => x.id !== c.id));
  }

  return (
    <Sheet label="Comments" onClose={onClose} variant="panel">
      <div className="comments">
        <header className="comments-head">
          <h2>{items ? `${compact(items.length)} ${items.length === 1 ? 'comment' : 'comments'}` : 'Comments'}</h2>
          <button type="button" className="icon-btn" aria-label="Close comments" onClick={onClose}>
            <CloseIcon />
          </button>
        </header>

        <ul className="comments-list">
          {items === null && <li className="muted">Loading…</li>}
          {items?.length === 0 && <li className="muted comments-empty">No comments yet.</li>}
          {items?.map((c) => (
            <li key={c.id} className="comment">
              {c.author.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img className="avatar" src={c.author.image} alt="" />
              ) : (
                <span className="avatar" style={{ background: colorFor(c.author.name) }} aria-hidden>
                  {c.author.name[0]?.toUpperCase()}
                </span>
              )}
              <div className="comment-body">
                <span className="comment-meta">
                  <strong>{c.author.name}</strong> · {timeAgo(c.createdAt)}
                </span>
                <p>{c.body}</p>
                {c.mine && (
                  <button type="button" className="btn-text btn-xs" onClick={() => remove(c)}>
                    <TrashIcon /> Delete
                  </button>
                )}
              </div>
              <button
                type="button"
                className={c.liked ? 'comment-like liked' : 'comment-like'}
                aria-pressed={c.liked}
                aria-label="Like comment"
                onClick={() => like(c)}
              >
                <HeartIcon size={16} filled={c.liked} />
                {c.likes > 0 && compact(c.likes)}
              </button>
            </li>
          ))}
        </ul>

        <form className="composer" onSubmit={post}>
          <label htmlFor="comment-input" className="sr-only">
            Add a comment
          </label>
          <input
            id="comment-input"
            value={draft}
            maxLength={500}
            placeholder={signedIn ? 'Add a comment…' : 'Sign in to comment'}
            onChange={(e) => setDraft(e.target.value)}
            onFocus={() => !signedIn && requireAuth(() => {})}
          />
          <button type="submit" className="round-btn primary" aria-label="Post comment" disabled={busy}>
            <SendIcon />
          </button>
          {error && <p className="form-error">{error}</p>}
        </form>
      </div>
    </Sheet>
  );
}
