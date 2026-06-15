require('dotenv').config()
const mongoose = require('mongoose')
const DocumentMeta = require('../models/DocumentMeta')
const { embedChunks } = require('../services/documentText.service')

async function run() {
  try {
    await mongoose.connect(process.env.MONGODB_URI)

    const docs = await DocumentMeta.find({
      text_chunks: { $exists: true, $ne: [] },
      $or: [
        { chunk_embeddings: { $exists: false } },
        { chunk_embeddings: { $size: 0 } },
      ],
    })

    console.log(`[Backfill] Found ${docs.length} documents needing embeddings`)

    for (const doc of docs) {
      try {
        console.log(`[Backfill] Embedding: ${doc.title}`)

        const vectors = await embedChunks(doc.text_chunks)

        doc.chunk_embeddings = vectors
        doc.embedding_status = vectors.length ? 'processed' : 'failed'

        await doc.save()

        console.log(
          `[Backfill] Done: ${doc.title} | chunks=${doc.text_chunks.length} | vectors=${vectors.length}`
        )
      } catch (err) {
        console.error(`[Backfill] Failed: ${doc.title}`, err?.message || err)

        doc.embedding_status = 'failed'
        await doc.save()
      }
    }

    console.log('[Backfill] Complete')
  } catch (err) {
    console.error('[Backfill] Fatal error:', err?.message || err)
  } finally {
    await mongoose.disconnect()
  }
}

run()