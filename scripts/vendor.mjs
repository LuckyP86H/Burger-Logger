// Copies htmx into public/ so the page needs no CDN and the CSP can say script-src 'self'.
import { copyFileSync } from "node:fs";

copyFileSync("node_modules/htmx.org/dist/htmx.min.js", "public/htmx.min.js");
