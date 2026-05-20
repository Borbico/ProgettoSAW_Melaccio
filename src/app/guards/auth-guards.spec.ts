import { TestBed } from '@angular/core/testing';
import { Router, UrlTree } from '@angular/router';
import { AuthSession } from '../services/auth-session';
import { NotificationCenter } from '../services/notification-center';
import { requireSignedInGuard } from './auth-guards';

describe('requireSignedInGuard', () => {
  it('allows authenticated users to open protected pages', async () => {
    TestBed.configureTestingModule({
      providers: [
        {
          provide: AuthSession,
          useValue: {
            currentUser: () => ({ id: 'user-1' }),
            whenReady: () => Promise.resolve(),
          },
        },
        { provide: Router, useValue: { createUrlTree: () => ({}) } },
        { provide: NotificationCenter, useValue: { warning: () => undefined } },
      ],
    });

    const result = await runGuard('/myshelf');

    expect(result).toBe(true);
  });

  it('redirects guests to the profile login panel', async () => {
    const warnings: string[] = [];
    const tree = { redirected: true } as unknown as UrlTree;
    let redirectExtras: unknown;

    TestBed.configureTestingModule({
      providers: [
        {
          provide: AuthSession,
          useValue: {
            currentUser: () => null,
            whenReady: () => Promise.resolve(),
          },
        },
        {
          provide: Router,
          useValue: {
            createUrlTree: (_commands: string[], extras: unknown) => {
              redirectExtras = extras;
              return tree;
            },
          },
        },
        {
          provide: NotificationCenter,
          useValue: {
            warning: (title: string) => warnings.push(title),
          },
        },
      ],
    });

    const result = await runGuard('/myshelf');

    expect(result).toBe(tree);
    expect(warnings).toEqual(['Accesso richiesto']);
    expect(redirectExtras).toEqual({
      fragment: 'accesso',
      queryParams: { redirectTo: '/myshelf' },
    });
  });
});

function runGuard(url: string): Promise<boolean | UrlTree> {
  return TestBed.runInInjectionContext(
    () => requireSignedInGuard({} as never, { url } as never) as Promise<boolean | UrlTree>,
  );
}
