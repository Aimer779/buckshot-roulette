import { motion } from 'framer-motion';
import HealthBar from '@/components/HealthBar';
import ItemCard from '@/components/ItemCard';
import type { GamePhase, Item } from '@/store/gameStore';

interface DealerAreaProps {
  dealerHP: number;
  dealerMaxHP: number;
  dealerItems: Item[];
  phase: GamePhase;
}

/**
 * Dealer section: HP bar, dealer items, and animated silhouette.
 */
export default function DealerArea({
  dealerHP,
  dealerMaxHP,
  dealerItems,
  phase,
}: DealerAreaProps) {
  return (
    <div className="w-full max-w-4xl flex flex-col items-center gap-2">
      {/* Dealer HP */}
      <div className="flex items-center gap-3">
        <HealthBar current={dealerHP} max={dealerMaxHP} label="庄家" isDealer />
      </div>

      {/* Dealer items */}
      {dealerItems.length > 0 && (
        <div className="flex items-center gap-1.5 flex-wrap justify-center">
          {dealerItems.map((item) => (
            <ItemCard key={item.id} item={item} size="sm" disabled />
          ))}
        </div>
      )}

      {/* Dealer silhouette */}
      <motion.div
        animate={
          phase === 'DEALER_TURN' ? { y: 5, scale: 1.02 } : { y: 0, scale: 1 }
        }
        transition={{ duration: 0.5 }}
        className="relative"
      >
        <img
          src="/dealer-silhouette.png"
          alt="庄家"
          className="w-[120px] h-auto sm:w-[160px] md:w-[200px] object-contain"
          draggable={false}
          style={{
            filter:
              phase === 'DEALER_TURN'
                ? 'drop-shadow(0 0 20px rgba(220, 38, 38, 0.5))'
                : 'drop-shadow(0 0 10px rgba(220, 38, 38, 0.2))',
            transition: 'filter 0.5s',
          }}
        />
        {/* Red eye glow on dealer turn */}
        {phase === 'DEALER_TURN' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: [0.3, 0.8, 0.3] }}
            transition={{ duration: 2, repeat: Infinity }}
            className="absolute top-[35%] left-[45%] w-2 h-1 rounded-full"
            style={{
              backgroundColor: 'var(--accent-red)',
              boxShadow: '0 0 10px var(--accent-red)',
            }}
          />
        )}
      </motion.div>
    </div>
  );
}
