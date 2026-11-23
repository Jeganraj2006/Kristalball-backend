import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { App } from './App';

describe('App', () => {
  it('renders the dashboard with an explicit fictional-demo boundary', () => {
    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <App />
      </MemoryRouter>,
    );

    expect(screen.getByRole('heading', { name: 'Operations Dashboard' })).toBeInTheDocument();
    expect(screen.getByText('Demo environment')).toBeInTheDocument();
  });
});
