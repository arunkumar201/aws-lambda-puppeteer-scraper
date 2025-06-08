import { z } from 'zod';

export const ScrapeActionSchema = z.object({
  action: z.enum(['wikipedia', 'news']),
  payload: z.record(z.any()),
});
export type ScrapeAction = z.infer<typeof ScrapeActionSchema>;

export const ScrapeBatchRequestSchema = z.object({
  jobs: z.array(ScrapeActionSchema),
});
export type ScrapeBatchRequest = z.infer<typeof ScrapeBatchRequestSchema>;

export interface ScrapeBatchResponse {
  results: Array<{
    action: string;
    success: boolean;
    data?: any;
    error?: string;
  }>;
}
