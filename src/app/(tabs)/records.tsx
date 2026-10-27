import { router } from 'expo-router';
import { useState } from 'react';
import { Button, Copy, Field, Page, Row, Toggle } from '@/components/nodebt/ui';
import { RecordCard } from '@/components/nodebt/record-card';
import { useGuest } from '@/features/guest/provider';
import type { Direction } from '@/domain/ledger';

export default function Records() {
  const { snapshot, today } = useGuest();
  const [query, setQuery] = useState('');
  const [direction, setDirection] = useState<Direction | 'all'>('all');
  const [archived, setArchived] = useState(false);
  const visible = snapshot.records.filter((record) => (archived || !record.archived)
    && (direction === 'all' || direction === record.direction)
    && `${record.title} ${record.counterparty} ${snapshot.categories.find((category) => category.id === record.categoryId)?.name ?? ''}`
      .toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()));
  return <Page title="Records" subtitle="Borrowing and lending in one private ledger">
    <Button label="Add a record" onPress={() => router.push('/record/new')} />
    <Field label="Search records, people or categories" value={query} onChangeText={setQuery} />
    <Row><Button label="All" secondary selected={direction === 'all'} onPress={() => setDirection('all')} />
      <Button label="I owe" secondary selected={direction === 'borrowed'} onPress={() => setDirection('borrowed')} />
      <Button label="Owed to me" secondary selected={direction === 'lent'} onPress={() => setDirection('lent')} /></Row>
    <Toggle label="Include archived records" value={archived} onChange={setArchived} />
    {visible.length === 0 ? <Copy variant="caption">No matching records. Try another filter or add your first record.</Copy> :
      visible.slice().reverse().map((record) => <RecordCard key={record.id} record={record} snapshot={snapshot} today={today} />)}
  </Page>;
}