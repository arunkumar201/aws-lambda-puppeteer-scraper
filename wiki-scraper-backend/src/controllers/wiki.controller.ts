import { Request, Response } from 'express';
import puppeteer, { Browser } from 'puppeteer-core';
import chromium from '@sparticuz/chromium';

import { GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { ScrapeInput } from '../validations';
import ApiError from '../utils/ApiError';
import config from '../config/config';
import logger from '../utils/logger';
import fs from 'fs';
import path from 'path';

const s3 = new S3Client({
  region: config.aws.region,
  credentials: {
    accessKeyId: config.aws.accessKeyId,
    secretAccessKey: config.aws.secretAccessKey,
  },
});

/**
 * Uploads a file to S3 or local folder and returns the URL
 */
async function uploadToS3orLocal(
  buffer: Buffer,
  key: string,
  contentType: string,
  s3Enabled: boolean
): Promise<string> {
  if (s3Enabled) {
    const params = {
      Bucket: config.aws.s3.bucketName,
      Key: key,
      Body: buffer,
      ContentType: contentType,
    };

    try {
      const command = new PutObjectCommand(params);
      await s3.send(command);

      // Generate a pre-signed URL for the uploaded file
      const url = await getSignedUrl(s3, command, { expiresIn: config.aws.s3.signedUrlExpiry });
      return url.split('?')[0]; // Return the base URL without query parameters
    } catch (error) {
      logger.error('Error uploading to S3:', error);
      throw new ApiError(500, 'Failed to upload file to S3');
    }
  } else {
    try {
      // Ensure the screenshots directory exists
      const screenshotsDir = path.join(process.cwd(), 'public', 'screenshots');
      await fs.promises.mkdir(screenshotsDir, { recursive: true });

      // Create a safe filename from the key
      const safeKey = key.replace(/[^a-z0-9.-]/gi, '_').toLowerCase();
      const filePath = path.join(screenshotsDir, safeKey);

      // Write the file
      await fs.promises.writeFile(filePath, buffer);

      // Return the relative URL path
      return `/screenshots/${safeKey}`;
    } catch (error) {
      logger.error('Error saving file locally:', error);
      throw new ApiError(500, 'Failed to save file locally');
    }
  }
}

/**
 * Scrapes a Wikipedia page and returns the content
 */
export const scrapeWikipediaPage = async (req: Request, res: Response) => {
  const { url } = req.body as ScrapeInput;

  let browser: Browser | null = null;

  try {
    logger.info(`Starting to scrape Wikipedia page: ${url}`);
    // Get the Chromium executable path for macOS
    const executablePath =
      process.platform === 'darwin'
        ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
        : await chromium.executablePath();

    logger.info(`Using Chromium executable: ${executablePath}`);

    const args = [
      ...chromium.args,
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--no-first-run',
      '--no-zygote',
      '--single-process',
      '--disable-gpu',
      '--disable-software-rasterizer',
      '--disable-features=IsolateOrigins,site-per-process',
    ];

    logger.info('Launching browser with args:', JSON.stringify(args, null, 2));

    const launchOptions = {
      executablePath,
      args: [
        ...args,
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--single-process',
        '--disable-gpu',
        '--disable-software-rasterizer',
      ],
      ignoreHTTPSErrors: true,
    };

    logger.info('Launching browser with options:', JSON.stringify(launchOptions, null, 2));
    browser = await puppeteer.launch({
      ...launchOptions,
      headless: chromium.headless,
      defaultViewport: chromium.defaultViewport,
      ignoreHTTPSErrors: true,
    });

    const page = await browser.newPage();

    // Set user agent to avoid bot detection
    await page.setUserAgent(
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
    );

    // Navigate to the page
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });

    // Extract page title
    const title = await page.title();

    // Extract main content
    const content = await page.evaluate(() => {
      // Remove any unwanted elements
      document
        .querySelectorAll(
          '.navbox, .sidebar, .infobox, .reference, .mw-editsection, .mw-cite-backlink'
        )
        .forEach(el => el.remove());

      // Get the main content
      const contentElement =
        document.querySelector('#mw-content-text .mw-parser-output') ||
        document.querySelector('.mw-body-content') ||
        document.body;

      return contentElement.textContent?.trim() || '';
    });

    // Extract sections
    const sections = await page.evaluate(() => {
      const sectionElements = Array.from(document.querySelectorAll('h2, h3'));
      return sectionElements.map(el => ({
        level: el.tagName.toLowerCase(),
        id: el.id,
        title: el.textContent?.trim() || '',
      }));
    });

    // Take a full-page screenshot
    const screenshotBuffer = await page.screenshot({
      fullPage: true,
      type: 'jpeg',
      quality: 80,
    });

    // Upload screenshot to S3
    const screenshotKey = `screenshots/${Date.now()}-${encodeURIComponent(title)}.jpg`;
    const screenshotUrl = await uploadToS3orLocal(
      Buffer.from(screenshotBuffer),
      screenshotKey,
      'image/jpeg',
      true
    );

    logger.info(`Successfully scraped page: ${url}`);

    res.status(200).json({
      success: true,
      data: {
        title,
        content: content.substring(0, 5000) + (content.length > 5000 ? '...' : ''), // Limit content length
        sections,
        screenshotUrl,
      },
    });
  } catch (error) {
    logger.error('Error scraping Wikipedia page:', error);

    if (browser) {
      await browser.close().catch((error: Error) => {
        logger.error('Error closing browser:', error);
      });
    }

    if (error instanceof ApiError) {
      throw error;
    }

    throw new ApiError(500, 'Failed to scrape Wikipedia page');
  } finally {
    if (browser) {
      await browser.close().catch((error: Error) => {
        logger.error('Error closing browser:', error);
      });
    }
  }
};
