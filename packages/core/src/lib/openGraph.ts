export interface OpenGraphMeta {
  title: string;
  description: string;
  image: string;
  url: string;
  type?: string;
}

const MAX_DESCRIPTION_LENGTH = 180;

export function imageOpenGraphMeta(opts: {
  prompt: string;
  imageUrl: string;
  pageUrl: string;
  elo?: number;
  votes?: number;
}): OpenGraphMeta {
  const stats = [
    typeof opts.elo === 'number' ? `${Math.round(opts.elo)} ELO` : null,
    typeof opts.votes === 'number' ? `${opts.votes} votes` : null,
  ].filter(Boolean);
  const description =
    stats.length > 0 ? `${truncate(opts.prompt)} - ${stats.join(' - ')}` : truncate(opts.prompt);

  return {
    title: 'aega.art Image',
    description,
    image: opts.imageUrl,
    url: opts.pageUrl,
    type: 'article',
  };
}

export function injectOpenGraphMeta(html: string, meta: OpenGraphMeta): string {
  return [
    ['property', 'og:type', meta.type ?? 'website'],
    ['property', 'og:title', meta.title],
    ['property', 'og:description', meta.description],
    ['property', 'og:image', meta.image],
    ['property', 'og:url', meta.url],
    ['name', 'twitter:title', meta.title],
    ['name', 'twitter:description', meta.description],
    ['name', 'twitter:image', meta.image],
  ].reduce(
    (current, [kind, key, value]) => replaceMeta(current, kind, key, value),
    replaceMeta(html, 'name', 'description', meta.description)
  );
}

function replaceMeta(html: string, kind: string, key: string, value: string): string {
  const escapedValue = escapeAttribute(value);
  const pattern = new RegExp(`<meta ${kind}="${escapeRegExp(key)}" content="[^"]*"\\s*/>`);
  const replacement = `<meta ${kind}="${key}" content="${escapedValue}" />`;
  if (pattern.test(html)) return html.replace(pattern, replacement);
  return html.replace('</head>', `    ${replacement}\n  </head>`);
}

function truncate(value: string): string {
  const normalized = value.replace(/\s+/g, ' ').trim();
  if (normalized.length <= MAX_DESCRIPTION_LENGTH) return normalized;
  return `${normalized.slice(0, MAX_DESCRIPTION_LENGTH - 1).trim()}...`;
}

function escapeAttribute(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
