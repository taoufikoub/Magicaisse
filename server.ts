import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";

import usersRouter from "./src/routes/users.ts";
import productsRouter from "./src/routes/products.ts";
import salesRouter from "./src/routes/sales.ts";
import inventoryRouter from "./src/routes/inventory.ts";
import shopifyRouter from "./src/routes/shopify.ts";
import reportsRouter from "./src/routes/reports.ts";

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Middleware for body parsing
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // API Health Check
  app.get("/api/health", (req, res) => {
    res.json({ status: "healthy", timestamp: new Date().toISOString() });
  });

  // Mount Modular Domain API Routers
  app.use("/api/users", usersRouter);
  app.use("/api/products", productsRouter);
  app.use("/api/sales", salesRouter);
  app.use("/api/inventory", inventoryRouter);
  app.use("/api/shopify", shopifyRouter);
  app.use("/api/reports", reportsRouter);

  // Serve static assets & Vite middleware configuration
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
    console.log("Vite dev middleware mounted successfully.");
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
    console.log("Production static build mounted.");
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Toy Shop Master POS Server running on port ${PORT}`);
  });
}

startServer().catch((err) => {
  console.error("Critical server boot failure:", err);
  process.exit(1);
});
