import { Browser } from 'puppeteer-core';
import { WikipediaJob, ScrapeResult } from '../types/job.types';
import { ScreenshotHelper, CheerioHelper } from './screenshot-helper';
import { MultiPlatformChatBotWaiter } from '../utils/multiPlatformChatBotWaiter';
import TurndownService from 'turndown';

export class WikipediaScraper {
  public async scrape(browser: Browser, job: WikipediaJob): Promise<ScrapeResult> {
    const page = await browser.newPage();
    try {
      await page.goto(job.url, { waitUntil: 'networkidle2', timeout: 60000 });
      const waiter = new MultiPlatformChatBotWaiter(page, {
        debug: true,
        maxWaitTime: 10000,
        checkInterval: 150,
      });
      const streamResponse = await waiter.waitForChatBotResponse();
      const content = await page.content();

      const screenshot = await ScreenshotHelper.takeScreenshot(page);
      const $ = CheerioHelper.load(content);
      const links = CheerioHelper.extractLinks($);
      const turndownService = new TurndownService();
      let markdown = turndownService.turndown(content);
      if (!markdown.trim() && !streamResponse.content) {
        const actualMarkdown = CheerioHelper.extractLongFormDescription($);
        markdown =
          actualMarkdown.trim().length > 1 ? actualMarkdown : content.substring(0, 2000) + '...';
      }

      return {
        screenshot,
        markdown: streamResponse.content ?? markdown,
        links: links.slice(0, 100),
      };
    } catch (error) {
      console.error('Error during Wikipedia scraping:', error);
      throw error;
    } finally {
      await page.goto('about:blank').catch(() => {});
    }
  }
}
