import dotenv from 'dotenv';
import puppeteer from 'puppeteer-core';
import chromium from '@sparticuz/chromium';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

// Initialize S3 client with region from environment or default to us-east-1
const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'us-east-1',
  // credentials: {
  //   accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
  //   secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || ''
  // }
});

// Function to generate a unique filename with timestamp
const generateScreenshotName = () => {
  const now = new Date();
  const timestamp = now.toISOString().replace(/[:.]/g, '-');
  return `llm-wikipedia-${timestamp}.png`;
};

// Function to upload file to S3
const uploadToS3 = async (bucketName, key, body, contentType) => {
  const params = {
    Bucket: bucketName,
    Key: key,
    Body: body,
    ContentType: contentType,
  };

  try {
    const command = new PutObjectCommand(params);
    await s3Client.send(command);

    // Generate a pre-signed URL for the uploaded file (valid for 1 hour)
    const url = await getSignedUrl(
      s3Client,
      new GetObjectCommand({
        Bucket: bucketName,
        Key: key,
      }),
      { expiresIn: 3600 }
    );

    return {
      bucket: bucketName,
      key,
      url,
    };
  } catch (error) {
    console.error('Error uploading to S3:', error);
    throw error;
  }
};

dotenv.config();

const scrapeLLMInfo = async () => {
  const url = 'https://en.wikipedia.org/wiki/Large_language_model';
  const introSelector = '#mw-content-text > div.mw-content-ltr.mw-parser-output > p';
  const tocSelector = '#toc';
  const keyInfoSelector = '#mw-content-text > div.mw-content-ltr.mw-parser-output > div';

  let browser;
  try {
    browser = await puppeteer.launch({
      args: chromium.args,
      defaultViewport: chromium.defaultViewport,
      executablePath: await chromium.executablePath(),
      headless: chromium.headless,
    });

    const page = await browser.newPage();
    await page.goto(url, { waitUntil: 'domcontentloaded' });

    // Wait for the main content to load
    await page.waitForSelector(introSelector);

    // Extract the introduction
    const intro = await page.evaluate(selector => {
      const paragraphs = Array.from(document.querySelectorAll(selector));
      return paragraphs
        .slice(0, 3) // Get first 3 paragraphs for introduction
        .map(p => p.textContent.trim())
        .join('\n\n');
    }, introSelector);

    // Extract table of contents sections
    const toc = await page.evaluate(selector => {
      const tocElement = document.querySelector(selector);
      if (!tocElement) return [];

      return Array.from(tocElement.querySelectorAll('li a span.toctext')).map(span =>
        span.textContent.trim()
      );
    }, tocSelector);

    // Extract key information sections
    const keyInfo = await page.evaluate(selector => {
      const sections = document.querySelectorAll(selector);
      const result = [];

      sections.forEach(section => {
        const heading = section.previousElementSibling;
        if (heading && heading.tagName.startsWith('H')) {
          result.push({
            heading: heading.textContent.trim(),
            content: section.textContent.trim().substring(0, 500) + '...', // Limit content length
          });
        }
      });

      return result;
    }, keyInfoSelector);

    // Take a screenshot of the page
    console.log('Taking screenshot...');
    const screenshotBuffer = await page.screenshot({
      fullPage: true,
      type: 'png',
    });

    console.log('Scraping complete');

    return {
      url,
      intro,
      tableOfContents: toc,
      keySections: keyInfo,
      screenshotBuffer,
    };
  } catch (error) {
    console.error('Error during scraping:', error.message);
    throw error;
  } finally {
    if (browser) await browser.close();
  }
};

const postTweets = async articles => {
  const client = new TwitterApi({
    appKey: process.env.CONSUMER_KEY,
    appSecret: process.env.CONSUMER_SECRET,
    accessToken: process.env.ACCESS_TOKEN,
    accessSecret: process.env.ACCESS_TOKEN_SECRET,
  });

  const checkRateLimit = async () => {
    try {
      const rateLimitStatus = await client.v2.get('application/rate_limit_status');
      const remainingRequests = rateLimitStatus.resources.statuses['/statuses/update'].remaining;
      const resetTimestamp = rateLimitStatus.resources.statuses['/statuses/update'].reset;

      if (remainingRequests === 0) {
        const waitTime = resetTimestamp - Math.floor(Date.now() / 1000);
        console.log(`Waiting for ${waitTime} seconds until rate limit resets...`);
        await new Promise(resolve => setTimeout(resolve, waitTime * 1000));
      }
    } catch (error) {
      console.error('Error checking rate limit:', error);
    }
  };

  for (const article of articles) {
    const tweetContent = `${article.title}\n${article.url}`;

    await checkRateLimit();

    try {
      await client.v2.tweet(tweetContent);
      console.log(`Tweet posted: ${tweetContent}`);
    } catch (error) {
      console.error('Error posting tweet:', error);
    }
  }
};

export const lambdaHandler = async (event, context) => {
  console.log('Starting Wikipedia scraper for Large Language Model page...');

  // Ensure S3 bucket name is provided
  const s3Bucket = process.env.S3_BUCKET_NAME;
  if (!s3Bucket) {
    throw new Error('S3_BUCKET_NAME environment variable is not set');
  }

  try {
    const llmInfo = await scrapeLLMInfo();

    console.log('Successfully scraped LLM information:');
    console.log(`- URL: ${llmInfo.url}`);
    console.log(`- Table of Contents: ${llmInfo.tableOfContents.length} sections`);
    console.log(`- Key Sections: ${llmInfo.keySections.length} sections found`);

    // Upload screenshot to S3
    console.log('Uploading screenshot to S3...');
    const screenshotKey = `screenshots/${generateScreenshotName()}`;
    const uploadResult = await uploadToS3(
      s3Bucket,
      screenshotKey,
      llmInfo.screenshotBuffer,
      'image/png'
    );

    console.log(`Screenshot uploaded to: ${uploadResult.url}`);

    // Format the response
    const response = {
      statusCode: 200,
      body: JSON.stringify({
        message: 'Successfully scraped LLM information and uploaded screenshot',
        data: {
          url: llmInfo.url,
          screenshot: {
            bucket: uploadResult.bucket,
            key: uploadResult.key,
            url: uploadResult.url,
          },
          intro: llmInfo.intro,
          tableOfContents: llmInfo.tableOfContents,
          keySections: llmInfo.keySections.map(section => ({
            heading: section.heading,
            content: section.content,
          })),
        },
      }),
    };

    return response;
  } catch (error) {
    console.error('Error in lambdaHandler:', error);

    return {
      statusCode: 500,
      body: JSON.stringify({
        error: 'Failed to scrape LLM information',
        details: error.message,
      }),
    };
  }
};
