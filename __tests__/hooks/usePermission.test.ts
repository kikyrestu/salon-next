import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { usePermission } from '@/hooks/usePermission';
import { useSession } from 'next-auth/react';

vi.mock('next-auth/react', () => ({
  useSession: vi.fn(),
}));

describe('usePermission', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('Super Admin has all permissions', () => {
    (useSession as any).mockReturnValue({
      data: {
        user: { role: 'Super Admin' }
      }
    });

    const { result } = renderHook(() => usePermission());
    
    expect(result.current.canView('any_resource')).toBe(true);
    expect(result.current.canCreate('any_resource')).toBe(true);
    expect(result.current.canEdit('any_resource')).toBe(true);
    expect(result.current.canDelete('any_resource')).toBe(true);
    expect(result.current.viewScope('any_resource')).toBe('all');
  });

  it('Returns false/none for user with no permissions', () => {
    (useSession as any).mockReturnValue({
      data: {
        user: { role: 'Staff', permissions: {} }
      }
    });

    const { result } = renderHook(() => usePermission());
    
    expect(result.current.canView('invoices')).toBe(false);
    expect(result.current.canCreate('invoices')).toBe(false);
    expect(result.current.viewScope('invoices')).toBe('none');
  });

  it('Handles boolean view permissions correctly', () => {
    (useSession as any).mockReturnValue({
      data: {
        user: { 
          role: 'Staff',
          permissions: {
            dashboard: { view: true },
            settings: { view: false }
          }
        }
      }
    });

    const { result } = renderHook(() => usePermission());
    
    expect(result.current.canView('dashboard')).toBe(true);
    expect(result.current.canView('settings')).toBe(false);
  });

  it('Handles string scope view permissions correctly', () => {
    (useSession as any).mockReturnValue({
      data: {
        user: { 
          role: 'Staff',
          permissions: {
            invoices: { view: 'own' },
            customers: { view: 'all' },
            reports: { view: 'none' }
          }
        }
      }
    });

    const { result } = renderHook(() => usePermission());
    
    expect(result.current.canView('invoices')).toBe(true);
    expect(result.current.viewScope('invoices')).toBe('own');
    
    expect(result.current.canView('customers')).toBe(true);
    expect(result.current.viewScope('customers')).toBe('all');
    
    expect(result.current.canView('reports')).toBe(false);
    expect(result.current.viewScope('reports')).toBe('none');
  });

  it('Evaluates create, edit, delete correctly based on permissions object', () => {
    (useSession as any).mockReturnValue({
      data: {
        user: { 
          role: 'Staff',
          permissions: {
            products: { create: true, edit: false, delete: true },
          }
        }
      }
    });

    const { result } = renderHook(() => usePermission());
    
    expect(result.current.canCreate('products')).toBe(true);
    expect(result.current.canEdit('products')).toBe(false);
    expect(result.current.canDelete('products')).toBe(true);
  });

  it('hasPermission delegates to individual methods', () => {
    (useSession as any).mockReturnValue({
      data: {
        user: { 
          role: 'Staff',
          permissions: {
            services: { view: 'all', create: true, edit: false },
          }
        }
      }
    });

    const { result } = renderHook(() => usePermission());
    
    expect(result.current.hasPermission('services', 'view')).toBe(true);
    expect(result.current.hasPermission('services', 'create')).toBe(true);
    expect(result.current.hasPermission('services', 'edit')).toBe(false);
    expect(result.current.hasPermission('services', 'delete')).toBe(false); // Default false if missing
  });

  it('Returns false/none when session is undefined', () => {
    (useSession as any).mockReturnValue({ data: null });

    const { result } = renderHook(() => usePermission());
    
    expect(result.current.canView('invoices')).toBe(false);
    expect(result.current.viewScope('invoices')).toBe('none');
    expect(result.current.hasPermission('invoices', 'view')).toBe(false);
  });
});
