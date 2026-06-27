import { useApp } from './context/AppContext';

import { HomeRoom } from './components/rooms/HomeRoom';
import { BeatLabRoom } from './components/rooms/BeatLabRoom';
import { FreeDLsRoom } from './components/rooms/FreeDLsRoom';
import { BeatTapesRoom } from './components/rooms/BeatTapesRoom';
import { ProdByRoom } from './components/rooms/ProdByRoom';
import { CreditsRoom } from './components/rooms/CreditsRoom';
import { TheLabRoom } from './components/rooms/TheLabRoom';
import { BeatBaynGrRoom } from './components/rooms/BeatBaynGrRoom';
import { SupaMasterRoom } from './components/rooms/SupaMasterRoom';
import { SubmissionRoom } from './components/rooms/SubmissionRoom';
import { ProfileRoom } from './components/rooms/ProfileRoom';
import { ExclusivesRoom } from './components/rooms/ExclusivesRoom';

import { AdminPanel } from './components/admin/AdminPanel';

import { GlobalPlayer } from './components/player/GlobalPlayer';
import { BeatBoxCart } from './components/modals/BeatBoxCart';
import { ToastContainer } from './components/ui/Toast';

function App() {
  const { currentRoom, cartOpen, isAdmin } = useApp();

  const renderRoom = () => {
    if (currentRoom === 'home') return <HomeRoom />;
    if (currentRoom === 'beatlab') return <BeatLabRoom />;
    if (currentRoom === 'freedls') return <FreeDLsRoom />;
    if (currentRoom === 'beattapes') return <BeatTapesRoom />;
    if (currentRoom === 'prodby') return <ProdByRoom />;
    if (currentRoom === 'credits') return <CreditsRoom />;
    if (currentRoom === 'thelab') return <TheLabRoom />;
    if (currentRoom === 'beatbayngr') return <BeatBaynGrRoom />;
    if (currentRoom === 'supamaster') return <SupaMasterRoom />;
    if (currentRoom === 'submission') return <SubmissionRoom />;
    if (currentRoom === 'profile') return <ProfileRoom />;
    if (currentRoom === 'exclusives') return <ExclusivesRoom />;
    if (currentRoom === 'admin' && isAdmin) return <AdminPanel />;

    return <HomeRoom />;
  };

  return (
    <div className="min-h-screen bg-[#080808] text-white relative overflow-x-hidden">
      <div className="fixed inset-0 pointer-events-none z-0">
        <div
          className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[400px] rounded-full opacity-[0.03] blur-[80px]"
          style={{
            background: 'radial-gradient(ellipse,#f5c518 0%,transparent 70%)',
          }}
        />
      </div>

      <div className="relative z-10">{renderRoom()}</div>

      <GlobalPlayer />

      {cartOpen && <BeatBoxCart />}

      <ToastContainer />
    </div>
  );
}

export default App;
