export class AppError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode: number = 500,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export class NuturyxApiError extends AppError {
  constructor(
    message: string,
    statusCode: number = 502,
    details?: unknown,
  ) {
    super(message, 'NUTURYX_API_ERROR', statusCode, details);
    this.name = 'NuturyxApiError';
  }
}

export class SessionNotFoundError extends AppError {
  constructor(phone: string) {
    super(`Session not found for phone: ${phone}`, 'SESSION_NOT_FOUND', 404);
    this.name = 'SessionNotFoundError';
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: unknown) {
    super(message, 'VALIDATION_ERROR', 400, details);
    this.name = 'ValidationError';
  }
}

export class RateLimitError extends AppError {
  constructor() {
    super('Too many requests', 'RATE_LIMIT_EXCEEDED', 429);
    this.name = 'RateLimitError';
  }
}
