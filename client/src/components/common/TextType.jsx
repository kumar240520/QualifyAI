import React, { useEffect, useState, useMemo, useRef, createElement } from 'react';
import './TextType.css';

const TextType = ({
  text = [],
  as: Component = 'span',
  typingSpeed = 45,
  initialDelay = 200,
  pauseDuration = 2000,
  deletingSpeed = 25,
  loop = true,
  className = '',
  showCursor = true,
  hideCursorWhileTyping = false,
  cursorCharacter = '|',
  cursorClassName = '',
  textColors = [],
  startOnVisible = false,
  ...props
}) => {
  const textArray = useMemo(() => {
    if (Array.isArray(text)) {
      return text.filter(Boolean);
    }
    return typeof text === 'string' && text.length > 0 ? [text] : [];
  }, [text]);

  // Find longest phrase to reserve exact layout dimensions and prevent page jump / CLS
  const longestText = useMemo(() => {
    return textArray.reduce((longest, current) =>
      current.length > longest.length ? current : longest
    , '');
  }, [textArray]);

  const [displayedText, setDisplayedText] = useState('');
  const [textIndex, setTextIndex] = useState(0);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isVisible, setIsVisible] = useState(!startOnVisible);
  const containerRef = useRef(null);

  // Viewport intersection observer if startOnVisible is true
  useEffect(() => {
    if (!startOnVisible || !containerRef.current) return;

    const observer = new IntersectionObserver(
      entries => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            setIsVisible(true);
          }
        });
      },
      { threshold: 0.1 }
    );

    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [startOnVisible]);

  useEffect(() => {
    if (!isVisible || textArray.length === 0) return;

    const currentPhrase = textArray[textIndex] || '';
    let timer = null;

    if (!isDeleting) {
      // TYPING PHASE
      if (displayedText.length < currentPhrase.length) {
        const nextCharCount = displayedText.length + 1;
        timer = setTimeout(() => {
          setDisplayedText(currentPhrase.slice(0, nextCharCount));
        }, displayedText.length === 0 ? initialDelay : typingSpeed);
      } else {
        // Finished typing current phrase
        if (textArray.length > 1) {
          timer = setTimeout(() => {
            setIsDeleting(true);
          }, pauseDuration);
        } else if (loop) {
          timer = setTimeout(() => {
            setIsDeleting(true);
          }, pauseDuration);
        }
      }
    } else {
      // DELETING PHASE
      if (displayedText.length > 0) {
        const nextCharCount = displayedText.length - 1;
        timer = setTimeout(() => {
          setDisplayedText(currentPhrase.slice(0, nextCharCount));
        }, deletingSpeed);
      } else {
        // Finished deleting, transition to next phrase
        setIsDeleting(false);
        const nextIndex = (textIndex + 1) % textArray.length;
        if (nextIndex === 0 && !loop) {
          return;
        }
        setTextIndex(nextIndex);
      }
    }

    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [
    displayedText,
    isDeleting,
    textIndex,
    textArray,
    isVisible,
    typingSpeed,
    deletingSpeed,
    pauseDuration,
    initialDelay,
    loop
  ]);

  const currentColor =
    textColors.length > 0 ? textColors[textIndex % textColors.length] : undefined;

  const isTypingNow = !isDeleting && displayedText.length < (textArray[textIndex] || '').length;
  const hideCursor = hideCursorWhileTyping && isTypingNow;

  return createElement(
    Component,
    {
      ref: containerRef,
      className: `text-type ${className}`.trim(),
      ...props
    },
    // Invisible ghost text reserving the exact layout space permanently
    <span className="text-type__ghost" aria-hidden="true">
      {longestText}
      {showCursor && <span className="opacity-0">|</span>}
    </span>,
    // Visible dynamic text positioned strictly inside the reserved space
    <span className="text-type__visible">
      <span
        className="text-type__content"
        style={currentColor ? { color: currentColor } : undefined}
      >
        {displayedText}
      </span>
      {showCursor && (
        <span
          className={`text-type__cursor ${cursorClassName} ${
            hideCursor ? 'text-type__cursor--hidden' : ''
          }`.trim()}
          aria-hidden="true"
        >
          {cursorCharacter}
        </span>
      )}
    </span>
  );
};

export default TextType;
