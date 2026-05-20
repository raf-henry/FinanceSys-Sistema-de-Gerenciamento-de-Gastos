import { Injectable, inject, signal, computed } from '@angular/core';
import { forkJoin, firstValueFrom } from 'rxjs';
import { Conta, ContaService } from './conta.service';
import { ExpenseService } from './expense.service';
import { TransactionService } from './transaction.service';

@Injectable({
  providedIn: 'root'
})
export class FinanceStoreService {
  private contaService = inject(ContaService);
  private expenseService = inject(ExpenseService);
  private transactionService = inject(TransactionService);

  // Shared Writable Signals accessible by views
  expenses = signal<any[]>([]);
  loading = signal<boolean>(false);
  error = signal<string | null>(null);
  periodoFiltro = signal<string>('Este Mês');
  searchText = signal<string>('');
  initialized = signal<boolean>(false);

  // Read-only/Writable mappings to ContaService
  readonly contas = this.contaService.contas;
  readonly selectedContaId = this.contaService.selectedContaId;

  // Computed signals
  readonly currentBank = computed(() => {
    const selectedId = this.selectedContaId();
    if (!selectedId) return 'GERAL';
    const conta = this.contas().find(c => c.id === Number(selectedId));
    return conta?.banco?.toUpperCase() || 'GERAL';
  });

  // Helpers
  safeNumber(val: any): number {
    if (val === null || val === undefined) return 0;
    if (typeof val === 'number') return val;
    let clean = String(val).replace(/[R$\s]/g, '');
    if (clean.includes(',') && clean.includes('.')) {
      clean = clean.replace(/\./g, '').replace(',', '.');
    } else if (clean.includes(',')) {
      clean = clean.replace(',', '.');
    }
    const num = Number(clean);
    return isNaN(num) ? 0 : num;
  }

  parseDateSeguro(dateStr: any): Date {
    if (!dateStr) return new Date(NaN);
    if (dateStr instanceof Date) return dateStr;
    
    if (Array.isArray(dateStr)) {
      if (dateStr.length >= 3) {
        const year = dateStr[0];
        const month = dateStr[1] - 1;
        const day = dateStr[2];
        const hours = dateStr.length > 3 ? dateStr[3] : 0;
        const minutes = dateStr.length > 4 ? dateStr[4] : 0;
        const seconds = dateStr.length > 5 ? dateStr[5] : 0;
        return new Date(year, month, day, hours, minutes, seconds);
      }
      return new Date(NaN);
    }

    if (typeof dateStr === 'string') {
      const trimmed = dateStr.trim();
      
      const dmyRegex = /^(\d{2})\/(\d{2})\/(\d{4})(.*)$/;
      if (dmyRegex.test(trimmed)) {
        const matches = trimmed.match(dmyRegex);
        if (matches) {
          const day = parseInt(matches[1], 10);
          const month = parseInt(matches[2], 10) - 1;
          const year = parseInt(matches[3], 10);
          
          let hours = 0;
          let minutes = 0;
          let seconds = 0;
          
          const timePart = matches[4].trim();
          if (timePart) {
            const parts = timePart.split(':');
            if (parts.length >= 2) {
              hours = parseInt(parts[0], 10);
              minutes = parseInt(parts[1], 10);
            }
            if (parts.length >= 3) {
              seconds = parseInt(parts[2], 10);
            }
          }
          return new Date(year, month, day, hours, minutes, seconds);
        }
      }
      
      const ymdRegex = /^(\d{4})-(\d{2})-(\d{2})(?:[T\s](\d{2}):(\d{2})(?::(\d{2}))?)?.*$/;
      if (ymdRegex.test(trimmed)) {
        const matches = trimmed.match(ymdRegex);
        if (matches) {
          const year = parseInt(matches[1], 10);
          const month = parseInt(matches[2], 10) - 1;
          const day = parseInt(matches[3], 10);
          const hours = matches[4] ? parseInt(matches[4], 10) : 0;
          const minutes = matches[5] ? parseInt(matches[5], 10) : 0;
          const seconds = matches[6] ? parseInt(matches[6], 10) : 0;
          return new Date(year, month, day, hours, minutes, seconds);
        }
      }
    }
    return new Date(dateStr);
  }

