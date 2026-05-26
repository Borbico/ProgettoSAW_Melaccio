import { Routes } from '@angular/router';
import { requireSignedInGuard } from './guards/auth-guards';

export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    redirectTo: 'catalogo',
  },
  {
    path: 'catalogo',
    loadComponent: () =>
      import('./pages/catalog/catalog-page').then((component) => component.CatalogPage),
  },
  {
    path: 'giochi/:id',
    loadComponent: () =>
      import('./pages/game-detail/game-detail-page').then((component) => component.GameDetailPage),
  },
  {
    path: 'myshelf',
    canActivate: [requireSignedInGuard],
    loadComponent: () =>
      import('./pages/profile/profile-page').then((component) => component.ProfilePage),
  },
  {
    path: 'community',
    canActivate: [requireSignedInGuard],
    loadComponent: () =>
      import('./pages/community/community-page').then((component) => component.CommunityPage),
  },
  {
    path: 'community/:userId',
    canActivate: [requireSignedInGuard],
    loadComponent: () =>
      import('./pages/public-shelf/public-shelf-page').then(
        (component) => component.PublicShelfPage,
      ),
  },
  {
    path: 'profilo',
    loadComponent: () =>
      import('./pages/profile/profile-page').then((component) => component.ProfilePage),
  },
  {
    path: '**',
    redirectTo: 'catalogo',
  },
];
