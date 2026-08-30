import { type ReactNode, useState, useMemo } from 'react';
import { Skeleton } from './Skeleton';
import { SearchX, ChevronLeft, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

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
  pageSize?: number;
}

export default function DataTable<T>({
  data,
  columns,
  keyExtractor,
  isLoading = false,
  emptyMessage = 'Không có dữ liệu',
  pageSize = 50,
}: DataTableProps<T>) {
  const [currentPage, setCurrentPage] = useState(1);

  const totalPages = Math.max(1, Math.ceil(data.length / pageSize));
  
  const validCurrentPage = Math.min(currentPage, totalPages);
  
  const currentData = useMemo(() => {
    const start = (validCurrentPage - 1) * pageSize;
    return data.slice(start, start + pageSize);
  }, [data, validCurrentPage, pageSize]);

  const handlePrevPage = () => {
    if (validCurrentPage > 1) setCurrentPage(validCurrentPage - 1);
  };

  const handleNextPage = () => {
    if (validCurrentPage < totalPages) setCurrentPage(validCurrentPage + 1);
  };

  if (isLoading) {
    return (
      <div className="w-full bg-white/60 dark:bg-slate-900/40 backdrop-blur-xl border border-white/40 dark:border-white/10 rounded-3xl shadow-xl overflow-hidden relative">
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-50/30 to-purple-50/30 dark:from-indigo-900/10 dark:to-purple-900/10 pointer-events-none" />
        <table className="w-full text-left text-sm whitespace-nowrap relative z-10">
          <thead className="bg-slate-50/50 dark:bg-slate-800/30 border-b border-slate-200/50 dark:border-white/5">
            <tr>
              {columns.map((col, i) => (
                <th key={i} className="px-6 py-5" style={{ width: col.width }}>
                  <Skeleton className="h-4 w-20 rounded-full" />
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100/50 dark:divide-white/5">
            {[1, 2, 3, 4, 5].map((row) => (
              <tr key={row}>
                {columns.map((_, i) => (
                  <td key={i} className="px-6 py-5">
                    <Skeleton className={`h-4 rounded-full ${i === 0 ? 'w-8' : i === columns.length - 1 ? 'w-16' : 'w-full max-w-[200px]'}`} />
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
      <div className="w-full bg-white/60 dark:bg-slate-900/40 backdrop-blur-xl border border-white/40 dark:border-white/10 rounded-3xl shadow-xl overflow-hidden relative">
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-50/30 to-purple-50/30 dark:from-indigo-900/10 dark:to-purple-900/10 pointer-events-none" />
        <table className="w-full text-left text-sm whitespace-nowrap relative z-10">
          <thead className="bg-slate-50/50 dark:bg-slate-800/30 border-b border-slate-200/50 dark:border-white/5 text-slate-500 dark:text-slate-400 uppercase tracking-widest text-xs font-bold">
            <tr>
              {columns.map((col) => (
                <th key={col.key} className="px-6 py-5" style={{ width: col.width }}>
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
        </table>
        <div className="flex flex-col items-center justify-center py-24 px-4 relative z-10">
          <motion.div 
            initial={{ scale: 0.8, opacity: 0, rotate: -10 }} 
            animate={{ scale: 1, opacity: 1, rotate: 0 }} 
            transition={{ type: "spring", stiffness: 200, damping: 15 }}
            className="flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-slate-100 to-slate-50 dark:from-slate-800 dark:to-slate-900 shadow-inner mb-6 border border-white/50 dark:border-white/5"
          >
            <SearchX className="h-10 w-10 text-slate-400 dark:text-slate-500" />
          </motion.div>
          <p className="text-base font-medium text-slate-500 dark:text-slate-400">{emptyMessage}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="w-full overflow-x-auto bg-white/60 dark:bg-slate-900/40 backdrop-blur-2xl border border-white/40 dark:border-white/10 rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.2)] relative">
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-50/20 to-violet-50/20 dark:from-indigo-900/5 dark:to-violet-900/5 pointer-events-none" />
        <table className="w-full text-left text-sm whitespace-nowrap relative z-10">
          <thead className="bg-slate-50/50 dark:bg-slate-950/30 border-b border-slate-200/50 dark:border-white/5 text-slate-500 dark:text-slate-400 uppercase tracking-widest text-[11px] font-extrabold">
            <tr>
              {columns.map((col) => (
                <th key={col.key} className="px-6 py-5" style={{ width: col.width }}>
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100/50 dark:divide-white/5">
            <AnimatePresence>
              {currentData.map((row, index) => (
                <motion.tr 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.03, duration: 0.2 }}
                  key={keyExtractor(row)} 
                  className="group hover:bg-white/80 dark:hover:bg-slate-800/60 transition-all duration-300 hover:shadow-[0_4px_20px_rgb(0,0,0,0.03)] dark:hover:shadow-[0_4px_20px_rgb(0,0,0,0.3)] relative"
                >
                  {columns.map((col) => (
                    <td key={col.key} className="px-6 py-4 text-slate-700 dark:text-slate-300 font-medium transition-colors group-hover:text-slate-900 dark:group-hover:text-white">
                      {col.render ? col.render(row) : (row as any)[col.key]}
                    </td>
                  ))}
                </motion.tr>
              ))}
            </AnimatePresence>
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between px-2 sm:px-4">
          <div className="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-medium text-slate-500 dark:text-slate-400 bg-white/50 dark:bg-slate-900/50 backdrop-blur-md px-4 py-2 rounded-full border border-slate-200/50 dark:border-slate-800/50 shadow-sm">
                Hiển thị <span className="font-bold text-indigo-600 dark:text-indigo-400">{(validCurrentPage - 1) * pageSize + 1}</span> -{' '}
                <span className="font-bold text-indigo-600 dark:text-indigo-400">
                  {Math.min(validCurrentPage * pageSize, data.length)}
                </span>{' '}
                / <span className="font-bold text-slate-700 dark:text-slate-300">{data.length}</span>
              </p>
            </div>
            <div>
              <nav className="isolate inline-flex gap-2" aria-label="Pagination">
                <button
                  onClick={handlePrevPage}
                  disabled={validCurrentPage === 1}
                  className="relative inline-flex items-center rounded-full px-3 py-2 text-slate-500 bg-white/70 dark:bg-slate-900/70 backdrop-blur-md border border-slate-200/60 dark:border-slate-800/60 shadow-sm hover:bg-white dark:hover:bg-slate-800 hover:text-indigo-600 dark:hover:text-indigo-400 hover:shadow-md transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-white/70 disabled:hover:shadow-sm"
                >
                  <span className="sr-only">Previous</span>
                  <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                </button>
                <div className="relative inline-flex items-center px-4 py-2 text-sm font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50/50 dark:bg-indigo-500/10 backdrop-blur-md rounded-full border border-indigo-100 dark:border-indigo-500/20 shadow-sm min-w-[5rem] justify-center">
                  {validCurrentPage} / {totalPages}
                </div>
                <button
                  onClick={handleNextPage}
                  disabled={validCurrentPage === totalPages}
                  className="relative inline-flex items-center rounded-full px-3 py-2 text-slate-500 bg-white/70 dark:bg-slate-900/70 backdrop-blur-md border border-slate-200/60 dark:border-slate-800/60 shadow-sm hover:bg-white dark:hover:bg-slate-800 hover:text-indigo-600 dark:hover:text-indigo-400 hover:shadow-md transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-white/70 disabled:hover:shadow-sm"
                >
                  <span className="sr-only">Next</span>
                  <ChevronRight className="h-4 w-4" aria-hidden="true" />
                </button>
              </nav>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
