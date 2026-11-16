import { AccountPanel } from "./AccountPanel";
import { useGame } from "../store";
import "./auth-screen.css";
export function AuthScreen({ onGuest }: { onGuest: () => void }) {
  const error = useGame((s) => s.error);
  return (
    <main className="auth-world">
      <div className="auth-scene">
        <header className="auth-sign">
          <h1>Tiệm Trà Mây</h1>
          <p>♡ Trà ngon, ngày lành ♡</p>
        </header>
        <div className="auth-card-position">
          <AccountPanel
            fullPage
            onClose={onGuest}
            onEntered={() => useGame.setState({ error: "" })}
          />
          {error && (
            <p className="auth-error" role="alert">
              {error}
            </p>
          )}
        </div>
      </div>
    </main>
  );
}
