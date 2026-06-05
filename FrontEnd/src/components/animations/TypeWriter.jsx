import { useState, useEffect, memo } from 'react';

/* ─────────────────────────────────────────────────────
   TypeWriter: Lightweight typing animation effect
   No external dependencies, pure CSS + React hooks
───────────────────────────────────────────────────── */
const TypeWriter = memo(({ 
  text, 
  speed = 80, 
  delay = 300,
  className = '',
  cursor = true 
}) => {
  const [displayText, setDisplayText] = useState('');
  const [isTyping, setIsTyping] = useState(false);

  useEffect(() => {
    let timeout;
    
    // Initial delay before typing starts
    timeout = setTimeout(() => {
      setIsTyping(true);
    }, delay);

    return () => clearTimeout(timeout);
  }, [delay]);

  useEffect(() => {
    if (!isTyping) return;

    let index = 0;
    const interval = setInterval(() => {
      if (index <= text.length) {
        setDisplayText(text.slice(0, index));
        index++;
      } else {
        clearInterval(interval);
        setIsTyping(false);
      }
    }, speed);

    return () => clearInterval(interval);
  }, [text, speed, isTyping]);

  return (
    <span className={className}>
      {displayText}
      {cursor && (
        <span 
          className="inline-block w-0.5 h-[1em] ml-1 bg-accent animate-pulse"
          style={{ 
            animation: isTyping ? 'blink 1s step-end infinite' : 'none',
            opacity: isTyping ? 1 : 0 
          }}
        />
      )}
    </span>
  );
});

TypeWriter.displayName = 'TypeWriter';
export default TypeWriter;
