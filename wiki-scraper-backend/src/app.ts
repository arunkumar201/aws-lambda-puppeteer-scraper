import express, { type Application, type Request, type Response, type NextFunction, type Router } from 'express';
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

const app: Application = express();

// Set security HTTP headers
app.use(helmet());

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
    logger.info(
      `${req.method} ${req.originalUrl} ${res.statusCode} - ${duration}ms`,
      {
        method: req.method,
        url: req.originalUrl,
        status: res.statusCode,
        duration: `${duration}ms`,
        ip: req.ip,
        userAgent: req.get('user-agent'),
      }
    );
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
