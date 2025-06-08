import { z } from 'zod';

export const WikipediaJobSchema = z.object({
  user_id: z.string().min(1),
  url: z.string().url(),
  job_id: z.string().optional(),
  metadata: z.record(z.any()).optional(),
});

export const NewsJobSchema = z.object({
  user_id: z.string().min(1),
  url: z.string().url(),
  job_id: z.string().optional(),
  metadata: z.record(z.any()).optional(),
});

export type WikipediaJob = z.infer<typeof WikipediaJobSchema>;
export type NewsJob = z.infer<typeof NewsJobSchema>;

export interface ScrapeResponse {
  screenshotKey: string;
  markdown: string;
  links: string[];
}
