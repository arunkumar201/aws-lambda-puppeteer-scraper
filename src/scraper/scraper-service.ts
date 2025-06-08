import { Browser } from 'puppeteer-core';
import { WikipediaJob, NewsJob, ScrapeResponse } from '../types/job';
import { S3Helper } from '../utils/s3-helper';
import { v4 as uuidv4 } from 'uuid';

const s3 = new S3Helper(process.env.AWS_REGION || 'us-east-1');
const BUCKET_NAME = process.env.S3_BUCKET_NAME || '';

export async function scrapeWikipedia(
  browser: Browser,
  job: WikipediaJob
): Promise<ScrapeResponse> {
  const page = await browser.newPage();
  await page.goto(job.url, { waitUntil: 'networkidle2', timeout: 60000 });
  const title = await page.title();
  const content = await page.content();
  const screenshot = (await page.screenshot({ fullPage: true, type: 'png' })) as Buffer;
  const links = await page.$$eval('a', as => as.map(a => a.href));
  // Convert content to markdown (placeholder)
  const markdown = `# ${title}\n\n${content.substring(0, 500)}...`;
  const screenshotKey = `screenshots/${job.job_id || uuidv4()}.png`;
  const url = await s3.uploadS3Local({
    bucket: BUCKET_NAME,
    key: screenshotKey,
    body: screenshot,
    contentType: 'image/png',
  });

  const screenshotUrl = url;
  await page.close();
  return { screenshotKey: screenshotUrl, markdown, links };
}

export async function scrapeNews(browser: Browser, job: NewsJob): Promise<ScrapeResponse> {
  const page = await browser.newPage();
  await page.goto(job.url, { waitUntil: 'networkidle2', timeout: 60000 });
  const title = await page.title();
  const content = await page.content();
  const screenshot = (await page.screenshot({ fullPage: true, type: 'png' })) as Buffer;
  const links = await page.$$eval('a', as => as.map(a => a.href));
  // Convert content to markdown (placeholder)
  const markdown = `# ${title}\n\n${content.substring(0, 500)}...`;
  const screenshotKey = `screenshots/${job.job_id || uuidv4()}.png`;
  await s3.uploadS3Local({
    bucket: BUCKET_NAME,
    key: screenshotKey,
    body: screenshot,
    contentType: 'image/png',
  });
  const screenshotUrl = `https://${BUCKET_NAME}.s3.amazonaws.com/${screenshotKey}`;
  await page.close();
  return { screenshotKey: screenshotUrl, markdown, links };
}
