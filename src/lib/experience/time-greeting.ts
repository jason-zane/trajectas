/**
 * Get a time-of-day greeting based on the current hour.
 *
 * @param date The date to check (typically new Date() for current time)
 * @returns A greeting string: "Good morning" (<12), "Good afternoon" (12–16), or "Good evening" (≥17)
 */
export function getTimeOfDayGreeting(date: Date): string {
  const hour = date.getHours()

  if (hour < 12) {
    return 'Good morning'
  }

  if (hour < 17) {
    return 'Good afternoon'
  }

  return 'Good evening'
}
