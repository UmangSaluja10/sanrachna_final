const { embedText, cosineSimilarity } = require('./embedding.service')

let cachedChunkEmbeddings = new Map()

const crypto = require('crypto')

function makeCacheKey(chunks) {
  return crypto
    .createHash('md5')
    .update(chunks.map((c) => c.text).join('|'))
    .digest('hex')
}

async function semanticRankChunks(question, chunks, limit = 6) {
  if (!chunks.length) return []

  const cacheKey = makeCacheKey(chunks)

  if (!cachedChunkEmbeddings.has(cacheKey)) {
    console.log('[SEMANTIC RAG] Embedding chunks...')

    const embeddedChunks = []

    for (const chunk of chunks) {
      const vector = await embedText(`${chunk.title || chunk.source}\n${chunk.text}`)
      embeddedChunks.push({
        ...chunk,
        vector,
      })
    }
    if (cachedChunkEmbeddings.size > 50) {
      cachedChunkEmbeddings.clear()
    }
    cachedChunkEmbeddings.set(cacheKey, embeddedChunks)
    console.log('[SEMANTIC RAG] Chunk embeddings ready')
  }

  const embeddedChunks = cachedChunkEmbeddings.get(cacheKey)
  const questionVector = await embedText(question)

  return embeddedChunks
    .map((chunk) => ({
      ...chunk,
      score: cosineSimilarity(questionVector, chunk.vector),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
}

function clearSemanticCache() {
  cachedChunkEmbeddings = new Map()
}

module.exports = {
  semanticRankChunks,
  clearSemanticCache,
}