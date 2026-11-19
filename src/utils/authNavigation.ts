import type { Href } from 'expo-router';

import type { UserRole } from '@/types/auth';

export function roleHome(role: UserRole): Href {
  switch (role) {
    case 'PARTNER':
      return '/(partner)/dashboard';
    case 'ADMIN':
      return '/(admin)/dashboard';
    case 'CUSTOMER':
      return '/(customer)/home';
  }
}
