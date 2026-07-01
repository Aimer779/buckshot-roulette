import { ChevronRight, AlertTriangle } from 'lucide-react';
import { TUTORIAL_COMBOS, TUTORIAL_SURVIVAL_TIPS } from '@/data/tutorialContent';
import TutorialSectionTitle from './TutorialSectionTitle';

/**
 * Page 4: round progression, guillotine warning, combos, and survival tips.
 */
export default function TutorialPageRounds() {
  return (
    <div className="flex flex-col gap-5 h-full overflow-y-auto">
      <TutorialSectionTitle className="mb-1">回合演进</TutorialSectionTitle>

      {/* Round cards */}
      <div className="flex flex-col gap-3">
        {/* Round 1 */}
        <div
          className="rounded-lg p-4 border-l-4"
          style={{
            backgroundColor: 'var(--bg-surface)',
            borderColor: 'var(--accent-blue)',
            borderLeftWidth: '4px',
            borderWidth: '1px',
            borderLeftColor: 'var(--accent-blue)',
          }}
        >
          <div className="flex items-center gap-3 mb-2 flex-wrap">
            <h3 className="font-chinese text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
              第一回合
            </h3>
            <span className="px-2 py-0.5 rounded-full text-xs font-chinese" style={{ backgroundColor: 'var(--bg-elevated)', color: 'var(--text-secondary)' }}>
              2点生命
            </span>
            <span className="px-2 py-0.5 rounded-full text-xs font-chinese" style={{ backgroundColor: 'var(--bg-elevated)', color: 'var(--text-secondary)' }}>
              无道具
            </span>
          </div>
          <p className="font-chinese text-sm" style={{ color: 'var(--text-secondary)' }}>
            最简单的配置，霰弹枪装填 1-2 发实弹和 2-3 发空包弹。没有道具，纯粹的博弈。
          </p>
        </div>

        {/* Arrow */}
        <div className="flex justify-center">
          <ChevronRight className="w-5 h-5 rotate-90" style={{ color: 'var(--text-dim)' }} />
        </div>

        {/* Round 2 */}
        <div
          className="rounded-lg p-4 border-l-4"
          style={{
            backgroundColor: 'var(--bg-surface)',
            borderColor: 'var(--accent-amber)',
            borderWidth: '1px',
            borderLeftWidth: '4px',
            borderLeftColor: 'var(--accent-amber)',
          }}
        >
          <div className="flex items-center gap-3 mb-2 flex-wrap">
            <h3 className="font-chinese text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
              第二回合
            </h3>
            <span className="px-2 py-0.5 rounded-full text-xs font-chinese" style={{ backgroundColor: 'var(--bg-elevated)', color: 'var(--text-secondary)' }}>
              4点生命
            </span>
            <span className="px-2 py-0.5 rounded-full text-xs font-chinese" style={{ backgroundColor: 'var(--bg-elevated)', color: 'var(--text-secondary)' }}>
              每轮2个道具
            </span>
          </div>
          <p className="font-chinese text-sm" style={{ color: 'var(--text-secondary)' }}>
            道具系统解锁！生命值增加，装填更多子弹。策略深度大幅提升。
          </p>
        </div>

        {/* Arrow */}
        <div className="flex justify-center">
          <ChevronRight className="w-5 h-5 rotate-90" style={{ color: 'var(--text-dim)' }} />
        </div>

        {/* Round 3 */}
        <div
          className="rounded-lg p-4 border-l-4"
          style={{
            backgroundColor: 'var(--bg-surface)',
            borderColor: 'var(--accent-red)',
            borderWidth: '1px',
            borderLeftWidth: '4px',
            borderLeftColor: 'var(--accent-red)',
          }}
        >
          <div className="flex items-center gap-3 mb-2 flex-wrap">
            <h3 className="font-chinese text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
              第三回合
            </h3>
            <span className="px-2 py-0.5 rounded-full text-xs font-chinese" style={{ backgroundColor: 'var(--bg-elevated)', color: 'var(--text-secondary)' }}>
              5点生命
            </span>
            <span className="px-2 py-0.5 rounded-full text-xs font-chinese" style={{ backgroundColor: 'var(--bg-elevated)', color: 'var(--text-secondary)' }}>
              每轮4个道具
            </span>
            <span className="px-2 py-0.5 rounded-full text-xs font-chinese" style={{ backgroundColor: 'rgba(220, 38, 38, 0.2)', color: 'var(--accent-red)' }}>
              闸刀
            </span>
          </div>
          <p className="font-chinese text-sm" style={{ color: 'var(--text-secondary)' }}>
            最终对决！引入致命闸刀机制：生命降至2点以下时，除颤仪被切断。无法恢复生命，下一次实弹命中直接死亡。
          </p>
        </div>
      </div>

      {/* Guillotine warning */}
      <div
        className="flex items-start gap-3 rounded-lg p-4 border"
        style={{
          backgroundColor: 'rgba(220, 38, 38, 0.1)',
          borderColor: 'var(--accent-red)',
          borderWidth: '2px',
        }}
      >
        <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: 'var(--accent-red)' }} />
        <div>
          <p className="font-chinese text-sm font-bold mb-1" style={{ color: 'var(--accent-red)' }}>
            闸刀警告
          </p>
          <p className="font-chinese text-sm" style={{ color: 'var(--text-primary)' }}>
            生命 ≤ 2 时，恢复类道具失效。请谨慎管理生命值。
          </p>
        </div>
      </div>

      {/* Classic combos */}
      <div>
        <h3
          className="font-chinese text-base font-bold mb-3"
          style={{ color: 'var(--accent-gold)' }}
        >
          经典 Combo
        </h3>
        <div className="flex flex-col gap-2">
          {TUTORIAL_COMBOS.map((combo, i) => (
            <div
              key={i}
              className="rounded-md p-3 border"
              style={{ backgroundColor: 'rgba(212, 165, 32, 0.05)', borderColor: 'rgba(212, 165, 32, 0.2)' }}
            >
              <p className="font-chinese text-sm" style={{ color: 'var(--accent-gold)' }}>
                {combo}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Tips */}
      <div>
        <h3
          className="font-chinese text-base font-bold mb-3"
          style={{ color: 'var(--text-primary)' }}
        >
          生存提示
        </h3>
        <ul className="flex flex-col gap-1.5">
          {TUTORIAL_SURVIVAL_TIPS.map((tip, i) => (
            <li
              key={i}
              className="font-chinese text-sm flex items-start gap-2"
              style={{ color: 'var(--text-secondary)' }}
            >
              <span style={{ color: 'var(--accent-red)' }}>•</span>
              {tip}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
