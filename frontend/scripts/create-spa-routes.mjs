import { mkdir, copyFile } from "node:fs/promises";
import { join } from "node:path";

const dist = join(process.cwd(), "dist");
const indexFile = join(dist, "index.html");

// Render's static CDN needs a real file for a deep URL unless a rewrite rule
// is configured. Create route entry files as a deployment-safe SPA fallback.
// React Router still controls the route after index.html loads.
const routes = [
  "cluster-map",
  "farmers",
  "team-location",
  "admin",
  "admin/users",
  "admin/data",
  "admin/audit",
  "admin/team-location",
  "data",
];

for (const route of routes) {
  const targetDir = join(dist, route);
  await mkdir(targetDir, { recursive: true });
  await copyFile(indexFile, join(targetDir, "index.html"));
}

console.log(`Created SPA refresh fallbacks for ${routes.length} routes.`);
