import { useEffect, useRef } from 'react';
import { supabaseClient } from '../lib/supabaseClient';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { clearHttpGetCache } from '../services/api/apiClient';

/**
 * Subscribe to Supabase realtime changes on one or more tables.
 * When any INSERT/UPDATE/DELETE occurs, calls `onUpdate`.
 *
 * @param tables  Table name(s) to listen to
 * @param onUpdate  Callback fired on any change (debounced)
 * @param enabled  Optional flag to enable/disable the subscription
 *
 * @example
 * useRealtimeSubscription('estudiantes', refresh);
 * useRealtimeSubscription(['estudiantes', 'matriculas', 'cursos'], fetchData);
 */
export function useRealtimeSubscription(
  tables: string | string[],
  onUpdate: () => void,
  enabled = true,
) {
  const onUpdateRef = useRef(onUpdate);
  onUpdateRef.current = onUpdate;

  const normalizedTables = (Array.isArray(tables) ? tables : [tables])
    .map((table) => String(table || '').trim())
    .filter(Boolean);
  const tablesKey = normalizedTables.join(',');

  useEffect(() => {
    if (!enabled || !supabaseClient) return;

    if (normalizedTables.length === 0) return;

    let timer: ReturnType<typeof setTimeout> | null = null;
    const debouncedUpdate = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        clearHttpGetCache();
        onUpdateRef.current();
      }, 500);
    };

    const channelName = `rt-${tablesKey}-${Date.now()}`;
    let channel: RealtimeChannel = supabaseClient.channel(channelName);

    for (const table of normalizedTables) {
      channel = channel.on(
        'postgres_changes',
        { event: '*', schema: 'public', table },
        debouncedUpdate,
      );
    }

    channel.subscribe();

    return () => {
      if (timer) clearTimeout(timer);
      supabaseClient?.removeChannel(channel);
    };
  }, [enabled, tablesKey]);
}
