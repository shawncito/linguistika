import React, { useEffect, useMemo, useState } from 'react';
import { X, RefreshCcw, Search } from 'lucide-react';
import { api } from '../services/api';

type ActivityItem = {
  id: string;
  created_at: string;
  actor_name?: string | null;
  actor_email?: string | null;
  actor_role?: string | null;
  action?: string | null;
  summary?: string | null;
  entity_type?: string | null;
  entity_id?: string | null;
  method?: string | null;
  route?: string | null;
  status?: number | null;
  meta?: any;
};

export const ACTIVITY_LAST_SEEN_KEY = 'activity.lastSeenAt';

function formatDateTime(value: string) {
  try {
    return new Date(value).toLocaleString('es-CR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  } catch {
    return value;
  }
}

export const ActivityLogDrawer: React.FC<{
  open: boolean;
  onClose: () => void;
}> = ({ open, onClose }) => {
  const [items, setItems] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const canRender = open;

  const fetchLogs = async (opts?: { q?: string }) => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.activity.list({ limit: 200, offset: 0, q: opts?.q ?? query });
      setItems((res.items || []) as ActivityItem[]);
    } catch (e: any) {
      const status = e?.response?.status;
      if (status === 403) {
        setError('No autorizado para ver el log.');
      } else if (status === 500 && e?.response?.data?.code === 'ACTIVITY_LOG_NOT_CONFIGURED') {
        setError('Activity Log no está configurado en el servidor (falta SUPABASE_SERVICE_KEY).');
      } else {
        setError(e?.response?.data?.error || e?.message || 'Error cargando logs.');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!open) return;
    fetchLogs();
    // Marcar como visto al abrir
    try {
      localStorage.setItem(ACTIVITY_LAST_SEEN_KEY, new Date().toISOString());
    } catch {
      // ignore
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const t = window.setInterval(() => fetchLogs(), 15000);
    return () => window.clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, query]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    const match = (v: any) => String(v ?? '').toLowerCase().includes(q);
    return items.filter((it) =>
      match(it.summary) ||
      match(it.actor_email) ||
      match(it.route) ||
      match(it.action) ||
      match(it.entity_type) ||
      match(it.entity_id)
    );
  }, [items, query]);

  if (!canRender) return null;

  return (
    <div className="fixed inset-0 z-[100]">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />

      <aside className="absolute right-0 top-0 h-full w-full max-w-xl bg-[#061735] border-l border-white/10 shadow-2xl flex flex-col">
        <div className="h-16 px-4 flex items-center justify-between border-b border-white/10">
          <div className="flex flex-col">
            <h2 className="text-white font-black text-lg">Log del Sistema</h2>
            <p className="text-xs text-slate-400 font-semibold">Movimientos (crear/editar/eliminar) con hora y usuario</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => fetchLogs()}
              className="h-10 w-10 rounded-lg bg-white/10 border border-white/10 hover:bg-white/15 text-white flex items-center justify-center"
              title="Refrescar"
            >
              <RefreshCcw className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="h-10 w-10 rounded-lg bg-white/10 border border-white/10 hover:bg-white/15 text-white flex items-center justify-center"
              title="Cerrar"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="p-4 border-b border-white/10">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar por usuario, ruta, acción, entidad..."
              className="w-full h-11 pl-10 pr-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-[#00AEEF]/30"
            />
          </div>
        </div>

        <div className="flex-1 overflow-auto p-4 space-y-3">
          {error && (
            <div className="rounded-xl border border-red-500/30 bg-red-500/10 text-red-100 px-4 py-3 text-sm font-semibold">
              {error}
            </div>
          )}

          {!error && loading && (
            <div className="text-slate-300 text-sm font-semibold">Cargando…</div>
          )}

          {!error && !loading && filtered.length === 0 && (
            <div className="text-slate-400 text-sm font-semibold">No hay registros.</div>
          )}

          {filtered.map((it) => {
            const isExpanded = expandedId === it.id;
            const status = it.status ?? null;
            const isError = typeof status === 'number' && status >= 400;
            const title = it.summary || `${it.action || 'acción'} · ${it.method || ''} ${it.route || ''}`.trim();
            const who = (it.actor_name && String(it.actor_name).trim()) || it.actor_email || 'Sistema';
            const when = formatDateTime(it.created_at);

            return (
              <div key={it.id} className="rounded-2xl border border-white/10 bg-white/5 overflow-hidden">
                <button
                  type="button"
                  onClick={() => setExpandedId((v) => (v === it.id ? null : it.id))}
                  className="w-full text-left px-4 py-3 hover:bg-white/5 transition-colors"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-white font-extrabold text-sm truncate">{title}</p>
                      <p className="text-[11px] text-slate-400 font-semibold truncate">
                        {when} · {who}
                        {it.actor_role ? ` · ${String(it.actor_role).toUpperCase()}` : ''}
                      </p>
                      <p className="text-[11px] text-slate-500 font-semibold truncate">
                        {it.method || '—'} {it.route || '—'}
                        {it.entity_type || it.entity_id ? ` · ${it.entity_type || 'entidad'}:${it.entity_id || '—'}` : ''}
                      </p>
                    </div>
                    {status !== null && (
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-black border tabular-nums ${
                          isError
                            ? 'border-red-500/30 bg-red-500/10 text-red-200'
                            : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200'
                        }`}
                      >
                        {status}
                      </span>
                    )}
                  </div>
                </button>

                {isExpanded && (
                  <div className="px-4 pb-4">
                    <div className="rounded-xl bg-black/20 border border-white/10 p-3 text-xs text-slate-200 overflow-auto">
                      <pre className="whitespace-pre-wrap break-words">{JSON.stringify(it.meta ?? {}, null, 2)}</pre>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </aside>
    </div>
  );
};
