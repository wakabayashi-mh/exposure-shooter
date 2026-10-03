import { lazy, Suspense, useEffect, useState } from 'react'
import { create } from 'zustand'
import { appendHistory } from '../../../core/history/history'
import { currentProfile } from '../../../core/profile/profileStore'
import { useBestStore } from '../bestStore'
import type { PlayLog } from '../logic/historyStats'
import { useRankingStore, type RankIn } from '../rankingStore'
import { useDexStore } from '../dexStore'
import type { Difficulty } from '../logic/constants'
import type { PlayConfig, PlayResult } from '../playConfig'
import { CharacterDexScreen } from './CharacterDexScreen'
import { HistoryScreen } from './HistoryScreen'
import { MasterEditorScreen } from './MasterEditorScreen'
import { ModeSelectScreen } from './ModeSelectScreen'
import { RankingScreen } from './RankingScreen'
import { ResultScreen } from './ResultScreen'
import { SettingsScreen } from './SettingsScreen'
import { StageSelectScreen } from './StageSelectScreen'

// Phaser は大きいので、プレイ画面を開いたときに読み込む
const PlayScreen = lazy(() => import('./PlayScreen').then((m) => ({ default: m.PlayScreen })))

type Screen = 'mode' | 'stage' | 'play' | 'result' | 'master' | 'dex' | 'ranking' | 'history' | 'settings'

interface NavState {
  screen: Screen
  difficulty: Difficulty
  /** いま遊んでいる / 直前に遊んだ設定 */
  config: PlayConfig | null
  /** 直前の結果でベストを更新したか */
  newBest: boolean
  /** 直前の結果のランクイン */
  rankIn: RankIn | null
  go: (screen: Screen) => void
  setDifficulty: (d: Difficulty) => void
  play: (config: PlayConfig) => void
}

const useNav = create<NavState>((set) => ({
  screen: 'mode',
  difficulty: 'standard',
  config: null,
  newBest: false,
  rankIn: null,
  go: (screen) => set({ screen }),
  setDifficulty: (difficulty) => set({ difficulty }),
  play: (config) => set({ config, screen: 'play' }),
}))

/** クイックスタートはページを開いたときの 1 回だけ */
let quickStarted = false

/** スマホを縦に持っている間は false（横向きを促す表示が出ている） */
function useLandscapeReady() {
  const query = () => !matchMedia('(pointer: coarse)').matches || matchMedia('(orientation: landscape)').matches
  const [ready, setReady] = useState(query)
  useEffect(() => {
    const mq = matchMedia('(orientation: landscape)')
    const onChange = () => setReady(query())
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])
  return ready
}

/** 撮影条件シューティングの画面遷移（モード選択 → ステージ選択 → プレイ → 結果・復習） */
export function ShooterRoot({ onExit, quickStart }: { onExit: () => void; quickStart?: PlayConfig | null }) {
  const { screen, difficulty, config, newBest, rankIn, go, setDifficulty, play } = useNav()
  const loadBest = useBestStore((s) => s.load)
  const loadDex = useDexStore((s) => s.load)
  const landscape = useLandscapeReady()

  useEffect(() => {
    void loadBest()
    void loadDex()
  }, [loadBest, loadDex])

  // 試作の共有用：横向きになったらすぐ遊び始める
  useEffect(() => {
    if (!quickStart || quickStarted || !landscape) return
    quickStarted = true
    play(quickStart)
  }, [quickStart, landscape, play])

  const finish = async (result: PlayResult) => {
    const profile = currentProfile()
    const better = await useBestStore.getState().submit(result)
    await useDexStore.getState().addFromRecords(result.session.records)
    const { config, status, session } = result
    const log: PlayLog = {
      at: new Date().toISOString(),
      mode: config.mode,
      difficulty: config.difficulty,
      region: config.mode === 'hard' ? undefined : config.region,
      status,
      score: session.score,
      records: session.records,
    }
    await appendHistory('exposure-shooter', profile.id, log)
    const rankIn = await useRankingStore.getState().submit(result, profile)
    useNav.setState({ newBest: better, rankIn, screen: 'result' })
  }

  switch (screen) {
    case 'stage':
      return <StageSelectScreen difficulty={difficulty} onPlay={play} onBack={() => go('mode')} />
    case 'master':
      return <MasterEditorScreen onBack={() => go('mode')} />
    case 'ranking':
      return <RankingScreen onBack={() => go('mode')} />
    case 'history':
      return <HistoryScreen onBack={() => go('mode')} />
    case 'settings':
      return <SettingsScreen onBack={() => go('mode')} />
    case 'dex':
      return <CharacterDexScreen onBack={() => go('mode')} />
    case 'play':
      return (
        <Suspense fallback={<div className="screen center muted">読み込み中…</div>}>
          <PlayScreen
            key={JSON.stringify(config)}
            config={config!}
            onFinish={(r) => void finish(r)}
            onQuit={() => go(config?.mode === 'standard' ? 'stage' : 'mode')}
          />
        </Suspense>
      )
    case 'result':
      return (
        <ResultScreen
          newBest={newBest}
          rankIn={rankIn}
          onPlay={play}
          onStageSelect={(mode) => go(mode === 'hard' ? 'mode' : 'stage')}
        />
      )
    default:
      return (
        <ModeSelectScreen
          difficulty={difficulty}
          onDifficulty={setDifficulty}
          onStandard={() => go('stage')}
          onPlay={play}
          onNavigate={go}
          onBack={onExit}
        />
      )
  }
}
