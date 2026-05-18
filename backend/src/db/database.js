import { JSONFilePreset } from 'lowdb/node'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const dbPath = join(__dirname, '../../db.json')

const defaultData = { claims: [], notes: [], nextClaimId: 1, nextNoteId: 1 }
export const db = await JSONFilePreset(dbPath, defaultData)
