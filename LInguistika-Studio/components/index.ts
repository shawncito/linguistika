// components/index.ts — barrel export de todos los componentes reutilizables
// UI primitives (design system)
export {
  Button,
  Card, CardHeader, CardTitle, CardDescription, CardContent,
  Input, Label, Select,
  Badge,
  Dialog,
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from './UI';

// Feature components (existentes)
export { ActivityLogDrawer } from './ActivityLogDrawer';
export { PasswordConfirmDialog } from './PasswordConfirmDialog';
export { PhoneInput } from './PhoneInput';

// Layout & structure
export { PageHeader } from './PageHeader';

// Data display
export { DataTable } from './DataTable';
export type { ColumnDef } from './DataTable';
export { StatusBadge } from './StatusBadge';
export { EmptyState } from './EmptyState';

// Loading & errors
export { LoadingSpinner, TableLoadingRows } from './LoadingSpinner';
export { ErrorAlert } from './ErrorAlert';

// Filters & controls
export { SearchFilterBar } from './SearchFilterBar';
export { SortSelector } from './SortSelector';
export { ViewModeToggle } from './ViewModeToggle';

// Modals & notifications
export { ConfirmDialog } from './ConfirmDialog';
export { ToastContainer } from './ToastContainer';
export { MascotMark } from './MascotMark';
