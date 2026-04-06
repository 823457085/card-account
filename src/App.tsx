import React, { useEffect } from 'react';
import { useRoomStore } from './store/useRoomStore';
import { useHistoryStore } from './store/useHistoryStore';
import IndexPage from './pages/index/IndexPage';
import RoomPage from './pages/room/RoomPage';
import SettlementPage from './pages/settlement/SettlementPage';
import HistoryPage from './pages/history/HistoryPage';
import HistoryDetailPage from './pages/history/HistoryDetailPage';

type Page = 'index' | 'room' | 'settlement' | 'history' | 'historyDetail';

export default function App() {
  const [page, setPage] = React.useState<Page>('index');
  const [recordId, setRecordId] = React.useState<string | null>(null);
  const { loadRooms, loadCurrentRoom } = useRoomStore();
  const { loadHistory } = useHistoryStore();

  useEffect(() => {
    loadRooms();
    loadHistory();

    const handleHashChange = () => {
      const hash = window.location.hash.slice(1);
      if (hash === '/pages/room/room') setPage('room');
      else if (hash === '/pages/settlement/settlement') setPage('settlement');
      else if (hash === '/pages/history/history') setPage('history');
      else if (hash === '/pages/history/historyDetail') setPage('historyDetail');
      else setPage('index');
    };

    handleHashChange();
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  const navigateTo = (p: Page, rid?: string) => {
    setPage(p);
    if (rid) setRecordId(rid);
    const routes: Record<Page, string> = {
      index: '/pages/index/index',
      room: '/pages/room/room',
      settlement: '/pages/settlement/settlement',
      history: '/pages/history/history',
      historyDetail: '/pages/history/historyDetail'
    };
    window.location.hash = routes[p];
  };

  return (
    <div className="app-root">
      {page === 'index' && <IndexPage navigateTo={navigateTo} />}
      {page === 'room' && <RoomPage navigateTo={navigateTo} />}
      {page === 'settlement' && <SettlementPage navigateTo={navigateTo} />}
      {page === 'history' && <HistoryPage navigateTo={navigateTo} />}
      {page === 'historyDetail' && <HistoryDetailPage navigateTo={navigateTo} recordId={recordId} />}
    </div>
  );
}
