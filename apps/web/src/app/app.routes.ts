import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', loadComponent: () => import('./search/home-page').then((m) => m.HomePage) },
  {
    path: 'game/:appId/:slug',
    loadComponent: () => import('./game/game-page').then((m) => m.GamePage),
  },
  { path: 'game/:appId', loadComponent: () => import('./game/game-page').then((m) => m.GamePage) },
  { path: 'config', loadComponent: () => import('./config/config-page').then((m) => m.ConfigPage) },
  { path: 'about', loadComponent: () => import('./about/about-page').then((m) => m.AboutPage) },
  { path: '**', redirectTo: '' },
];
