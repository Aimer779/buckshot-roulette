import { useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { playSFX } from '@/lib/sound';
import { useGameStore } from '@/store/gameStore';
import type { TutorialItemDetail } from '@/data/tutorialContent';
import TutorialLayout from '@/components/tutorial/TutorialLayout';
import TutorialNavBar from '@/components/tutorial/TutorialNavBar';
import TutorialManual from '@/components/tutorial/TutorialManual';
import TutorialPagination from '@/components/tutorial/TutorialPagination';
import TutorialStartAction from '@/components/tutorial/TutorialStartAction';
import TutorialItemModal from '@/components/tutorial/TutorialItemModal';
import TutorialPageOverview from '@/components/tutorial/TutorialPageOverview';
import TutorialPageRules from '@/components/tutorial/TutorialPageRules';
import TutorialPageItems from '@/components/tutorial/TutorialPageItems';
import TutorialPageRounds from '@/components/tutorial/TutorialPageRounds';

const TOTAL_PAGES = 4;

export default function TutorialScreen() {
  const navigate = useNavigate();
  const { setShowTutorial, resetGame } = useGameStore();

  const [currentPage, setCurrentPage] = useState(0);
  const [direction, setDirection] = useState(0);
  const [selectedItem, setSelectedItem] = useState<TutorialItemDetail | null>(null);

  const goToPage = useCallback(
    (page: number) => {
      if (page < 0 || page >= TOTAL_PAGES) return;
      playSFX('shell-eject', 0.3);
      setDirection(page > currentPage ? 1 : -1);
      setCurrentPage(page);
    },
    [currentPage]
  );

  const handleBack = useCallback(() => {
    playSFX('shotgun-click', 0.3);
    navigate('/');
  }, [navigate]);

  const handleStart = useCallback(() => {
    playSFX('shotgun-pump');
    setShowTutorial(false);
    resetGame();
    navigate('/play');
  }, [navigate, resetGame, setShowTutorial]);

  const handleSkip = useCallback(() => {
    playSFX('shotgun-click', 0.3);
    setShowTutorial(false);
    resetGame();
    navigate('/play');
  }, [navigate, resetGame, setShowTutorial]);

  const handleSelectItem = useCallback((item: TutorialItemDetail) => {
    playSFX('item-use', 0.3);
    setSelectedItem(item);
  }, []);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (selectedItem) {
        if (e.key === 'Escape') {
          setSelectedItem(null);
        }
        return;
      }

      if (e.key === 'ArrowLeft') {
        goToPage(currentPage - 1);
      } else if (e.key === 'ArrowRight') {
        goToPage(currentPage + 1);
      } else if (e.key === 'Escape') {
        handleBack();
      } else if (e.key === 'Enter' && currentPage === TOTAL_PAGES - 1) {
        handleStart();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentPage, selectedItem, goToPage, handleBack, handleStart]);

  const renderCurrentPage = () => {
    switch (currentPage) {
      case 0:
        return <TutorialPageOverview />;
      case 1:
        return <TutorialPageRules />;
      case 2:
        return <TutorialPageItems onSelectItem={handleSelectItem} />;
      case 3:
        return <TutorialPageRounds />;
      default:
        return null;
    }
  };

  return (
    <TutorialLayout>
      <TutorialNavBar onBack={handleBack} onSkip={handleSkip} />
      <TutorialManual currentPage={currentPage} direction={direction}>
        {renderCurrentPage()}
      </TutorialManual>
      <TutorialPagination
        currentPage={currentPage}
        totalPages={TOTAL_PAGES}
        onPageChange={goToPage}
      />
      <TutorialStartAction
        visible={currentPage === TOTAL_PAGES - 1}
        onStart={handleStart}
      />
      <TutorialItemModal item={selectedItem} onClose={() => setSelectedItem(null)} />
    </TutorialLayout>
  );
}
