/**
 * Library Entries Service — MathViz Redwood
 *
 * CRUD operations for the composable knowledge base. Entries store formulas,
 * patterns, cheat sheets, and proofs as Markdown with KaTeX.
 *
 * Tags are stored as a JSON string in SQLite but exposed as String[] in
 * GraphQL — parsed in the field resolver.
 */

import type { QueryResolvers, MutationResolvers } from 'types/graphql'

import { db } from 'src/lib/db'

// ─── Queries ───────────────────────────────────────────────────────────────

export const libraryEntries: QueryResolvers['libraryEntries'] = () => {
  return db.libraryEntry.findMany({
    where: { deletedAt: null },
    orderBy: { createdAt: 'desc' },
  })
}

export const libraryEntry: QueryResolvers['libraryEntry'] = ({ id }) => {
  return db.libraryEntry.findUnique({
    where: { id },
  })
}

// ─── Mutations ─────────────────────────────────────────────────────────────

export const createLibraryEntry: MutationResolvers['createLibraryEntry'] = ({
  input,
}) => {
  return db.libraryEntry.create({
    data: {
      title: input.title,
      category: input.category ?? 'formula',
      tags: JSON.stringify(input.tags ?? []),
      body: input.body,
    },
  })
}

export const deleteLibraryEntry: MutationResolvers['deleteLibraryEntry'] = ({
  id,
}) => {
  // Soft delete
  return db.libraryEntry.update({
    where: { id },
    data: { deletedAt: new Date() },
  })
}

// ─── Field Resolvers ───────────────────────────────────────────────────────

export const LibraryEntry = {
  tags: (
    _obj: Record<string, unknown>,
    { root }: { root: { tags: string } }
  ) => {
    try {
      const parsed = JSON.parse(root.tags)
      return Array.isArray(parsed) ? parsed : []
    } catch {
      return []
    }
  },
}
