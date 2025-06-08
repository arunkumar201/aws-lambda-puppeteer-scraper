/* eslint-disable no-console */
import winston from 'winston';
import fs from 'fs';

// Only create file transport in non-production environments
const transports: winston.transport[] = [
  new winston.transports.Console({
    format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
    stderrLevels: ['error'],
  }),
];

// Only add file transport in local development
if (process.env.NODE_ENV === 'local') {
  const logDir = 'logs';

  // Create logs directory if it doesn't exist
  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir);
  }
  transports.push(
    new winston.transports.File({
      filename: `${logDir}/app.log`,
      format: winston.format.combine(winston.format.timestamp(), winston.format.simple()),
    })
  );
}

export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.json(),
  defaultMeta: { service: 'wiki-scraper' },
  transports: transports,
  exitOnError: false,
});

export default logger;

// Log unhandled exceptions
process.on('uncaughtException', error => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});
