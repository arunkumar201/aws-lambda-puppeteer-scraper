import { z } from 'zod';

const scrape = {
  body: z.object({
    url: z
      .string()
      .url('Invalid URL format')
      .refine(
        (url) => url.startsWith('https://en.wikipedia.org/wiki/'),
        'Only Wikipedia URLs are allowed'
      ),
  }),
};

export const scrapeValidation = {
  scrape: z.object({
    body: scrape.body,
  }),
};

export type ScrapeInput = z.infer<typeof scrape.body>;
