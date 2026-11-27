import { repoUrl } from '@/lib/site';

export type ThemeId = 'post-apocalyptic' | 'folklore' | 'city' | 'sci-fi' | 'mystery';

export const themes: { id: ThemeId; label: string }[] = [
  { id: 'post-apocalyptic', label: 'Post-apocalyptic' },
  { id: 'folklore', label: 'Folklore' },
  { id: 'city', label: 'City life' },
  { id: 'sci-fi', label: 'Sci-fi' },
  { id: 'mystery', label: 'Mystery' },
];

type Base = { slug: string; title: string; theme: ThemeId };

export type ReleasedStory = Base & {
  status: 'released';
  narrated: boolean;
  caption: string;
  video: string;
  poster: string;
  stills: string[];
  liveUrl: string;
  sourceUrl: string;
  seconds: number;
  published: string;
};

export type UpcomingStory = Base & { status: 'coming-soon' };

export type Story = ReleasedStory | UpcomingStory;

// The live player is built into public/play (scripts/build-player.mjs).
const liveBase = process.env.NEXT_PUBLIC_LIVE_BASE_URL ?? '/play';
const source = (id: string) => `${repoUrl}/tree/main/src/stories/${id}`;

const released: ReleasedStory[] = [
  {
    slug: 'the-lantern-keeper',
    title: 'The Lantern Keeper (Demo)',
    theme: 'folklore',
    status: 'released',
    narrated: true,
    caption:
      'Every evening, Pip climbed the old hill to wake the great lantern, so that travellers below could find their way home. But tonight, the flame would not catch.',
    video: '/media/lantern-keeper/video.mp4',
    poster: '/media/lantern-keeper/poster.jpg',
    stills: [1, 2, 3, 4].map((n) => `/media/lantern-keeper/still-${n}.jpg`),
    liveUrl: `${liveBase}/stories/lantern-keeper/index.html`,
    sourceUrl: source('lantern-keeper'),
    seconds: 45,
    published: '2026-11-26',
  },
  {
    slug: 'route-7-still-running',
    title: 'Route 7, Still Running',
    theme: 'post-apocalyptic',
    status: 'released',
    narrated: true,
    caption:
      'A retired danfo driver keeps running his route through a flooded, empty Lagos, until one passenger finally flags him down.',
    video: '/media/route-7/video.mp4',
    poster: '/media/route-7/poster.jpg',
    stills: [1, 2, 3, 4].map((n) => `/media/route-7/still-${n}.jpg`),
    liveUrl: `${liveBase}/stories/route-7/index.html`,
    sourceUrl: source('route-7'),
    seconds: 112,
    published: '2026-11-27',
  },
];

const upcoming: Record<ThemeId, string[]> = {
  'post-apocalyptic': [
    'Seed Vault',
    'Signal Fire',
    'Rust Choir',
    'Ash Garden',
    'Generator Night',
    "The Mapmaker's Dog",
    'Before the Water',
  ],
  folklore: [
    'Tortoise at the Sky Party',
    "Anansi's Wi-Fi",
    'Mami Wata Takes the Ferry',
    'The Masquerade Who Missed the Parade',
    "Ogun's Night Shift",
    'Sunshower',
    "Baba Yaga's Ride",
  ],
  city: [
    'One More Seat',
    'Market Day',
    'Rooftop at 2 A.M.',
    'Suya Spot',
    'Light Don Go',
    "The Barber's Chair",
    'Under the Bridge',
    'Laundry Line',
  ],
  'sci-fi': [
    'Unit 9 Waters the Garden',
    'Moon Kid',
    'Hello, Goat',
    'Night Shift at the Array',
    'Satellite Fall',
    'Orbit Mail',
    'Sky Whales',
  ],
  mystery: [
    'The Extra Passenger',
    'Room 14',
    'The Same Morning',
    'Footsteps Upstairs',
    'The Photo Booth',
    'Floor Zero',
    'The Lamp Across the Way',
  ],
};

const slugify = (title: string) =>
  title
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

export const stories: Story[] = [
  ...released,
  ...themes.flatMap(({ id }) =>
    upcoming[id].map((title): UpcomingStory => ({ slug: slugify(title), title, theme: id, status: 'coming-soon' })),
  ),
];

export const releasedStories = released;

export function findReleased(slug: string) {
  return released.find((s) => s.slug === slug);
}

export function themeLabel(id: ThemeId) {
  return themes.find((t) => t.id === id)?.label ?? id;
}
