import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class TransactionService {
  private http = inject(HttpClient);
  private readonly API_URL = `${environment.apiUrl}/api/transacoes`;

  getTransactions(contaId?: number | null): Observable<any[]> {
    const url = contaId ? `${this.API_URL}?contaId=${contaId}` : this.API_URL;
    return this.http.get<any[]>(url);
  }

  deleteTransaction(id: number): Observable<any> {
    return this.http.delete<any>(`${this.API_URL}/${id}`);
  }

  importNubank(file: File, contaId: number): Observable<any> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('contaId', contaId.toString());
    return this.http.post<any>(`${this.API_URL}/importar-nubank`, formData);
  }
}
