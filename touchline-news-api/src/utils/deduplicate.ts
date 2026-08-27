export const normalizeTitle = (title: string) =>
  title
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

export const normalizeUrl = (url: string) => {
  try {
    const parsed = new URL(url);
    parsed.hash = '';
    ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'].forEach((key) =>
      parsed.searchParams.delete(key)
    );
    return parsed.toString();
  } catch {
    return url.trim();
  }
};
