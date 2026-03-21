export const schema = gql`
  type LibraryEntry {
    id: String!
    title: String!
    category: String!
    tags: [String!]!
    body: String!
    createdAt: DateTime!
    updatedAt: DateTime!
  }

  type Query {
    libraryEntries: [LibraryEntry!]! @skipAuth
    libraryEntry(id: String!): LibraryEntry @skipAuth
  }

  input CreateLibraryEntryInput {
    title: String!
    category: String
    tags: [String!]
    body: String!
  }

  type Mutation {
    createLibraryEntry(input: CreateLibraryEntryInput!): LibraryEntry! @skipAuth
    deleteLibraryEntry(id: String!): LibraryEntry! @skipAuth
  }
`