  readonly transacoesFiltradasPeriodo = computed(() => {
    const list = this.expenses();
    const periodo = this.periodoFiltro();
    const search = this.searchText().toLowerCase().trim();
    const now = new Date();

    return list.filter(t => {
      if (!t.dataGasto) return false;
      const data = this.parseDateSeguro(t.dataGasto);
      if (isNaN(data.getTime())) return false;

      let matchDate = true;

      if (periodo === 'Esta Semana') {
        const dayOfWeek = now.getDay();
        const startOfWeek = new Date(now);
        startOfWeek.setDate(now.getDate() - dayOfWeek);
        startOfWeek.setHours(0, 0, 0, 0);
        const endOfWeek = new Date(startOfWeek);
        endOfWeek.setDate(startOfWeek.getDate() + 6);
        endOfWeek.setHours(23, 59, 59, 999);
        matchDate = data >= startOfWeek && data <= endOfWeek;
      } else if (periodo === 'Este Mês') {
        matchDate = data.getMonth() === now.getMonth() && data.getFullYear() === now.getFullYear();
      } else if (periodo === 'Este Ano') {
        matchDate = data.getFullYear() === now.getFullYear();
      }

      if (!matchDate) return false;

      if (search) {
        return (t.descricao && t.descricao.toLowerCase().includes(search)) ||
               (t.favorecido && t.favorecido.toLowerCase().includes(search)) ||
               (t.categoria && t.categoria.toLowerCase().includes(search));
      }

      return true;
    });
  });

  readonly totalEntradas = computed(() => {
    return this.transacoesFiltradasPeriodo()
      .filter(t => {
        const tipo = (t.tipo || '').toUpperCase();
        const tipoMov = (t.tipoMovimentacao || '').toUpperCase();
        return tipo === 'RECEITA' || tipo === 'ENTRADA' || tipo === 'RENDIMENTO' ||
               tipoMov === 'ENTRADA' || tipoMov === 'RENDIMENTO';
      })
      .reduce((sum, t) => sum + this.safeNumber(t.valor), 0);
  });

  readonly totalSaidas = computed(() => {
    return this.transacoesFiltradasPeriodo()
      .filter(t => {
        const tipo = (t.tipo || '').toUpperCase();
        const tipoMov = (t.tipoMovimentacao || '').toUpperCase();
        return tipo === 'DESPESA' || tipo === 'SAIDA' || tipoMov === 'SAIDA';
      })
      .reduce((sum, t) => sum + this.safeNumber(t.valor), 0);
  });

  readonly saldoLiquido = computed(() => {
    return this.totalEntradas() - this.totalSaidas();
  });

  readonly metaEconomiaPorcentagem = computed(() => {
    const meta = 5000;
    const liquido = this.saldoLiquido();
    if (liquido <= 0) return 0;
    return Math.min(100, Math.round((liquido / meta) * 100));
  });

  readonly faltaParaMeta = computed(() => {
    const meta = 5000;
    const liquido = this.saldoLiquido();
    return Math.max(0, meta - liquido);
  });

  readonly saldoAtual = computed(() => {
    const allExpenses = this.expenses();
    const allContas = this.contas();
    const selectedId = this.selectedContaId();

    const calculateFallbackBalance = (gastos: any[]) => {
      const entradas = gastos.filter(g => g.tipo === 'RECEITA' || g.tipo === 'ENTRADA' || g.tipo === 'RENDIMENTO').reduce((sum, g) => sum + (g.valor || 0), 0);
      const saidas = gastos.filter(g => g.tipo === 'DESPESA' || g.tipo === 'SAIDA').reduce((sum, g) => sum + (g.valor || 0), 0);
      return entradas - saidas;
    };

    if (selectedId) {
      const gastosDaConta = allExpenses
        .filter(g => (g.contaId === Number(selectedId) || g.conta?.id === Number(selectedId)))
        .sort((a, b) => new Date(b.dataGasto).getTime() - new Date(a.dataGasto).getTime());
      
      if (gastosDaConta.length > 0) {
        return (gastosDaConta[0].saldo && gastosDaConta[0].saldo !== 0) ? gastosDaConta[0].saldo : calculateFallbackBalance(gastosDaConta);
      }
      return 0;
    } else {
      let total = 0;
      allContas.forEach(conta => {
        const gastosDaConta = allExpenses
          .filter(g => (g.contaId === conta.id || g.conta?.id === conta.id))
          .sort((a, b) => new Date(b.dataGasto).getTime() - new Date(a.dataGasto).getTime());
        
        if (gastosDaConta.length > 0) {
          total += (gastosDaConta[0].saldo && gastosDaConta[0].saldo !== 0) ? gastosDaConta[0].saldo : calculateFallbackBalance(gastosDaConta);
        }
      });
      return total;
    }
  });

  // Actions
  async init() {
    if (!this.initialized()) {
      await this.loadContas();
      this.initialized.set(true);
    }
  }

