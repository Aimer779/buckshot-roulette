import { ChevronRight } from 'lucide-react';
import TutorialSectionTitle from './TutorialSectionTitle';
import TutorialInfoCard from './TutorialInfoCard';

/**
 * Page 2: core rules — round flow, shell types, and shooting choices.
 */
export default function TutorialPageRules() {
  return (
    <div className="flex flex-col gap-5 h-full overflow-y-auto">
      <TutorialSectionTitle className="mb-1">核心规则</TutorialSectionTitle>

      {/* Round flow */}
      <div>
        <h3
          className="font-chinese text-lg font-bold mb-3"
          style={{ color: 'var(--text-primary)' }}
        >
          回合流程
        </h3>
        <div
          className="flex flex-wrap items-center gap-2 font-chinese text-sm"
          style={{ color: 'var(--text-secondary)' }}
        >
          <span className="px-3 py-1 rounded-md" style={{ backgroundColor: 'var(--bg-elevated)' }}>① 装弹</span>
          <ChevronRight className="w-4 h-4" style={{ color: 'var(--accent-red)' }} />
          <span className="px-3 py-1 rounded-md" style={{ backgroundColor: 'var(--bg-elevated)' }}>② 玩家回合</span>
          <ChevronRight className="w-4 h-4" style={{ color: 'var(--accent-red)' }} />
          <span className="px-3 py-1 rounded-md" style={{ backgroundColor: 'var(--bg-elevated)' }}>③ 庄家回合</span>
          <ChevronRight className="w-4 h-4" style={{ color: 'var(--accent-red)' }} />
          <span className="px-3 py-1 rounded-md" style={{ backgroundColor: 'var(--bg-elevated)' }}>重复</span>
        </div>
      </div>

      {/* Shell types */}
      <div className="flex flex-col sm:flex-row gap-3">
        <TutorialInfoCard className="flex-1 p-4">
          <div className="flex items-center gap-2 mb-2">
            <div
              className="w-5 h-5 rounded-full"
              style={{ backgroundColor: 'var(--accent-red)', boxShadow: '0 0 8px var(--accent-red)' }}
            />
            <span className="font-chinese text-base font-bold" style={{ color: 'var(--accent-red)' }}>
              实弹
            </span>
          </div>
          <p className="font-chinese text-sm" style={{ color: 'var(--text-secondary)' }}>
            造成伤害，回合结束
          </p>
        </TutorialInfoCard>
        <TutorialInfoCard className="flex-1 p-4">
          <div className="flex items-center gap-2 mb-2">
            <div
              className="w-5 h-5 rounded-full"
              style={{ backgroundColor: 'var(--accent-blue-dim)', boxShadow: '0 0 8px var(--accent-blue)' }}
            />
            <span className="font-chinese text-base font-bold" style={{ color: 'var(--accent-blue)' }}>
              空包弹
            </span>
          </div>
          <p className="font-chinese text-sm" style={{ color: 'var(--text-secondary)' }}>
            无伤害，对自己开枪可额外回合
          </p>
        </TutorialInfoCard>
      </div>

      {/* Shooting choices */}
      <div>
        <h3
          className="font-chinese text-lg font-bold mb-3"
          style={{ color: 'var(--text-primary)' }}
        >
          射击选择
        </h3>
        <div className="flex flex-col sm:flex-row gap-3">
          <TutorialInfoCard className="flex-1 p-4">
            <h4 className="font-chinese text-base font-bold mb-2" style={{ color: 'var(--text-primary)' }}>
              对自己射击
            </h4>
            <p className="font-chinese text-sm mb-1" style={{ color: 'var(--accent-blue)' }}>
              空包弹 → 额外回合（高收益）
            </p>
            <p className="font-chinese text-sm" style={{ color: 'var(--accent-red)' }}>
              实弹 → 自己受伤，回合结束
            </p>
          </TutorialInfoCard>
          <TutorialInfoCard className="flex-1 p-4">
            <h4 className="font-chinese text-base font-bold mb-2" style={{ color: 'var(--text-primary)' }}>
              对庄家射击
            </h4>
            <p className="font-chinese text-sm mb-1" style={{ color: 'var(--accent-red)' }}>
              实弹 → 庄家受伤，回合结束
            </p>
            <p className="font-chinese text-sm" style={{ color: 'var(--text-dim)' }}>
              空包弹 → 无事发生，回合结束
            </p>
          </TutorialInfoCard>
        </div>
      </div>

      <p
        className="font-chinese text-sm"
        style={{ color: 'var(--text-dim)' }}
      >
        每回合开始时，会告知实弹和空包弹数量，但顺序完全随机。
      </p>
    </div>
  );
}
