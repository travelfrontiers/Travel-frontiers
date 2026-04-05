import { DocumentActionProps, useClient } from 'sanity'
import { useState } from 'react'

export function GenerateItineraryAction({ id, type, published, draft, onComplete }: DocumentActionProps) {
    const [isGenerating, setIsGenerating] = useState(false)
    const client = useClient({ apiVersion: '2024-01-18' })
    const doc = draft || published

    if (type !== 'roteiro' || !doc) {
        return null
    }

    return {
        label: isGenerating ? 'Generating Itinerary...' : 'Generate Word Itinerary',
        disabled: isGenerating || !doc.sourceFile,
        onHandle: async () => {
            setIsGenerating(true)

            try {
                // Get the file reference to find its URL
                const fileRef = (doc.sourceFile as any)?.asset?._ref
                if (!fileRef) {
                    throw new Error("Source file asset not found.")
                }

                // Call our API with the file reference and notes
                // and specify we want an arraybuffer/blob back
                const response = await fetch('/api/generate-itinerary', {
                    method: 'POST',
                    body: JSON.stringify({
                        fileRef: fileRef,
                        title: doc.title,
                        notes: doc.notes || '',
                    }),
                    headers: { 'Content-Type': 'application/json' },
                })

                if (!response.ok) {
                    const errorData = await response.json().catch(() => ({}))
                    throw new Error(errorData.error || response.statusText || 'Generation failed.')
                }

                // Receive the file blob
                const blob = await response.blob()
                const url = window.URL.createObjectURL(blob)
                
                // Trigger download
                const a = document.createElement('a')
                a.href = url
                a.download = `Itinerary_${doc.title || 'Trip'}.docx`
                document.body.appendChild(a)
                a.click()
                window.URL.revokeObjectURL(url)
                document.body.removeChild(a)

            } catch (err: any) {
                console.error(err)
                alert('Generation failed: ' + err.message)
            } finally {
                setIsGenerating(false)
                onComplete()
            }
        },
    }
}
