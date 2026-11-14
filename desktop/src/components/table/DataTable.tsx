import { Button } from 'react-aria-components';
import { createColumnHelper, flexRender, useTable } from '@tanstack/react-table';
import { listFeatures, type ListFeatures } from '@/components/table/features';
import { useT } from '@/i18n';

/** Columns for DataTable, built with `columnsFor<T>().columns([...])` (callers never spell the feature type). */
export type DataTableColumns<T extends object> = ReturnType<ReturnType<typeof createColumnHelper<ListFeatures, T>>['columns']>;
/** Column helper bound to the shared feature bundle. */
export const columnsFor = <T extends object>() => createColumnHelper<ListFeatures, T>();

/**
 * The shared list table in the dummy's ledger markup: sortable headers within the
 * page the server returned, `aria-sort` on each header, a named empty state.
 * `stack` turns rows into labelled cards on a narrow window (`.ledger.stack-sm`).
 */
export function DataTable<T extends object>({ data, columns, empty, rowKey, stack }: { data: T[]; columns: DataTableColumns<T>; empty: string; rowKey: (row: T) => string; stack?: boolean }) {
  const t = useT();
  const table = useTable({ features: listFeatures, data, columns, getRowId: rowKey });
  if (!data.length) return <p className="lede">{empty}</p>;
  return (
    <table className={stack ? 'ledger stack-sm' : 'ledger'}>
      <thead>
        {table.getHeaderGroups().map((hg) => (
          <tr key={hg.id}>
            {hg.headers.map((h) => {
              const sorted = h.column.getIsSorted();
              const num = (h.column.columnDef.meta as { num?: boolean } | undefined)?.num;
              return (
                <th key={h.id} className={num ? 'num' : undefined} aria-sort={sorted === 'asc' ? 'ascending' : sorted === 'desc' ? 'descending' : 'none'}>
                  {h.column.getCanSort() ? (
                    <Button className="sort-btn" onPress={() => h.column.toggleSorting()} aria-label={t('common.sortBy', { column: String(h.column.columnDef.header ?? h.id) })}>
                      {flexRender(h.column.columnDef.header, h.getContext())}
                      <span aria-hidden="true">{sorted === 'asc' ? ' ▲' : sorted === 'desc' ? ' ▼' : ''}</span>
                    </Button>
                  ) : flexRender(h.column.columnDef.header, h.getContext())}
                </th>
              );
            })}
          </tr>
        ))}
      </thead>
      <tbody>
        {table.getRowModel().rows.map((row) => (
          <tr key={row.id}>
            {row.getAllCells().map((c) => {
              const meta = c.column.columnDef.meta as { num?: boolean; label?: string } | undefined;
              const header = c.column.columnDef.header;
              const label = stack ? meta?.label ?? (typeof header === 'string' ? header : undefined) : undefined;
              return <td key={c.id} className={meta?.num ? 'num' : undefined} data-label={label}>{flexRender(c.column.columnDef.cell, c.getContext())}</td>;
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
