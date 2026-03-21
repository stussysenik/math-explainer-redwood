/**
 * Conversations Service — MathViz Redwood
 *
 * CRUD operations for conversation threads. Each conversation holds an
 * ordered list of messages (user + assistant exchanges).
 */

import type { QueryResolvers, MutationResolvers } from 'types/graphql'

import { db } from 'src/lib/db'

// ─── Queries ───────────────────────────────────────────────────────────────

export const conversations: QueryResolvers['conversations'] = () => {
  return db.conversation.findMany({
    where: { deletedAt: null },
    orderBy: { createdAt: 'desc' },
  })
}

export const conversation: QueryResolvers['conversation'] = ({ id }) => {
  return db.conversation.findUnique({
    where: { id },
  })
}

// ─── Mutations ─────────────────────────────────────────────────────────────

export const createConversation: MutationResolvers['createConversation'] = ({
  input,
}) => {
  return db.conversation.create({
    data: {
      title: input.title ?? 'New Conversation',
    },
  })
}

export const deleteConversation: MutationResolvers['deleteConversation'] = ({
  id,
}) => {
  // Soft delete: set deletedAt timestamp
  return db.conversation.update({
    where: { id },
    data: { deletedAt: new Date() },
  })
}

// ─── Relation Resolvers ────────────────────────────────────────────────────

export const Conversation = {
  messages: (
    _obj: Record<string, unknown>,
    { root }: { root: { id: string } }
  ) => {
    return db.message.findMany({
      where: { conversationId: root.id },
      orderBy: { createdAt: 'asc' },
    })
  },
}
