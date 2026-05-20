export type UserRole = 'guest' | 'standard' | 'admin';

export function roleLabel(role: UserRole): string {
  if (role === 'admin') {
    return 'Admin';
  }

  if (role === 'standard') {
    return 'Utente standard';
  }

  return 'Ospite';
}
