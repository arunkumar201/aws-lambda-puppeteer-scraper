import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { ScrapeBatchRequestSchema, ScrapeBatchResponse, ScrapeAction } from '../types/scrape.types';

import { SCRAPER_MAP, ScrapeActionType } from '../scraper/scraper.constants';
import { BrowserFactory } from '../scraper/browser-factory';
import { Browser } from 'puppeteer-core';

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    if (!event.body) return respond(400, { message: 'Request body is required' });

    const parsed = ScrapeBatchRequestSchema.safeParse(JSON.parse(event.body));
    if (!parsed.success)
      return respond(400, { message: 'Invalid input', errors: parsed.error.errors });

    const browserFactory = new BrowserFactory();
    const browser = await browserFactory.createBrowser();

    const results = await Promise.all(
      parsed.data.jobs.map(async (job: ScrapeAction) => {
        const entry = SCRAPER_MAP[job.action as ScrapeActionType];
        if (!entry) {
          return { action: job.action, success: false, error: 'Unknown action' };
        }
        const jobParse = entry.schema.safeParse(job.payload);
        if (!jobParse.success) {
          return {
            action: job.action,
            success: false,
            error: 'Invalid payload',
            data: jobParse.error.errors,
          };
        }
        try {
          const scraper = new entry.scraper();
          const data = await scraper.scrape(browser as Browser, jobParse.data);
          return { action: job.action, success: true, data };
        } catch (err) {
          return {
            action: job.action,
            success: false,
            error: err instanceof Error ? err.message : String(err),
          };
        }
      })
    );

    await browser.close();

    const response: ScrapeBatchResponse = { results };
    return respond(200, response);
  } catch (error) {
    return respond(500, {
      message: 'Internal server error',
      error: error instanceof Error ? error.message : error,
    });
  }
};

function respond(statusCode: number, body: unknown): APIGatewayProxyResult {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    body: JSON.stringify(body),
  };
}
