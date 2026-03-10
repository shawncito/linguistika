import { useEffect, useRef } from 'react';
import { supabaseClient } from '../lib/supabaseClient';
import type { RealtimeChannel } from '@supabase/supabase-js';

/**
 * Subscribe to Supabase realtime changes on one or more tables.
 * When any INSERT/UPDATE/DELETE occurs, calls `onUpdate`.
 *
 * @param tables  Table name(s) to listen to
 * @param onUpdate  Callback fired on any change (debounced 300ms)
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

  useEffect(() => {
    if (!enabled || !supabaseClient) return;

    const tableList = Array.isArray(tables) ? tables : [tables];
    if (tableList.length === 0) return;

    let timer: ReturnType<typeof setTimeout> | null = null;
    const debouncedUpdate = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => onUpdateRef.current(), 300);
    };

    const channelName = `rt-${tableList.join('-')}-${Date.now()}`;
    let channel: RealtimeChannel = supabaseClient.channel(channelName);

    for (const table of tableList) {
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
  }, [tables, enabled]);
}
