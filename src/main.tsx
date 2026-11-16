import { createRoot } from "react-dom/client";
import App from "./App";
import "./style.css";
import "./game-v2.css";
createRoot(document.getElementById("root")!).render(<App />);
if (
  import.meta.env.DEV &&
  new URLSearchParams(location.search).get("qa") === "1"
)
  void import("./qa/bridge");
