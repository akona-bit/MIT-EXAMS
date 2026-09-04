import * as React from 'react';
import { motion, HTMLMotionProps } from 'framer-motion';
import { cn } from '../../lib/utils';

interface PageTransitionProps extends HTMLMotionProps<"div"> {
  children: React.ReactNode;
  className?: string;
}

export const PageTransition: React.FC<PageTransitionProps> = ({ 
  children, 
  className,
  ...props 
}) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -15 }}
      transition={{ 
        duration: 0.3,
        ease: [0.22, 1, 0.36, 1] // Custom ease-out curve for premium feel
      }}
      className={cn("w-full h-full", className)}
      {...props}
    >
      {children}
    </motion.div>
  );
};
