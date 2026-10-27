import type { Direction } from './ledger.ts';

export interface Category {
  readonly id: string;
  readonly direction: Direction;
  readonly name: string;
  readonly kind: 'default' | 'custom';
  readonly freeDefault: boolean;
  readonly archived: boolean;
  readonly sortOrder: number;
}
export interface CategoryAccess { readonly isPro: boolean }
export const FREE_CUSTOM_LIMIT = 3;

// Stable, locale-independent IDs. The names are English launch labels, not financial calculation rules.
const borrowing = [
  ['personal_loan', 'Personal loan'], ['home_loan', 'Home loan'], ['vehicle_loan', 'Vehicle loan'],
  ['education_loan', 'Education loan'], ['credit_card', 'Credit card'], ['friends_family', 'Friends & family'],
  ['bnpl', 'Buy now, pay later'], ['medical', 'Medical'], ['business', 'Business'], ['secured', 'Secured loan'],
  ['overdraft', 'Overdraft'], ['short_term', 'Short-term loan'], ['rent', 'Rent'],
  ['utilities', 'Utilities'], ['tax', 'Tax'], ['other', 'Other borrowing'],
] as const;
const lending = [
  ['friends', 'Friends'], ['family', 'Family'], ['colleagues', 'Colleagues'],
  ['personal_loan', 'Personal loan'], ['emergency', 'Emergency'], ['other', 'Other lending'],
  ['business', 'Business'], ['education', 'Education'], ['medical', 'Medical'], ['rent', 'Rent'],
  ['travel', 'Travel'], ['community', 'Community'], ['employee', 'Employee'], ['secured', 'Secured lending'],
] as const;

export const DEFAULT_CATEGORIES: readonly Category[] = [
  ...borrowing.map(([key, name], index) => ({
    id: `borrowed:${key}`, direction: 'borrowed' as const, name, kind: 'default' as const,
    freeDefault: index < 6, archived: false, sortOrder: index,
  })),
  ...lending.map(([key, name], index) => ({
    id: `lent:${key}`, direction: 'lent' as const, name, kind: 'default' as const,
    freeDefault: index < 6, archived: false, sortOrder: index,
  })),
];

export function canAssignCategory(category: Category, access: CategoryAccess, currentId?: string): boolean {
  if (category.id === currentId) return true; // Downgrade/archive cannot invalidate a historical assignment.
  if (category.archived) return false;
  return category.kind === 'custom' || category.freeDefault || access.isPro;
}

export function assertCanCreateCategory(categories: readonly Category[], direction: Direction,
  name: string, access: CategoryAccess, excludingId?: string): string {
  const trimmed = name.trim();
  if (!trimmed || trimmed.length > 60) throw new Error('Category name must contain 1–60 characters.');
  if (categories.some((category) => category.direction === direction && category.id !== excludingId
    && category.name.trim().toLocaleLowerCase('en') === trimmed.toLocaleLowerCase('en'))) {
    throw new Error('A category with this name already exists in this direction.');
  }
  // Archived and retained Pro categories count too: hiding a category must not bypass the Free limit.
  if (!excludingId && !access.isPro && categories.filter((category) =>
    category.direction === direction && category.kind === 'custom').length >= FREE_CUSTOM_LIMIT) {
    throw new Error('Free supports up to 3 custom categories in each direction. Existing categories are preserved.');
  }
  return trimmed;
}