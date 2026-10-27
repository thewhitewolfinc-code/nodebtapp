import { router, useLocalSearchParams } from 'expo-router';
import { useRef, useState } from 'react';
import { Button, Card, Copy, Field, Page, Problem, Row, Toggle, errorMessage } from '@/components/nodebt/ui';
import { canAssignCategory, type Category } from '@/domain/categories';
import type { Direction } from '@/domain/ledger';
import { useGuest, useOperationId } from '@/features/guest/provider';

export default function Categories() {
  const params = useLocalSearchParams<{ direction?: string; recordId?: string }>();
  const { snapshot, busy, execute } = useGuest();
  const record = snapshot.records.find((candidate) => candidate.id === params.recordId);
  const version = useRef(record?.version);
  const [direction, setDirection] = useState<Direction>(record?.direction ?? (params.direction === 'lent' ? 'lent' : 'borrowed'));
  const [editing, setEditing] = useState<Category>();
  const [name, setName] = useState('');
  const [archived, setArchived] = useState(false);
  const [error, setError] = useState<string>();
  const operation = useOperationId();
  const rows = snapshot.categories.filter((category) => category.direction === direction).sort((a, b) => a.sortOrder - b.sortOrder);
  const defaults = rows.filter((category) => category.kind === 'default');
  const custom = rows.filter((category) => category.kind === 'custom');
  async function saveCategory() {
    try {
      setError(undefined);
      await execute(operation.get(), editing ? { type: 'change_category', id: editing.id, name, archived }
        : { type: 'create_category', direction, name });
      operation.reset(); setName(''); setEditing(undefined); setArchived(false);
    } catch (cause) { setError(errorMessage(cause)); }
  }
  async function assign(categoryId: string) {
    if (!record) return;
    try {
      setError(undefined);
      await execute(operation.get(), { type: 'assign_category', recordId: record.id, expectedVersion: version.current!, categoryId });
      router.back();
    } catch (cause) { setError(errorMessage(cause)); }
  }
  if (params.recordId && !record) return <Page title="Record not found" back><Copy>This record is not available in the current guest ledger.</Copy></Page>;
  return <Page title={record ? 'Choose a category' : 'Categories'} subtitle="Free includes 6 defaults and up to 3 custom categories per direction." back>
    {!record && <Row><Button label="Borrowing" secondary selected={direction === 'borrowed'} disabled={busy} onPress={() => { setDirection('borrowed'); setEditing(undefined); setName(''); }} />
      <Button label="Lending" secondary selected={direction === 'lent'} disabled={busy} onPress={() => { setDirection('lent'); setEditing(undefined); setName(''); }} /></Row>}
    <Copy variant="heading">Default categories</Copy>
    <Copy variant="caption">6 available in guest mode · {defaults.length} total with Pro.</Copy>
    {defaults.filter((category) => canAssignCategory(category, { isPro: false }, record?.categoryId)).map((category) => <Card key={category.id}>
      <Copy>{category.name}{!category.freeDefault ? ' · Existing Pro assignment preserved' : ''}</Copy>
      {record && <Button label={record.categoryId === category.id ? 'Keep current category' : `Use ${category.name}`} secondary disabled={busy}
        onPress={() => { void assign(category.id); }} />}
    </Card>)}
    <Copy variant="heading">Custom categories · {custom.length} / 3 Free</Copy>
    <Copy variant="caption">Archiving retains history and counts toward the limit. You can rename or reuse existing categories. Pro categories are kept after expiry.</Copy>
    {custom.map((category) => <Card key={category.id}>
      <Copy>{category.name}{category.archived ? ' · Archived' : ''}</Copy>
      {record && canAssignCategory(category, { isPro: false }, record.categoryId) && <Button label={`Use ${category.name}`} secondary disabled={busy} onPress={() => { void assign(category.id); }} />}
      <Button label="Rename / archive category" secondary disabled={busy} onPress={() => {
        setEditing(category); setName(category.name); setArchived(category.archived); setError(undefined); operation.reset();
      }} />
    </Card>)}
    <Field label={editing ? 'Rename custom category' : 'New custom category name'} value={name} onChangeText={setName} maxLength={60} editable={!busy} />
    {editing && <Toggle label="Archive this category" value={archived} onChange={setArchived} disabled={busy} />}
    <Problem message={error} />
    <Button label={busy ? 'Saving…' : editing ? 'Save category changes' : 'Create custom category'} disabled={busy || (!editing && custom.length >= 3)} onPress={() => { void saveCategory(); }} />
    {editing && <Button label="Cancel editing" secondary disabled={busy} onPress={() => { setEditing(undefined); setName(''); operation.reset(); }} />}
  </Page>;
}