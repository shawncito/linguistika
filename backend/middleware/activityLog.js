import crypto from 'crypto';
import { supabaseAdmin } from '../supabase.js';

const MUTATION_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

const SENSITIVE_KEYS = new Set([
  'password',
  'pass',
  'token',
  'access_token',
  'refresh_token',
  'authorization',
  'auth',
]);

function sanitizeValue(value, depth = 0) {
  if (depth > 6) return '[MaxDepth]';
  if (value === null || value === undefined) return value;
  if (typeof value === 'string') {
    if (value.length > 800) return value.slice(0, 800) + '…';
    return value;
  }
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  if (Array.isArray(value)) return value.slice(0, 50).map((v) => sanitizeValue(v, depth + 1));
  if (typeof value === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      if (SENSITIVE_KEYS.has(String(k).toLowerCase())) {
        out[k] = '[REDACTED]';
      } else {
        out[k] = sanitizeValue(v, depth + 1);
      }
    }
    return out;
  }
  return String(value);
}

function actionFromMethod(method) {
  switch (method) {
    case 'POST':
      return 'create';
    case 'PUT':
    case 'PATCH':
      return 'update';
    case 'DELETE':
      return 'delete';
    default:
      return 'unknown';
  }
}

function humanVerb(action) {
  switch (action) {
    case 'create':
      return 'Creó';
    case 'update':
      return 'Actualizó';
    case 'delete':
      return 'Eliminó';
    default:
      return 'Operación';
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

function inferEntityFromRoute(route) {
  const path = String(route || '');
  const parts = path.split('/').filter(Boolean);
  const apiIdx = parts.indexOf('api');
  const afterApi = apiIdx >= 0 ? parts.slice(apiIdx + 1) : parts;
  const first = afterApi[0] || null;
  if (!first) return { entityType: null, entityLabel: null };

  const labelMap = {
    tutores: 'Tutor',
    cursos: 'Curso',
    estudiantes: 'Estudiante',
    matriculas: 'Matrícula',
    pagos: 'Pago',
    movimientos: 'Movimiento',
    dashboard: 'Dashboard',
    bulk: 'Importación',
    admin: 'Admin',
    auth: 'Auth',
  };

  const entityLabel = labelMap[first] || titleCaseEs(singularizeEs(first));
  return { entityType: singularizeEs(first), entityLabel };
}

function defaultEntityId(req) {
  if (!req?.params || typeof req.params !== 'object') return null;
  const p = req.params;
  return (
    p.id ??
    p.tutorId ??
    p.cursoId ??
    p.estudianteId ??
    p.matriculaId ??
    p.pagoId ??
    null
  );
}

function makeDefaultSummary({ action, entityLabel, entityId, status }) {
  const verb = humanVerb(action);
  const entity = entityLabel || 'registro';
  const suffix = entityId ? ` (${entityId})` : '';
  if (typeof status === 'number' && status >= 400) {
    return `Falló: ${verb.toLowerCase()} ${entity}${suffix}`;
  }
  return `${verb} ${entity}${suffix}`;
}

function safeRoute(req) {
  // Evitar meter tokens en query string si existieran
  const original = String(req.originalUrl || req.url || '');
  const [pathOnly] = original.split('?');
  return pathOnly;
}

export function activityLogMiddleware(req, res, next) {
  if (!supabaseAdmin) return next();
  if (!MUTATION_METHODS.has(String(req.method || '').toUpperCase())) return next();

  const route = safeRoute(req);
  if (route.startsWith('/api/activity')) return next();

  const requestId =
    (req.headers['x-request-id'] && String(req.headers['x-request-id'])) ||
    (crypto.randomUUID ? crypto.randomUUID() : crypto.randomBytes(16).toString('hex'));

  const startAt = Date.now();

  res.on('finish', () => {
    const actorUserId = req.user?.id ?? null;
    const actorEmail = req.user?.email ?? null;
    const actorRole = req.userRole ?? null;
    const actorNameRaw = req.userName ?? null;
    const actorName =
      (actorNameRaw && String(actorNameRaw).trim()) ||
      (actorEmail && String(actorEmail).includes('@') ? String(actorEmail).split('@')[0] : null);

    const override = req.activity || null;
    const action = override?.action || actionFromMethod(String(req.method).toUpperCase());

    const inferred = inferEntityFromRoute(route);
    const inferredEntityId = defaultEntityId(req);
    const entityType = override?.entityType ?? inferred.entityType;
    const entityId = override?.entityId ?? inferredEntityId;
    const summary =
      override?.summary ??
      makeDefaultSummary({
        action,
        entityLabel: override?.entityLabel ?? inferred.entityLabel,
        entityId,
        status: res.statusCode,
      });

    const payload = {
      actor_user_id: actorUserId,
      actor_email: actorEmail,
      actor_role: actorRole,
      actor_name: actorName,

      action,
      summary,

      entity_type: entityType ?? null,
      entity_id: entityId ?? null,

      method: String(req.method || '').toUpperCase(),
      route,
      status: res.statusCode,
      request_id: requestId,

      meta: sanitizeValue({
        ms: Date.now() - startAt,
        params: req.params,
        query: req.query,
        body: req.body,
        ip: req.headers['x-forwarded-for'] || req.socket?.remoteAddress || null,
        user_agent: req.headers['user-agent'] || null,
        ...(override?.meta && typeof override.meta === 'object' ? override.meta : null),
      }),
    };

    // Fire-and-forget
    Promise.resolve()
      .then(async () => {
        const tryInsert = async (p) => supabaseAdmin.from('activity_logs').insert(p);

        let { error } = await tryInsert(payload);
        if (error) {
          const msg = String(error.message || '');
          // Si aún no corrieron la migración 012, actor_name no existe. Reintentar sin ese campo.
          if (msg.toLowerCase().includes('actor_name') && msg.toLowerCase().includes('does not exist')) {
            const { actor_name, ...payloadNoActorName } = payload;
            const res2 = await tryInsert(payloadNoActorName);
            error = res2.error;
          }
        }

        if (error) {
          // No romper la app si el log falla
          console.error('❌ activity_logs insert error:', error.message);
        }
      })
      .catch((err) => {
        console.error('❌ activity_logs unexpected error:', err?.message || err);
      });
  });

  return next();
}
