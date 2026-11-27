import Image from 'next/image';
import Link from 'next/link';
import { HeaderAccount } from '@/components/HeaderAccount';
import { CubeIcon, GitHubIcon, HeartIcon, PlayIcon } from '@/components/Icons';
import { NotifyForm } from '@/components/NotifyForm';
import { releasedStories, themeLabel } from '@/content/stories';
import { repoUrl } from '@/lib/site';

export default function Home() {
  const demo = releasedStories[0];

  return (
    <div className="home">
      <header className="site-header wrap">
        <Link href="/" className="brand">
          <Image src="/brand/mark.png" alt="" width={32} height={32} />
          <span>STORIES</span>
        </Link>
        <nav className="site-nav" aria-label="Main">
          <Link href="/stories">Stories</Link>
          <a href="#how">About</a>
          <a href={repoUrl}>GitHub</a>
        </nav>
        <div className="site-actions">
          <HeaderAccount />
          <Link href="/watch" className="btn btn-primary btn-sm">
            Start watching
          </Link>
        </div>
      </header>

      <section className="hero wrap">
        <div className="hero-copy">
          <h1>A collection of short interactive films made with Three.js and WebGL.</h1>
          <div className="actions">
            <Link href="/watch" className="btn btn-primary btn-lg">
              <PlayIcon />
              Start watching
            </Link>
            <Link href="/stories" className="btn btn-outline btn-lg">
              <CubeIcon size={18} />
              See all stories
            </Link>
          </div>
        </div>
        <div className="hero-art" aria-hidden>
          <div className="phone phone-back">
            <Image src={demo.stills[2]} alt="" fill sizes="250px" />
          </div>
          <div className="phone phone-front">
            <video src={demo.video} poster={demo.poster} autoPlay muted loop playsInline />
            <div className="phone-caption">
              <strong>{demo.title}</strong>
              <span className="pill pill-solid">Play it live</span>
            </div>
          </div>
        </div>
      </section>

      <section className="band">
        <div className="wrap now">
          <div className="now-head">
            <div>
              <span className="eyebrow">Now showing</span>
              <h2>{demo.title}</h2>
            </div>
            <div className="tags">
              {demo.narrated && <span>Narrated</span>}
              <span>{themeLabel(demo.theme)}</span>
            </div>
          </div>
          <div className="feature">
            <Link href={`/s/${demo.slug}`} className="feature-poster" aria-label={`Watch ${demo.title}`}>
              <Image src={demo.stills[0]} alt="" fill sizes="(max-width: 900px) 100vw, 360px" />
              <span className="play-badge">
                <PlayIcon size={30} />
              </span>
            </Link>
            <div className="feature-copy">
              <blockquote>“{demo.caption}”</blockquote>
              <p className="muted">Watch and help Pip light the lantern yourself.</p>
              <div className="stills">
                {demo.stills.map((src, i) => (
                  <Image key={src} src={src} alt={`Still ${i + 1}`} width={180} height={320} />
                ))}
              </div>
              <div className="actions">
                <Link href={`/s/${demo.slug}`} className="btn btn-primary">
                  Watch the film
                </Link>
                <a href={demo.liveUrl} className="btn btn-outline" target="_blank" rel="noopener">
                  Play it live
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="how" className="wrap how">
        <h2>How it works</h2>
        <div className="how-grid">
          <div className="card">
            <span className="card-icon gold">
              <CubeIcon size={24} />
            </span>
            <h3>Experience</h3>
            <p className="muted">Experience the same story yourself using the live link.</p>
          </div>
          <div className="card">
            <span className="card-icon cyan">
              <HeartIcon size={24} filled />
            </span>
            <h3>Share</h3>
            <p className="muted">Like, comment and share.</p>
          </div>
        </div>
      </section>

      <section id="code" className="wrap how">
        <div className="section-head">
          <h2>Made entirely in code</h2>
          <p className="muted">
            There are no cameras, film sets or animation software behind these stories. Each one is a small program.
            The hills, the sky, the light and the way every character moves are written out as instructions, and the
            film is simply what those instructions look like when a computer runs them.
          </p>
          <p className="muted">
            It works a lot like a video game. A game doesn&apos;t play back a recording. Your computer draws every frame
            as you go, from a world the developers built. These stories are made the same way, except the camera
            follows a script instead of a controller, so the story plays out like a film. And because it&apos;s built
            like a game, you can open the live link and step inside it.
          </p>
        </div>
        <ol className="code-steps">
          <li className="card">
            <span className="step-num">1</span>
            <h3>Build the world</h3>
            <p className="muted">The hills, streets, skies and light are all written in code. The characters are free 3D models, and code tells them how to move.</p>
          </li>
          <li className="card">
            <span className="step-num">2</span>
            <h3>Direct the scene</h3>
            <p className="muted">A script says where the camera goes, who moves, and when the narrator speaks. The voices are generated from the script.</p>
          </li>
          <li className="card">
            <span className="step-num">3</span>
            <h3>Record or play</h3>
            <p className="muted">For the video, a computer plays the story and saves every frame. The live link runs the same code on your screen, so you can step in.</p>
          </li>
        </ol>
        <a href={repoUrl} className="btn btn-outline code-link">
          <GitHubIcon size={18} />
          Read the code
        </a>
      </section>

      <section className="wrap">
        <div className="notify">
          <div>
            <h2>Hear about new stories</h2>
          </div>
          <NotifyForm />
        </div>
      </section>

      <footer className="site-footer">
        <div className="wrap">
          <span>© {new Date().getFullYear()} Toneflix Stories · Open source</span>
          <div className="footer-links">
            <Link href="/stories">All stories</Link>
            <a href={repoUrl}>
              <GitHubIcon size={16} />
              GitHub
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
