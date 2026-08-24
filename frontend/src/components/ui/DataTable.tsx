import { type ReactNode } from 'react';

export interface Column<T> {
  key: string;
  header: string;
  render?: (row: T) => ReactNode;
  width?: string;
}

interface DataTableProps<T> {
  data: T[];
  columns: Column<T>[];
  keyExtractor: (item: T) => string | number;
  isLoading?: boolean;
  emptyMessage?: string;
}

export default function DataTable<T>({
  data,
  columns,
  keyExtractor,
  isLoading = false,
  emptyMessage = 'Không có dữ liệu',
}: DataTableProps<T>) {
  if (isLoading) {
    return (
      <div className="w-full h-48 flex items-center justify-center bg-white border border-neutral-200 rounded-xl">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500" />
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="w-full h-48 flex items-center justify-center bg-white border border-neutral-200 rounded-xl">
        <p className="text-neutral-500">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="w-full overflow-x-auto bg-white border border-neutral-200 rounded-xl shadow-sm">
      <table className="w-full text-left text-sm whitespace-nowrap">
        <thead className="bg-neutral-50 border-b border-neutral-200 text-neutral-500 uppercase tracking-wider text-xs">
          <tr>
            {columns.map((col) => (
              <th key={col.key} className="px-6 py-4 font-semibold" style={{ width: col.width }}>
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-neutral-100">
          {data.map((row) => (
            <tr key={keyExtractor(row)} className="hover:bg-neutral-50/50 transition-colors">
              {columns.map((col) => (
                <td key={col.key} className="px-6 py-4 text-neutral-700">
                  {col.render ? col.render(row) : (row as any)[col.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
