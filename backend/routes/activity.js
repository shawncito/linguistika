import express from 'express';
import { supabaseAdmin } from '../supabase.js';
import { requireRoles } from '../middleware/roles.js';

const router = express.Router();

router.get('/', requireRoles(['admin', 'contador']), async (req, res) => {
  try {
    if (!supabaseAdmin) {
      return res.status(500).json({
        error: 'SUPABASE_SERVICE_KEY no configurada; activity log requiere permisos admin.',
        code: 'ACTIVITY_LOG_NOT_CONFIGURED',
      });
    }

    const limitRaw = Number(req.query.limit ?? 200);
    const offsetRaw = Number(req.query.offset ?? 0);
    const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 500) : 200;
    const offset = Number.isFinite(offsetRaw) ? Math.max(offsetRaw, 0) : 0;

    const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';

    const buildQuery = (includeActorName) => {
      const cols = includeActorName
        ? 'id, created_at, actor_user_id, actor_name, actor_email, actor_role, action, summary, entity_type, entity_id, method, route, status, request_id, meta'
        : 'id, created_at, actor_user_id, actor_email, actor_role, action, summary, entity_type, entity_id, method, route, status, request_id, meta';

      let query = supabaseAdmin
        .from('activity_logs')
        .select(cols, { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (q) {
        const like = `%${q.replace(/%/g, '\\%')}%`;
        query = query.or(
          [
            `summary.ilike.${like}`,
            ...(includeActorName ? [`actor_name.ilike.${like}`] : []),
            `actor_email.ilike.${like}`,
            `route.ilike.${like}`,
            `entity_type.ilike.${like}`,
            `entity_id.ilike.${like}`,
            `action.ilike.${like}`,
          ].join(',')
        );
      }

      return query;
    };

    let data;
    let count;

    // Intentar con actor_name primero; si la columna no existe, reintentar sin ella.
    let res1 = await buildQuery(true);
    if (res1.error) {
      const msg = String(res1.error.message || '').toLowerCase();
      if (msg.includes('actor_name') && msg.includes('does not exist')) {
        res1 = await buildQuery(false);
      }
    }

    if (res1.error) throw res1.error;
    data = res1.data;
    count = res1.count;

    return res.json({ items: data ?? [], count: count ?? null, limit, offset });
  } catch (err) {
    console.error('❌ /api/activity error:', err);
    return res.status(500).json({ error: err?.message || String(err) });
  }
});

export default router;
