export const schema = gql`
  type Conversation {
    id: String!
    title: String!
    messages: [Message!]!
    createdAt: DateTime!
    updatedAt: DateTime!
  }

  type Query {
    conversations: [Conversation!]! @skipAuth
    conversation(id: String!): Conversation @skipAuth
  }

  input CreateConversationInput {
    title: String
  }

  type Mutation {
    createConversation(input: CreateConversationInput!): Conversation! @skipAuth
    deleteConversation(id: String!): Conversation! @skipAuth
  }
`
