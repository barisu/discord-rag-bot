import { Readability } from '@mozilla/readability';
import { JSDOM } from 'jsdom';

export interface LinkContent {
  url: string;
  title?: string;
  content?: string;
  description?: string;
  error?: string;
  statusCode?: number;
  readability?: {
    byline?: string;
    siteName?: string;
    length: number;
    excerpt?: string;
  };
}

export interface ProcessedContent {
  originalUrl: string;
  title: string;
  content: string;
  metadata: {
    description?: string;
    domain: string;
    processedAt: Date;
    statusCode: number;
    byline?: string;
    siteName?: string;
    contentLength: number;
    excerpt?: string;
    extractionMethod: 'readability' | 'fallback';
  };
}

export class LinkProcessor {
  private readonly REQUEST_TIMEOUT = 10000; // 10秒
  private readonly MAX_CONTENT_LENGTH = 50000; // 50KB制限
  private readonly BLOCKED_DOMAINS = [
    'localhost',
    '127.0.0.1',
    '0.0.0.0',
    'facebook.com',
    'twitter.com',
    'instagram.com',
    'tiktok.com',
    'discord.com',
    'discord.gg'
  ];

  async processLinks(links: string[]): Promise<ProcessedContent[]> {
    const processedContents: ProcessedContent[] = [];

    for (const link of links) {
      try {
        if (this.isBlockedDomain(link)) {
          console.log(`Skipping blocked domain: ${link}`);
          continue;
        }

        const content = await this.fetchLinkContent(link);
        if (content.content && content.title && this.isContentValuable(content)) {
          processedContents.push({
            originalUrl: link,
            title: content.title,
            content: content.content,
            metadata: {
              description: content.description,
              domain: new URL(link).hostname,
              processedAt: new Date(),
              statusCode: content.statusCode || 200,
              byline: content.readability?.byline,
              siteName: content.readability?.siteName,
              contentLength: content.readability?.length || content.content.length,
              excerpt: content.readability?.excerpt,
              extractionMethod: content.readability ? 'readability' : 'fallback',
            },
          });
        }

        // レート制限対策
        await this.delay(500);
      } catch (error) {
        console.error(`Error processing link ${link}:`, error);
        // エラーがあっても続行
      }
    }

    return processedContents;
  }

  private async fetchLinkContent(url: string): Promise<LinkContent> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.REQUEST_TIMEOUT);

      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'Discord-RAG-Bot/1.0 (+https://github.com/your-repo)',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'ja,en;q=0.9',
        },
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        return {
          url,
          error: `HTTP ${response.status}: ${response.statusText}`,
          statusCode: response.status,
        };
      }

      const contentType = response.headers.get('content-type');
      if (!contentType?.includes('text/html')) {
        return {
          url,
          error: `Unsupported content type: ${contentType}`,
          statusCode: response.status,
        };
      }

      const html = await response.text();
      const parsed = this.extractContentWithReadability(html, url);

      return {
        url,
        title: parsed.title,
        content: parsed.content,
        description: parsed.description,
        statusCode: response.status,
        readability: parsed.readability,
      };
    } catch (error) {
      return {
        url,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  private extractContentWithReadability(html: string, url: string): { 
    title?: string; 
    content?: string; 
    description?: string; 
    readability?: LinkContent['readability'] 
  } {
    try {
      // JSDOMでHTMLを解析
      const dom = new JSDOM(html, { url });
      const document = dom.window.document;

      // Readabilityでメインコンテンツを抽出
      const reader = new Readability(document);
      const article = reader.parse();

      if (article) {
        // Readabilityで成功した場合
        let content = article.textContent;
        
        // 長すぎるコンテンツは切り詰め
        if (content.length > this.MAX_CONTENT_LENGTH) {
          content = content.substring(0, this.MAX_CONTENT_LENGTH) + '...';
        }

        // メタディスクリプションを取得
        const descriptionElement = document.querySelector('meta[name="description"]');
        const description = descriptionElement?.getAttribute('content')?.trim();

        return {
          title: article.title,
          content,
          description,
          readability: {
            byline: article.byline || undefined,
            siteName: article.siteName || undefined,
            length: article.length,
            excerpt: article.excerpt || undefined,
          },
        };
      } else {
        // Readabilityが失敗した場合、フォールバック処理
        console.warn(`Readability failed for ${url}, falling back to basic parsing`);
        return this.fallbackParseHtmlContent(html);
      }
    } catch (error) {
      console.error(`Error extracting content with Readability for ${url}:`, error);
      return this.fallbackParseHtmlContent(html);
    }
  }

  private fallbackParseHtmlContent(html: string): { title?: string; content?: string; description?: string } {
    // 以前の簡単なHTML解析をフォールバックとして保持
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    const title = titleMatch?.[1]?.trim();

    const descriptionMatch = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i);
    const description = descriptionMatch?.[1]?.trim();

    // メタタグとスクリプトを除去
    let content = html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<meta[^>]*>/gi, '')
      .replace(/<link[^>]*>/gi, '')
      .replace(/<[^>]+>/g, ' ') // HTMLタグを除去
      .replace(/\s+/g, ' ') // 複数の空白を1つに
      .trim();

    // 長すぎるコンテンツは切り詰め
    if (content.length > this.MAX_CONTENT_LENGTH) {
      content = content.substring(0, this.MAX_CONTENT_LENGTH) + '...';
    }

    return {
      title,
      content: content || undefined,
      description,
    };
  }

  private isBlockedDomain(url: string): boolean {
    try {
      const domain = new URL(url).hostname.toLowerCase();
      return this.BLOCKED_DOMAINS.some(blocked => 
        domain === blocked || domain.endsWith('.' + blocked)
      );
    } catch {
      return true; // 不正なURLはブロック
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // コンテンツの価値判定（最小限のフィルタリング）
  private isContentValuable(content: LinkContent): boolean {
    const { title, content: text } = content;
    
    // 基本的な品質チェック
    if (!title || !text) return false;
    if (text.length < 100) return false; // 短すぎるコンテンツ
    if (title.toLowerCase().includes('error') || title.toLowerCase().includes('404')) return false;
    if (title.toLowerCase().includes('not found')) return false;
    
    // 広告やスパムっぽいコンテンツを除外
    const spamKeywords = ['click here', 'buy now', 'limited time', 'act fast', '今すぐ購入'];
    const lowerContent = (title + ' ' + text).toLowerCase();
    const hasSpam = spamKeywords.some(keyword => lowerContent.includes(keyword));
    
    return !hasSpam;
  }
}