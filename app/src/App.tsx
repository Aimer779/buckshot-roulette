import { Routes, Route } from 'react-router';
import Layout from '@/components/Layout';
import TitleScreen from '@/pages/TitleScreen';
import TutorialScreen from '@/pages/TutorialScreen';
import GameplayScreen from '@/pages/GameplayScreen';
import GameOverScreen from '@/pages/GameOverScreen';

function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<TitleScreen />} />
        <Route path="/tutorial" element={<TutorialScreen />} />
        <Route path="/play" element={<GameplayScreen />} />
        <Route path="/gameover" element={<GameOverScreen />} />
      </Routes>
    </Layout>
  );
}

export default App;
