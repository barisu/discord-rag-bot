export class InMemoryVectorStore {
    documents = new Map();
    async addDocument(content, metadata) {
        const id = Math.random().toString(36).substr(2, 9);
        // Note: In a real implementation, you would generate embeddings here
        // For now, we'll use a placeholder
        const embedding = [];
        this.documents.set(id, {
            content,
            embedding,
            metadata,
        });
        return id;
    }
    async search(queryEmbedding, limit = 5) {
        const results = [];
        for (const [id, doc] of this.documents) {
            const similarity = this.cosineSimilarity(queryEmbedding, doc.embedding);
            results.push({
                id,
                content: doc.content,
                metadata: doc.metadata,
                similarity,
            });
        }
        return results
            .sort((a, b) => b.similarity - a.similarity)
            .slice(0, limit);
    }
    async deleteDocument(id) {
        this.documents.delete(id);
    }
    cosineSimilarity(a, b) {
        if (a.length === 0 || b.length === 0)
            return 0;
        const dotProduct = a.reduce((sum, val, i) => sum + val * b[i], 0);
        const magnitudeA = Math.sqrt(a.reduce((sum, val) => sum + val * val, 0));
        const magnitudeB = Math.sqrt(b.reduce((sum, val) => sum + val * val, 0));
        return dotProduct / (magnitudeA * magnitudeB);
    }
}
