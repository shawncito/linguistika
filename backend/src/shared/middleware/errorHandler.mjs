import { AppError } from '../errors/AppError.mjs';
import { schemaErrorPayload } from '../utils/schemaErrors.mjs';

export function errorHandler(err, req, res, next) {
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({ error: err.message });
  }

  const schemaPayload = schemaErrorPayload(err);
  if (schemaPayload) {
    return res.status(400).json(schemaPayload);
  }

  console.error('❌ Unhandled error:', err);
  return res.status(500).json({ error: err?.message || 'Error interno del servidor' });
}
