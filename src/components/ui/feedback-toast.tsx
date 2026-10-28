import { X } from 'lucide-react';
import { useWorkspace } from '@/app/workspace-context';
export function FeedbackToast() {
  const { feedback, dismissFeedback } = useWorkspace();
  return (
    <div
      className="feedback-toasts"
      aria-live={feedback?.error ? 'assertive' : 'polite'}
      aria-atomic="true"
    >
      {feedback && (
        <div
          className={`feedback-toast${feedback.error ? ' error' : ''}`}
          role={feedback.error ? 'alert' : 'status'}
        >
          <span>{feedback.message}</span>
          <button
            type="button"
            aria-label="Dismiss feedback"
            onClick={dismissFeedback}
          >
            <X size={17} />
          </button>
        </div>
      )}
    </div>
  );
}
