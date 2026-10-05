import React, { useState, useEffect, useRef } from 'react';
import { motion, useMotionValue, useTransform } from 'motion/react';
import './Stack.css';

export default function Stack({
  cards = [],
  activeIndex = 0,
  onNext,
  onPrev,
  sensitivity = 100,
  sendToBackOnClick = true,
}) {
  // Drag motion values for the active top card
  const dragX = useMotionValue(0);
  const dragY = useMotionValue(0);
  const rotateX = useTransform(dragY, [-100, 100], [20, -20]);
  const rotateY = useTransform(dragX, [-100, 100], [-20, 20]);
  const rotateZDrag = useTransform(dragX, [-200, 200], [-15, 15]);

  // Track the outgoing card that is animating to the back
  const [exitingCardIndex, setExitingCardIndex] = useState(null);
  const [animatingDirection, setAnimatingDirection] = useState('forward'); // 'forward' | 'backward'
  const prevActiveRef = useRef(activeIndex);

  useEffect(() => {
    if (prevActiveRef.current !== activeIndex) {
      const prev = prevActiveRef.current;
      prevActiveRef.current = activeIndex;

      // Identify whether we moved forward or backward
      const isForward =
        (activeIndex > prev && !(prev === 0 && activeIndex === cards.length - 1)) ||
        (prev === cards.length - 1 && activeIndex === 0);

      setAnimatingDirection(isForward ? 'forward' : 'backward');
      setExitingCardIndex(prev);

      const timer = setTimeout(() => {
        setExitingCardIndex(null);
      }, 450);

      return () => clearTimeout(timer);
    }
  }, [activeIndex, cards.length]);

  const handleDragEnd = (_, info) => {
    if (Math.abs(info.offset.x) > sensitivity || Math.abs(info.offset.y) > sensitivity) {
      if (info.offset.x < 0 || info.offset.y < 0) {
        onNext?.();
      } else {
        if (onPrev) {
          onPrev();
        } else {
          onNext?.();
        }
      }
    }
    dragX.set(0);
    dragY.set(0);
  };

  const total = cards.length;

  return (
    <div className="stack-container">
      {cards.map((content, idx) => {
        // Calculate offset from current active card
        // 0 = front/active, 1 = right behind, 2 = 2 behind, etc.
        const offset = total > 0 ? (idx - activeIndex + total) % total : 0;
        const isCurrentTop = offset === 0;
        const isExiting = exitingCardIndex === idx;

        // Visual depth stacking properties
        let zIndex = 1;
        let scale = 0.78;
        let y = 48;
        let x = 0;
        let rotateZ = -10;
        let opacity = 0;

        if (isExiting) {
          // Card that is flying out to the back
          zIndex = 45;
          scale = 0.98;
          x = animatingDirection === 'forward' ? 140 : -140;
          y = -20;
          rotateZ = animatingDirection === 'forward' ? 12 : -12;
          opacity = 0.85;
        } else if (isCurrentTop) {
          // Front active card
          zIndex = 40;
          scale = 1;
          x = 0;
          y = 0;
          rotateZ = 0;
          opacity = 1;
        } else if (offset === 1) {
          // 1 step behind
          zIndex = 30;
          scale = 0.94;
          x = 0;
          y = 15;
          rotateZ = -3.5;
          opacity = 0.94;
        } else if (offset === 2) {
          // 2 steps behind
          zIndex = 20;
          scale = 0.88;
          x = 0;
          y = 30;
          rotateZ = -7;
          opacity = 0.82;
        } else if (offset === 3) {
          // 3 steps behind
          zIndex = 10;
          scale = 0.82;
          x = 0;
          y = 44;
          rotateZ = -10;
          opacity = 0.6;
        } else {
          // Hidden in the deck
          zIndex = 2;
          scale = 0.76;
          x = 0;
          y = 52;
          rotateZ = -12;
          opacity = 0;
        }

        return (
          <motion.div
            key={idx}
            className="card-layer"
            style={{
              zIndex,
              pointerEvents: isCurrentTop && !isExiting ? 'auto' : 'none',
            }}
            animate={{
              scale,
              y,
              x,
              rotateZ,
              opacity,
              transformOrigin: '50% 90%',
            }}
            transition={{
              type: 'spring',
              stiffness: 260,
              damping: 22,
              mass: 0.85,
            }}
          >
            {isCurrentTop && !isExiting ? (
              <motion.div
                className="card-rotate"
                style={{
                  x: dragX,
                  y: dragY,
                  rotateX,
                  rotateY,
                  rotateZ: rotateZDrag,
                }}
                drag="x"
                dragConstraints={{ left: 0, right: 0 }}
                dragElastic={0.7}
                whileTap={{ cursor: 'grabbing' }}
                onDragEnd={handleDragEnd}
                onClick={() => sendToBackOnClick && onNext?.()}
              >
                <div className="card">{content}</div>
              </motion.div>
            ) : (
              <div className="card-rotate-disabled">
                <div className="card">{content}</div>
              </div>
            )}
          </motion.div>
        );
      })}
    </div>
  );
}
