import { useEffect, useState } from 'react';
import { ApiArticle, fetchNews } from '@/services/touchlineApi';

/** "3 hours ago" for recent items, a plain SAST date beyond a week. */
const relativeTime = (iso: string) => {
    const then = Date.parse(iso);
    if (Number.isNaN(then)) return '';

    const minutes = Math.round((Date.now() - then) / 60000);
    if (minutes < 1) return 'just now';
    if (minutes < 60) return `${minutes} min ago`;

    const hours = Math.round(minutes / 60);
    if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;

    const days = Math.round(hours / 24);
    if (days <= 7) return `${days} day${days === 1 ? '' : 's'} ago`;

    return new Date(then).toLocaleDateString('en-ZA', {
        timeZone: 'Africa/Johannesburg',
        day: 'numeric',
        month: 'short'
    });
};

const ArticleCard = ({ article }: { article: ApiArticle }) => {
    const [imageFailed, setImageFailed] = useState(false);
    const image = article.imageUrl || article.image;
    const showImage = image && !imageFailed;

    return (
        <li>
            <a
                href={article.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex gap-3 border-b px-3 py-3 transition-colors last:border-b-0 hover:bg-muted/50"
            >
                {showImage && (
                    <img
                        src={image}
                        alt=""
                        loading="lazy"
                        onError={() => setImageFailed(true)}
                        className="h-16 w-20 shrink-0 rounded object-cover"
                    />
                )}

                <span className="min-w-0 flex-1">
                    <span className="line-clamp-2 block text-sm font-medium">{article.title}</span>
                    {article.summary && (
                        <span className="mt-1 line-clamp-2 block text-xs text-muted-foreground">
                            {article.summary}
                        </span>
                    )}
                    <span className="mt-1 block text-xs text-muted-foreground">
                        {article.source?.name}
                        {article.publishedAt && ` · ${relativeTime(article.publishedAt)}`}
                    </span>
                </span>
            </a>
        </li>
    );
};

export const NewsList = () => {
    const [articles, setArticles] = useState<ApiArticle[]>([]);
    const [unavailable, setUnavailable] = useState(false);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;

        fetchNews(10)
            .then((data) => {
                if (cancelled) return;
                setArticles(data.articles);
                setUnavailable(Boolean(data.unavailable));
            })
            .catch((err: Error) => {
                if (!cancelled) setError(err.message);
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });

        return () => {
            cancelled = true;
        };
    }, []);

    if (loading) {
        return <p className="py-10 text-center text-sm text-muted-foreground">Loading news…</p>;
    }

    if (error) {
        return (
            <p className="py-10 text-center text-sm text-destructive">
                Could not load news: {error}
            </p>
        );
    }

    if (unavailable || !articles.length) {
        return (
            <p className="py-10 text-center text-sm text-muted-foreground">
                No news available right now. Headlines appear here once the sync worker has
                published them.
            </p>
        );
    }

    return (
        <ul className="rounded-lg border">
            {articles.map((article, index) => (
                <ArticleCard key={`${article.url}-${index}`} article={article} />
            ))}
        </ul>
    );
};
