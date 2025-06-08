import { Browser } from 'puppeteer-core';
import { WikipediaJob, ScrapeResult } from '../types/job.types';
import { ScreenshotHelper, CheerioHelper } from './screenshot-helper';

export class WikipediaScraper {
  public async scrape(browser: Browser, job: WikipediaJob): Promise<ScrapeResult> {
    const page = await browser.newPage();
    await page.goto(job.url, { waitUntil: 'networkidle2', timeout: 60000 });

    const content = await page.content();

    const screenshot = await ScreenshotHelper.takeScreenshot(page);
    const $ = CheerioHelper.load(content);
    const links = CheerioHelper.extractLinks($);
    const markdown = CheerioHelper.extractLongFormDescription($);
    await page.close();
    return { screenshot, markdown, links: links.slice(0, 100) };
  }
}
