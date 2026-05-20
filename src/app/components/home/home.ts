import { Component, inject, OnInit, signal, computed } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { ExpenseService } from '../../services/expense.service';
import { AuthService } from '../../services/auth.service';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ContaService } from '../../services/conta.service';
import { SidebarService } from '../../services/sidebar.service';
import { TransactionService } from '../../services/transaction.service';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './home.html',
  styleUrl: './home.css',
})
export class Home implements OnInit {
  private router = inject(Router);
  private expenseService = inject(ExpenseService);
  private authService = inject(AuthService);
  private contaService = inject(ContaService);
  public sidebarService = inject(SidebarService);
  private transactionService = inject(TransactionService);

  expenses = signal<any[]>([]);
  contas = signal<any[]>([]);

  get contaSelecionadaId() {
    return this.contaService.selectedContaId();
  }

  set contaSelecionadaId(val: any) {
    // Garante que o valor seja número ou null
    const id = (val === 'null' || val === null) ? null : Number(val);
    this.contaService.selectedContaId.set(id);
  }

  totalEntradas = computed(() => {
    return this.expenses()
      .filter(e => e.tipo === 'RECEITA')
      .reduce((acc, curr) => acc + curr.valor, 0);
  });

  totalSaidas = computed(() => {
    return this.expenses()
      .filter(e => e.tipo === 'DESPESA')
      .reduce((acc, curr) => acc + curr.valor, 0);
  });

  stats = signal({
    totalGastos: 0,
    valorTotal: 0,
    gastoFixoMensal: 0
  });

