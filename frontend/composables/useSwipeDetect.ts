const SWIPE_THRESHOLD = 50

export function useSwipeDetect(onSwipeLeft: () => void, onSwipeRight: () => void) {
  let startX = 0
  let startY = 0

  function onTouchStart(e: TouchEvent) {
    startX = e.touches[0].clientX
    startY = e.touches[0].clientY
  }

  function onTouchEnd(e: TouchEvent) {
    const dx = e.changedTouches[0].clientX - startX
    const dy = e.changedTouches[0].clientY - startY
    if (Math.abs(dx) > SWIPE_THRESHOLD && Math.abs(dx) > Math.abs(dy)) {
      if (dx < 0) onSwipeLeft()
      else onSwipeRight()
    }
  }

  return { onTouchStart, onTouchEnd }
}
