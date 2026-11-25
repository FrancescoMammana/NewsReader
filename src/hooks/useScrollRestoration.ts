import { type RefObject, useEffect, useLayoutEffect, useRef } from 'react';

const savedScrollPositions = new Map<string, number>();

export function useScrollRestoration(
  scrollRef: RefObject<HTMLElement | null>,
  scrollKey: string,
  isVisible = true,
): void {
  const isVisibleRef = useRef(isVisible);
  isVisibleRef.current = isVisible;

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    const handleScroll = () => {
      if (!isVisibleRef.current || el.clientHeight === 0) return;
      savedScrollPositions.set(scrollKey, el.scrollTop);
    };

    el.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      el.removeEventListener('scroll', handleScroll);
    };
  }, [scrollRef, scrollKey]);

  useLayoutEffect(() => {
    if (!isVisible) return;
    const el = scrollRef.current;
    if (!el) return;

    const target = savedScrollPositions.get(scrollKey) ?? 0;
    el.scrollTop = target;

    const rafId = requestAnimationFrame(() => {
      if (isVisibleRef.current && scrollRef.current && target > 0) {
        scrollRef.current.scrollTop = target;
      }
    });
    return () => cancelAnimationFrame(rafId);
  }, [scrollRef, scrollKey, isVisible]);
}
