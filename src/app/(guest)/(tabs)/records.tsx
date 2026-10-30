import { router } from 'expo-router';
import { useState } from 'react';
import { Badge, Button, Card, Copy, EmptyState, Field, IconButton, Page, Segments, Toggle } from '@/components/nodebt/ui';
import { RecordCard } from '@/components/nodebt/record-card';
import { useGuest } from '@/features/guest/provider';
import type { Direction } from '@/domain/ledger';
export default function Records() {
  const { snapshot, today } = useGuest();
  const [query, setQuery] = useState(''), [direction, setDirection] = useState<Direction | 'all'>('all'), [archived, setArchived] = useState(false);
  const visible = snapshot.records.filter((record) => (archived || !record.archived) && (direction === 'all' || direction === record.direction)
    && `${record.title} ${record.counterparty} ${snapshot.categories.find((category) => category.id === record.categoryId)?.name ?? ''}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()));
  return <Page title="Records" subtitle="Borrowing and lending in one private ledger." action={<IconButton icon="plus" label="Add a record" onPress={() => router.push('/record/new')} />}>
    <Segments value={direction} onChange={setDirection} options={[{ value: 'all', label: 'All records' }, { value: 'borrowed', label: 'I owe' }, { value: 'lent', label: 'Owed to me' }]} />
    <Field label="Search your ledger" icon="search" placeholder="Search records, people or categories" value={query} onChangeText={setQuery} returnKeyType="search" />
    <Card style={{ paddingVertical: 4 }}><Toggle label="Include archived records" value={archived} onChange={setArchived} /></Card>
    <Badge label={`${visible.length} ${visible.length === 1 ? 'record' : 'records'}`} />
    {visible.length === 0 ? <EmptyState icon={snapshot.records.length ? 'search' : 'layers'} title={snapshot.records.length ? 'No matching records' : 'Your ledger starts here'}
      description={snapshot.records.length ? 'Try a different search or include archived records.' : 'Keep formal loans, personal borrowing, and money lent to others in one private ledger.'}
      action={snapshot.records.length ? <Button label="Clear filters" secondary onPress={() => { setQuery(''); setDirection('all'); setArchived(false); }} /> : <Button label="Add a record" icon="plus" onPress={() => router.push('/record/new')} />} /> :
      visible.slice().reverse().map((record) => <RecordCard key={record.id} record={record} snapshot={snapshot} today={today} />)}
    <Copy variant="caption">Archived records are hidden by default. Their outstanding balances remain in your totals.</Copy>
  </Page>;
}
