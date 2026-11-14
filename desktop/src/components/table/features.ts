/**
 * The one TanStack Table v9 feature bundle: sorting within the already-limited page
 * the server returned (20 rows, cursor-paged). Filtering and paging stay server-side.
 */
import { createSortedRowModel, rowSortingFeature, sortFns, tableFeatures } from '@tanstack/react-table';

export const listFeatures = tableFeatures({ rowSortingFeature, sortedRowModel: createSortedRowModel(), sortFns });
export type ListFeatures = typeof listFeatures;
