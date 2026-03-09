import React, { useMemo, useState } from 'react';
import { ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react';
import { Table, TableBody, TableHead, TableHeader, TableRow, TableCell } from './UI';
import { TableLoadingRows } from './LoadingSpinner';
import { EmptyState } from './EmptyState';

export interface ColumnDef<T> {
  key: string;
  header: string;
  /** Extract value for sorting and default cell rendering */
  accessor?: (row: T) => React.ReactNode;
  /** Custom cell renderer — overrides accessor */
  cell?: (row: T) => React.ReactNode;
  sortable?: boolean;
  className?: string;
  headerClassName?: string;
}

interface DataTableProps<T extends { id: number | string }> {
  columns: ColumnDef<T>[];
  data: T[];
  loading?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyAction?: { label: string; onClick: () => void };
  rowKey?: (row: T) => string | number;
  onRowClick?: (row: T) => void;
  className?: string;
}

type SortDir = 'asc' | 'desc' | null;

/**
 * Tabla genérica con soporte para ordenamiento de columnas, loading skeleton y estado vacío.
 * Acepta un tipo T genérico con su definición de columnas.
 *
 * @example
 * const columns: ColumnDef<Tutor>[] = [
 *   { key: 'nombre', header: 'Nombre', accessor: t => t.nombre, sortable: true },
 *   { key: 'estado', header: 'Estado', cell: t => <StatusBadge status={t.estado} /> },
 * ];
 *
 * <DataTable columns={columns} data={tutores} loading={loading} />
 */
export function DataTable<T extends { id: number | string }>({
  columns,
  data,
  loading = false,
  emptyTitle,
  emptyDescription,
  emptyAction,
  rowKey,
  onRowClick,
  className = '',
}: DataTableProps<T>) {
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>(null);

  const handleSort = (key: string) => {
    if (sortKey !== key) {
      setSortKey(key);
      setSortDir('asc');
    } else if (sortDir === 'asc') {
      setSortDir('desc');
    } else {
      setSortKey(null);
      setSortDir(null);
    }
  };

  const sorted = useMemo(() => {
    if (!sortKey || !sortDir) return data;
    const col = columns.find(c => c.key === sortKey);
    if (!col?.accessor) return data;
    return [...data].sort((a, b) => {
      const va = String(col.accessor!(a) ?? '');
      const vb = String(col.accessor!(b) ?? '');
      const cmp = va.localeCompare(vb, 'es', { sensitivity: 'base', numeric: true });
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [data, sortKey, sortDir, columns]);

  const getKey = (row: T) => rowKey ? rowKey(row) : row.id;

  return (
    <div className={className}>
      <Table>
        <TableHeader>
          <tr>
            {columns.map(col => (
              <TableHead
                key={col.key}
                className={col.headerClassName}
                onClick={col.sortable ? () => handleSort(col.key) : undefined}
                style={col.sortable ? { cursor: 'pointer', userSelect: 'none' } : undefined}
              >
                <span className="inline-flex items-center gap-1">
                  {col.header}
                  {col.sortable && (
                    sortKey === col.key
                      ? sortDir === 'asc'
                        ? <ChevronUp className="w-3.5 h-3.5 text-[#00AEEF]" />
                        : <ChevronDown className="w-3.5 h-3.5 text-[#00AEEF]" />
                      : <ChevronsUpDown className="w-3.5 h-3.5 text-slate-500" />
                  )}
                </span>
              </TableHead>
            ))}
          </tr>
        </TableHeader>
        <TableBody>
          {loading ? (
            <TableLoadingRows cols={columns.length} />
          ) : sorted.length === 0 ? (
            <tr>
              <td colSpan={columns.length}>
                <EmptyState
                  title={emptyTitle}
                  description={emptyDescription}
                  action={emptyAction}
                />
              </td>
            </tr>
          ) : (
            sorted.map(row => (
              <TableRow
                key={getKey(row)}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                style={onRowClick ? { cursor: 'pointer' } : undefined}
              >
                {columns.map(col => (
                  <TableCell key={col.key} className={col.className}>
                    {col.cell ? col.cell(row) : col.accessor ? col.accessor(row) : null}
                  </TableCell>
                ))}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
