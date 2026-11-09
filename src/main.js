import React from "react";
import { createRoot } from "react-dom/client";
import { html } from "htm/react";
import { App } from "./App.js";

const container = document.getElementById("root");
const root = createRoot(container);
root.render(html`<${App} />`);
