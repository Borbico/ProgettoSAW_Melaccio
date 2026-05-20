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
      import('./pages/my-shelf/my-shelf-page').then((component) => component.MyShelfPage),
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
