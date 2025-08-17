/**
 * BM25アルゴリズムによる文書-キーワード関連度計算機
 * 
 * BM25は情報検索における標準的なランキング関数で、
 * Term Frequency (TF) と Inverse Document Frequency (IDF) を
 * 組み合わせて関連度スコアを算出します。
 */
export interface BM25Config {
  /** 用語頻度の飽和パラメータ（デフォルト: 1.2） */
  k1: number;
  /** 文書長正規化パラメータ（デフォルト: 0.75） */
  b: number;
}

export interface DocumentStats {
  /** 総文書数 */
  totalDocuments: number;
  /** 平均文書長 */
  averageDocumentLength: number;
  /** 用語ごとの文書頻度 (term -> document count) */
  termDocumentFrequency: Map<string, number>;
}

export interface TermStats {
  /** 文書内での用語頻度 */
  termFrequency: number;
  /** コーパス内での文書頻度 */
  documentFrequency: number;
  /** 文書長 */
  documentLength: number;
}

/**
 * BM25スコア計算結果
 */
export interface BM25Score {
  term: string;
  score: number;
  termFrequency: number;
  documentFrequency: number;
  idf: number;
}

export class BM25Calculator {
  private config: BM25Config;

  constructor(config: Partial<BM25Config> = {}) {
    this.config = {
      k1: config.k1 ?? 1.2,
      b: config.b ?? 0.75,
    };
  }

  /**
   * 文書からBM25スコアを計算
   */
  calculateScore(
    term: string,
    termStats: TermStats,
    documentStats: DocumentStats
  ): BM25Score {
    const { termFrequency, documentFrequency, documentLength } = termStats;
    const { totalDocuments, averageDocumentLength } = documentStats;

    // IDF計算: log((N - df + 0.5) / (df + 0.5))
    const idf = Math.log(
      (totalDocuments - documentFrequency + 0.5) / (documentFrequency + 0.5)
    );

    // TF正規化計算
    const normalizedTF =
      (termFrequency * (this.config.k1 + 1)) /
      (termFrequency +
        this.config.k1 *
          (1 -
            this.config.b +
            this.config.b * (documentLength / averageDocumentLength)));

    // BM25スコア
    const score = idf * normalizedTF;

    return {
      term,
      score: Math.max(0, score), // 負のスコアを防ぐ
      termFrequency,
      documentFrequency,
      idf,
    };
  }

  /**
   * 複数の用語に対してBM25スコアを計算
   */
  calculateScores(
    terms: string[],
    document: string,
    documentStats: DocumentStats
  ): BM25Score[] {
    const termCounts = this.countTerms(document, terms);
    const documentLength = this.getDocumentLength(document);

    return terms.map(term => {
      const termFrequency = termCounts.get(term) || 0;
      const documentFrequency = documentStats.termDocumentFrequency.get(term) || 1;

      const termStats: TermStats = {
        termFrequency,
        documentFrequency,
        documentLength,
      };

      return this.calculateScore(term, termStats, documentStats);
    });
  }

  /**
   * 文書内の用語頻度をカウント
   */
  private countTerms(document: string, terms: string[]): Map<string, number> {
    const counts = new Map<string, number>();
    const normalizedDocument = this.normalizeText(document);

    for (const term of terms) {
      const normalizedTerm = this.normalizeText(term);
      const regex = new RegExp(`\\b${this.escapeRegExp(normalizedTerm)}\\b`, 'gi');
      const matches = normalizedDocument.match(regex);
      counts.set(term, matches ? matches.length : 0);
    }

    return counts;
  }

  /**
   * 文書長を計算（単語数ベース）
   */
  private getDocumentLength(document: string): number {
    const normalized = this.normalizeText(document);
    const words = normalized.split(/\s+/).filter(word => word.length > 0);
    return words.length;
  }

  /**
   * テキストの正規化
   * - 小文字変換
   * - 余分な空白除去
   * - 特殊文字の正規化
   */
  private normalizeText(text: string): string {
    return text
      .toLowerCase()
      .replace(/[^\w\s\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/g, ' ') // 日本語文字保持
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * 正規表現用文字列エスケープ
   */
  private escapeRegExp(string: string): string {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  /**
   * 文書統計の初期化
   */
  static createEmptyDocumentStats(): DocumentStats {
    return {
      totalDocuments: 0,
      averageDocumentLength: 0,
      termDocumentFrequency: new Map(),
    };
  }

  /**
   * 文書統計を更新
   */
  static updateDocumentStats(
    stats: DocumentStats,
    document: string,
    terms: string[]
  ): DocumentStats {
    const documentLength = new BM25Calculator().getDocumentLength(document);
    const uniqueTermsInDoc = new Set<string>();

    // 文書内に存在する用語をチェック
    for (const term of terms) {
      const normalizedDoc = new BM25Calculator().normalizeText(document);
      const normalizedTerm = new BM25Calculator().normalizeText(term);
      
      if (normalizedDoc.includes(normalizedTerm)) {
        uniqueTermsInDoc.add(term);
      }
    }

    // 統計更新
    const newTotalDocuments = stats.totalDocuments + 1;
    const newAverageLength =
      (stats.averageDocumentLength * stats.totalDocuments + documentLength) /
      newTotalDocuments;

    const newTermFrequency = new Map(stats.termDocumentFrequency);
    for (const term of uniqueTermsInDoc) {
      const currentCount = newTermFrequency.get(term) || 0;
      newTermFrequency.set(term, currentCount + 1);
    }

    return {
      totalDocuments: newTotalDocuments,
      averageDocumentLength: newAverageLength,
      termDocumentFrequency: newTermFrequency,
    };
  }
}