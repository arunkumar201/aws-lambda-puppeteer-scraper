import { Browser } from 'puppeteer-core';
import { NewsJob, ScrapeResult } from '../types/job.types';
import { ScreenshotHelper, CheerioHelper } from './screenshot-helper';
import { sleep } from '../utils';
import { MultiPlatformChatBotWaiter } from '../utils/multiPlatformChatBotWaiter';

export class NewsScraper {
  public async scrape(browser: Browser, job: NewsJob): Promise<ScrapeResult> {
    const page = await browser.newPage();
    try {
      await page.goto(job.url, { waitUntil: 'networkidle2', timeout: 60000 });
      await sleep(1);
      const title = await page.title();
      const waiter = new MultiPlatformChatBotWaiter(page, {
        debug: true,
        maxWaitTime: 10000,
        checkInterval: 150,
      });
      await waiter.waitForChatBotResponse();

      const content = await page.content();
      console.log('---- ------- ------ ------ ------ ------ ------ ------ --');
      const screenshot = await ScreenshotHelper.takeScreenshot(page);
      const $ = CheerioHelper.load(content);

      const links = CheerioHelper.extractLinks($);
      const actualMarkdown = CheerioHelper.extractLongFormDescription($);
      const markdown =
        actualMarkdown.trim().length > 1
          ? actualMarkdown
          : `# ${title}\n\n${content.substring(0, 2000)}...`;

      return { screenshot, markdown, links: links.slice(0, 100) };
    } catch (error) {
      console.error('Error during scraping:', error);
      throw error;
    } finally {
      await page.goto('about:blank').catch(() => {});
    }
  }
}
