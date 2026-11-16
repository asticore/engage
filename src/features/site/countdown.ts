/** Time left until a launch, as whole days, hours, minutes and seconds. Never negative. Pure. */
export const timeLeft = (launchAt: string, now: Date): { days: number; hours: number; minutes: number; seconds: number; done: boolean } => {
  const total = Math.max(0, Math.floor((Date.parse(launchAt) - now.getTime()) / 1000))
  return { days: Math.floor(total / 86400), hours: Math.floor((total % 86400) / 3600), minutes: Math.floor((total % 3600) / 60), seconds: total % 60, done: total === 0 }
}
