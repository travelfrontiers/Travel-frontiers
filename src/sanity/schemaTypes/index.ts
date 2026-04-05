import { type SchemaTypeDefinition } from 'sanity'
import { promotion } from './promotion'
import { roteiro } from './roteiro'

export const schema: { types: SchemaTypeDefinition[] } = {
    types: [promotion, roteiro],
}
