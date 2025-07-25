import type { GeminiClient } from '../llm';
import type { BM25Calculator, DocumentStats, BM25Score } from './bm25-calculator';

/**
 * LLMから抽出されたキーワード情報
 */
export interface ExtractedKeyword {
  keyword: string;
  confidence: number; // LLMの信頼度 (0.0-1.0)
}

/**
 * BM25スコア付きキーワード
 */
export interface ScoredKeyword {
  keyword: string;
  bm25Score: number;
  termFrequency: number;
  documentFrequency: number;
  embedding?: number[];
  confidence: number;
}

export interface KeywordExtractionConfig {
  /** 抽出するキーワードの最大数 */
  maxKeywords: number;
  /** 最小キーワード信頼度 */
  minConfidence: number;
  /** 最小BM25スコア */
  minBm25Score: number;
}

/**
 * LLM + BM25を組み合わせたキーワード抽出器
 */
export class KeywordExtractor {
  private geminiClient: GeminiClient;
  private bm25Calculator: BM25Calculator;
  private config: KeywordExtractionConfig;

  constructor(
    geminiClient: GeminiClient,
    bm25Calculator: BM25Calculator,
    config: Partial<KeywordExtractionConfig> = {}
  ) {
    this.geminiClient = geminiClient;
    this.bm25Calculator = bm25Calculator;
    this.config = {
      maxKeywords: config.maxKeywords ?? 8,
      minConfidence: config.minConfidence ?? 0.6,
      minBm25Score: config.minBm25Score ?? 0.1,
    };
  }

  /**
   * 文書からキーワードを抽出してBM25スコアを計算
   */
  async extractKeywords(
    document: string,
    documentStats: DocumentStats
  ): Promise<ScoredKeyword[]> {
    try {
      // Step 1: LLMでキーワード抽出
      const llmKeywords = await this.extractKeywordsWithLLM(document);
      
      if (llmKeywords.length === 0) {
        console.warn('No keywords extracted by LLM for document');
        return [];
      }

      // Step 2: BM25スコア計算
      const keywordTerms = llmKeywords.map(k => k.keyword);
      const bm25Scores = this.bm25Calculator.calculateScores(
        keywordTerms,
        document,
        documentStats
      );

      // Step 3: LLM信頼度とBM25スコアを組み合わせ
      const scoredKeywords: ScoredKeyword[] = [];
      
      for (let i = 0; i < llmKeywords.length; i++) {
        const llmKeyword = llmKeywords[i];
        const bm25Score = bm25Scores[i];

        // フィルタリング
        if (
          llmKeyword.confidence >= this.config.minConfidence &&
          bm25Score.score >= this.config.minBm25Score
        ) {
          scoredKeywords.push({
            keyword: llmKeyword.keyword,
            bm25Score: bm25Score.score,
            termFrequency: bm25Score.termFrequency,
            documentFrequency: bm25Score.documentFrequency,
            confidence: llmKeyword.confidence,
          });
        }
      }

      // Step 4: 複合スコアでソート（BM25スコア × LLM信頼度）
      scoredKeywords.sort((a, b) => {
        const scoreA = a.bm25Score * a.confidence;
        const scoreB = b.bm25Score * b.confidence;
        return scoreB - scoreA;
      });

      // Step 5: 上位キーワードを返却
      return scoredKeywords.slice(0, this.config.maxKeywords);

    } catch (error) {
      console.error('Keyword extraction failed:', error);
      return [];
    }
  }

  /**
   * LLMを使用してキーワードを抽出
   */
  private async extractKeywordsWithLLM(document: string): Promise<ExtractedKeyword[]> {
    const prompt = this.createKeywordExtractionPrompt(document);
    
    try {
      const response = await this.geminiClient.generateText(prompt);
      return this.parseKeywordResponse(response);
    } catch (error) {
      console.error('LLM keyword extraction failed:', error);
      throw error;
    }
  }

  /**
   * キーワード抽出用のプロンプトを作成
   */
  private createKeywordExtractionPrompt(document: string): string {
    return `以下の文書から重要なキーワードを抽出してください。技術的な用語、概念、重要な名詞を中心に選んでください。

文書:
"""
${document}
"""

抽出ルール:
1. 最大8個のキーワードを抽出
2. 各キーワードの重要度を0.0-1.0で評価
3. 日本語・英語両方対応
4. 単語または短いフレーズ（2-3語以内）
5. 技術用語、概念、固有名詞を優先

出力形式（JSON）:
{
  "keywords": [
    {"keyword": "キーワード1", "confidence": 0.9},
    {"keyword": "キーワード2", "confidence": 0.8}
  ]
}

注意: JSON形式のみで回答し、他の説明は不要です。`;
  }

  /**
   * LLMレスポンスからキーワードを解析
   */
  private parseKeywordResponse(response: string): ExtractedKeyword[] {
    try {
      // JSONブロックを抽出
      const jsonMatch = response.match(/```json\s*([\s\S]*?)\s*```/) || 
                       response.match(/\{[\s\S]*\}/);
      
      if (!jsonMatch) {
        // JSONブロックが見つからない場合、レスポンス全体をJSONとして解析を試行
        const parsed = JSON.parse(response.trim());
        return this.validateKeywords(parsed.keywords || []);
      }

      const jsonStr = jsonMatch[1] || jsonMatch[0];
      const parsed = JSON.parse(jsonStr);
      
      return this.validateKeywords(parsed.keywords || []);
    } catch (error) {
      console.error('Failed to parse keyword response:', error);
      console.error('Response:', response);
      
      // フォールバック: シンプルな正規表現でキーワード抽出
      return this.fallbackKeywordExtraction(response);
    }
  }

  /**
   * キーワードリストの検証とフィルタリング
   */
  private validateKeywords(keywords: any[]): ExtractedKeyword[] {
    return keywords
      .filter((kw) => 
        kw && 
        typeof kw.keyword === 'string' && 
        typeof kw.confidence === 'number' &&
        kw.keyword.length > 0 &&
        kw.keyword.length <= 50 &&
        kw.confidence >= 0 && 
        kw.confidence <= 1
      )
      .map((kw) => ({
        keyword: kw.keyword.trim(),
        confidence: Math.max(0, Math.min(1, kw.confidence)),
      }));
  }

  /**
   * フォールバック: 単純な正規表現でキーワード抽出
   */
  private fallbackKeywordExtraction(response: string): ExtractedKeyword[] {
    console.warn('Using fallback keyword extraction');
    
    // "keyword": "value" パターンを探す
    const keywordPattern = /"keyword":\s*"([^"]+)"/g;
    const confidencePattern = /"confidence":\s*([\d.]+)/g;
    
    const keywords: string[] = [];
    const confidences: number[] = [];
    
    let match;
    while ((match = keywordPattern.exec(response)) !== null) {
      keywords.push(match[1].trim());
    }
    
    while ((match = confidencePattern.exec(response)) !== null) {
      confidences.push(parseFloat(match[1]));
    }
    
    const results: ExtractedKeyword[] = [];
    const minLength = Math.min(keywords.length, confidences.length);
    
    for (let i = 0; i < minLength; i++) {
      if (keywords[i] && keywords[i].length > 0) {
        results.push({
          keyword: keywords[i],
          confidence: Math.max(0, Math.min(1, confidences[i] || 0.5)),
        });
      }
    }
    
    return results.slice(0, this.config.maxKeywords);
  }
}