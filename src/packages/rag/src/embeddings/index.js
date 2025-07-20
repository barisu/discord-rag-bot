export class OpenAIEmbeddings {
    apiKey;
    model;
    constructor(apiKey, model = 'text-embedding-3-small') {
        this.apiKey = apiKey;
        this.model = model;
    }
    async embed(text) {
        const response = await fetch('https://api.openai.com/v1/embeddings', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${this.apiKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model: this.model,
                input: text,
            }),
        });
        const data = await response.json();
        return data.data[0].embedding;
    }
    async embedBatch(texts) {
        const response = await fetch('https://api.openai.com/v1/embeddings', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${this.apiKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model: this.model,
                input: texts,
            }),
        });
        const data = await response.json();
        return data.data.map((item) => item.embedding);
    }
}