  saldoAtual = computed(() => {
    const allExpenses = this.expenses();
    const allContas = this.contas();
    const selectedId = this.contaSelecionadaId;

    const calculateFallbackBalance = (gastos: any[]) => {
      const entradas = gastos.filter(g => g.tipo === 'RECEITA' || g.tipo === 'ENTRADA' || g.tipo === 'RENDIMENTO').reduce((sum, g) => sum + (g.valor || 0), 0);
      const saidas = gastos.filter(g => g.tipo === 'DESPESA' || g.tipo === 'SAIDA').reduce((sum, g) => sum + (g.valor || 0), 0);
      return entradas - saidas;
    };

    if (selectedId) {
      // Para uma conta específica: pega o saldo do lançamento mais recente
      const gastosDaConta = allExpenses
        .filter(g => (g.contaId === Number(selectedId) || g.conta?.id === Number(selectedId)))
        .sort((a, b) => new Date(b.dataGasto).getTime() - new Date(a.dataGasto).getTime());

      if (gastosDaConta.length > 0) {
        return (gastosDaConta[0].saldo && gastosDaConta[0].saldo !== 0) ? gastosDaConta[0].saldo : calculateFallbackBalance(gastosDaConta);
      }
      return 0;
    } else {
      // Para todas as contas: soma o último saldo de cada conta existente
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

  currentBank = computed(() => {
    const selectedId = this.contaSelecionadaId;
    if (!selectedId) return 'GERAL';
    const conta = this.contas().find(c => c.id === Number(selectedId));
    return conta?.banco?.toUpperCase() || 'GERAL';
  });

  isUploadingExtrato = signal(false);

  userName = localStorage.getItem('username') || 'Usuário';

  showModal = false;
  isEditing = false;
  selectedExpenseId: number | null = null;

  novoGasto = {
    descricao: '',
    categoria: 'Outros',
    valor: 0,
    tipo: 'DESPESA',
    status: 'Pago',
    numeroParcelas: 1,
    valorParcela: 0
  };

  ngOnInit() {
    this.contaService.getContas().subscribe({
      next: (data: any) => {
        this.contas.set(data);
        // Se já existe uma conta selecionada no serviço (vinda de outra tela), mantém.
        // Caso contrário, tenta selecionar a primeira conta.
        if (this.contaSelecionadaId === null && data.length > 0) {
          this.contaSelecionadaId = data[0].id ?? null;
        }
        this.loadDashboardData();
      },
      error: (err) => {
        console.error('Erro ao carregar contas:', err);
        this.loadDashboardData();
      }
    });
  }

  loadDashboardData() {
    const bank = this.currentBank();

    if (bank === 'NUBANK') {
      this.transactionService.getTransactions(this.contaSelecionadaId).subscribe({
        next: (res) => {
          const mapped = res.map(t => ({
            ...t,
            dataGasto: t.dataHora,
            descricao: t.tituloExibicao,
            tipo: t.tipoMovimentacao === 'ENTRADA' || t.tipoMovimentacao === 'RENDIMENTO' ? 'RECEITA' : 'DESPESA',
            saldo: t.saldoMomento,
            favorecido: t.nomeContraparte,
            formaPagamento: t.formaPagamento
          }));
          this.expenses.set(mapped);

          // KPIs para Nubank
          const despesas = mapped.filter(m => m.tipo === 'DESPESA');
          const totalValor = despesas.reduce((acc, curr) => acc + (curr.valor || 0), 0);
          this.stats.set({
            totalGastos: despesas.length,
            valorTotal: totalValor,
            gastoFixoMensal: 0
          });
        },
        error: (err) => console.error('Erro ao carregar transações Nubank:', err)
      });
    } else if (bank === 'GERAL') {
      forkJoin({
        gastos: this.expenseService.getExpenses(null),
        transacoes: this.transactionService.getTransactions(null)
      }).subscribe({
        next: ({ gastos, transacoes }) => {
          const mappedTransacoes = transacoes.map(t => ({
            ...t,
            dataGasto: t.dataHora,
            descricao: t.tituloExibicao,
            tipo: t.tipoMovimentacao === 'ENTRADA' || t.tipoMovimentacao === 'RENDIMENTO' ? 'RECEITA' : 'DESPESA',
            saldo: t.saldoMomento,
            favorecido: t.nomeContraparte,
            formaPagamento: t.formaPagamento
          }));
          const combined = [...gastos, ...mappedTransacoes];

          // Sort by date desc
          combined.sort((a, b) => {
            const timeA = a.dataGasto ? new Date(a.dataGasto).getTime() : 0;
            const timeB = b.dataGasto ? new Date(b.dataGasto).getTime() : 0;
            return timeB - timeA;
          });

          this.expenses.set(combined);

          // Combined KPIs
          const despesas = combined.filter(m => m.tipo === 'DESPESA');
          const totalValorDespesas = despesas.reduce((acc, curr) => acc + (curr.valor || 0), 0);

          this.expenseService.getKpis(null).subscribe({
            next: (data) => {
              this.stats.set({
                totalGastos: despesas.length,
                valorTotal: totalValorDespesas,
                gastoFixoMensal: data.gastoFixoMensal || 0
              });
            },
            error: (err) => {
              this.stats.set({
                totalGastos: despesas.length,
                valorTotal: totalValorDespesas,
                gastoFixoMensal: 0
              });
            }
          });
        },
        error: (err) => console.error('Erro ao buscar dados mesclados:', err)
      });
    } else {
      this.expenseService.getExpenses(this.contaSelecionadaId).subscribe({
        next: (data) => this.expenses.set(data),
        error: (err) => console.error('Erro ao buscar gastos', err)
      });

      this.expenseService.getKpis(this.contaSelecionadaId).subscribe({
        next: (data) => {
          this.stats.set({
            totalGastos: data.totalGastos,
            valorTotal: data.valorTotal,
            gastoFixoMensal: data.gastoFixoMensal || 0
          });
        },
        error: (err) => console.error('Erro ao buscar estatísticas', err)
      });
    }
  }

  onContaChange() {
    this.loadDashboardData();
  }

  abrirModalParaNovo() {
    this.isEditing = false;
    this.selectedExpenseId = null;
    this.novoGasto = { descricao: '', categoria: 'Outros', valor: 0, tipo: 'DESPESA', status: 'Pago', numeroParcelas: 1, valorParcela: 0 };
    this.showModal = true;
  }

  abrirModalParaEditar(gasto: any) {
    this.isEditing = true;
    this.selectedExpenseId = gasto.id;
    this.novoGasto = {
      descricao: gasto.descricao,
      categoria: gasto.categoria || 'Outros',
      valor: gasto.valor,
      tipo: gasto.tipo || 'DESPESA',
      status: gasto.status || 'Pago',
      numeroParcelas: gasto.numeroParcelas || 1,
      valorParcela: gasto.valorParcela || 0
    };
    this.showModal = true;
  }

  calcularTotal() {
    if (this.novoGasto.status === 'Parcelado') {
      this.novoGasto.valor = (this.novoGasto.numeroParcelas || 0) * (this.novoGasto.valorParcela || 0);
    }
  }

  salvarGasto() {
    this.calcularTotal();

    if (this.novoGasto.descricao && this.novoGasto.valor > 0) {
      const descricaoFormatada = this.novoGasto.descricao.charAt(0).toUpperCase() + this.novoGasto.descricao.slice(1);
      const gastoParaSalvar: any = { ...this.novoGasto, descricao: descricaoFormatada };

      if (this.contaSelecionadaId) {
        gastoParaSalvar.contaId = this.contaSelecionadaId;
      }

      if (this.isEditing && this.selectedExpenseId) {
        this.expenseService.updateExpense(this.selectedExpenseId, gastoParaSalvar).subscribe({
          next: () => this.finalizarOperacao(),
          error: (err) => alert('Erro ao atualizar: ' + err.message)
        });
      } else {
        this.expenseService.createExpense(gastoParaSalvar).subscribe({
          next: () => this.finalizarOperacao(),
          error: (err) => alert('Erro ao salvar: ' + err.message)
        });
      }
    }
  }

  deletarGasto(id: number) {
    if (confirm('Tem certeza que deseja excluir este gasto?')) {
      this.expenseService.deleteExpense(id).subscribe({
        next: () => this.loadDashboardData(),
        error: (err) => alert('Erro ao excluir: ' + err.message)
      });
    }
  }

  private finalizarOperacao() {
    this.showModal = false;
    this.novoGasto = { descricao: '', categoria: 'Outros', valor: 0, tipo: 'DESPESA', status: 'Pago', numeroParcelas: 1, valorParcela: 0 };
    this.loadDashboardData();
  }

  logout() {
    this.authService.logout();
    this.router.navigate(['/login']);
  }

  toggleSidebar() {
    this.sidebarService.toggle();
  }

  onFileSelected(event: any) {
    if (this.contas().length === 0) {
      alert('Você precisa registrar uma conta bancária na aba "Contas" antes de importar um extrato.');
      return;
    }
    const file = event.target.files[0];
    if (file && this.contaSelecionadaId) {
      this.isUploadingExtrato.set(true);
      this.expenseService.uploadExtrato(file, this.contaSelecionadaId.toString(), this.currentBank()).subscribe({
        next: (res) => {
          this.isUploadingExtrato.set(false);
          alert('Extrato processado com sucesso!');
          this.loadDashboardData();
        },
        error: (err) => {
          this.isUploadingExtrato.set(false);
          alert('Erro ao processar extrato: ' + (err.error?.error || err.message));
        }
      });
      // Reseta o input para permitir enviar o mesmo arquivo novamente se necessário
      event.target.value = '';
    } else if (!this.contaSelecionadaId) {
      alert('Por favor, selecione uma conta bancária primeiro.');
    }
  }

  exportToCSV() {
    const data = this.expenses();
    if (!data || data.length === 0) {
      alert('Não há dados para exportar.');
      return;
    }

    const colunas = ['ID', 'TIPO', 'CATEGORIA', 'DESCRIÇÃO', 'FAVORECIDO', 'CPF/CNPJ', 'Nº DOC', 'STATUS', 'VALOR', 'DATA'];

    // Adiciona o BOM (\uFEFF) para o Excel reconhecer acentuação corretamente
    let csvContent = '\uFEFF';
    csvContent += colunas.join(';') + '\r\n';

    data.forEach(item => {
      // Força o status correto baseado no tipo para o CSV
      let statusAmigavel = item.status;
      if (item.tipo === 'RECEITA') {
        statusAmigavel = 'Recebido';
      } else if (!statusAmigavel || statusAmigavel === 'Recebido') {
        statusAmigavel = 'Pago';
      }

      // Adiciona sinal ao valor para facilitar leitura no Excel
      const sinal = item.tipo === 'RECEITA' ? '' : '-';
      const valorFormatado = item.valor ? `${sinal}${item.valor.toString().replace('.', ',')}` : '0,00';

      const row = [
        item.id,
        item.tipo || 'DESPESA',
        `"${item.categoria || 'Outros'}"`,
        `"${item.descricao ? item.descricao.replace(/"/g, '""') : ''}"`,
        `"${item.favorecido ? item.favorecido.replace(/"/g, '""') : ''}"`,
        `"${item.cpfCnpj || ''}"`,
        `"${item.nrDoc || ''}"`,
        statusAmigavel,
        valorFormatado,
        item.dataGasto ? new Date(item.dataGasto).toLocaleString('pt-BR') : ''
      ];
      csvContent += row.join(';') + '\r\n';
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `extrato_financeiro_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }
}
