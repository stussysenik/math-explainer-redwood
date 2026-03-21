export const schema = gql`
  type Message {
    id: String!
    conversationId: String!
    role: String!
    content: String!
    hasImage: Boolean!
    solveResult: SolveResult
    createdAt: DateTime!
  }

  type SolveResult {
    id: String!
    mode: String!
    status: String!
    adapter: String!
    chatReply: String
    chatSteps: [String!]!
    symbolStatement: String
    symbolExpression: String
    symbolLatex: String
    symbolGraphExpr: String
    symbolNotes: [String!]!
    proofVerified: Boolean!
    proofState: String
    proofSummary: String
    proofDurationMs: Int
    graphDesmos: JSON
    graphGeogebra: JSON
    graphLatexBlock: String
    timingNlpMs: Int!
    timingSympyMs: Int!
    timingVerifyMs: Int!
    timingGraphMs: Int!
    error: String
    engineResults: [EngineResult!]!
    createdAt: DateTime!
  }

  type EngineResult {
    id: String!
    engineName: String!
    toolUseId: String
    status: String!
    result: JSON
    durationMs: Int!
  }

  type Query {
    messages(conversationId: String!): [Message!]! @skipAuth
  }
`
