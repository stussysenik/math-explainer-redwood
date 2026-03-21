export const schema = gql`
  type SolveResponse {
    messageId: String!
    conversationId: String!
    solveResult: SolveResult!
  }

  input SolveInput {
    query: String!
    conversationId: String
    imageBase64: String
    imageMime: String
  }

  type Mutation {
    solve(input: SolveInput!): SolveResponse! @skipAuth
  }
`
