import DOMPurify from 'dompurify';

export function sanitizeMessage(text: string): string {
  // Remove all HTML tags and attributes
  return DOMPurify.sanitize(text, {
    ALLOWED_TAGS: [], // No HTML tags allowed
    ALLOWED_ATTR: [],
    KEEP_CONTENT: true, // Keep text content
  });
}

export function sanitizeError(error: string | undefined): string {
  if (!error) return 'An error occurred';
  
  let sanitized = error;
  
  // Remove API keys (Gemini API key pattern: AIza...)
  sanitized = sanitized.replace(/AIza[0-9A-Za-z_-]{35}/g, '[API_KEY_REDACTED]');
  
  // Remove file paths
  sanitized = sanitized.replace(/\/[^\s]+\.(key|pem|env|config)/gi, '[FILE_PATH_REDACTED]');
  
  // Remove database URLs
  sanitized = sanitized.replace(/postgres:\/\/[^\s]+/gi, '[DB_URL_REDACTED]');
  sanitized = sanitized.replace(/mongodb:\/\/[^\s]+/gi, '[DB_URL_REDACTED]');
  
  // Remove stack traces (lines with file paths)
  sanitized = sanitized.replace(/at\s+[^\s]+\s+\([^)]+\)/g, '[STACK_TRACE_REDACTED]');
  
  // Remove internal IPs
  sanitized = sanitized.replace(/\b(?:[0-9]{1,3}\.){3}[0-9]{1,3}\b/g, '[IP_REDACTED]');
  
  // Limit length
  sanitized = sanitized.substring(0, 200);
  
  return sanitized || 'An error occurred';
}
