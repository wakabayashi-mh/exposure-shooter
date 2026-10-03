import { lazy, Suspense, useEffect } from 'react'
import { create } from 'zustand'
import { useBestStore } from '../bestStore'
import type { Difficulty } from '../logic/constants'
import type { PlayConfig, PlayResult } from '../playConfig'
import { MasterListScreen } from './MasterListScreen'
import { ModeSelectScreen } from './ModeSelectScreen'
import { ResultScreen } from './ResultScreen'
import { StageSelectScreen } from './StageSelectScreen'

// Phaser は大きいので、プレイ画面を開いたときに読み込む
const PlayScreen = lazy(() => import('./PlayScreen').then((m) => ({ default: m.PlayScreen })))

type Screen = 'mode' | 'stage' | 'play' | 'result' | 'master'

interface NavState {
  screen: Screen
  difficulty: Difficulty
  /** いま遊んでいる / 直前に遊んだ設定 */
  config: PlayConfig | null
  /** 直前の結果でベストを更新したか */
  newBest: boolean
  go: (screen: Screen) => void
  setDifficulty: (d: Difficulty) => void
  play: (config: PlayConfig) => void
}

const useNav = create<NavState>((set) => ({
  screen: 'mode',
  difficulty: 'standard',
  config: null,
  newBest: false,
  go: (screen) => set({ screen }),
  setDifficulty: (difficulty) => set({ difficulty }),
  play: (config) => set({ config, screen: 'play' }),
}))

/** 撮影条件シューティングの画面遷移（モード選択 → ステージ選択 → プレイ → 結果・復習） */
export function ShooterRoot({ onExit }: { onExit: () => void }) {
  const { screen, difficulty, config, newBest, go, setDifficulty, play } = useNav()
  const loadBest = useBestStore((s) => s.load)

  useEffect(() => {
    void loadBest()
  }, [loadBest])

  const finish = async (result: PlayResult) => {
    const better = await useBestStore.getState().submit(result)
    useNav.setState({ newBest: better, screen: 'result' })
  }

  switch (screen) {
    case 'stage':
      return <StageSelectScreen difficulty={difficulty} onPlay={play} onBack={() => go('mode')} />
    case 'master':
      return <MasterListScreen onBack={() => go('mode')} />
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
          onMaster={() => go('master')}
          onBack={onExit}
        />
      )
  }
}
