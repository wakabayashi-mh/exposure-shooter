import { describe, expect, it } from 'vitest'
import { EXPOSURE_IDLE, prepProgress, press, release, tick, type ExposureState } from './exposure'

const t = { prepMs: 1000, overholdMs: 5000 }

function run(s: ExposureState, ms: number, step = 100) {
  const events: string[] = []
  for (let i = 0; i < ms; i += step) {
    const r = tick(s, step, t)
    s = r.state
    if (r.event) events.push(r.event)
  }
  return { s, events }
}

describe('曝射スイッチ', () => {
  it('押すと準備を始め、準備時間で READY になる', () => {
    let s = press(EXPOSURE_IDLE)
    expect(s.phase).toBe('preparing')
    const r = run(s, 1000)
    s = r.s
    expect(s.phase).toBe('ready')
    expect(r.events).toEqual(['ready'])
    expect(prepProgress(s, t)).toBe(1)
  })

  it('READY で離すと曝射する', () => {
    const { s } = run(press(EXPOSURE_IDLE), 1200)
    expect(release(s)).toEqual({ state: EXPOSURE_IDLE, event: 'expose' })
  })

  it('準備完了前に離すとキャンセルで、曝射しない', () => {
    const { s } = run(press(EXPOSURE_IDLE), 500)
    expect(prepProgress(s, t)).toBe(0.5)
    expect(release(s)).toEqual({ state: EXPOSURE_IDLE, event: 'cancel' })
  })

  it('READY のまま 5 秒離さないと管球負荷になり、その後離しても曝射しない', () => {
    const r = run(press(EXPOSURE_IDLE), 6000)
    expect(r.events).toEqual(['ready', 'overheat'])
    expect(r.s.phase).toBe('overheat')
    expect(release(r.s).event).toBeNull()
  })

  it('押していないときに離しても何も起きない', () => {
    expect(release(EXPOSURE_IDLE).event).toBeNull()
  })

  it('準備中に押し直しても最初からにはならない', () => {
    const { s } = run(press(EXPOSURE_IDLE), 500)
    expect(press(s)).toBe(s)
  })
})
