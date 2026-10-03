import { held, noise, tone, type Held } from '../../core/audio/synth'

/**
 * 撮影条件シューティングの効果音（すべて合成。SPEC 7.4 の回転上昇音・完了音・曝射音「ピー」など）。
 */
export const sfx = {
  /** 準備（ロートアップ）：陽極が回り始めて回転が上がっていくうなり。準備完了後もうなり続ける */
  prepStart(prepMs: number): Held {
    return held((ctx, out) => {
      const t0 = ctx.currentTime
      const prep = prepMs / 1000
      const osc = ctx.createOscillator()
      osc.type = 'sawtooth'
      osc.frequency.setValueAtTime(70, t0)
      osc.frequency.exponentialRampToValueAtTime(380, t0 + prep)
      const f = ctx.createBiquadFilter()
      f.type = 'lowpass'
      f.frequency.setValueAtTime(400, t0)
      f.frequency.exponentialRampToValueAtTime(1600, t0 + prep)
      const g = ctx.createGain()
      g.gain.setValueAtTime(0.0001, t0)
      g.gain.exponentialRampToValueAtTime(0.07, t0 + 0.15)
      osc.connect(f).connect(g).connect(out)
      osc.start(t0)
      return {
        stop: (t) => {
          g.gain.cancelScheduledValues(t)
          g.gain.setTargetAtTime(0.0001, t, 0.04)
          osc.stop(t + 0.3)
        },
      }
    })
  },
  /** 準備完了 */
  ready() {
    tone({ type: 'triangle', freq: 988, dur: 0.12, gain: 0.18 })
    tone({ type: 'triangle', freq: 1319, dur: 0.18, gain: 0.18, delay: 0.1 })
  },
  /** 準備未完了で離した */
  cancel() {
    tone({ type: 'square', freq: 330, freqEnd: 220, dur: 0.14, gain: 0.06, lowpass: 1200 })
  },
  /** 曝射音「ピー」 */
  expose() {
    tone({ type: 'square', freq: 1700, dur: 0.38, gain: 0.07, attack: 0.01, lowpass: 3500 })
  },
  perfect() {
    ;[1047, 1319, 1568, 2093].forEach((f, i) => tone({ type: 'triangle', freq: f, dur: 0.16, gain: 0.16, delay: 0.32 + i * 0.06 }))
  },
  good() {
    ;[880, 1175].forEach((f, i) => tone({ type: 'triangle', freq: f, dur: 0.16, gain: 0.14, delay: 0.32 + i * 0.08 }))
  },
  /** 再撮影（MISS） */
  miss() {
    tone({ type: 'sawtooth', freq: 160, freqEnd: 90, dur: 0.4, gain: 0.12, delay: 0.3, lowpass: 900 })
  },
  /** 防衛ラインに到達 */
  breach() {
    noise({ dur: 0.35, gain: 0.35, lowpass: 400 })
    tone({ type: 'sine', freq: 110, freqEnd: 50, dur: 0.35, gain: 0.3 })
  },
  /** 管球負荷の警告 */
  overheat() {
    ;[0, 1, 2].forEach((i) => {
      tone({ type: 'square', freq: 660, dur: 0.12, gain: 0.07, delay: i * 0.26, lowpass: 2000 })
      tone({ type: 'square', freq: 440, dur: 0.12, gain: 0.07, delay: i * 0.26 + 0.13, lowpass: 2000 })
    })
  },
  lockOn() {
    tone({ type: 'sine', freq: 1200, freqEnd: 1700, dur: 0.06, gain: 0.08 })
  },
  /** ダイヤルを 1 刻み回した */
  tick() {
    tone({ type: 'square', freq: 2400, dur: 0.02, gain: 0.025, lowpass: 5000 })
  },
  combo() {
    ;[1568, 2093, 2637].forEach((f, i) => tone({ type: 'sine', freq: f, dur: 0.1, gain: 0.1, delay: 0.5 + i * 0.05 }))
  },
  start() {
    tone({ type: 'triangle', freq: 523, dur: 0.12, gain: 0.15 })
    tone({ type: 'triangle', freq: 784, dur: 0.25, gain: 0.15, delay: 0.12 })
  },
  clear() {
    ;[523, 659, 784, 1047, 784, 1047].forEach((f, i) => tone({ type: 'triangle', freq: f, dur: i === 5 ? 0.5 : 0.14, gain: 0.16, delay: i * 0.12 }))
  },
  gameOver() {
    ;[392, 330, 262, 196].forEach((f, i) => tone({ type: 'triangle', freq: f, dur: i === 3 ? 0.6 : 0.2, gain: 0.16, delay: i * 0.22 }))
  },
}
