export interface SeasonalEvent {
  name: string
  month: number
  typicalDemandMultiplier: number
}

export interface UpcomingSeasonalEvent extends SeasonalEvent {
  date: Date
  daysAway: number
}

export const MY_SEASONAL_EVENTS: SeasonalEvent[] = [
  { name: 'Chinese New Year', month: 1, typicalDemandMultiplier: 3.5 },
  { name: 'Hari Raya Aidilfitri', month: 3, typicalDemandMultiplier: 3.8 },
  { name: 'Hari Raya Aidiladha', month: 6, typicalDemandMultiplier: 2.0 },
  { name: 'Merdeka Day', month: 8, typicalDemandMultiplier: 2.5 },
  { name: 'Malaysia Day', month: 9, typicalDemandMultiplier: 2.0 },
  { name: 'Deepavali', month: 10, typicalDemandMultiplier: 2.5 },
  { name: 'Christmas / Year End', month: 11, typicalDemandMultiplier: 2.8 },
  { name: 'Q1 Campaign Season', month: 1, typicalDemandMultiplier: 2.0 },
]

export function getUpcomingSeasonalEvents(withinDays: number): UpcomingSeasonalEvent[] {
  const now = new Date()
  const cutoff = new Date(now.getTime() + withinDays * 24 * 60 * 60 * 1000)
  const results: UpcomingSeasonalEvent[] = []

  for (const event of MY_SEASONAL_EVENTS) {
    // Build candidate date for this year and next year
    for (const yearOffset of [0, 1]) {
      const candidateYear = now.getFullYear() + yearOffset
      // Use the 1st of the month as the event start date
      const eventDate = new Date(candidateYear, event.month - 1, 1)

      if (eventDate >= now && eventDate <= cutoff) {
        const daysAway = Math.floor(
          (eventDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
        )
        results.push({
          ...event,
          date: eventDate,
          daysAway,
        })
        break // Only add the nearest occurrence
      }
    }
  }

  return results.sort((a, b) => a.daysAway - b.daysAway)
}
