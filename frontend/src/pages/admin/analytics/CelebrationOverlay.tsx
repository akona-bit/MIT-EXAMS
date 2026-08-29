import { useEffect, useState } from "react";
import confetti from "canvas-confetti";
import { motion, AnimatePresence } from "framer-motion";
import { Trophy } from "lucide-react";

interface Props {
  studentName?: string;
  valedictorianName?: string;
  salutatorianName?: string;
}

export default function CelebrationOverlay({ studentName, valedictorianName, salutatorianName }: Props) {
  const [show, setShow] = useState(false);
  const [title, setTitle] = useState("");

  useEffect(() => {
    if (!studentName) return;

    let isTop = false;
    let rankTitle = "";

    // Exact string match might be flaky if names have extra spaces, let's just do a simple check
    const sName = studentName.trim().toLowerCase();
    const vName = valedictorianName?.trim().toLowerCase();
    const saName = salutatorianName?.trim().toLowerCase();

    if (sName === vName) {
      isTop = true;
      rankTitle = "THỦ KHOA";
    } else if (sName === saName) {
      isTop = true;
      rankTitle = "Á KHOA";
    }

    if (isTop) {
      const storageKey = `celebrated_${sName}`;
      if (!localStorage.getItem(storageKey)) {
        setTitle(rankTitle);
        setShow(true);
        localStorage.setItem(storageKey, "true");
        fireConfetti();
        
        // Auto hide after 6 seconds
        setTimeout(() => setShow(false), 6000);
      }
    }
  }, [studentName, valedictorianName, salutatorianName]);

  const fireConfetti = () => {
    const duration = 3000;
    const animationEnd = Date.now() + duration;
    const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 9999 };

    const randomInRange = (min: number, max: number) => Math.random() * (max - min) + min;

    const interval: any = setInterval(function() {
      const timeLeft = animationEnd - Date.now();

      if (timeLeft <= 0) {
        return clearInterval(interval);
      }

      const particleCount = 50 * (timeLeft / duration);
      confetti(Object.assign({}, defaults, { particleCount, origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 } }));
      confetti(Object.assign({}, defaults, { particleCount, origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 } }));
    }, 250);
  };

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[9998] flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={() => setShow(false)}
        >
          <motion.div
            initial={{ scale: 0.8, y: 50, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.8, y: 50, opacity: 0 }}
            transition={{ type: "spring", bounce: 0.5 }}
            className="relative overflow-hidden rounded-2xl bg-white p-8 text-center shadow-2xl dark:bg-slate-900 max-w-lg w-full mx-4 border-2 border-yellow-400"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-yellow-400 via-yellow-200 to-yellow-400" />
            <Trophy className="mx-auto h-24 w-24 text-yellow-400 mb-6 drop-shadow-lg" />
            <h2 className="text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-yellow-600 to-yellow-400 mb-2 uppercase tracking-wider">
              Chúc mừng {title}
            </h2>
            <p className="text-xl font-medium text-slate-800 dark:text-slate-200 mb-6">
              {studentName}
            </p>
            <p className="text-slate-600 dark:text-slate-400 mb-8">
              Kết quả học tập xuất sắc của bạn là một thành tích đáng tự hào. Hãy tiếp tục phát huy nhé!
            </p>
            <button
              onClick={() => setShow(false)}
              className="px-8 py-3 bg-gradient-to-r from-yellow-500 to-yellow-600 text-white font-bold rounded-xl shadow-lg hover:shadow-xl transition-all active:scale-95"
            >
              Cảm ơn
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
