import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom';
import CalendarPage from './pages/CalendarPage';
import TripPage from './pages/TripPage';
import PeoplePage from './pages/PeoplePage';
import StatsPage from './pages/StatsPage';
import NotificationsPanel from './components/NotificationsPanel';
import './App.css';

export default function App() {
  return (
    <BrowserRouter>
      <div className="app">
        <nav className="nav">
          <div className="nav-brand">🤾 Saymons on Tour</div>
          <NotificationsPanel />
        </nav>
        <main className="main">
          <Routes>
            <Route path="/" element={<CalendarPage />} />
            <Route path="/trips/:id" element={<TripPage />} />
            <Route path="/people" element={<PeoplePage />} />
            <Route path="/stats" element={<StatsPage />} />
          </Routes>
        </main>
        <nav className="bottom-nav">
          <NavLink to="/" end className={({ isActive }) => isActive ? 'active' : ''}>
            <span className="nav-icon">🗓️</span>
            Выезды
          </NavLink>
          <NavLink to="/people" className={({ isActive }) => isActive ? 'active' : ''}>
            <span className="nav-icon">👥</span>
            Участники
          </NavLink>
          <NavLink to="/stats" className={({ isActive }) => isActive ? 'active' : ''}>
            <span className="nav-icon">📊</span>
            Рейтинг
          </NavLink>
        </nav>
      </div>
    </BrowserRouter>
  );
}
