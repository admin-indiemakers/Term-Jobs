import React from "react";
import ReactDOM from "react-dom/client";
import { AuraChatWorkspace } from "./AuraChatWorkspace";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <AuraChatWorkspace apiBaseUrl="http://localhost:8001" />
  </React.StrictMode>
);
