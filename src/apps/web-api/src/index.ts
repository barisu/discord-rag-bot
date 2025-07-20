import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { prettyJSON } from 'hono/pretty-json';

const app = new Hono();

app.use('*', cors());
app.use('*', logger());
app.use('*', prettyJSON());

app.get('/', (c) => {
  return c.json({ 
    message: 'Discord RAG Bot API',
    version: '1.0.0',
    status: 'running'
  });
});

app.get('/health', (c) => {
  return c.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

const port = process.env.PORT || 3000;

console.log(`Server is running on port ${port}`);

export default {
  port,
  fetch: app.fetch,
};