import { Send, ShieldCheck } from 'lucide-react';
import { useMemo, useState } from 'react';
import { StatusBadge } from './ui';
import type { ToastTone } from './ui';
export function ReconciliationPanel({
  notify,
}: {
  notify: (title: string, detail: string, tone?: ToastTone) => void;
}) {
  const [actual, setActual] = useState<string>('');
  const [submitted, setSubmitted] = useState(false);
  const expected = 42;
  const variance = actual === '' ? null : Number(actual) - expected;
  const rate = useMemo(
    () => (actual === '' ? '—' : variance === 0 ? '100%' : '0%'),
    [actual, variance],
  );
  return (
    <section className="transfer-workflow" aria-label="Physical reconciliation preview">
      <div className="transfer-workflow__heading">
        <div>
          <span className="eyebrow">Physical count preview</span>
          <h2>STK-DEMO-0081</h2>
          <p>Northfield Stores · Expected quantity is preserved when the count session starts.</p>
        </div>
        <StatusBadge tone={submitted ? 'warning' : 'neutral'}>
          {submitted ? 'SUBMITTED' : 'COUNTING'}
        </StatusBadge>
      </div>
      <div className="reconciliation-grid">
        <label>
          Expected quantity<strong>{expected}</strong>
          <small>Snapshot; never overwritten.</small>
        </label>
        <label>
          Actual counted quantity
          <input
            aria-label="Actual counted quantity"
            min="0"
            onChange={(event) => setActual(event.target.value)}
            placeholder="Not counted"
            type="number"
            value={actual}
          />
          <small>Blank means uncounted; 0 means counted zero.</small>
        </label>
        <label>
          Variance<strong>{variance === null ? '—' : variance}</strong>
          <small>Actual − expected</small>
        </label>
        <label>
          Reconciliation rate<strong>{rate}</strong>
          <small>Matching counted records / total counted records</small>
        </label>
      </div>
      <div className="transfer-workflow__controls">
        <p>
          Submitting a count creates a review request only. Only an independent authorized approval
          can post a compensating ledger correction.
        </p>
        <button
          className="button button--primary"
          disabled={actual === '' || submitted}
          onClick={() => {
            setSubmitted(true);
            notify(
              'Count submitted for review',
              'No inventory has changed. This local preview is not connected to the API.',
              'success',
            );
          }}
          type="button"
        >
          {submitted ? <ShieldCheck size={16} /> : <Send size={16} />}
          {submitted ? 'Awaiting independent review' : 'Submit count for review'}
        </button>
      </div>
    </section>
  );
}
