process.env.NODE_ENV = 'test';
process.env.DATABASE_URL ||= 'postgresql://touchline:touchline@localhost:5432/touchline_news_test';
process.env.GNEWS_API_KEY ||= '';
process.env.NEWS_SYNC_ENABLED ||= 'false';
