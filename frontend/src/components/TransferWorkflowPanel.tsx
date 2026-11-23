import { CheckCircle2, PackageCheck, Send, Truck } from 'lucide-react';
import { useState } from 'react';
import { StatusBadge } from './ui';
import type { ToastTone } from './ui';

type Stage = 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'DISPATCHED' | 'RECEIVED';
const steps: Stage[] = ['DRAFT', 'SUBMITTED', 'APPROVED', 'DISPATCHED', 'RECEIVED'];

export function TransferWorkflowPanel({
  notify,
}: {
  notify: (title: string, detail: string, tone?: ToastTone) => void;
}) {
  const [stage, setStage] = useState<Stage>('DRAFT');
  const index = steps.indexOf(stage);
  const advance = () => {
    const next = steps[index + 1];
    if (!next) return;
    setStage(next);
    notify(
      `Demo transfer ${next.toLowerCase()}`,
      'This is a local UI preview. The API workflow enforces the real authorization and stock controls.',
      'success',
    );
  };
  const label =
    stage === 'DRAFT'
      ? 'Submit for approval'
      : stage === 'SUBMITTED'
        ? 'Approve transfer'
        : stage === 'APPROVED'
          ? 'Record dispatch'
          : stage === 'DISPATCHED'
            ? 'Record receipt'
            : 'Completed';
  return (
    <section className="transfer-workflow" aria-label="Transfer workflow preview">
      <div className="transfer-workflow__heading">
        <div>
          <span className="eyebrow">Controlled workflow preview</span>
          <h2>TRF-DEMO-0248</h2>
          <p>Central Stores → Harbor Annex · 24 units of protective cases</p>
        </div>
        <StatusBadge
          tone={stage === 'RECEIVED' ? 'success' : stage === 'DRAFT' ? 'neutral' : 'warning'}
        >
          {stage}
        </StatusBadge>
      </div>
      <ol className="transfer-steps">
        {steps.map((step, stepIndex) => (
          <li className={stepIndex <= index ? 'is-complete' : ''} key={step}>
            <span>{stepIndex < index ? <CheckCircle2 size={15} /> : stepIndex + 1}</span>
            {step.replace('_', ' ')}
          </li>
        ))}
      </ol>
      <div className="transfer-workflow__controls">
        <p>
          Drafts and approvals do not change stock. Dispatch posts the source debit; receipt posts
          only the acknowledged destination quantity.
        </p>
        <button
          className="button button--primary"
          disabled={stage === 'RECEIVED'}
          onClick={advance}
          type="button"
        >
          {stage === 'DRAFT' ? (
            <Send size={16} />
          ) : stage === 'APPROVED' ? (
            <Truck size={16} />
          ) : (
            <PackageCheck size={16} />
          )}
          {label}
        </button>
      </div>
    </section>
  );
}
