import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import { auctionSounds } from "@/lib/auctionSounds";

interface UnsoldAnimationProps {
  show: boolean;
  playerName: string;
  soundEnabled?: boolean;
  animationEnabled?: boolean;
}

export const UnsoldAnimation = ({
  show,
  playerName,
  soundEnabled = true,
  animationEnabled = true
}: UnsoldAnimationProps) => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (show) {
      // Play sound if enabled (sound continues even if dismissed)
      if (soundEnabled) {
        auctionSounds.playUnsoldSound();
      }

      // Show animation if enabled
      if (animationEnabled) {
        setIsVisible(true);
      }
    } else {
      setIsVisible(false);
    }
  }, [show, soundEnabled, animationEnabled]);

  return (
    <AnimatePresence>
      {isVisible && animationEnabled && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
        >
          <motion.div
            initial={{ scale: 0.5, opacity: 0, rotate: -10 }}
            animate={{
              scale: [0.5, 1.1, 1],
              opacity: 1,
              rotate: [10, -5, 0]
            }}
            exit={{ scale: 0.8, opacity: 0 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
            className="text-center space-y-6 p-8"
          >
            <motion.div
              animate={{
                rotate: [0, 10, -10, 10, 0],
              }}
              transition={{
                duration: 0.5,
                repeat: 3,
                ease: "easeInOut"
              }}
            >
              <X className="h-40 w-40 text-destructive mx-auto stroke-[3]" />
            </motion.div>

            <motion.h2
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="text-7xl font-black text-destructive"
            >
              UNSOLD
            </motion.h2>

            <motion.p
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.3 }}
              className="text-4xl font-bold text-muted-foreground"
            >
              {playerName}
            </motion.p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};