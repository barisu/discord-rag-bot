import { Client, GatewayIntentBits, Events } from 'discord.js';
import { bootstrap, registerRagServices, setContainer, SERVICES } from '@shared/core';
import { RagRetriever } from '@rag/core';
import { OpenAIEmbeddings } from '@rag/core';
import { PostgresVectorStore } from '@rag/core';
import { InitDbCommand } from './commands/init-db-refactored';
import { SearchCommand } from './commands/search';

// アプリケーションをブートストラップ
const { container, config, logger } = bootstrap();

// RAGサービスを登録
registerRagServices(container);

// グローバルコンテナを設定
setContainer(container);

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.DirectMessages,
  ],
});

// DiscordクライアントをMessageFetcherサービス用に登録
container.registerSingleton(SERVICES.MESSAGE_FETCHER, () => {
  const { MessageFetcher } = require('@shared/core');
  return new MessageFetcher(client);
});

// Initialize RAG system (after database connection)
const embeddings = new OpenAIEmbeddings(process.env.OPENAI_API_KEY || '');
const vectorStore = new PostgresVectorStore();
const ragRetriever = new RagRetriever(embeddings, vectorStore);

// Initialize commands (after database connection)
const initDbCommand = new InitDbCommand();
const searchCommand = new SearchCommand(client);

client.once(Events.ClientReady, (readyClient) => {
  console.log(`Ready! Logged in as ${readyClient.user.tag}`);
});

client.on(Events.MessageCreate, async (message) => {
  if (message.author.bot) return;
  
  if (message.content.startsWith('!ping')) {
    await message.reply('Pong! Discord RAG Bot is ready.');
  }
  
  if (message.content.startsWith('!init-db')) {
    const args = message.content.slice(8).trim().split(/\s+/);
    await initDbCommand.execute(message, args);
    return;
  }
  
  if (message.content.startsWith('!search')) {
    const args = message.content.slice(8).trim().split(/\s+/);
    await searchCommand.execute(message, args);
    return;
  }
  
  if (message.content.startsWith('!ask ')) {
    const query = message.content.slice(5).trim();
    
    try {
      const response = await ragRetriever.query({
        query,
        userId: message.author.id,
        guildId: message.guildId || undefined,
      });
      
      await message.reply(response.answer);
    } catch (error) {
      console.error('RAG query error:', error);
      await message.reply('Sorry, I encountered an error while processing your question.');
    }
  }
});

const token = process.env.DISCORD_TOKEN;
client.login(token);