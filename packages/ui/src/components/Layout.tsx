import { type ReactNode } from 'react';
import { Nav } from './Nav';
import styles from './Layout.module.css';

export function Layout({ children }: { children: ReactNode }) {
  return (
    <>
      <a href="#main" className="skip-to-content">
        Skip to content
      </a>
      <Nav />
      <main id="main" className={styles.main}>
        {children}
      </main>
      <footer className={styles.footer}>
        <p>
          aega.art ·{' '}
          <a href="https://github.com" rel="noreferrer">
            source
          </a>
        </p>
      </footer>
    </>
  );
}
