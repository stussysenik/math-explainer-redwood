/**
 * Messages Service — MathViz Redwood
 *
 * Query resolvers for messages within a conversation. Messages are created
 * by the solve service, not directly by clients.
 */

import type { QueryResolvers } from 'types/graphql'

import { db } from 'src/lib/db'

// ─── Queries ───────────────────────────────────────────────────────────────

export const messages: QueryResolvers['messages'] = ({ conversationId }) => {
  return db.message.findMany({
    where: { conversationId },
    orderBy: { createdAt: 'asc' },
  })
}

// ─── Relation Resolvers ────────────────────────────────────────────────────

export const Message = {
  solveResult: (
    _obj: Record<string, unknown>,
    { root }: { root: { id: string } }
  ) => {
    return db.solveResult.findUnique({
      where: { messageId: root.id },
    })
  },
}

/**
 * SolveResult relation and field resolvers.
 *
 * JSON fields stored as strings in SQLite need to be parsed back to their
 * GraphQL types here. The SDL declares chatSteps as [String!]! and
 * symbolNotes as [String!]!, but Prisma stores them as JSON strings.
 */
export const SolveResult = {
  chatSteps: (
    _obj: Record<string, unknown>,
    { root }: { root: { chatSteps: string } }
  ) => {
    try {
      const parsed = JSON.parse(root.chatSteps)
      return Array.isArray(parsed) ? parsed : []
    } catch {
      return []
    }
  },

  symbolNotes: (
    _obj: Record<string, unknown>,
    { root }: { root: { symbolNotes: string } }
  ) => {
    try {
      const parsed = JSON.parse(root.symbolNotes)
      return Array.isArray(parsed) ? parsed : []
    } catch {
      return []
    }
  },

  graphDesmos: (
    _obj: Record<string, unknown>,
    { root }: { root: { graphDesmos: string } }
  ) => {
    try {
      return JSON.parse(root.graphDesmos)
    } catch {
      return null
    }
  },

  graphGeogebra: (
    _obj: Record<string, unknown>,
    { root }: { root: { graphGeogebra: string } }
  ) => {
    try {
      return JSON.parse(root.graphGeogebra)
    } catch {
      return null
    }
  },

  engineResults: (
    _obj: Record<string, unknown>,
    { root }: { root: { id: string } }
  ) => {
    return db.engineResult.findMany({
      where: { solveResultId: root.id },
    })
  },
}

/**
 * EngineResult field resolvers.
 * The result field is stored as a JSON string.
 */
export const EngineResult = {
  result: (
    _obj: Record<string, unknown>,
    { root }: { root: { result: string } }
  ) => {
    try {
      return JSON.parse(root.result)
    } catch {
      return null
    }
  },
}
