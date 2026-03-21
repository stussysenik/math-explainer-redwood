import type { PipelineStatus } from 'src/types/solve'

const statusDotClasses = (status: PipelineStatus, isVerified: boolean, hasChatReply: boolean, hasError: boolean): string => {
  if (hasError) return 'h-2.5 w-2.5 rounded-full bg-rose-500'
  if (hasChatReply) return 'h-2.5 w-2.5 rounded-full bg-sky-500'
  if (isVerified) return 'h-2.5 w-2.5 rounded-full bg-emerald-500'
  if (status === 'computing') return 'h-2.5 w-2.5 rounded-full animate-pulse bg-amber-400'
  if (status === 'verifying') return 'h-2.5 w-2.5 rounded-full animate-pulse bg-violet-400'
  return 'h-2.5 w-2.5 rounded-full bg-stone-300'
}

interface Props {
  status: PipelineStatus
  isVerified: boolean
  hasChatReply: boolean
  hasError: boolean
}

const StatusIndicator = ({ status, isVerified, hasChatReply, hasError }: Props) => (
  <div className="flex items-center gap-3">
    <span className={statusDotClasses(status, isVerified, hasChatReply, hasError)} data-testid="status-indicator">
      <span className="sr-only">{status}</span>
    </span>
  </div>
)

export default StatusIndicator
