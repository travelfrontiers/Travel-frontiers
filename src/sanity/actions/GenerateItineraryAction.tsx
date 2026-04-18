import { DocumentActionProps, useClient } from 'sanity'
import { useState } from 'react'
import { useToast, Box, Spinner, Text } from '@sanity/ui'

export function GenerateItineraryAction({ id, type, published, draft, onComplete }: DocumentActionProps) {
    const [isGenerating, setIsGenerating] = useState(false)
    const client = useClient({ apiVersion: '2024-01-18' })
    const toast = useToast()
    const doc = draft || published

    if (type !== 'roteiro' || !doc) {
        return null
    }

    return {
        label: isGenerating ? 'Gerando Itinerário...' : 'Gerar itinerário IA',
        disabled: isGenerating || !doc.sourceFile,
        dialog: isGenerating ? {
            type: 'dialog',
            header: 'A Gerar Documento...',
            content: (
                <Box padding={5}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
                        <Spinner muted size={3} />
                        <Text size={2}>A viajar pelos dados com a IA... Isto pode demorar até 60 segundos.</Text>
                    </div>
                </Box>
            ),
            onClose: () => {} // Prevent accidental closing
        } : null,
        onHandle: async () => {
            setIsGenerating(true)
            toast.push({
                title: 'A IA está a criar o seu itinerário',
                description: 'Este processo pode demorar até 60 segundos.',
                status: 'info',
            })

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

                toast.push({
                    title: 'Sucesso!',
                    description: 'Itinerário gerado e transferido com sucesso.',
                    status: 'success',
                })
            } catch (err: any) {
                console.error(err)
                toast.push({
                    title: 'Erro a gerar o itinerário',
                    description: err.message,
                    status: 'error',
                })
            } finally {
                setIsGenerating(false)
                onComplete()
            }
        },
    }
}
