import 'dotenv/config';
import http from 'http';
import app from './app';
import logger from './utils/logger';

const PORT = process.env.PORT || 3000;

// Track if server is in the process of shutting down
let isShuttingDown = false;

// Function to clean up resources
const cleanup = async () => {
  if (isShuttingDown) return;
  isShuttingDown = true;

  logger.info('Cleaning up resources...');

  // Close the HTTP server
  return new Promise<void>(resolve => {
    if (server.listening) {
      server.close(err => {
        if (err) {
          logger.error('Error closing server:', err);
        } else {
          logger.info('Server closed');
        }
        resolve();
      });
    } else {
      resolve();
    }
  });
};

// Create HTTP server
const server = http.createServer(app);

// Handle unhandled promise rejections
process.on('unhandledRejection', (err: Error) => {
  logger.error(`Unhandled Rejection: ${err.message}`);
  // Close server & exit process
  server.close(() => process.exit(1));
});

// Handle uncaught exceptions
process.on('uncaughtException', (err: Error) => {
  logger.error(`Uncaught Exception: ${err.message}`);
  // Close server & exit process
  server.close(() => process.exit(1));
});

// Graceful shutdown
const exitHandler = () => {
  if (server) {
    server.close(() => {
      logger.info('Server closed');
      process.exit(0);
    });
  } else {
    process.exit(0);
  }
};

// Handle termination signals
process.on('SIGTERM', () => {
  logger.info('SIGTERM received');
  exitHandler();
});

process.on('SIGINT', () => {
  logger.info('SIGINT received');
  exitHandler();
});

// Start the server
const startServer = async () => {
  try {
    // Start the server
    server.listen(PORT, () => {
      logger.info(`Server is running on port ${PORT}`);

      isShuttingDown = false;
    });

    // Handle server errors
    server.on('error', (error: NodeJS.ErrnoException) => {
      if (error.code === 'EADDRINUSE') {
        logger.error(
          `Port ${PORT} is already in use. Please wait for the port to be released or use a different port.`
        );
      } else {
        logger.error('Server error:', error);
      }

      // Attempt to restart the server after a delay
      if (!isShuttingDown) {
        setTimeout(() => {
          logger.info('Attempting to restart server...');
          startServer().catch(err => {
            logger.error('Failed to restart server:', err);
          });
        }, 1000);
      }
    });
  } catch (error) {
    logger.error('Error starting server:', error);
    process.exit(1);
  }
};

// Start the application
startServer();

export default app;
