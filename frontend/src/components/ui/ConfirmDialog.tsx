import { type ReactNode, useEffect, useRef, useState } from 'react';
import { motion, useMotionValue, useTransform } from 'framer-motion';
import { ChevronRight, Check, Loader2 } from 'lucide-react';
import Button from './Button';

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: ReactNode;
  confirmText?: string;
  cancelText?: string;
  isDestructive?: boolean;
  isLoading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

function SwipeToConfirm({ onConfirm, isLoading, text = 'Kéo để xóa' }: { onConfirm: () => void, isLoading: boolean, text?: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const x = useMotionValue(0);
  const [isConfirmed, setIsConfirmed] = useState(false);
  const [containerWidth, setContainerWidth] = useState(0);

  useEffect(() => {
    if (containerRef.current) {
      setContainerWidth(containerRef.current.offsetWidth);
    }
  }, []);

  // Background changes color as you drag (subtle danger red)
  const bg = useTransform(x, [0, Math.max(containerWidth - 50, 100)], ['var(--tw-gradient-from, transparent)', 'rgba(239, 68, 68, 0.1)']);
  const textOpacity = useTransform(x, [0, Math.max(containerWidth / 2, 50)], [1, 0]);

  const handleDragEnd = (event: any, info: any) => {
    if (!containerWidth) return;
    const thumbWidth = 44; // h-11 w-11
    
    // If dragged more than 80% of the way
    if (info.point.x >= containerRef.current!.getBoundingClientRect().right - thumbWidth - 10 || x.get() >= containerWidth - thumbWidth - 20) {
      setIsConfirmed(true);
      onConfirm();
    } else {
      // Snap back
      x.set(0);
    }
  };

  return (
    <motion.div 
      ref={containerRef}
      style={{ background: bg }}
      className="relative flex h-14 w-full sm:w-[240px] items-center rounded-full overflow-hidden border border-slate-200 bg-slate-50/50 dark:border-slate-700 dark:bg-slate-900 shadow-inner"
    >
      <motion.span 
        style={{ opacity: textOpacity }}
        className="absolute w-full text-center text-sm font-bold text-slate-500 dark:text-slate-400 pointer-events-none uppercase tracking-wider"
      >
        {text}
      </motion.span>
      
      {!isConfirmed && !isLoading && (
        <motion.div
          drag="x"
          dragConstraints={{ left: 0, right: containerWidth ? containerWidth - 52 : 188 }}
          dragElastic={0.1}
          onDragEnd={handleDragEnd}
          style={{ x }}
          className="absolute left-1.5 flex h-11 w-11 items-center justify-center rounded-full bg-white dark:bg-slate-800 shadow-md cursor-grab active:cursor-grabbing border border-slate-100 dark:border-slate-700 z-10"
        >
          <ChevronRight className="h-5 w-5 text-slate-400" />
        </motion.div>
      )}

      {isLoading && (
        <div className="absolute left-1.5 flex h-11 w-11 items-center justify-center rounded-full bg-white dark:bg-slate-800 shadow-md border border-slate-100 dark:border-slate-700 z-10">
          <Loader2 className="h-5 w-5 text-primary-500 animate-spin" />
        </div>
      )}

      {isConfirmed && !isLoading && (
        <motion.div 
          initial={{ width: 44 }}
          animate={{ width: "calc(100% - 12px)" }}
          className="absolute left-1.5 flex h-11 items-center justify-center rounded-full bg-danger-500 shadow-md z-10"
        >
          <Check className="h-5 w-5 text-white" />
        </motion.div>
      )}
    </motion.div>
  );
}

export default function ConfirmDialog({
  isOpen,
  title,
  message,
  confirmText = 'Xác nhận',
  cancelText = 'Hủy',
  isDestructive = false,
  isLoading = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-slate-900/40 dark:bg-slate-950/80 transition-opacity animate-in fade-in duration-200"
        onClick={!isLoading ? onCancel : undefined}
      />
      
      {/* Modal Content */}
      <div className="relative bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden transform transition-all animate-in fade-in zoom-in-95 duration-200">
        <div className="p-6">
          <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-3">{title}</h3>
          <div className="text-slate-600 dark:text-slate-400 text-sm leading-relaxed">
            {message}
          </div>
        </div>
        <div className="bg-slate-50 dark:bg-slate-800/50 px-6 py-5 flex flex-col sm:flex-row items-center justify-end gap-3 border-t border-slate-100 dark:border-slate-800">
          <Button className="w-full sm:w-auto" variant="ghost" onClick={onCancel} disabled={isLoading}>
            {cancelText}
          </Button>
          
          {isDestructive ? (
            <SwipeToConfirm onConfirm={onConfirm} isLoading={isLoading} text="Kéo để xóa" />
          ) : (
            <Button 
              className="w-full sm:w-auto"
              variant="default" 
              onClick={onConfirm} 
              isLoading={isLoading}
            >
              {confirmText}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
