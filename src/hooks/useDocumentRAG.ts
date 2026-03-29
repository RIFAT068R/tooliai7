import { useState, useCallback, useRef } from 'react'
import { blink } from '../blink/client'

export interface RagDocument {
  id: string
  filename: string
  status: 'uploading' | 'processing' | 'ready' | 'error'
  collectionName: string
  chunkCount?: number
  progressMessage?: string
}

export interface RagSource {
  filename: string
  excerpt: string
  score: number
}

const COLLECTION_PREFIX = 'toolia_docs'

function sanitize(str: string): string {
  return str.toLowerCase().replace(/[^a-z0-9_-]/g, '_').slice(0, 40)
}

export function useDocumentRAG(userId: string | undefined) {
  const [activeDoc, setActiveDoc] = useState<RagDocument | null>(null)
  const collectionRef = useRef<string | null>(null)

  const ingestFile = useCallback(async (file: File): Promise<RagDocument | null> => {
    if (!userId) return null

    const collectionName = `${COLLECTION_PREFIX}_${sanitize(userId)}`
    collectionRef.current = collectionName

    const doc: RagDocument = {
      id: '',
      filename: file.name,
      status: 'uploading',
      collectionName,
      progressMessage: 'Uploading document…',
    }
    setActiveDoc({ ...doc })

    try {
      // Ensure collection exists
      try {
        await blink.rag.createCollection({
          name: collectionName,
          description: 'TooliAi user document store',
        })
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err)
        const isExists = msg.includes('409') || msg.includes('already exists') || msg.includes('COLLECTION_EXISTS')
        if (!isExists) throw err
      }

      // For PDFs and binary files: upload to storage first, extract text, then ingest as content
      const isPdfOrBinary = /\.(pdf|docx|doc)$/i.test(file.name)

      let uploadedDoc: { id: string; status: string }

      if (isPdfOrBinary) {
        setActiveDoc(prev => prev ? { ...prev, progressMessage: 'Uploading to storage…' } : prev)

        const ext = file.name.split('.').pop() ?? 'bin'
        const { publicUrl } = await blink.storage.upload(
          file,
          `rag_docs/${userId}/${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`,
          { upsert: true } as Parameters<typeof blink.storage.upload>[2]
        )

        setActiveDoc(prev => prev ? { ...prev, progressMessage: 'Extracting text…' } : prev)

        const extraction = await blink.data.extractFromUrl(publicUrl)
        const extractedText = typeof extraction === 'string'
          ? extraction
          : Array.isArray(extraction)
            ? (extraction as string[]).join('\n')
            : ''

        if (!extractedText.trim()) {
          throw new Error(`Could not extract text from ${file.name}. Please try a .txt or .md file.`)
        }

        setActiveDoc(prev => prev ? { ...prev, progressMessage: 'Ingesting into knowledge base…', status: 'processing' } : prev)

        uploadedDoc = await blink.rag.upload({
          collectionName,
          filename: file.name,
          content: extractedText,
          metadata: { userId, originalExt: ext },
        })
      } else {
        // Plain text / CSV / JSON / Markdown — read directly
        setActiveDoc(prev => prev ? { ...prev, progressMessage: 'Reading document…' } : prev)
        const textContent = await file.text()

        setActiveDoc(prev => prev ? { ...prev, progressMessage: 'Ingesting into knowledge base…', status: 'processing' } : prev)

        uploadedDoc = await blink.rag.upload({
          collectionName,
          filename: file.name,
          content: textContent,
          metadata: { userId },
        })
      }

      // Poll for ready
      const maxAttempts = 30
      const pollInterval = 2000
      let finalDoc = uploadedDoc

      if (finalDoc.status === 'processing' || finalDoc.status === 'pending') {
        for (let attempt = 0; attempt < maxAttempts; attempt++) {
          await new Promise(res => setTimeout(res, pollInterval))
          const polled = await blink.rag.getDocument(finalDoc.id)
          const pct = Math.round(((attempt + 1) / maxAttempts) * 100)
          setActiveDoc(prev => prev ? {
            ...prev,
            progressMessage: `Processing… ${pct}%`,
          } : prev)

          if (polled.status === 'ready') {
            finalDoc = polled
            break
          } else if (polled.status === 'error') {
            throw new Error(`Document processing failed: ${(polled as Record<string, unknown>).errorMessage ?? 'unknown error'}`)
          }
        }
      }

      const readyDoc: RagDocument = {
        id: finalDoc.id,
        filename: file.name,
        status: 'ready',
        collectionName,
        chunkCount: (finalDoc as Record<string, unknown>).chunkCount as number | undefined,
        progressMessage: undefined,
      }
      setActiveDoc(readyDoc)
      return readyDoc

    } catch (err) {
      const errDoc: RagDocument = {
        id: '',
        filename: file.name,
        status: 'error',
        collectionName,
        progressMessage: err instanceof Error ? err.message : 'Ingestion failed',
      }
      setActiveDoc(errDoc)
      throw err
    }
  }, [userId])

  const queryDocument = useCallback(async (
    query: string,
    onChunk?: (delta: string) => void,
  ): Promise<{ answer: string; sources: RagSource[] }> => {
    const collName = collectionRef.current
    if (!collName) throw new Error('No document loaded')

    const stream = await blink.rag.aiSearch({
      collectionName: collName,
      query,
      model: 'google/gemini-3-flash',
      stream: true,
    })

    let answer = ''
    let sources: RagSource[] = []

    const reader = (stream as ReadableStream).getReader()
    const decoder = new TextDecoder()

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      for (const line of decoder.decode(value).split('\n')) {
        if (!line.startsWith('data: ')) continue
        try {
          const json = JSON.parse(line.slice(6)) as { type: string; delta?: string; sources?: RagSource[] }
          if (json.type === 'text-delta' && json.delta) {
            answer += json.delta
            onChunk?.(json.delta)
          }
          if (json.type === 'sources' && json.sources) {
            sources = json.sources
          }
        } catch { /* skip malformed lines */ }
      }
    }

    return { answer, sources }
  }, [])

  const clearDocument = useCallback(() => {
    setActiveDoc(null)
  }, [])

  return { activeDoc, ingestFile, queryDocument, clearDocument }
}
