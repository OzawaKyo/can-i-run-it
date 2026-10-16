import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    title: 'Can I Run It?',
    loadComponent: () => import('./search/home-page').then((m) => m.HomePage),
  },
  {
    path: 'game/:id/:slug',
    title: 'Can I Run It?',
    loadComponent: () => import('./game/game-page').then((m) => m.GamePage),
  },
  {
    path: 'game/:id',
    title: 'Can I Run It?',
    loadComponent: () => import('./game/game-page').then((m) => m.GamePage),
  },
  {
    path: 'config',
    title: 'Can I Run It?',
    loadComponent: () => import('./config/config-page').then((m) => m.ConfigPage),
  },
  {
    path: 'about',
    title: 'Can I Run It?',
    loadComponent: () => import('./about/about-page').then((m) => m.AboutPage),
  },
  { path: '**', redirectTo: '' },
];