  setSelectedContaId(id: number | null) {
    this.contaService.selectedContaId.set(id);
    this.loadExpenses();
  }

  setPeriodoFiltro(periodo: string) {
    this.periodoFiltro.set(periodo);
  }

  setSearchText(text: string) {
    this.searchText.set(text);
  }

  async loadContas() {
    this.loading.set(true);
    this.error.set(null);
    try {
      const res = await firstValueFrom(this.contaService.getContas());
      if (this.selectedContaId() === null && res.length > 0) {
        this.contaService.selectedContaId.set(res[0].id ?? null);
      }
      await this.loadExpenses();
    } catch (err: any) {
      console.error('Erro ao carregar contas na store:', err);
      this.error.set('Erro ao conectar ao servidor. Não foi possível carregar as contas.');
    } finally {
      this.loading.set(false);
    }
  }

  async loadExpenses() {
    this.loading.set(true);
    this.error.set(null);
    const bank = this.currentBank();
    const contaId = this.selectedContaId();

    try {
      if (bank === 'NUBANK') {
        const res = await firstValueFrom(this.transactionService.getTransactions(contaId));
        const mapped = res.map((t: any) => ({
          ...t,
          dataGasto: t.dataHora,
          descricao: t.tituloExibicao,
          tipo: t.tipoMovimentacao || t.tipo,
          saldo: t.saldoMomento,
          favorecido: t.nomeContraparte,
          formaPagamento: t.formaPagamento
        }));
        this.sortAndSetExpenses(mapped);
      } else if (bank === 'GERAL') {
        const { gastos, transacoes } = await firstValueFrom(
          forkJoin({
            gastos: this.expenseService.getExpenses(null),
            transacoes: this.transactionService.getTransactions(null)
          })
        );
        const mappedTransacoes = transacoes.map((t: any) => ({
          ...t,
          dataGasto: t.dataHora,
          descricao: t.tituloExibicao,
          tipo: t.tipoMovimentacao || t.tipo,
          saldo: t.saldoMomento,
          favorecido: t.nomeContraparte,
          formaPagamento: t.formaPagamento
        }));
        const combined = [...gastos, ...mappedTransacoes];
        this.sortAndSetExpenses(combined);
      } else {
        const res = await firstValueFrom(this.expenseService.getExpenses(contaId));
        this.sortAndSetExpenses(res);
      }
    } catch (err: any) {
      console.error('Erro ao carregar lançamentos na store:', err);
      this.error.set('Erro ao conectar ao servidor. Não foi possível carregar os lançamentos.');
    } finally {
      this.loading.set(false);
    }
  }

  private sortAndSetExpenses(res: any[]) {
    const sorted = res.sort((a: any, b: any) => {
      const timeA = a.dataGasto ? this.parseDateSeguro(a.dataGasto).getTime() : 0;
      const timeB = b.dataGasto ? this.parseDateSeguro(b.dataGasto).getTime() : 0;
      return timeB - timeA;
    });
    this.expenses.set(sorted);
  }

  // Mutações
  async createExpense(expense: any) {
    this.loading.set(true);
    try {
      await firstValueFrom(this.expenseService.createExpense(expense));
      await this.loadExpenses();
    } catch (err) {
      console.error('Erro ao salvar lançamento:', err);
      throw err;
    } finally {
      this.loading.set(false);
    }
  }

  async updateExpense(id: number, expense: any) {
    this.loading.set(true);
    try {
      await firstValueFrom(this.expenseService.updateExpense(id, expense));
      await this.loadExpenses();
    } catch (err) {
      console.error('Erro ao editar lançamento:', err);
      throw err;
    } finally {
      this.loading.set(false);
    }
  }

  async deleteExpense(id: number) {
    this.loading.set(true);
    try {
      await firstValueFrom(this.expenseService.deleteExpense(id));
      await this.loadExpenses();
    } catch (err) {
      console.error('Erro ao excluir lançamento:', err);
      throw err;
    } finally {
      this.loading.set(false);
    }
  }

  async uploadExtrato(file: File, bank: string) {
    this.loading.set(true);
    const contaId = this.selectedContaId();
    if (!contaId) {
      throw new Error('Conta não selecionada');
    }
    try {
      await firstValueFrom(this.expenseService.uploadExtrato(file, contaId.toString(), bank));
      await this.loadContas();
    } catch (err) {
      console.error('Erro ao processar extrato na store:', err);
      throw err;
    } finally {
      this.loading.set(false);
    }
  }
}
