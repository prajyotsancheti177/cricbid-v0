import { useEffect, useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import confetti from "canvas-confetti";
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

        // ========== MASSIVE CONFETTI CELEBRATION ==========
        const duration = 4000;
        const animationEnd = Date.now() + duration;

        // Colors for celebration
        const colors = ['#a855f7', '#ec4899', '#f97316', '#fbbf24', '#22c55e', '#3b82f6'];

        // Initial big burst from center
        confetti({
          particleCount: 150,
          spread: 100,
          origin: { x: 0.5, y: 0.5 },
          colors: colors,
          startVelocity: 55,
          gravity: 0.8,
          scalar: 1.2,
          ticks: 100,
        });

        // Side cannons burst
        const sideTimeout = setTimeout(() => {
          // Left cannon
          confetti({
            particleCount: 100,
            angle: 60,
            spread: 55,
            origin: { x: 0, y: 0.6 },
            colors: colors,
            startVelocity: 60,
          });
          // Right cannon
          confetti({
            particleCount: 100,
            angle: 120,
            spread: 55,
            origin: { x: 1, y: 0.6 },
            colors: colors,
            startVelocity: 60,
          });
        }, 200);
        timeoutsRef.current.push(sideTimeout);

        // Star burst from top
        const starTimeout = setTimeout(() => {
          confetti({
            particleCount: 80,
            spread: 180,
            origin: { x: 0.5, y: 0 },
            colors: colors,
            startVelocity: 35,
            gravity: 1.2,
            shapes: ['star'],
            scalar: 1.5,
          });
        }, 400);
        timeoutsRef.current.push(starTimeout);

        // Continuous rain effect
        intervalRef.current = setInterval(() => {
          const timeLeft = animationEnd - Date.now();

          if (timeLeft <= 0) {
            cleanup();
            const hideTimeout = setTimeout(() => setIsVisible(false), 1000);
            timeoutsRef.current.push(hideTimeout);
            return;
          }

          // Random bursts from multiple positions
          const origins = [
            { x: 0.1, y: 0.1 },
            { x: 0.9, y: 0.1 },
            { x: 0.2, y: 0.8 },
            { x: 0.8, y: 0.8 },
            { x: 0.5, y: 0.2 },
          ];

          const randomOrigin = origins[Math.floor(Math.random() * origins.length)];

          // Regular confetti shower
          confetti({
            particleCount: 30,
            spread: 100,
            origin: randomOrigin,
            colors: colors,
            startVelocity: 25,
            gravity: 0.6,
            ticks: 80,
          });

          // Occasional big bursts
          if (Math.random() > 0.6) {
            confetti({
              particleCount: 60,
              spread: 120,
              origin: { x: Math.random(), y: Math.random() * 0.3 },
              colors: colors,
              startVelocity: 40,
              shapes: ['circle', 'square'],
              scalar: 1.3,
            });
          }

          // Star sparkles
          if (Math.random() > 0.7) {
            confetti({
              particleCount: 20,
              spread: 360,
              origin: { x: 0.5, y: 0.5 },
              colors: ['#fbbf24', '#ffffff'],
              shapes: ['star'],
              scalar: 0.8,
              startVelocity: 20,
              gravity: 0.3,
            });
          }
        }, 100);

        // Final firework burst
        const fireworkTimeout = setTimeout(() => {
          for (let i = 0; i < 5; i++) {
            const burstTimeout = setTimeout(() => {
              confetti({
                particleCount: 80,
                spread: 360,
                origin: { x: 0.2 + (i * 0.15), y: 0.3 + (Math.random() * 0.2) },
                colors: colors,
                startVelocity: 30,
                ticks: 50,
              });
            }, i * 100);
            timeoutsRef.current.push(burstTimeout);
          }
        }, 2500);
        timeoutsRef.current.push(fireworkTimeout);

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
                💰 {amount} Pts. 💰
              </motion.p>
            </motion.div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

