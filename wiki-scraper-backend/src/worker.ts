import { SQSEvent, SQSHandler } from 'aws-lambda';
import { BrowserFactory } from './scraper/browser-factory';
import { WikipediaJobSchema, NewsJobSchema, ScrapeAction, ScrapeResult } from './types/job.types';
import { logger } from './utils/logger';
import { Browser } from 'puppeteer-core';
import { z } from 'zod';
import { WikipediaWorkerProcessor } from './workers/wikipedia-worker';
import { NewsWorkerProcessor } from './workers/news-worker';

const scraperMap: Record<ScrapeAction['action'], { processor: unknown; schema: unknown }> = {
  wikipedia: {
    processor: WikipediaWorkerProcessor,
    schema: WikipediaJobSchema,
  },
  news: {
    processor: NewsWorkerProcessor,
    schema: NewsJobSchema,
  },
};

export const handler: SQSHandler = async (event: SQSEvent) => {
  const browserFactory = new BrowserFactory();
  let browser: Browser | null = null;

  try {
    browser = (await browserFactory.createBrowser()) as Browser;
    logger.info('Browser launched successfully in worker.', typeof event.Records);

    if (!event.Records || !Array.isArray(event.Records)) {
      logger.error('Invalid SQS event format: event.Records is not an iterable array.', {
        event,
      });
      return;
    }

    for (const record of event.Records) {
      try {
        const rawBody = JSON.parse(record.body);
        const { action, payload } = rawBody as ScrapeAction;

        const scraperEntry = scraperMap[action];
        if (!scraperEntry) {
          logger.warn(`Unknown action type: ${action}`, { recordBody: rawBody });
          continue;
        }

        const schema = scraperEntry.schema as z.ZodType;
        const parsedPayload = schema.safeParse(payload);
        if (!parsedPayload.success) {
          logger.error(`Invalid payload for action ${action}:`, {
            errors: parsedPayload.error.errors,
            recordBody: rawBody,
          });
          continue; // Skip this record
        }

        const WorkerProcessorClass = scraperEntry.processor as new () => {
          processJob: (browser: Browser, rawJob: ScrapeAction) => Promise<ScrapeResult>;
        };
        const workerProcessor = new WorkerProcessorClass();

        logger.info(
          `Processing job for action: ${action}, job_id: ${rawBody.payload.job_id || 'N/A'}`
        );

        await workerProcessor.processJob(browser, rawBody);
      } catch (innerError) {
        logger.error('Error processing single SQS record:', {
          error: innerError instanceof Error ? innerError.message : innerError,
          stack: innerError instanceof Error ? innerError.stack : undefined,
          recordBody: record.body,
        });
      }
    }
  } catch (outerError) {
    logger.error('Error in main worker handler (browser launch or overall):', {
      error: outerError instanceof Error ? outerError.message : outerError,
      stack: outerError instanceof Error ? outerError.stack : undefined,
    });
  } finally {
    if (browser) {
      await browser.close().catch(e => logger.error('Error closing browser:', e));
    }
  }
};
