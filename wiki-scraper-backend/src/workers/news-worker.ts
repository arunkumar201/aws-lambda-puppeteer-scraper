import { NewsJobSchema, ScrapeAction, ScrapeResult } from '../types/job.types';
import { SQSClient, SendMessageCommand } from '@aws-sdk/client-sqs';
import { logger } from '../utils/logger';
import { Browser } from 'puppeteer-core';
import { NewsScraper } from '../scraper/news-scraper';

const sqs = new SQSClient({ region: process.env.AWS_REGION || 'ap-south-1' });
const RESULTS_QUEUE_URL = process.env.RESULTS_QUEUE_URL || 'aws-lambda-result-queue';

export class NewsWorkerProcessor {
  public async processJob(browser: Browser, rawJob: ScrapeAction): Promise<ScrapeResult | null> {
    try {
      const { action, payload } = rawJob;

      if (action !== 'news') {
        logger.warn(`NewsWorkerProcessor received non-news job action: ${action}`);
        // eslint-disable-next-line no-console
        console.log('Invalid job action for NewsWorkerProcessor');
        return null;
      }

      const parsedPayload = NewsJobSchema.safeParse(payload);
      if (!parsedPayload.success) {
        logger.error(`Invalid payload for news job:`, {
          errors: parsedPayload.error.errors,
          recordBody: rawJob,
        });
        throw new Error('Invalid payload for News job');
      }

      const job = parsedPayload.data;
      const scraper = new NewsScraper();

      logger.info(`Processing news job_id: ${job.job_id || 'N/A'}`);

      const scrapeResult: ScrapeResult = await scraper.scrape(browser, job);

      await sqs.send(
        new SendMessageCommand({
          QueueUrl: RESULTS_QUEUE_URL,
          MessageBody: JSON.stringify({
            job_id: job.job_id,
            action,
            result: scrapeResult,
          }),
        })
      );
      logger.info(`Scrape result sent to results queue for news job_id: ${job.job_id || 'N/A'}`);
      return scrapeResult;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : JSON.stringify(error);
      const errorStack = error instanceof Error ? error.stack : undefined;

      logger.error('Error processing News job in NewsWorkerProcessor:', {
        error: errorMessage,
        stack: errorStack,
        rawJob,
      });

      throw new Error(`NewsWorkerProcessor failed: ${errorMessage}`);
    }
  }
}
