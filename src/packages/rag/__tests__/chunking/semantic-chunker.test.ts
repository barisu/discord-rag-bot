import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SemanticChunker } from '../../src/chunking/semantic-chunker';
import type { LLMClient } from '@shared/core';

describe('SemanticChunker', () => {
  let mockLLMClient: LLMClient;
  let chunker: SemanticChunker;

  beforeEach(() => {
    mockLLMClient = {
      generateText: vi.fn(),
    };
    chunker = new SemanticChunker(mockLLMClient);
  });

  describe('chunk', () => {
    it('LLMを使用してテキストをチャンク化する', async () => {
      const mockResponseText = JSON.stringify({
        chunks: [
          { content: '第1チャンクの内容', index: 0 },
          { content: '第2チャンクの内容', index: 1 },
        ],
      });

      vi.mocked(mockLLMClient.generateText).mockResolvedValue(mockResponseText);

      const text = 'これは複数の部分にチャンク化されるべき長いテキストです。';
      const result = await chunker.chunk(text);

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({ content: '第1チャンクの内容', index: 0 });
      expect(result[1]).toEqual({ content: '第2チャンクの内容', index: 1 });
      expect(mockLLMClient.generateText).toHaveBeenCalledWith(
        expect.stringContaining('以下のテキストを意味的に自然な境界で分割してください'),
        expect.objectContaining({
          temperature: 0.1,
          maxTokens: 4000,
        })
      );
    });

    it('空のチャンクをフィルタリングする', async () => {
      const mockResponseText = JSON.stringify({
        chunks: [
          { content: '有効なチャンク', index: 0 },
          { content: '', index: 1 },
          { content: '   ', index: 2 },
          { content: 'もう一つの有効なチャンク', index: 3 },
        ],
      });

      vi.mocked(mockLLMClient.generateText).mockResolvedValue(mockResponseText);

      const result = await chunker.chunk('テストテキスト');

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({ content: '有効なチャンク', index: 0 });
      expect(result[1]).toEqual({ content: 'もう一つの有効なチャンク', index: 1 });
    });

    it('LLMが失敗した時に段落分割にフォールバックする', async () => {
      vi.mocked(mockLLMClient.generateText).mockRejectedValue(new Error('APIエラー'));

      const text = '第1段落。\n\n第2段落。\n\n第3段落。';
      const result = await chunker.chunk(text);

      expect(result).toHaveLength(3);
      expect(result[0]).toEqual({ content: '第1段落。', index: 0 });
      expect(result[1]).toEqual({ content: '第2段落。', index: 1 });
      expect(result[2]).toEqual({ content: '第3段落。', index: 2 });
    });

    it('フォールバック時に段落がないテキストを処理する', async () => {
      vi.mocked(mockLLMClient.generateText).mockRejectedValue(new Error('APIエラー'));

      const text = '段落のない単一行テキスト';
      const result = await chunker.chunk(text);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({ content: '段落のない単一行テキスト', index: 0 });
    });

    it('カスタムオプションを使用する', async () => {
      const mockResponseText = JSON.stringify({
        chunks: [{ content: 'チャンク', index: 0 }],
      });

      vi.mocked(mockLLMClient.generateText).mockResolvedValue(mockResponseText);

      const options = {
        maxChunkSize: 500,
        language: '英語',
      };

      await chunker.chunk('テストテキスト', options);

      expect(mockLLMClient.generateText).toHaveBeenCalledWith(
        expect.stringContaining('英語の文章構造を考慮する'),
        expect.any(Object)
      );
      expect(mockLLMClient.generateText).toHaveBeenCalledWith(
        expect.stringContaining('概ね500文字以下にする'),
        expect.any(Object)
      );
    });

    it('長い技術文書を意味的に分割する', async () => {
      const longTechnicalText = `
人工知能（AI）は、機械学習、深層学習、自然言語処理などの技術を組み合わせた分野です。
特に近年、大規模言語モデルの発展により、テキスト生成、翻訳、要約などのタスクで人間に匹敵する性能を示しています。

機械学習においては、教師あり学習、教師なし学習、強化学習の3つの主要なアプローチが存在します。
教師あり学習では、入力と正解のペアからパターンを学習し、新しいデータに対して予測を行います。
一方、教師なし学習では、正解のないデータから隠れた構造やパターンを発見することを目的としています。

深層学習は、多層のニューラルネットワークを使用した機械学習手法の一種です。
畳み込みニューラルネットワーク（CNN）は画像認識分野で、
再帰型ニューラルネットワーク（RNN）は時系列データの処理で優れた性能を発揮します。
最近では、Transformerアーキテクチャが自然言語処理の分野で革命をもたらしました。

自然言語処理（NLP）は、人間の言語をコンピュータが理解し、生成するための技術です。
形態素解析、構文解析、意味解析などの基本的な処理から、
機械翻訳、質問応答システム、対話システムなどの応用まで幅広い分野をカバーしています。
GPTやBERTなどの事前学習済みモデルの登場により、多くのNLPタスクで大幅な性能向上が実現されています。

今後のAI発展において、説明可能AI、フェアネス、プライバシー保護などの課題への対応が重要になります。
また、AGI（汎用人工知能）の実現に向けた研究も活発に行われており、
人間のような柔軟な思考と推論能力を持つAIシステムの開発が期待されています。
      `.trim();

      const mockResponseText = JSON.stringify({
        chunks: [
          { 
            content: '人工知能（AI）は、機械学習、深層学習、自然言語処理などの技術を組み合わせた分野です。特に近年、大規模言語モデルの発展により、テキスト生成、翻訳、要約などのタスクで人間に匹敵する性能を示しています。', 
            index: 0 
          },
          { 
            content: '機械学習においては、教師あり学習、教師なし学習、強化学習の3つの主要なアプローチが存在します。教師あり学習では、入力と正解のペアからパターンを学習し、新しいデータに対して予測を行います。一方、教師なし学習では、正解のないデータから隠れた構造やパターンを発見することを目的としています。', 
            index: 1 
          },
          { 
            content: '深層学習は、多層のニューラルネットワークを使用した機械学習手法の一種です。畳み込みニューラルネットワーク（CNN）は画像認識分野で、再帰型ニューラルネットワーク（RNN）は時系列データの処理で優れた性能を発揮します。最近では、Transformerアーキテクチャが自然言語処理の分野で革命をもたらしました。', 
            index: 2 
          },
          { 
            content: '自然言語処理（NLP）は、人間の言語をコンピュータが理解し、生成するための技術です。形態素解析、構文解析、意味解析などの基本的な処理から、機械翻訳、質問応答システム、対話システムなどの応用まで幅広い分野をカバーしています。GPTやBERTなどの事前学習済みモデルの登場により、多くのNLPタスクで大幅な性能向上が実現されています。', 
            index: 3 
          },
          { 
            content: '今後のAI発展において、説明可能AI、フェアネス、プライバシー保護などの課題への対応が重要になります。また、AGI（汎用人工知能）の実現に向けた研究も活発に行われており、人間のような柔軟な思考と推論能力を持つAIシステムの開発が期待されています。', 
            index: 4 
          }
        ]
      });

      vi.mocked(mockLLMClient.generateText).mockResolvedValue(mockResponseText);

      const result = await chunker.chunk(longTechnicalText);

      expect(result).toHaveLength(5);
      expect(result[0].content).toContain('人工知能（AI）');
      expect(result[1].content).toContain('機械学習においては');
      expect(result[2].content).toContain('深層学習は');
      expect(result[3].content).toContain('自然言語処理（NLP）');
      expect(result[4].content).toContain('今後のAI発展において');
      
      // プロンプトに適切な指示が含まれているかチェック
      expect(mockLLMClient.generateText).toHaveBeenCalledWith(
        expect.stringContaining('意味的に自然な境界で分割してください'),
        expect.any(Object)
      );
    });

    it('対話形式の長文を文脈に応じて分割する', async () => {
      const dialogText = `
昨日のプロジェクト会議で議論された内容について整理したいと思います。

まず、新機能の仕様についてですが、ユーザーインターフェースの改善が最優先課題として挙げられました。
現在のダッシュボードは情報量が多すぎて、新規ユーザーにとって使いにくいという声が多数寄せられています。
デザインチームからは、よりシンプルで直感的なレイアウトの提案がありました。

次に、バックエンドの性能改善について話し合われました。
データベースクエリの最適化により、レスポンス時間を30%短縮できる見込みです。
また、キャッシュ機能の実装により、頻繁にアクセスされるデータの処理速度が大幅に向上します。
インフラチームは、これらの変更を来月末までに完了させる予定です。

セキュリティ面では、新しい認証システムの導入が検討されています。
二要素認証とシングルサインオンの両方に対応し、企業ユーザーの要求に応えることができます。
セキュリティ監査の結果、現在のシステムにはいくつかの脆弱性が発見されており、早急な対応が必要です。

最後に、プロジェクトのタイムラインについて確認しました。
第一フェーズの開発は来月中旬に完了予定で、その後ベータテストを開始します。
第二フェーズでは、ユーザーフィードバックを反映した改良を行い、年末のリリースを目指しています。
      `.trim();

      const mockResponseText = JSON.stringify({
        chunks: [
          { 
            content: '昨日のプロジェクト会議で議論された内容について整理したいと思います。', 
            index: 0 
          },
          { 
            content: 'まず、新機能の仕様についてですが、ユーザーインターフェースの改善が最優先課題として挙げられました。現在のダッシュボードは情報量が多すぎて、新規ユーザーにとって使いにくいという声が多数寄せられています。デザインチームからは、よりシンプルで直感的なレイアウトの提案がありました。', 
            index: 1 
          },
          { 
            content: '次に、バックエンドの性能改善について話し合われました。データベースクエリの最適化により、レスポンス時間を30%短縮できる見込みです。また、キャッシュ機能の実装により、頻繁にアクセスされるデータの処理速度が大幅に向上します。インフラチームは、これらの変更を来月末までに完了させる予定です。', 
            index: 2 
          },
          { 
            content: 'セキュリティ面では、新しい認証システムの導入が検討されています。二要素認証とシングルサインオンの両方に対応し、企業ユーザーの要求に応えることができます。セキュリティ監査の結果、現在のシステムにはいくつかの脆弱性が発見されており、早急な対応が必要です。', 
            index: 3 
          },
          { 
            content: '最後に、プロジェクトのタイムラインについて確認しました。第一フェーズの開発は来月中旬に完了予定で、その後ベータテストを開始します。第二フェーズでは、ユーザーフィードバックを反映した改良を行い、年末のリリースを目指しています。', 
            index: 4 
          }
        ]
      });

      vi.mocked(mockLLMClient.generateText).mockResolvedValue(mockResponseText);

      const result = await chunker.chunk(dialogText);

      expect(result).toHaveLength(5);
      expect(result[0].content).toContain('昨日のプロジェクト会議');
      expect(result[1].content).toContain('新機能の仕様について');
      expect(result[2].content).toContain('バックエンドの性能改善');
      expect(result[3].content).toContain('セキュリティ面では');
      expect(result[4].content).toContain('プロジェクトのタイムライン');
    });

    it('複数の話題が混在する長文記事を適切に分割する', async () => {
      const mixedTopicText = `
現代社会におけるデジタル変革の波は、あらゆる産業に大きな影響を与えています。

教育分野では、オンライン学習プラットフォームの普及により、従来の教室での授業形態が大きく変化しました。
学生は自分のペースで学習を進めることができ、多様な学習リソースにアクセス可能になりました。
教師の役割も、知識の一方的な伝達から、学習のファシリテーターへと変化しています。
個別指導やアダプティブラーニングにより、一人ひとりの学習効果が最大化されることが期待されています。

医療業界では、テレメディシンの導入が急速に進んでいます。
遠隔診療により、地方の患者も専門医の診察を受けることが可能になりました。
AIを活用した診断支援システムは、医師の診断精度向上に貢献しています。
電子カルテシステムの標準化により、医療機関間での情報共有がスムーズになりました。
ウェアラブルデバイスによる健康データの収集は、予防医療の発展に重要な役割を果たしています。

金融業界では、フィンテックの台頭により、従来の銀行業務が革新されています。
デジタル決済、仮想通貨、ロボアドバイザーなどの新しいサービスが次々と登場しています。
ブロックチェーン技術は、取引の透明性と安全性を大幅に向上させました。
オープンバンキングにより、顧客は複数の金融機関のサービスを統合して利用できるようになりました。

小売業では、Eコマースとオムニチャネル戦略が標準的になりつつあります。
在庫管理システムの高度化により、需要予測の精度が向上し、在庫コストの削減が実現されています。
パーソナライゼーション技術により、顧客一人ひとりに最適化された商品推薦が可能になりました。
      `.trim();

      // フォールバック機能をテスト（JSONパースエラーをシミュレート）
      vi.mocked(mockLLMClient.generateText).mockRejectedValue(new Error('JSON解析エラー'));

      const result = await chunker.chunk(mixedTopicText);

      // フォールバックによる段落分割が動作することを確認
      expect(result.length).toBeGreaterThan(1);
      expect(result[0].content).toContain('現代社会におけるデジタル変革');
      
      // 各段落が適切に分割されていることを確認
      const contentJoined = result.map(chunk => chunk.content).join('\n\n');
      expect(contentJoined).toContain('教育分野では');
      expect(contentJoined).toContain('医療業界では');
      expect(contentJoined).toContain('金融業界では');
      expect(contentJoined).toContain('小売業では');
    });
  });
});