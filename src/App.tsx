import { useApp } from './context/AppContext';

import { HomeRoom } from './components/rooms/HomeRoom';
import { BeatLabRoom } from './components/rooms/BeatLabRoom';
import { FreeDLsRoom } from './components/rooms/FreeDLsRoom';
import { BeatTapesRoom } from './components/rooms/BeatTapesRoom';
import { ProdByRoom } from './components/rooms/ProdByRoom';
import { TheLabRoom } from './components/rooms/TheLabRoom';
import { BeatBaynGrRoom } from './components/rooms/BeatBaynGrRoom';
import { SubmissionRoom } from './components/rooms/SubmissionRoom';
import { ProfileRoom } from './components/rooms/ProfileRoom';
import { ExclusivesRoom } from './components/rooms/ExclusivesRoom';

import { AdminPanel } from './components/admin/AdminPanel';

import { GlobalPlayer } from './components/player/GlobalPlayer';
import { BeatBoxCart } from './components/modals/BeatBoxCart';
import { ToastContainer } from './components/ui/Toast';

function App() {
  const {
    currentRoom,
    cartOpen,
    bananazMode,
    bananazTheme,
    isAdmin,
  } = useApp();

  const bananazClass = bananazMode
    ? `bananaz-mode bananaz-${bananazTheme}`
    : '';

  return (
    <div
      className={`min-h-screen bg-[#080808] text-white relative overflow-x-hidden ${bananazClass}`}
    >
      {/* Ambient Background */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div
          className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[400px] rounded-full opacity-[0.03] blur-[80px]"
          style={{
            background:
              'radial-gradient(ellipse,#f5c518 0%,transparent 70%)',
          }}
        />
      </div>

      <div className="relative z-10">
        {currentRoom === 'home' && <HomeRoom />}
        {currentRoom === 'beatlab' && <BeatLabRoom />}
        {currentRoom === 'freedls' && <FreeDLsRoom />}
        {currentRoom === 'beattapes' && <BeatTapesRoom />}
        {currentRoom === 'prodby' && <ProdByRoom />}
        {currentRoom === 'thelab' && <TheLabRoom />}
        {currentRoom === 'beatbayngr' && <BeatBaynGrRoom />}
        {currentRoom === 'submission' && <SubmissionRoom />}
        {currentRoom === 'profile' && <ProfileRoom />}
        {currentRoom === 'exclusives' && <ExclusivesRoom />}

        {currentRoom === 'admin' && isAdmin && (
          <AdminPanel />
        )}
      </div>

      <GlobalPlayer />

      {cartOpen && <BeatBoxCart />}

      <ToastContainer />
    </div>
  );
}

export default App;