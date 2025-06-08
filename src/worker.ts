import { SQSEvent, SQSHandler } from 'aws-lambda';
import { BrowserFactory } from './scraper/browser-factory';
import { ScrapeAction, ScrapeResult, ScrapeActionSchema } from './types/job.types';
import { logger } from './utils/logger';
import { Browser } from 'puppeteer-core';
import { WikipediaWorkerProcessor } from './workers/wikipedia-worker';
import { NewsWorkerProcessor } from './workers/news-worker';

const scraperMap: Record<ScrapeAction['site_type'], { processor: unknown }> = {
  wikipedia: {
    processor: WikipediaWorkerProcessor,
  },
  news: {
    processor: NewsWorkerProcessor,
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
        const parsedPayload = ScrapeActionSchema.safeParse(rawBody);

        if (!parsedPayload.success) {
          logger.error(`Invalid payload for SQS record:`, {
            errors: parsedPayload.error.errors,
            recordBody: rawBody,
          });
          continue; // Skip this record
        }

        const { site_type, job_id } = parsedPayload.data;

        const scraperEntry = scraperMap[site_type];
        if (!scraperEntry) {
          logger.warn(`Unknown site_type received: ${site_type}`, { recordBody: rawBody });
          continue;
        }

        const WorkerProcessorClass = scraperEntry.processor as new () => {
          processJob: (browser: Browser, job: ScrapeAction) => Promise<ScrapeResult>;
        };
        const workerProcessor = new WorkerProcessorClass();

        logger.info(`Processing job for site_type: ${site_type}, job_id: ${job_id || 'N/A'}`);

        await workerProcessor.processJob(browser, parsedPayload.data);
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
