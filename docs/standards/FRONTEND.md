# Frontend Standards (React + TypeScript)

## Project Structure

```
src/
├── components/       # Shared components
│   ├── ui/           # Base UI (shadcn)
│   ├── charts/       # Chart wrappers
│   └── layout/       # Shell, sidebar
├── modules/          # Feature modules
├── hooks/            # Custom hooks
├── stores/           # Zustand stores
├── lib/              # Utils, API client
└── types/            # TypeScript types
```

## Component Pattern

```tsx
// components/MyComponent.tsx
interface MyComponentProps {
  title: string;
  onAction: () => void;
}

export function MyComponent({ title, onAction }: MyComponentProps) {
  return (
    <div className="...">
      <h2>{title}</h2>
      <button onClick={onAction}>Action</button>
    </div>
  );
}
```

## Data Fetching (React Query)

```tsx
// hooks/useAnalytics.ts
export function useOverview(filters: Filters) {
  return useQuery({
    queryKey: ['overview', filters],
    queryFn: () => api.getOverview(filters),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

// In component
function Dashboard() {
  const { data, isLoading, error } = useOverview(filters);
  
  if (isLoading) return <Skeleton />;
  if (error) return <ErrorState />;
  return <DashboardContent data={data} />;
}
```

## State Management (Zustand)

```tsx
// stores/authStore.ts
interface AuthState {
  user: User | null;
  setUser: (user: User | null) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  setUser: (user) => set({ user }),
  logout: () => set({ user: null }),
}));
```

## Styling (Tailwind)

```tsx
// Use consistent patterns
<div className="bg-white rounded-lg border border-slate-200 p-6">
  <h2 className="text-lg font-semibold text-slate-800">Title</h2>
  <p className="text-sm text-slate-500 mt-1">Description</p>
</div>
```
