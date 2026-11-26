import type { CommentView, StoryState } from './social';

async function call<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: init?.body ? { 'Content-Type': 'application/json' } : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error ?? 'Something went wrong');
  return data as T;
}

const story = (slug: string) => `/api/stories/${encodeURIComponent(slug)}`;

export const api = {
  state: (slug: string) => call<StoryState>(story(slug)),
  like: (slug: string, on: boolean) => call<StoryState>(`${story(slug)}/like`, { method: on ? 'PUT' : 'DELETE' }),
  save: (slug: string, on: boolean) => call<StoryState>(`${story(slug)}/save`, { method: on ? 'PUT' : 'DELETE' }),
  share: (slug: string, channel: string) =>
    call<StoryState>(`${story(slug)}/share`, { method: 'POST', body: JSON.stringify({ channel }) }),
  comments: (slug: string) => call<CommentView[]>(`${story(slug)}/comments`),
  comment: (slug: string, body: string) =>
    call<CommentView[]>(`${story(slug)}/comments`, { method: 'POST', body: JSON.stringify({ body }) }),
  deleteComment: (id: string) => call<{ ok: true }>(`/api/comments/${id}`, { method: 'DELETE' }),
  likeComment: (id: string, on: boolean) =>
    call<{ ok: true }>(`/api/comments/${id}/like`, { method: on ? 'PUT' : 'DELETE' }),
  subscribe: (email: string) => call<{ ok: true }>('/api/subscribe', { method: 'POST', body: JSON.stringify({ email }) }),
};

export function compact(n: number) {
  if (n < 1000) return String(n);
  if (n < 1_000_000) return `${Math.round(n / 100) / 10}K`;
  return `${Math.round(n / 100_000) / 10}M`;
}

export function timeAgo(iso: string) {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return 'now';
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  if (s < 604800) return `${Math.floor(s / 86400)}d`;
  return new Date(iso).toLocaleDateString();
}
