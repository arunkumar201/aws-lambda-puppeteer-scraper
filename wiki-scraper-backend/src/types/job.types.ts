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

export type ScrapeAction = {
  action: 'wikipedia' | 'news';
  payload: (WikipediaJob | NewsJob) & { job_id: string };
};
