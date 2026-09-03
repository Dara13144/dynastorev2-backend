export const errorHandler = (err, req, res, next) => {
  console.error('🔥 Server Error:', err);

  const statusCode = err.statusCode || (err.code === '22P02' ? 400 : 500);
  let rawMessage = err.message || '';

  // Sanitize database / technical errors so raw payloads/syntax errors never leak to frontend
  let friendlyMessage = 'An unexpected error occurred. Please try again.';

  if (rawMessage.includes('invalid input syntax for type numeric') || err.code === '22P02') {
    friendlyMessage = 'Invalid numeric format provided. Please check the values and try again.';
  } else if (rawMessage.includes('duplicate key') || err.code === '23505') {
    friendlyMessage = 'A record with this information already exists.';
  } else if (rawMessage.includes('foreign key') || err.code === '23503') {
    friendlyMessage = 'Referenced resource was not found.';
  } else if (rawMessage.includes('null value in column')) {
    friendlyMessage = 'A required field is missing. Please fill in all required fields.';
  } else if (statusCode < 500 && rawMessage && !rawMessage.includes('{"') && !rawMessage.includes('syntax')) {
    // Normal client error message
    friendlyMessage = rawMessage;
  }

  res.status(statusCode).json({
    success: false,
    message: friendlyMessage,
  });
};
