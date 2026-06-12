import "./styles/base.css";
import { mountGodWorkbenchPage } from "./screens/god-workbench/index.js";

const root = document.getElementById("app");

if (!root) {
    throw new Error("Missing #app root.");
}

mountGodWorkbenchPage({ root });
