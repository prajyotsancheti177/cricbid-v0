import { useEffect, useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { auctionSounds } from "@/lib/auctionSounds";

interface SoldCelebrationProps {
  show: boolean;
  playerName: string;
  teamName: string;
  amount: number;
  soundEnabled?: boolean;
  animationEnabled?: boolean;
}

export const SoldCelebration = ({
  show,
  playerName,
  teamName,
  amount,
  soundEnabled = true,
  animationEnabled = true
}: SoldCelebrationProps) => {
  const [isVisible, setIsVisible] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const timeoutsRef = useRef<NodeJS.Timeout[]>([]);

  // Cleanup function
  const cleanup = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    timeoutsRef.current.forEach(t => clearTimeout(t));
    timeoutsRef.current = [];
  };

  useEffect(() => {
    if (show) {
      // Play sound if enabled (sound continues even if dismissed)
      if (soundEnabled) {
        auctionSounds.playSoldSound();
      }

      // Show animation if enabled
      if (animationEnabled) {
        setIsVisible(true);

        // The confetti that used to cover the screen here has been removed.
        // The overlay below is the whole celebration now.
        //
        // The confetti interval was also what took the overlay back down: it
        // ran until the 4s mark and then hid it a second later. Removing the
        // particles without keeping that timing would have left the SOLD card
        // on screen forever, so the same 4s + 1s is kept as one timer.
        const SHOW_MS = 4000;
        const FADE_MS = 1000;
        const hideTimeout = setTimeout(() => setIsVisible(false), SHOW_MS + FADE_MS);
        timeoutsRef.current.push(hideTimeout);

        return cleanup;
      }
    } else {
      // When show becomes false, reset visibility
      setIsVisible(false);
      cleanup();
    }
  }, [show, soundEnabled, animationEnabled]);

  return (
    <AnimatePresence>
      {isVisible && animationEnabled && (
        <motion.div
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.5 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-background/70 backdrop-blur-md"
        >
          <motion.div
            initial={{ y: 100, scale: 0.8 }}
            animate={{ y: 0, scale: 1 }}
            transition={{ type: "spring", damping: 12, stiffness: 200 }}
            className="text-center space-y-6 p-12 rounded-3xl bg-gradient-to-br from-purple-600 via-pink-600 to-orange-500 shadow-[0_0_100px_rgba(168,85,247,0.6)]"
          >
            <motion.div
              animate={{
                rotate: [0, -10, 10, -10, 10, 0],
                scale: [1, 1.1, 1, 1.1, 1]
              }}
              transition={{ duration: 0.6, repeat: 4 }}
              className="text-7xl sm:text-9xl font-black text-white drop-shadow-[0_0_30px_rgba(255,255,255,0.8)]"
            >
              🎉 SOLD! 🎉
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="space-y-3"
            >
              <h2 className="text-3xl sm:text-5xl font-bold text-white drop-shadow-lg">{playerName}</h2>
              <p className="text-xl sm:text-3xl text-white/90">to {teamName}</p>
              <motion.p
                animate={{ scale: [1, 1.05, 1] }}
                transition={{ duration: 0.5, repeat: Infinity }}
                className="text-4xl sm:text-6xl font-black text-yellow-300 drop-shadow-[0_0_20px_rgba(250,204,21,0.8)]"
              >
                💰 {amount} Pts 💰
              </motion.p>
            </motion.div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

