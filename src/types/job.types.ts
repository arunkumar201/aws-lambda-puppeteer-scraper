import { z } from 'zod';

export const WikipediaJobSchema = z.object({
  user_id: z.string().min(1),
  url: z.string().url(),
  job_id: z.string().optional(),
  metadata: z.record(z.any()).optional(),
});
export type WikipediaJob = z.infer<typeof WikipediaJobSchema>;

export const NewsJobSchema = z.object({
  user_id: z.string().min(1),
  url: z.string().url(),
  job_id: z.string().optional(),
  metadata: z.record(z.any()).optional(),
});
export type NewsJob = z.infer<typeof NewsJobSchema>;

export interface ScrapeResult {
  screenshot: string;
  markdown: string;
  links: string[];
}

// New schema for a single scrape action, combining common fields
export const ScrapeActionSchema = z.object({
  site_type: z.union([z.literal('wikipedia'), z.literal('news')]),
  user_id: z.string().min(1),
  url: z.string().url(),
  metadata: z.record(z.any()).optional(),
  job_id: z.string().optional(), 
});

export type ScrapeAction = z.infer<typeof ScrapeActionSchema>;

// Schema for a batch request (array of ScrapeActionSchema)
export const ScrapeBatchRequestSchema = z.array(ScrapeActionSchema);

export type ScrapeBatchRequest = z.infer<typeof ScrapeBatchRequestSchema>;
