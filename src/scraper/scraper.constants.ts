import { WikipediaJobSchema, NewsJobSchema } from '../types/job.types';
import { WikipediaScraper } from './wikipedia-scraper';
import { NewsScraper } from './news-scraper';

export const SCRAPE_ACTIONS = ['wikipedia', 'news'] as const;
export type ScrapeActionType = (typeof SCRAPE_ACTIONS)[number];

export const SCRAPER_MAP = {
  wikipedia: {
    schema: WikipediaJobSchema,
    scraper: WikipediaScraper,
  },
  news: {
    schema: NewsJobSchema,
    scraper: NewsScraper,
  },
} as const;
