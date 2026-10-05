import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';

import './RotatingText.css';

function cn(...classes) {
  return classes.filter(Boolean).join(' ');
}

const RotatingText = forwardRef((props, ref) => {
  const {
    texts = [],
    transition = { type: 'spring', damping: 26, stiffness: 280 },
    initial = { y: '100%', opacity: 0 },
    animate = { y: 0, opacity: 1 },
    exit = { y: '-100%', opacity: 0 },
    animatePresenceMode = 'wait',
    animatePresenceInitial = false,
    rotationInterval = 2400,
    staggerDuration = 0.015,
    staggerFrom = 'first',
    loop = true,
    auto = true,
    splitBy = 'words',
    onNext,
    mainClassName,
    splitLevelClassName,
    elementLevelClassName,
    ...rest
  } = props;

  const [currentTextIndex, setCurrentTextIndex] = useState(0);

  // Find longest word to lock badge width & prevent any layout shift
  const longestText = useMemo(() => {
    return texts.reduce((longest, current) =>
      current.length > longest.length ? current : longest
    , '');
  }, [texts]);

  const splitIntoCharacters = text => {
    if (typeof Intl !== 'undefined' && Intl.Segmenter) {
      const segmenter = new Intl.Segmenter('en', { granularity: 'grapheme' });
      return Array.from(segmenter.segment(text), segment => segment.segment);
    }
    return Array.from(text);
  };

  const elements = useMemo(() => {
    const currentText = texts[currentTextIndex] || '';
    if (splitBy === 'characters') {
      const words = currentText.split(' ');
      return words.map((word, i) => ({
        characters: splitIntoCharacters(word),
        needsSpace: i !== words.length - 1
      }));
    }
    if (splitBy === 'words') {
      return currentText.split(' ').map((word, i, arr) => ({
        characters: [word],
        needsSpace: i !== arr.length - 1
      }));
    }
    if (splitBy === 'lines') {
      return currentText.split('\n').map((line, i, arr) => ({
        characters: [line],
        needsSpace: i !== arr.length - 1
      }));
    }

    return currentText.split(splitBy).map((part, i, arr) => ({
      characters: [part],
      needsSpace: i !== arr.length - 1
    }));
  }, [texts, currentTextIndex, splitBy]);

  const getStaggerDelay = useCallback(
    (index, totalChars) => {
      const total = totalChars;
      if (staggerFrom === 'first') return index * staggerDuration;
      if (staggerFrom === 'last') return (total - 1 - index) * staggerDuration;
      if (staggerFrom === 'center') {
        const center = Math.floor(total / 2);
        return Math.abs(center - index) * staggerDuration;
      }
      if (staggerFrom === 'random') {
        const randomIndex = Math.floor(Math.random() * total);
        return Math.abs(randomIndex - index) * staggerDuration;
      }
      return Math.abs(staggerFrom - index) * staggerDuration;
    },
    [staggerFrom, staggerDuration]
  );

  const handleIndexChange = useCallback(
    newIndex => {
      setCurrentTextIndex(newIndex);
      if (onNext) onNext(newIndex);
    },
    [onNext]
  );

  const next = useCallback(() => {
    const nextIndex = currentTextIndex === texts.length - 1 ? (loop ? 0 : currentTextIndex) : currentTextIndex + 1;
    if (nextIndex !== currentTextIndex) {
      handleIndexChange(nextIndex);
    }
  }, [currentTextIndex, texts.length, loop, handleIndexChange]);

  const previous = useCallback(() => {
    const prevIndex = currentTextIndex === 0 ? (loop ? texts.length - 1 : currentTextIndex) : currentTextIndex - 1;
    if (prevIndex !== currentTextIndex) {
      handleIndexChange(prevIndex);
    }
  }, [currentTextIndex, texts.length, loop, handleIndexChange]);

  const jumpTo = useCallback(
    index => {
      const validIndex = Math.max(0, Math.min(index, texts.length - 1));
      if (validIndex !== currentTextIndex) {
        handleIndexChange(validIndex);
      }
    },
    [texts.length, currentTextIndex, handleIndexChange]
  );

  const reset = useCallback(() => {
    if (currentTextIndex !== 0) {
      handleIndexChange(0);
    }
  }, [currentTextIndex, handleIndexChange]);

  useImperativeHandle(
    ref,
    () => ({
      next,
      previous,
      jumpTo,
      reset
    }),
    [next, previous, jumpTo, reset]
  );

  useEffect(() => {
    if (!auto || texts.length <= 1) return;
    const intervalId = setInterval(next, rotationInterval);
    return () => clearInterval(intervalId);
  }, [next, rotationInterval, auto, texts.length]);

  return (
    <span className={cn('text-rotate relative inline-flex items-center justify-center align-middle', mainClassName)} {...rest}>
      {/* Invisible ghost spacer that reserves maximum badge width and height */}
      <span className="invisible pointer-events-none select-none opacity-0" aria-hidden="true" style={{ visibility: 'hidden' }}>
        {longestText}
      </span>
      <span className="text-rotate-sr-only">{texts[currentTextIndex]}</span>
      <span className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <AnimatePresence mode={animatePresenceMode} initial={animatePresenceInitial}>
          <motion.span
            key={currentTextIndex}
            className={cn(splitBy === 'lines' ? 'text-rotate-lines' : 'text-rotate-inner')}
            aria-hidden="true"
          >
            {elements.map((wordObj, wordIndex, array) => {
              const previousCharsCount = array.slice(0, wordIndex).reduce((sum, word) => sum + word.characters.length, 0);
              return (
                <span key={wordIndex} className={cn('text-rotate-word', splitLevelClassName)}>
                  {wordObj.characters.map((char, charIndex) => (
                    <motion.span
                      key={charIndex}
                      initial={initial}
                      animate={animate}
                      exit={exit}
                      transition={{
                        ...transition,
                        delay: getStaggerDelay(
                          previousCharsCount + charIndex,
                          array.reduce((sum, word) => sum + word.characters.length, 0)
                        )
                      }}
                      className={cn('text-rotate-element', elementLevelClassName)}
                    >
                      {char}
                    </motion.span>
                  ))}
                  {wordObj.needsSpace && <span className="text-rotate-space"> </span>}
                </span>
              );
            })}
          </motion.span>
        </AnimatePresence>
      </span>
    </span>
  );
});

RotatingText.displayName = 'RotatingText';
export default RotatingText;
