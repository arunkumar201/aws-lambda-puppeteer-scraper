import { SQSEvent, SQSHandler } from 'aws-lambda';
import chromium from '@sparticuz/chromium';
import puppeteer from 'puppeteer-core';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { logger } from './utils/logger';

const s3 = new S3Client({ region: process.env.AWS_REGION });
const BUCKET_NAME = process.env.S3_BUCKET_NAME || '';

export const handler: SQSHandler = async (event: SQSEvent) => {
  for (const record of event.Records) {
    try {
      const { messageId, body } = record;
      const { id, url } = JSON.parse(body);
      
      logger.info('Processing scraping task', { messageId, taskId: id, url });
      
      // Launch browser with optimized settings for AWS Lambda
      const browser = await puppeteer.launch({
        args: [
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
        ],
        defaultViewport: chromium.defaultViewport,
        executablePath: await chromium.executablePath(),
        headless: chromium.headless,
        ignoreHTTPSErrors: true,
      });

      try {
        const page = await browser.newPage();
        await page.setViewport({ width: 1280, height: 800 });
        
        logger.info(`Navigating to ${url}`);
        await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });
        
        // Take a screenshot
        const screenshot = await page.screenshot({
          fullPage: true,
          type: 'png',
        });
        
        // Get page content
        const title = await page.title();
        const content = await page.content();
        
        // Upload screenshot to S3
        const screenshotKey = `screenshots/${id}.png`;
        await s3.send(
          new PutObjectCommand({
            Bucket: BUCKET_NAME,
            Key: screenshotKey,
            Body: screenshot,
            ContentType: 'image/png',
          })
        );
        
        // Upload HTML content to S3
        const htmlKey = `content/${id}.html`;
        await s3.send(
          new PutObjectCommand({
            Bucket: BUCKET_NAME,
            Key: htmlKey,
            Body: content,
            ContentType: 'text/html',
          })
        );
        
        logger.info('Successfully processed task', { 
          taskId: id, 
          screenshotKey,
          htmlKey,
          title,
        });
        
      } finally {
        await browser.close();
      }
      
    } catch (error) {
      logger.error('Error processing message', { 
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
      });
      // Don't throw error to prevent message from being requeued indefinitely
      // The message will be moved to DLQ after maxReceiveCount is reached
    }
  }
};
