import { Page } from '@/components/nodebt/ui';
import { ActivityList } from '@/features/guest/activity-list';
export default function Activity() {
  return <Page title="Activity" subtitle="Original transactions and all financial corrections remain visible."><ActivityList /></Page>;
}