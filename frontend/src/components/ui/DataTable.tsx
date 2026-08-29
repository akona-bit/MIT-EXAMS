import { type ReactNode } from 'react';
import { Skeleton } from './Skeleton';
import { SearchX } from 'lucide-react';
import { motion } from 'framer-motion';

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
      <div className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-2xl shadow-sm overflow-hidden">
        <table className="w-full text-left text-sm whitespace-nowrap">
          <thead className="bg-slate-50 dark:bg-slate-950/50 border-b border-slate-200 dark:border-white/10">
            <tr>
              {columns.map((col, i) => (
                <th key={i} className="px-6 py-4" style={{ width: col.width }}>
                  <Skeleton className="h-4 w-20" />
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-white/5">
            {[1, 2, 3, 4, 5].map((row) => (
              <tr key={row}>
                {columns.map((_, i) => (
                  <td key={i} className="px-6 py-4">
                    <Skeleton className={`h-4 ${i === 0 ? 'w-8' : i === columns.length - 1 ? 'w-16' : 'w-full max-w-[200px]'}`} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-2xl shadow-sm overflow-hidden">
        <table className="w-full text-left text-sm whitespace-nowrap">
          <thead className="bg-slate-50 dark:bg-slate-950/50 border-b border-slate-200 dark:border-white/10 text-slate-500 dark:text-slate-400 uppercase tracking-wider text-xs">
            <tr>
              {columns.map((col) => (
                <th key={col.key} className="px-6 py-4 font-semibold" style={{ width: col.width }}>
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
        </table>
        <div className="flex flex-col items-center justify-center py-16 px-4">
          <motion.div 
            initial={{ scale: 0.9, opacity: 0 }} 
            animate={{ scale: 1, opacity: 1 }} 
            className="flex h-16 w-16 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800 mb-4"
          >
            <SearchX className="h-8 w-8 text-slate-400" />
          </motion.div>
          <p className="text-sm font-medium text-slate-600 dark:text-slate-400">{emptyMessage}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full overflow-x-auto bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl border border-slate-200/60 dark:border-white/10 rounded-2xl shadow-[0_4px_20px_rgb(0,0,0,0.03)] dark:shadow-[0_4px_20px_rgb(0,0,0,0.2)]">
      <table className="w-full text-left text-sm whitespace-nowrap">
        <thead className="bg-slate-50/80 dark:bg-slate-950/50 border-b border-slate-200/60 dark:border-white/10 text-slate-500 dark:text-slate-400 uppercase tracking-wider text-xs">
          <tr>
            {columns.map((col) => (
              <th key={col.key} className="px-6 py-4 font-semibold" style={{ width: col.width }}>
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100/80 dark:divide-white/5">
          {data.map((row) => (
            <motion.tr 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              key={keyExtractor(row)} 
              className="group hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-all duration-200 hover:shadow-[0_4px_20px_rgb(0,0,0,0.02)]"
            >
              {columns.map((col) => (
                <td key={col.key} className="px-6 py-4 text-slate-700 dark:text-slate-300 transition-colors group-hover:text-slate-900 dark:group-hover:text-white">
                  {col.render ? col.render(row) : (row as any)[col.key]}
                </td>
              ))}
            </motion.tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
