/**
 * 効果音の小さな合成エンジン（Web Audio）。音源ファイルを使わないので、オフラインで動き、素材の権利の心配もない。
 * ブラウザは操作があるまで音を鳴らせないので、最初の操作で unlockAudio() を呼ぶ。
 */

let ctx: AudioContext | null = null
let master: GainNode | null = null
let volume = 0.8

function ensure(): AudioContext | null {
  if (ctx) return ctx
  const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!Ctor) return null
  ctx = new Ctor()
  master = ctx.createGain()
  master.gain.value = volume
  master.connect(ctx.destination)
  return ctx
}

/** 操作のあとに呼ぶ（スマホ・ブラウザの自動再生の制限を外す） */
export function unlockAudio() {
  const c = ensure()
  if (c && c.state === 'suspended') void c.resume()
}

/** 音量 0〜1 */
export function setVolume(v: number) {
  volume = Math.min(1, Math.max(0, v))
  if (master && ctx) master.gain.setTargetAtTime(volume, ctx.currentTime, 0.01)
}

/** 鳴らせる状態なら AudioContext と出力先を返す */
export function output(): { ctx: AudioContext; out: GainNode } | null {
  const c = ensure()
  if (!c || !master || c.state !== 'running' || volume === 0) return null
  return { ctx: c, out: master }
}

export interface ToneOptions {
  type?: OscillatorType
  freq: number
  /** 終わりの周波数（指定すると指数でなめらかに変える） */
  freqEnd?: number
  /** 長さ [秒] */
  dur: number
  gain?: number
  /** 鳴り始めまでの遅れ [秒] */
  delay?: number
  attack?: number
  /** ローパスフィルタの周波数（耳に痛い高音を丸める） */
  lowpass?: number
}

/** 単音を 1 つ鳴らす */
export function tone(o: ToneOptions) {
  const io = output()
  if (!io) return
  const { ctx, out } = io
  const t0 = ctx.currentTime + (o.delay ?? 0)
  const osc = ctx.createOscillator()
  osc.type = o.type ?? 'sine'
  osc.frequency.setValueAtTime(o.freq, t0)
  if (o.freqEnd) osc.frequency.exponentialRampToValueAtTime(o.freqEnd, t0 + o.dur)
  const g = ctx.createGain()
  const peak = o.gain ?? 0.2
  const attack = o.attack ?? 0.005
  g.gain.setValueAtTime(0.0001, t0)
  g.gain.exponentialRampToValueAtTime(peak, t0 + attack)
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + o.dur)
  let node: AudioNode = osc
  if (o.lowpass) {
    const f = ctx.createBiquadFilter()
    f.type = 'lowpass'
    f.frequency.value = o.lowpass
    osc.connect(f)
    node = f
  }
  node.connect(g).connect(out)
  osc.start(t0)
  osc.stop(t0 + o.dur + 0.05)
}

/** 雑音（どすん、ざざっ）を鳴らす */
export function noise(o: { dur: number; gain?: number; lowpass?: number; delay?: number }) {
  const io = output()
  if (!io) return
  const { ctx, out } = io
  const t0 = ctx.currentTime + (o.delay ?? 0)
  const buf = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * o.dur), ctx.sampleRate)
  const data = buf.getChannelData(0)
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1
  const src = ctx.createBufferSource()
  src.buffer = buf
  const f = ctx.createBiquadFilter()
  f.type = 'lowpass'
  f.frequency.value = o.lowpass ?? 800
  const g = ctx.createGain()
  g.gain.setValueAtTime(o.gain ?? 0.3, t0)
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + o.dur)
  src.connect(f).connect(g).connect(out)
  src.start(t0)
}

/** 鳴らし続けて、あとで止める音（準備中のロートアップ音など） */
export interface Held {
  stop: () => void
}

export function held(build: (ctx: AudioContext, out: AudioNode) => { stop: (t: number) => void }): Held {
  const io = output()
  if (!io) return { stop: () => {} }
  const h = build(io.ctx, io.out)
  let stopped = false
  return {
    stop: () => {
      if (stopped) return
      stopped = true
      h.stop(io.ctx.currentTime)
    },
  }
}
