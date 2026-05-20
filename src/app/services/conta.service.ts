import { Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { environment } from '../../environments/environment';

export interface Conta {
  id?: number;
  nome: string;
  banco: string;
  tipo: string;
  cor: string;
  icone: string;
}

@Injectable({
  providedIn: 'root'
})
export class ContaService {
  private apiUrl = `${environment.apiUrl}/api/contas`;
  
  // Signal para manter as contas sincronizadas em toda a aplicação
  contas = signal<Conta[]>([]);
  selectedContaId = signal<number | null>(null);

  constructor(private http: HttpClient) {}

  getContas(): Observable<Conta[]> {
    return this.http.get<Conta[]>(this.apiUrl).pipe(
      tap(contas => this.contas.set(contas))
    );
  }

  criarConta(conta: Conta): Observable<Conta> {
    return this.http.post<Conta>(this.apiUrl, conta).pipe(
      tap(() => this.getContas().subscribe()) // Recarrega a lista após criar
    );
  }

  deletarConta(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`).pipe(
      tap(() => this.getContas().subscribe()) // Recarrega a lista após deletar
    );
  }
}
