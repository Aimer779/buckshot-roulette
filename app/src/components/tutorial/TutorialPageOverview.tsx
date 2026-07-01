import TutorialSectionTitle from './TutorialSectionTitle';

/**
 * Page 1: game overview / story intro.
 */
export default function TutorialPageOverview() {
  return (
    <div className="flex flex-col gap-6 h-full">
      <TutorialSectionTitle className="mb-2">欢迎来到地下夜总会</TutorialSectionTitle>

      <p
        className="font-chinese text-base leading-relaxed"
        style={{ color: 'var(--text-primary)' }}
      >
        1998年，你坐在一家地下夜总会的金属桌前。对面坐着神秘的"庄家"——一个与你进行生死对决的存在。
      </p>

      {/* Tagline highlight box */}
      <div
        className="rounded-lg p-6 border-l-4"
        style={{
          backgroundColor: 'rgba(220, 38, 38, 0.1)',
          borderColor: 'var(--accent-red)',
          borderWidth: '2px',
          borderLeftWidth: '4px',
        }}
      >
        <p
          className="font-chinese text-lg font-medium text-center leading-relaxed"
          style={{ color: 'var(--text-primary)' }}
        >
          两人进入。一人离开。
        </p>
        <p
          className="font-chinese text-base text-center mt-3 leading-relaxed"
          style={{ color: 'var(--text-primary)' }}
        >
          一把霰弹枪。实弹与空包弹。你或他。活到最后的，才能离开这张桌子。
        </p>
      </div>

      <p
        className="font-chinese text-base leading-relaxed"
        style={{ color: 'var(--text-secondary)' }}
      >
        游戏分为三个回合，难度逐步升级。每个回合中，你们轮流选择对自己或对庄家扣动扳机。
      </p>

      <p
        className="font-chinese text-base leading-relaxed mt-auto"
        style={{ color: 'var(--text-dim)' }}
      >
        祝你好运。
      </p>
    </div>
  );
}
