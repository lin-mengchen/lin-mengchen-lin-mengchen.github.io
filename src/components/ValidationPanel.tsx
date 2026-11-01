import { AlertTriangle, CheckCircle2, Info } from 'lucide-react'
import type { ValidationIssue } from '../types/poetry'

interface ValidationPanelProps {
  issues: ValidationIssue[]
  sceneError?: string
}

export function ValidationPanel({ issues, sceneError }: ValidationPanelProps) {
  const allIssues = sceneError
    ? [
        ...issues,
        {
          code: 'READ_ERROR' as const,
          severity: 'error' as const,
          message: sceneError,
        },
      ]
    : issues

  if (allIssues.length === 0) {
    return (
      <div className="validation validation-ok" role="status">
        <CheckCircle2 size={15} aria-hidden="true" />
        字符、坐标与空白间距已校验
      </div>
    )
  }

  return (
    <div className="validation-list" aria-live="polite">
      {allIssues.map((issue, index) => (
        <div
          className={`validation ${issue.severity === 'error' ? 'validation-error' : 'validation-warning'}`}
          key={`${issue.code}-${issue.coordinate?.address ?? index}`}
          role={issue.severity === 'error' ? 'alert' : 'status'}
        >
          {issue.severity === 'error'
            ? <AlertTriangle size={15} aria-hidden="true" />
            : <Info size={15} aria-hidden="true" />}
          <span>{issue.message}</span>
        </div>
      ))}
    </div>
  )
}
