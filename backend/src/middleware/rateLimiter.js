import rateLimit from 'express-rate-limit'

export const loginLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 5,
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
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 3,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res, next) => {
    const error = new Error('Too many accounts created. Please try again later.')
    error.status = 429
    next(error)
  }
})

/**
 * Chatbot rate limiter — tracks by authenticated user ID, not IP.
 * Allows 10 messages per user per day.
 *
 * IMPORTANT: This must be applied AFTER authenticateToken middleware
 * so that req.user.id is available.
 */
export const chatLimiter = rateLimit({
  windowMs: 24 * 60 * 60 * 1000, // 24 hours
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  // Key by user ID instead of IP
  keyGenerator: (req) => `chatbot_user_${req.user.id}`,
  handler: (req, res, next) => {
    const error = new Error('You have reached your daily limit of 10 messages. Please try again tomorrow.')
    error.status = 429
    next(error)
  }
})