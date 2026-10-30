import { useState } from 'react';
import { Notice, Page, Segments } from '@/components/nodebt/ui';
import { ActivityList } from '@/features/guest/activity-list';
export default function Activity() {
  const [filter, setFilter] = useState<'all' | 'payments' | 'revisions'>('all');
  return <Page title="Activity" subtitle="Every entry and correction, kept in order.">
    <Segments value={filter} onChange={setFilter} options={[{ value: 'all', label: 'All activity' }, { value: 'payments', label: 'Payments' }, { value: 'revisions', label: 'Corrections' }]} />
    <Notice icon="clock" tone="brand">Previous revisions are always preserved. Your history stays transparent.</Notice>
    <ActivityList filter={filter} />
  </Page>;
}
