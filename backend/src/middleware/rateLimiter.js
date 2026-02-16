import rateLimit from 'express-rate-limit'

export const loginLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 5, // 5 attempts
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  handler: (req, res, next) => {
    const error = new Error('Too many login attempts. Please try again in 5 minutes.')
    error.status = 429
    next(error) 
  }
})

export const registerLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 hour
  max: 3, // 3 registrations
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res, next) => {
    const error = new Error('Too many accounts created. Please try again later.')
    error.status = 429
    next(error) 
  }
})