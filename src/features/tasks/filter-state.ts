export interface Filters {
  search: string;
  status: string;
  priority: string;
  person: string;
  project: string;
  sort: string;
}
export const initialFilters: Filters = {
  search: '',
  status: 'all',
  priority: 'all',
  person: 'all',
  project: 'all',
  sort: 'due',
};
