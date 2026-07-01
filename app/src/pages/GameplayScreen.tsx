import { useNavigate } from 'react-router';
import { motion } from 'framer-motion';
import GameLogPanel from '@/components/GameLogPanel';
import GameplayHud from '@/components/gameplay/GameplayHud';
import DealerArea from '@/components/gameplay/DealerArea';
import ShotgunStage from '@/components/gameplay/ShotgunStage';
import PlayerArea from '@/components/gameplay/PlayerArea';
import GameplayOverlays from '@/components/gameplay/GameplayOverlays';
import { useGameplayController } from '@/hooks/useGameplayController';

export default function GameplayScreen() {
  const navigate = useNavigate();
  const { state, ui, actions } = useGameplayController(navigate);

  return (
    <div
      className="relative min-h-[100dvh] w-full overflow-hidden select-none"
      style={{ backgroundColor: 'var(--bg-void)' }}
    >
      {/* Background */}
      <div
        className="fixed inset-0 z-0 opacity-40"
        style={{
          backgroundImage: 'url(/bg-gameplay.jpg)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      />

      {/* Screen shake wrapper */}
      <motion.div
        animate={
          ui.shakeScreen
            ? {
                x: [0, -4, 4, -3, 3, -2, 2, 0],
                y: [0, 2, -3, 2, -2, 1, -1, 0],
              }
            : {}
        }
        transition={{ duration: 0.3 }}
        className="relative z-10 min-h-[100dvh] flex flex-col"
      >
        {/* ═══ Top HUD Bar ═══ */}
        <GameplayHud
          phase={state.phase}
          dealerThinking={state.dealerThinking}
          currentRound={state.currentRound}
          maxRounds={state.maxRounds}
          roundLabel={state.roundLabel}
          sawActive={state.sawActive}
          skipDealerTurn={state.skipDealerTurn}
          onToggleSettings={actions.toggleSettings}
        />

        {/* ═══ Game Log + Main Game Area ═══ */}
        <div className="relative flex-1 flex overflow-hidden">
          <GameLogPanel />

          {/* ═══ Main Game Area ═══ */}
          <div className="flex-1 flex flex-col items-center justify-between px-4 py-2 sm:py-4 relative overflow-y-auto">
            {/* ─── Dealer Section ─── */}
            <DealerArea
              dealerHP={state.dealerHP}
              dealerMaxHP={state.dealerMaxHP}
              dealerItems={state.dealerItems}
              phase={state.phase}
            />

            {/* ─── Central Game Area ─── */}
            <ShotgunStage
              shells={state.shells}
              currentShellIndex={state.currentShellIndex}
              shootingAnim={ui.shootingAnim}
              muzzleFlash={ui.muzzleFlash}
              shellEjectAnim={ui.shellEjectAnim}
              ejectedShellType={ui.ejectedShellType}
              revealedShellIndex={ui.revealedShellIndex}
              itemEffectAnim={ui.itemEffectAnim}
            />

            {/* ─── Player Section ─── */}
            <PlayerArea
              playerHP={state.playerHP}
              playerMaxHP={state.playerMaxHP}
              playerItems={state.playerItems}
              actionsEnabled={state.actionsEnabled}
              onUseItem={actions.useItem}
              onShootSelf={actions.shootSelf}
              onShootDealer={actions.shootDealer}
            />
          </div>
        </div>
      </motion.div>

      {/* ═══ Overlays ═══ */}
      <GameplayOverlays
        roundAnnounce={ui.roundAnnounce}
        currentRound={state.currentRound}
        roundLabel={state.roundLabel}
        showGuillotineWarning={ui.showGuillotineWarning}
        bloodFlash={ui.bloodFlash}
        damageFloatingText={ui.damageFloatingText}
        settingsOpen={ui.settingsOpen}
        phase={state.phase}
        dealerThinking={state.dealerThinking}
        itemEffectAnim={ui.itemEffectAnim}
        toasts={ui.toasts}
        onDismissToast={actions.dismissToast}
        onCloseSettings={actions.closeSettings}
        onQuit={actions.quit}
      />
    </div>
  );
}