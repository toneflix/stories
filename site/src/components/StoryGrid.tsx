'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useState } from 'react';
import { themeLabel, themes, type Story, type ThemeId } from '@/content/stories';

export function StoryGrid({ stories, filters = true }: { stories: Story[]; filters?: boolean }) {
  const [theme, setTheme] = useState<ThemeId | 'all'>('all');
  const shown = theme === 'all' ? stories : stories.filter((s) => s.theme === theme);
  const chips: { id: ThemeId | 'all'; label: string }[] = [{ id: 'all', label: 'All' }, ...themes];

  return (
    <>
      {filters && (
        <div className="chips" role="group" aria-label="Filter by theme">
          {chips.map((c) => (
            <button
              key={c.id}
              type="button"
              className={theme === c.id ? 'chip active' : 'chip'}
              aria-pressed={theme === c.id}
              onClick={() => setTheme(c.id)}
            >
              {c.label}
            </button>
          ))}
        </div>
      )}
      <ul className="grid">
        {shown.map((s) =>
          s.status === 'released' ? (
            <li key={s.slug}>
              <Link href={`/s/${s.slug}`} className="tile">
                <Image src={s.poster} alt="" fill sizes="(max-width: 900px) 33vw, 220px" />
                <span className="tile-info">
                  <strong>{s.title}</strong>
                  <span>
                    {themeLabel(s.theme)}
                  </span>
                </span>
              </Link>
            </li>
          ) : (
            <li key={s.slug}>
              <div className="tile tile-soon" aria-disabled="true">
                <span className="tile-info">
                  <strong>{s.title}</strong>
                  <span>
                    <span className="hide-sm">{themeLabel(s.theme)} · </span>Coming soon
                  </span>
                </span>
              </div>
            </li>
          ),
        )}
      </ul>
    </>
  );
}
