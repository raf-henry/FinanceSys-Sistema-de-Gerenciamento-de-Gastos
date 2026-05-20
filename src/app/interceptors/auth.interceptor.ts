import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { tap, catchError, throwError } from 'rxjs';

/**
 * Interceptor responsável por adicionar 'withCredentials: true' em todas as requisições,
 * permitindo o envio automático de cookies HttpOnly, e redirecionar para login em caso de 401.
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  // Adiciona withCredentials: true para todas as requisições (necessário para cookies HttpOnly)
  const authReq = req.clone({
    withCredentials: true
  });

  return next(authReq).pipe(
    catchError((error) => {
      // Se o backend retornar 401 ou 403 (não autorizado/cookie expirado)
      if (error.status === 401 || error.status === 403) {
        localStorage.removeItem('username');
        if (!window.location.pathname.includes('/login')) {
          window.location.href = '/login';
        }
      }
      return throwError(() => error);
    })
  );
};
