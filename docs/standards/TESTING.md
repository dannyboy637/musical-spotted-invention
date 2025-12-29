# Testing Standards

## Philosophy
- Test behavior, not implementation
- Focus on critical paths
- Don't test framework code

## Backend (pytest)

```python
# tests/test_analytics.py
import pytest
from fastapi.testclient import TestClient

def test_overview_returns_data(client: TestClient, auth_headers: dict):
    response = client.get("/api/analytics/overview", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert "revenue" in data
    assert "transactions" in data

def test_overview_requires_auth(client: TestClient):
    response = client.get("/api/analytics/overview")
    assert response.status_code == 401
```

## Frontend (Vitest + Testing Library)

```tsx
// __tests__/Dashboard.test.tsx
import { render, screen } from '@testing-library/react';
import { Dashboard } from '../Dashboard';

test('shows loading state initially', () => {
  render(<Dashboard />);
  expect(screen.getByTestId('skeleton')).toBeInTheDocument();
});

test('shows data when loaded', async () => {
  render(<Dashboard />);
  expect(await screen.findByText('₱2.4M')).toBeInTheDocument();
});
```

## What to Test

### Must Test
- Auth flows
- Data fetching success/error
- Critical calculations
- RLS policies

### Nice to Test
- UI interactions
- Edge cases
- Error states

### Skip
- Styling
- Third-party libraries
- Simple getters/setters
