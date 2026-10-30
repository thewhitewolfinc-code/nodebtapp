import { router, useLocalSearchParams } from 'expo-router';
import { useRef, useState } from 'react';
import { View } from 'react-native';
import { Badge, Button, Card, Copy, EmptyState, Field, IconCircle, Notice, Page, Problem, Section, Segments, Toggle, errorMessage } from '@/components/nodebt/ui';
import { canAssignCategory, type Category } from '@/domain/categories';
import type { Direction } from '@/domain/ledger';
import { useGuest, useOperationId } from '@/features/guest/provider';
export default function Categories() {
  const params = useLocalSearchParams<{ direction?: string; recordId?: string }>();
  const { snapshot, busy, execute } = useGuest();
  const record = snapshot.records.find((candidate) => candidate.id === params.recordId), version = useRef(record?.version);
  const [direction, setDirection] = useState<Direction>(record?.direction ?? (params.direction === 'lent' ? 'lent' : 'borrowed'));
  const [editing, setEditing] = useState<Category>(), [name, setName] = useState(''), [archived, setArchived] = useState(false), [error, setError] = useState<string>();
  const operation = useOperationId();
  const rows = snapshot.categories.filter((category) => category.direction === direction).sort((a, b) => a.sortOrder - b.sortOrder);
  const defaults = rows.filter((category) => category.kind === 'default'), custom = rows.filter((category) => category.kind === 'custom');
  async function saveCategory() {
    try {
      setError(undefined);
      await execute(operation.get(), editing ? { type: 'change_category', id: editing.id, name, archived } : { type: 'create_category', direction, name });
      operation.reset(); setName(''); setEditing(undefined); setArchived(false);
    } catch (cause) { setError(errorMessage(cause)); }
  }
  async function assign(categoryId: string) {
    if (!record) return;
    try { setError(undefined); await execute(operation.get(), { type: 'assign_category', recordId: record.id, expectedVersion: version.current!, categoryId }); router.back(); }
    catch (cause) { setError(errorMessage(cause)); }
  }
  if (params.recordId && !record) return <Page title="Record not found" back><EmptyState icon="file-text" title="This record isn’t available" description="Open a record from your current guest ledger." /></Page>;
  return <Page title={record ? 'Choose a category' : 'Your categories'} eyebrow="Organise your ledger" subtitle={record ? `Choose a category for ${record.title}.` : 'Keep borrowing and lending organised your way.'} revealBottom={error} back>
    {!record && <Segments value={direction} disabled={busy} onChange={(value) => { setDirection(value); setEditing(undefined); setName(''); }} options={[{ value: 'borrowed', label: 'Borrowing' }, { value: 'lent', label: 'Lending' }]} />}
    <Notice tone="brand" icon="grid">Free includes 6 default categories and up to 3 custom categories for each direction.</Notice>
    <Section title="Default categories" subtitle={`6 available in Guest · ${defaults.length} total with Pro`}>
      {defaults.filter((category) => canAssignCategory(category, { isPro: false }, record?.categoryId)).map((category) => <Card key={category.id}>
        <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}><IconCircle icon="folder" size={36} /><View style={{ flex: 1, gap: 3 }}><Copy>{category.name}</Copy>{!category.freeDefault && <Copy variant="caption">Existing Pro assignment preserved</Copy>}</View><Badge label={record?.categoryId === category.id ? 'Current' : 'Default'} tone={record?.categoryId === category.id ? 'brand' : 'neutral'} /></View>
        {record && <Button label={record.categoryId === category.id ? 'Keep current category' : `Use ${category.name}`} secondary disabled={busy} onPress={() => { void assign(category.id); }} />}
      </Card>)}
    </Section>
    <Section title="Custom categories" subtitle={`${custom.length} of 3 Free categories used in this direction`}>
      {custom.length === 0 && <EmptyState icon="folder-plus" title="Make room for your own categories" description="Add a category below for the way you organise your borrowing or lending." />}
      {custom.map((category) => <Card key={category.id}>
        <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}><IconCircle icon="tag" size={36} /><View style={{ flex: 1 }}><Copy variant="heading">{category.name}</Copy></View><Badge label={category.archived ? 'Archived' : 'Custom'} tone={category.archived ? 'neutral' : 'brand'} /></View>
        {record && canAssignCategory(category, { isPro: false }, record.categoryId) && <Button label={`Use ${category.name}`} secondary disabled={busy} onPress={() => { void assign(category.id); }} />}
        <Button label="Rename / archive category" previewSafe icon="edit-2" secondary disabled={busy} onPress={() => { setEditing(category); setName(category.name); setArchived(category.archived); setError(undefined); operation.reset(); }} />
      </Card>)}
    </Section>
    <Section title={editing ? 'Edit category' : 'Create a category'}><Card>
      <Field label={editing ? 'Category name' : 'New category name'} icon="tag" placeholder="Give your category a name" value={name} onChangeText={setName} maxLength={60} editable={!busy} />
      {editing && <Toggle label="Archive this category" value={archived} onChange={setArchived} disabled={busy} />}
      {!editing && custom.length >= 3 && <Notice tone="warning" icon="info">You’ve reached the Free limit in this direction. Existing categories can still be renamed and reused.</Notice>}
      <Problem message={error} />
      <Button label={editing ? 'Save category changes' : 'Create custom category'} icon={editing ? 'check' : 'plus'} loading={busy} disabled={busy || (!editing && custom.length >= 3)} onPress={() => { void saveCategory(); }} />
      {editing && <Button label="Cancel editing" previewSafe secondary disabled={busy} onPress={() => { setEditing(undefined); setName(''); operation.reset(); }} />}
    </Card></Section>
    <Copy variant="caption">Archiving retains history and counts toward your limit. Pro categories are kept after expiry.</Copy>
  </Page>;
}
