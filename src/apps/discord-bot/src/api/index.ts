import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { prettyJSON } from 'hono/pretty-json';

export function createApiServer() {
  const app = new Hono();

  app.use('*', cors());
  app.use('*', logger());
  app.use('*', prettyJSON());

  app.get('/', (c) => {
    return c.json({ 
      message: 'Discord RAG Bot Internal API',
      version: '1.0.0',
      status: 'running'
    });
  });

  app.get('/health', (c) => {
    return c.json({ status: 'healthy', timestamp: new Date().toISOString() });
  });

  return app;
}

export function startApiServer(port = 3000) {
  const app = createApiServer();
  
  console.log(`Internal API server is running on port ${port}`);
  
  return {
    port,
    fetch: app.fetch,
  };
}