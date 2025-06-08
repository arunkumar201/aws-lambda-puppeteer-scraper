import express, { type Application, type Request, type Response, type NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
// Remove hpp and xss-clean as they don't have proper TypeScript types
// import hpp from 'hpp';
// import xss from 'xss-clean';
import httpStatus from 'http-status';
import { errorConverter, errorHandler } from './middlewares/error';
import ApiError from './utils/ApiError';
import routes from './routes';
import config from './config/config';
import logger from './utils/logger';
import { ScrapeBatchRequestSchema, ScrapeBatchResponse, ScrapeAction } from './types/scrape.types';
import { SCRAPER_MAP, ScrapeActionType } from './scraper/scraper.constants';
import { BrowserFactory } from './scraper/browser-factory';
import { Browser } from 'puppeteer-core';
import path from 'path';

const app: Application = express();

// Set security HTTP headers
app.use(helmet());

app.use(express.static('public'));
app.use(express.static(path.join(__dirname, 'public')));

// Enable CORS
app.use(cors());
app.options('*', cors());

// Parse json request body
app.use(express.json({ limit: '10kb' }));

// Parse urlencoded request body
app.use(express.urlencoded({ extended: true, limit: '10kb' }));

// Gzip compression
app.use(compression());

// HTTP request logger
app.use((req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.info(`${req.method} ${req.originalUrl} ${res.statusCode} - ${duration}ms`, {
      method: req.method,
      url: req.originalUrl,
      status: res.statusCode,
      duration: `${duration}ms`,
      ip: req.ip,
      userAgent: req.get('user-agent'),
    });
  });

  next();
});

// Limit requests from same API
if (config.env === 'production') {
  const limiter = rateLimit({
    max: 100,
    windowMs: 60 * 60 * 1000, // 1 hour
    message: 'Too many requests from this IP, please try again in an hour!',
  });
  app.use('/api', limiter);
}

// Setup routes
app.use('/api', routes);

// Batch scraping endpoint
app.post('/api/scrape', async (req: any, res: any) => {
  const parsed = ScrapeBatchRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: 'Invalid input', errors: parsed.error.errors });
  }

  try {
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
    return res.status(200).json(response);
  } catch (error) {
    return res.status(500).json({
      message: 'Internal server error',
      error: error instanceof Error ? error.message : error,
    });
  }
});

// Health check endpoint
app.get('/health', (req: Request, res: Response) => {
  res.status(httpStatus.OK).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Send 404 for any unknown API request
app.use((req: Request, res: Response, next: NextFunction) => {
  next(new ApiError(httpStatus.NOT_FOUND, 'Not found'));
});

// Convert error to ApiError, if needed
app.use(errorConverter);

// Handle error
app.use(errorHandler);

export default app;
