import { Page } from 'puppeteer-core';
import * as cheerio from 'cheerio';
import { S3Helper } from '../utils/s3-helper';
import config from '../config/config';
import { v4 as uuidv4 } from 'uuid';
import logger from '../utils/logger';

export class ScreenshotHelper {
  private static readonly s3 = new S3Helper(config.aws.region);
  private static readonly bucket = config.aws.s3.bucketName;

  /**
   * Takes a screenshot of the given Puppeteer page, uploads to S3, and returns the S3 URL.
   * @param page Puppeteer Page instance
   * @param fullPage Whether to capture the full page
   * @param type Screenshot type (default: 'png')
   */
  public static async takeScreenshot(
    page: Page,
    fullPage = true,
    type: 'png' | 'jpeg' = 'png'
  ): Promise<string> {
    const screenshotBuffer = (await page.screenshot({ fullPage, type })) as Buffer;
    const key = `screenshots/${Date.now()}-${uuidv4()}.${type}`;
    const url = await this.s3.uploadS3Local({
      bucket: this.bucket,
      key,
      body: screenshotBuffer,
      contentType: type === 'png' ? 'image/png' : 'image/jpeg',
    });
    logger.info(`Screenshot uploaded to S3: ${url}`);
    return url;
  }
}

export class CheerioHelper {
  /**
   * Loads HTML into Cheerio and returns the root selector.
   */
  public static load(html: string): cheerio.CheerioAPI {
    return cheerio.load(html);
  }

  /**
   * Extracts all unique absolute HTTPS links from the HTML using Cheerio.
   * Skips relative or malformed URLs and returns only those explicitly available in the HTML.
   * @param $ Cheerio root selector
   * @returns Array of unique, valid HTTPS URLs
   */
  public static extractLinks($: cheerio.CheerioAPI): string[] {
    const links = new Set<string>();

    $('a[href]').each((_, el) => {
      const href = $(el).attr('href');
      if (!href) return;

      try {
        const parsedUrl = new URL(href);
        if (parsedUrl.protocol === 'https:') {
          links.add(parsedUrl.href);
        }
      } catch {
        // Skip invalid or relative URLs
      }
    });

    return Array.from(links);
  }

  /**
   * Extracts a long-form, meaningful description from an HTML page using semantic tags.
   * Formats headings, paragraphs, blockquotes, and lists into readable plain text.
   * @param $ Cheerio root selector
   * @returns A structured, readable article-like description
   */
  public static extractLongFormDescription($: cheerio.CheerioAPI): string {
    const root = $('article').first().length
      ? $('article').first()
      : $('main').first().length
        ? $('main').first()
        : $('section').first().length
          ? $('section').first()
          : $('body');

    // eslint-disable-next-line prefer-const
    let result: string[] = [];

    root.find('h1, h2, h3, p, li, blockquote, ul, ol').each((_, el) => {
      const tag = $(el).prop('tagName')?.toLowerCase() ?? '';
      const text = $(el).text().trim();

      if (!text) return;

      switch (tag) {
        case 'h1':
        case 'h2':
        case 'h3':
          result.push(`\n${'#'.repeat(Number(tag[1]))} ${text}`);
          break;
        case 'blockquote':
          result.push(`> ${text}`);
          break;
        case 'li':
          result.push(`• ${text}`);
          break;
        default:
          result.push(text);
          break;
      }
    });

    return result.join('\n\n').trim();
  }
}
