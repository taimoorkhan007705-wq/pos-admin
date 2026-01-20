/**
 * Retry Service - Exponential backoff helper
 */

/**
 * Execute function with exponential backoff retry
 * @param {Function} fn - Async function to retry
 * @param {Object} options - Configuration options
 *   - maxAttempts: Max number of attempts (default 5)
 *   - baseDelay: Initial delay in ms (default 1000)
 *   - maxDelay: Maximum delay in ms (default 30000)
 *   - backoffMultiplier: Multiplier for each retry (default 2)
 *   - shouldRetry: Function to determine if error should trigger retry (optional)
 * @returns {Promise} - Result of successful function call
 */
export async function exponentialBackoff(fn, options = {}) {
  const {
    maxAttempts = 5,
    baseDelay = 1000,
    maxDelay = 30000,
    backoffMultiplier = 2,
    shouldRetry = null
  } = options;

  let lastError = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      
      // Check if we should retry
      const shouldRetryThis = !shouldRetry || shouldRetry(err, attempt);
      
      if (attempt === maxAttempts || !shouldRetryThis) {
        throw err;
      }

      // Calculate delay with exponential backoff
      const delay = Math.min(
        baseDelay * Math.pow(backoffMultiplier, attempt - 1),
        maxDelay
      );

      // Add jitter to prevent thundering herd
      const jitter = delay * Math.random() * 0.1;
      const actualDelay = delay + jitter;

      console.log(
        `⏳ Retry ${attempt}/${maxAttempts} after ${Math.round(actualDelay)}ms - Error: ${err.message}`
      );

      await new Promise(resolve => setTimeout(resolve, actualDelay));
    }
  }

  throw lastError;
}

/**
 * Retry with specific delay between attempts
 * @param {Function} fn - Async function to retry
 * @param {number} attempts - Number of attempts (default 3)
 * @param {number} delayMs - Delay between attempts in ms (default 1000)
 * @returns {Promise} - Result of successful function call
 */
export async function simpleRetry(fn, attempts = 3, delayMs = 1000) {
  let lastError = null;

  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      
      if (i < attempts - 1) {
        console.log(`⏳ Retrying after ${delayMs}ms (attempt ${i + 1}/${attempts - 1})`);
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }
  }

  throw lastError;
}

/**
 * Predefined retry condition for network errors
 * @param {Error} err - Error to check
 * @returns {boolean} - True if should retry
 */
export function isNetworkError(err) {
  if (!err) return false;
  
  // Check for common network errors
  const networkErrors = [
    'ERR_NETWORK',
    'ERR_FAILED_FETCH',
    'ECONNREFUSED',
    'ECONNRESET',
    'ETIMEDOUT',
    'EHOSTUNREACH',
    'Network Error'
  ];

  return networkErrors.some(netErr => 
    err.message?.includes(netErr) || 
    err.code?.includes(netErr) ||
    err.toString?.().includes(netErr)
  );
}

/**
 * Predefined retry condition for server errors (5xx)
 * @param {Error} err - Error to check
 * @returns {boolean} - True if should retry
 */
export function isServerError(err) {
  if (!err) return false;
  
  // Check for 5xx status codes
  return err.status >= 500 || err.response?.status >= 500;
}

/**
 * Predefined retry condition for rate limits (429)
 * @param {Error} err - Error to check
 * @returns {boolean} - True if should retry
 */
export function isRateLimitError(err) {
  if (!err) return false;
  
  return err.status === 429 || err.response?.status === 429;
}

/**
 * Combined retry condition: retry on network, server, or rate limit errors
 * @param {Error} err - Error to check
 * @returns {boolean} - True if should retry
 */
export function isRetryableError(err) {
  return isNetworkError(err) || isServerError(err) || isRateLimitError(err);
}
