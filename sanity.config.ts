'use client'

/**
 * This configuration is used to for the Sanity Studio that’s mounted on the `/app/admin/[[...tool]]/page.tsx` route
 */

import { visionTool } from '@sanity/vision'
import { defineConfig } from 'sanity'
import { structureTool } from 'sanity/structure'

// Go to https://www.sanity.io/docs/api-versioning to learn how API versioning works
import { schema } from './src/sanity/schemaTypes'
import { TranslateAction } from './src/sanity/actions/TranslateAction'
import { GenerateStoryAction } from './src/sanity/actions/GenerateStoryAction'
import { ArchiveAction } from './src/sanity/actions/ArchiveAction'
import { ProcessExpiredAction } from './src/sanity/actions/ProcessExpiredAction'

const projectId = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID!
const dataset = process.env.NEXT_PUBLIC_SANITY_DATASET || 'production'

export default defineConfig({
    basePath: '/admin',
    projectId,
    dataset,
    // Add and edit the content schema in the './sanity/schema' folder
    schema,
    document: {
        actions: (prev, context) => {
            return context.schemaType === 'promotion'
                ? [...prev, TranslateAction, GenerateStoryAction, ArchiveAction, ProcessExpiredAction]
                : prev
        },
    },
    plugins: [
        structureTool(),
        // Vision is a tool that lets you query your content with GROQ in the studio
        // https://www.sanity.io/docs/the-vision-plugin
        visionTool({ defaultApiVersion: '2024-01-18' }),
    ],
})
