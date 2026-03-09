import crypto from 'crypto';
import { supabaseAdmin } from '../config/supabaseClient.mjs';

const MUTATION_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

const SENSITIVE_KEYS = new Set([
  'password', 'pass', 'token', 'access_token',
  'refresh_token', 'authorization', 'auth',
]);

function sanitizeValue(value, depth = 0) {
  if (depth > 6) return '[MaxDepth]';
  if (value === null || value === undefined) return value;
  if (typeof value === 'string') return value.length > 800 ? value.slice(0, 800) + '…' : value;
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  if (Array.isArray(value)) return value.slice(0, 50).map((v) => sanitizeValue(v, depth + 1));
  if (typeof value === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      out[k] = SENSITIVE_KEYS.has(String(k).toLowerCase()) ? '[REDACTED]' : sanitizeValue(v, depth + 1);
    }
    return out;
  }
  return String(value);
}

function actionFromMethod(method) {
  switch (method) {
    case 'POST': return 'create';
    case 'PUT': case 'PATCH': return 'update';
    case 'DELETE': return 'delete';
    default: return 'unknown';
  }
}

function humanVerb(action) {
  switch (action) {
    case 'create': return 'Creó';
    case 'update': return 'Actualizó';
    case 'delete': return 'Eliminó';
    default: return 'Operación';
  }
}

function singularizeEs(word) {
  const w = String(word || '').trim();
  if (!w) return w;
  if (w.endsWith('ses')) return w.slice(0, -2);
  if (w.endsWith('s') && w.length > 3) return w.slice(0, -1);
  return w;
}

function titleCaseEs(word) {
  const w = String(word || '').trim();
  if (!w) return w;
  return w.charAt(0).toUpperCase() + w.slice(1);
}

const LABEL_MAP = {
  tutores: 'Tutor', cursos: 'Curso', estudiantes: 'Estudiante',
  matriculas: 'Matrícula', pagos: 'Pago', movimientos: 'Movimiento',
  dashboard: 'Dashboard', bulk: 'Importación', admin: 'Admin', auth: 'Auth',
  tesoreria: 'Tesorería', horarios: 'Horario', 'horas-trabajo': 'Horas Trabajo',
  activity: 'Activity', finanzas: 'Finanzas',
};

function inferEntityFromRoute(route) {
  const parts = String(route || '').split('/').filter(Boolean);
  // Strip "api" and "v1"
  const after = parts.filter((p) => p !== 'api' && p !== 'v1');
  const first = after[0] || null;
  if (!first) return { entityType: null, entityLabel: null };
  const entityLabel = LABEL_MAP[first] || titleCaseEs(singularizeEs(first));
  return { entityType: singularizeEs(first), entityLabel };
}

function defaultEntityId(req) {
  if (!req?.params || typeof req.params !== 'object') return null;
  const p = req.params;
  return p.id ?? p.tutorId ?? p.cursoId ?? p.estudianteId ?? p.matriculaId ?? p.pagoId ?? null;
}

function safeRoute(req) {
  const original = String(req.originalUrl || req.url || '');
  const [pathOnly] = original.split('?');
  return pathOnly;
}

export function activityLogMiddleware(req, res, next) {
  if (!supabaseAdmin) return next();
  if (!MUTATION_METHODS.has(String(req.method || '').toUpperCase())) return next();

  const route = safeRoute(req);
  if (route.includes('/activity')) return next();

  const requestId =
    (req.headers['x-request-id'] && String(req.headers['x-request-id'])) ||
    (crypto.randomUUID ? crypto.randomUUID() : crypto.randomBytes(16).toString('hex'));

  res.on('finish', () => {
    const actorUserId = req.user?.id ?? null;
    const actorEmail = req.user?.email ?? null;
    const actorRole = req.userRole ?? null;
    const actorName = req.userName ?? null;
    const method = String(req.method || '').toUpperCase();
    const action = actionFromMethod(method);
    const status = res.statusCode;
    const { entityType, entityLabel } = inferEntityFromRoute(route);
    const entityId = String(defaultEntityId(req) ?? '');
    const summary = `${humanVerb(action)} ${entityLabel || 'registro'}${entityId ? ` (${entityId})` : ''}`;

    const meta = sanitizeValue({
      body: req.body,
      params: req.params,
      query: req.query,
    });

    supabaseAdmin
      .from('activity_logs')
      .insert({
        actor_user_id: actorUserId,
        actor_email: actorEmail,
        actor_role: actorRole,
        actor_name: actorName,
        action,
        summary,
        entity_type: entityType,
        entity_id: entityId || null,
        method,
        route,
        status,
        request_id: requestId,
        meta,
      })
      .then(({ error }) => {
        if (error) console.warn('ActivityLog error:', error.message);
      });
  });

  next();
}
