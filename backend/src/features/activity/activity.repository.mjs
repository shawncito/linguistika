import { supabaseAdmin } from '../../shared/config/supabaseClient.mjs';
import AppError from '../../shared/errors/AppError.mjs';
import { ACTIVITY_DEFAULT_LIMIT, ACTIVITY_MAX_LIMIT } from './activity.schemas.mjs';

export async function findAll({ limitRaw, offsetRaw, q } = {}) {
  if (!supabaseAdmin) {
    throw new AppError(
      'SUPABASE_SERVICE_KEY no configurada; activity log requiere permisos admin.',
      503
    );
  }

  const limit = Number.isFinite(Number(limitRaw))
    ? Math.min(Math.max(Number(limitRaw), 1), ACTIVITY_MAX_LIMIT)
    : ACTIVITY_DEFAULT_LIMIT;
  const offset = Number.isFinite(Number(offsetRaw)) ? Math.max(Number(offsetRaw), 0) : 0;
  const qStr = typeof q === 'string' ? q.trim() : '';

  const buildQuery = (includeActorName) => {
    const cols = includeActorName
      ? 'id, created_at, actor_user_id, actor_name, actor_email, actor_role, action, summary, entity_type, entity_id, method, route, status, request_id, meta'
      : 'id, created_at, actor_user_id, actor_email, actor_role, action, summary, entity_type, entity_id, method, route, status, request_id, meta';

    let query = supabaseAdmin
      .from('activity_logs')
      .select(cols, { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (qStr) {
      const like = `%${qStr.replace(/%/g, '\\%')}%`;
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

  let result = await buildQuery(true);
  if (result.error) {
    const msg = String(result.error.message || '').toLowerCase();
    if (msg.includes('actor_name') && msg.includes('does not exist')) {
      result = await buildQuery(false);
    }
  }

  if (result.error) throw result.error;

  return { items: result.data ?? [], count: result.count ?? null, limit, offset };
}
