import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Overview' };

const platforms = [
  { name: 'Slack', status: 'idle', port: 3001 },
  { name: 'Teams', status: 'idle', port: 3002 },
  { name: 'Discord', status: 'idle', port: 3003 },
] as const;

export default function DashboardPage() {
  return (
    <main style={{ padding: '2rem', maxWidth: '960px', margin: '0 auto' }}>
      <h1 style={{ fontSize: '1.75rem', fontWeight: 700 }}>Spann Dashboard</h1>
      <p style={{ color: 'var(--color-muted)' }}>
        Accessibility plugin management across Slack, Teams, and Discord.
      </p>

      <section aria-labelledby="platforms-heading" style={{ marginTop: '2rem' }}>
        <h2 id="platforms-heading" style={{ fontSize: '1.25rem', marginBottom: '1rem' }}>
          Platform Connectors
        </h2>
        <ul role="list" style={{ listStyle: 'none', padding: 0, display: 'grid', gap: '1rem', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}>
          {platforms.map((p) => (
            <li key={p.name} style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius)', padding: '1.25rem' }}>
              <strong>{p.name}</strong>
              <span style={{ display: 'block', color: 'var(--color-muted)', fontSize: '0.875rem', marginTop: '0.25rem' }}>
                Status: {p.status} · Port {p.port}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
