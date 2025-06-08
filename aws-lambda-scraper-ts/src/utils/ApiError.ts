import httpStatus from 'http-status';

export class ApiError extends Error {
  statusCode: number;
  isOperational: boolean;
  errors?: any[];

  constructor(
    statusCode: number,
    message: string,
    errors?: any[],
    isOperational = true,
    stack = ''
  ) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.errors = errors;

    if (stack) {
      this.stack = stack;
    } else {
      Error.captureStackTrace(this, this.constructor);
    }
  }

  static badRequest(message: string, errors?: any[]) {
    return new ApiError(httpStatus.BAD_REQUEST, message, errors);
  }

  static unauthorized(message = 'Unauthorized') {
    return new ApiError(httpStatus.UNAUTHORIZED, message);
  }

  static forbidden(message = 'Forbidden') {
    return new ApiError(httpStatus.FORBIDDEN, message);
  }

  static notFound(message = 'Not Found') {
    return new ApiError(httpStatus.NOT_FOUND, message);
  }

  static conflict(message: string) {
    return new ApiError(httpStatus.CONFLICT, message);
  }

  static internal(message = 'Internal Server Error', errors?: any[]) {
    return new ApiError(httpStatus.INTERNAL_SERVER_ERROR, message, errors);
  }
}

export default ApiError;
