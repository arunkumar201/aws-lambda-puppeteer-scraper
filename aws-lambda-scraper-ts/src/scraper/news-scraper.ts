import { Browser } from 'puppeteer-core';
import { NewsJob, ScrapeResult } from '../types/job.types';
import { ScreenshotHelper, CheerioHelper } from './screenshot-helper';
import { sleep } from '../utils';

export class NewsScraper {
  public async scrape(browser: Browser, job: NewsJob): Promise<ScrapeResult> {
    const page = await browser.newPage();
    await page.goto(job.url, { waitUntil: 'networkidle2', timeout: 60000 });
    await sleep(20);
    const title = await page.title();
    const content = await page.content();
    const screenshot = await ScreenshotHelper.takeScreenshot(page);
    const $ = CheerioHelper.load(content);
    const links = CheerioHelper.extractLinks($);
    // Convert content to markdown (placeholder)
    const actualMarkdown = CheerioHelper.extractLongFormDescription($);
    const markdown =
      actualMarkdown.trim().length > 1
        ? actualMarkdown
        : `# ${title}\n\n${content.substring(0, 2000)}...`;
    await page.close();
    return { screenshot, markdown, links: links.slice(0, 100) };
  }
}
