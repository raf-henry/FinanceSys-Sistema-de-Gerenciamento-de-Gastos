import { Routes } from '@angular/router';
import { authGuard } from './guards/auth.guard';

export const routes: Routes = [
  { path: '', redirectTo: 'login', pathMatch: 'full' },
  { 
    path: 'home', 
    loadComponent: () => import('./components/home/home').then(m => m.Home), 
    canActivate: [authGuard] 
  },
  { 
    path: 'contas', 
    loadComponent: () => import('./components/contas/contas').then(m => m.Contas), 
    canActivate: [authGuard] 
  },
  { 
    path: 'transacoes', 
    loadComponent: () => import('./components/transacoes/transacoes').then(m => m.Transacoes), 
    canActivate: [authGuard] 
  },
  { 
    path: 'relatorios', 
    loadComponent: () => import('./components/relatorios/relatorios').then(m => m.Relatorios), 
    canActivate: [authGuard] 
  },
  { 
    path: 'configuracoes', 
    loadComponent: () => import('./components/configuracoes/configuracoes').then(m => m.Configuracoes), 
    canActivate: [authGuard] 
  },
  { 
    path: 'login', 
    loadComponent: () => import('./components/login/login').then(m => m.Login) 
  },
  { 
    path: 'register', 
    loadComponent: () => import('./components/register/register').then(m => m.Register) 
  },
  { path: '**', redirectTo: 'login' },
];
