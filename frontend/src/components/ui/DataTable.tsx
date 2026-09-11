import { type ReactNode, useState, useMemo } from 'react';
import { Skeleton } from './Skeleton';
import { SearchX, ChevronLeft, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export interface Column<T> {
  key: string;
  header: ReactNode | string;
  render?: (row: T) => ReactNode;
  width?: string;
  fixed?: boolean;
}

interface DataTableProps<T> {
  data: T[];
  columns: Column<T>[];
  keyExtractor: (item: T) => string | number;
  isLoading?: boolean;
  emptyMessage?: string;
  pageSize?: number;
  compact?: boolean;
}

export default function DataTable<T>({
  data,
  columns,
  keyExtractor,
  isLoading = false,
  emptyMessage = 'Không có dữ liệu',
  pageSize = 15,
  compact = false,
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
      <div className="w-full rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden dark:border-slate-800 dark:bg-slate-900">
        <table className="w-full text-left text-sm whitespace-nowrap relative z-10">
          <thead className="border-b border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-950">
            <tr>
              {columns.map((col, i) => (
                <th key={i} className={`${compact ? 'px-4 py-2.5' : 'px-6 py-5'}`} style={{ width: col.width }}>
                  <Skeleton className="h-4 w-20 rounded-full" />
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
            {[1, 2, 3, 4, 5].map((row) => (
              <tr key={row}>
                {columns.map((_, i) => (
                  <td key={i} className={`${compact ? 'px-4 py-2' : 'px-6 py-5'}`}>
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
      <div className="w-full rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden dark:border-slate-800 dark:bg-slate-900">
        <table className="w-full text-left text-sm whitespace-nowrap relative z-10">
          <thead className="border-b border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-950 text-slate-500 dark:text-slate-400 uppercase tracking-widest text-xs font-bold">
            <tr>
              {columns.map((col) => (
                <th key={col.key} className={`${compact ? 'px-4 py-2.5' : 'px-6 py-5'}`} style={{ width: col.width }}>
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

  const getPageNumbers = (current: number, total: number) => {
    if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
    if (current <= 4) return [1, 2, 3, 4, 5, "...", total];
    if (current >= total - 3) return [1, "...", total - 4, total - 3, total - 2, total - 1, total];
    return [1, "...", current - 1, current, current + 1, "...", total];
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="w-full overflow-auto max-h-[calc(100vh-280px)] min-h-[300px] rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900 scrollbar-thin scrollbar-thumb-slate-300 dark:scrollbar-thumb-slate-700">
        <table className="w-full text-left text-sm whitespace-nowrap relative">
          <thead className="border-b border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-950 text-slate-500 dark:text-slate-400 uppercase tracking-widest text-[11px] font-extrabold">
            <tr>
              {columns.map((col) => (
                <th key={col.key} className={`${compact ? 'px-4 py-2.5' : 'px-6 py-5'} sticky top-0 ${col.fixed ? 'left-0 z-30 shadow-[1px_1px_0_0_#e2e8f0] dark:shadow-[1px_1px_0_0_#1e293b]' : 'z-20 shadow-[0_1px_0_0_#e2e8f0] dark:shadow-[0_1px_0_0_#1e293b]'} bg-slate-50 dark:bg-slate-950`} style={{ width: col.width }}>
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
            <AnimatePresence>
              {currentData.map((row, index) => (
                <motion.tr 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.03, duration: 0.2 }}
                  key={keyExtractor(row)} 
                  className="group hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                >
                  {columns.map((col) => (
                    <td key={col.key} className={`${compact ? 'px-4 py-1.5 text-[13px]' : 'px-6 py-4'} text-slate-700 dark:text-slate-300 font-medium transition-colors group-hover:text-slate-900 dark:group-hover:text-white ${col.fixed ? 'sticky left-0 z-10 bg-white dark:bg-slate-900 group-hover:bg-slate-50 dark:group-hover:bg-slate-800/50 shadow-[1px_0_0_0_#e2e8f0] dark:shadow-[1px_0_0_0_#1e293b]' : ''}`}>
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
              <p className="text-sm font-medium text-slate-500 dark:text-slate-400 bg-white dark:bg-slate-900 px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-800 shadow-sm">
                Hiển thị <span className="font-bold text-indigo-600 dark:text-indigo-400">{(validCurrentPage - 1) * pageSize + 1}</span> -{' '}
                <span className="font-bold text-indigo-600 dark:text-indigo-400">
                  {Math.min(validCurrentPage * pageSize, data.length)}
                </span>{' '}
                / <span className="font-bold text-slate-700 dark:text-slate-300">{data.length}</span>
              </p>
            </div>
            <div>
              <nav className="isolate inline-flex gap-1.5" aria-label="Pagination">
                <button
                  onClick={handlePrevPage}
                  disabled={validCurrentPage === 1}
                  className="relative inline-flex items-center rounded-lg px-2 py-2 text-slate-500 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <span className="sr-only">Previous</span>
                  <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                </button>
                
                {getPageNumbers(validCurrentPage, totalPages).map((pageNum, idx) => {
                  if (pageNum === "...") {
                    return (
                      <span key={`ellipsis-${idx}`} className="relative inline-flex items-center px-3 py-2 text-sm font-medium text-slate-400">
                        ...
                      </span>
                    );
                  }
                  
                  const isCurrent = pageNum === validCurrentPage;
                  return (
                    <button
                      key={pageNum}
                      onClick={() => setCurrentPage(pageNum as number)}
                      className={`relative inline-flex items-center px-3.5 py-2 text-sm font-semibold rounded-lg shadow-sm transition-colors border ${
                        isCurrent 
                          ? "z-10 bg-primary-50 border-primary-200 text-primary-600 dark:bg-primary-900/30 dark:border-primary-500/30 dark:text-primary-400" 
                          : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50 dark:bg-slate-900 dark:border-slate-800 dark:text-slate-300 dark:hover:bg-slate-800"
                      }`}
                    >
                      {pageNum}
                    </button>
                  );
                })}

                <button
                  onClick={handleNextPage}
                  disabled={validCurrentPage === totalPages}
                  className="relative inline-flex items-center rounded-lg px-2 py-2 text-slate-500 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
