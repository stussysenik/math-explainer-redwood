import MathText from 'src/components/math/MathText/MathText'
import type { ConversationMessage } from 'src/types/solve'

interface Props {
  messages: ConversationMessage[]
}

const ConversationThread = ({ messages }: Props) => {
  // Only show when there are 2+ messages, and exclude the last message
  const displayMessages = messages.slice(0, -1)
  if (displayMessages.length < 1) return null

  return (
    <div className="mb-8 max-h-60 space-y-3 overflow-y-auto rounded-2xl border border-stone-100 bg-stone-50/50 p-4" data-testid="conversation-thread">
      {displayMessages.map((msg, idx) => (
        <div key={idx} className={`rounded-xl px-3 py-2 text-sm ${msg.role === 'user' ? 'bg-white text-stone-900' : 'bg-stone-100 text-stone-700'}`}>
          <span className="text-[0.6rem] font-semibold uppercase tracking-[0.2em] text-stone-400">{msg.role}</span>
          <MathText
            text={msg.content}
            className="mt-1 line-clamp-2 text-sm leading-6 text-inherit"
          />
        </div>
      ))}
    </div>
  )
}

export default ConversationThread
