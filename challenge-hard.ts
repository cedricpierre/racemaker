import { createApp } from "./src/app";

const app = createApp();

export default {
  port: 3000,
  fetch: app.fetch,
};

