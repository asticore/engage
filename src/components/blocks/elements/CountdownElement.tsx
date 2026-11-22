import React from 'react'

import { num, str } from './elementUtil'

/**
 * `countdown`: Spark draws the live clock (`spark-countdown`, asticore/spark). The server sends the target date as text
 * so the element reads sensibly before the script runs; Spark replaces it with the ticking cards and, when the time is
 * up, with the "ended" message.
 */
export const CountdownElement: React.FC<Record<string, unknown>> = (p) => {
  const target = str(p.target).trim()
  if (!Number.isFinite(Date.parse(target))) return <div className="el-countdown el-countdown--empty">Set a date and time for the countdown.</div>
  const units = Math.round(num(p.units, 4, 2, 4))
  const labels = [str(p.daysLabel, 'Days'), str(p.hoursLabel, 'Hours'), str(p.minutesLabel, 'Minutes'), str(p.secondsLabel, 'Seconds')].map((l) => l.replace(/\|/g, ' '))
  return (
    <div className="spark-countdown" data-spark-to={target} data-spark-units={'dhms'.slice(4 - units)} data-spark-labels={labels.join('|')} data-spark-expired={str(p.expiredText, 'This offer has ended.')}>
      <time dateTime={target}>{target.replace('T', ' ')}</time>
    </div>
  )
}
