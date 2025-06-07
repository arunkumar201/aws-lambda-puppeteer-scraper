import { Request, Response, NextFunction } from 'express';
import httpStatus from 'http-status';
import ApiError from '../utils/ApiError';
import logger from '../utils/logger';

/**
 * Converts error to ApiError if needed
 */
export const errorConverter = (
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  let error = err;
  
  if (!(error instanceof ApiError)) {
    const statusCode = error.statusCode || httpStatus.INTERNAL_SERVER_ERROR;
    // @ts-ignore - httpStatus[statusCode] is valid but TypeScript doesn't recognize it
    const message = error.message || httpStatus[statusCode] || 'Internal Server Error';
    error = new ApiError(statusCode, message, undefined, false, err.stack);
  }
  
  next(error);
};

/**
 * Handles errors and sends response
 */
export const errorHandler = (
  err: ApiError,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  next: NextFunction
) => {
  const { statusCode, message, errors } = err;
  
  const response = {
    code: statusCode,
    message,
    ...(errors && { errors }),
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  };
  
  if (process.env.NODE_ENV === 'development') {
    logger.error(err);
  }
  
  res.status(statusCode).json(response);
};

/**
 * Catch 404 and forward to error handler
 */
export const notFound = (req: Request, res: Response, next: NextFunction) => {
  next(new ApiError(httpStatus.NOT_FOUND, 'Not found'));
};
