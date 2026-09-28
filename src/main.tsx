import { createRoot } from 'react-dom/client';
import './styles/base.css';
import './styles/tv.css';
import './styles/phone.css';
import './styles/cards.css';
import { TvApp } from './tv/TvApp';
import { PhoneApp } from './phone/PhoneApp';
import { CardsPage } from './cards/CardsPage';

// Tiny path router:  /tv → host screen · /join[/CODE] → phone · /cards/CODE → print · / → landing
function App() {
  const parts = location.pathname.split('/').filter(Boolean);
  const [first, second] = [parts[0]?.toLowerCase(), parts[1]];
  document.body.dataset.view = first || 'home';
  if (first === 'tv' || first === 'host') return <TvApp />;
  if (first === 'cards' && second) return <CardsPage code={second.toUpperCase()} />;
  if (first === 'join') return <PhoneApp initialCode={second ?? null} />;
  return (
    <div className="phone center landing">
      <div className="logo big">THE <span>HUNDRED</span></div>
      <p className="muted">100 beers. One deadline. Someone is lying.</p>
      <a className="p-btn big" href="/join">📱 JOIN A GAME</a>
      <a className="p-btn ghost" href="/tv">📺 HOST / TV SCREEN</a>
    </div>
  );
}

createRoot(document.getElementById('root')!).render(<App />);
