import { Component, inject, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../services/auth.service';
import { SidebarService } from '../../services/sidebar.service';
import { ExpenseService } from '../../services/expense.service';
import { ContaService } from '../../services/conta.service';
import { TransactionService } from '../../services/transaction.service';

@Component({
  selector: 'app-transacoes',
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule],
  templateUrl: './transacoes.html',
  styleUrls: ['./transacoes.css']
})
export class Transacoes implements OnInit {
  private router = inject(Router);
  private authService = inject(AuthService);
  public sidebarService = inject(SidebarService);
  private expenseService = inject(ExpenseService);
  private contaService = inject(ContaService);
  private transactionService = inject(TransactionService);

  userName = localStorage.getItem('username') || 'Usuário';
  transacoes = signal<any[]>([]);
  contas = signal<any[]>([]);

  get contaSelecionadaId() {
    return this.contaService.selectedContaId();
  }

  set contaSelecionadaId(val: any) {
    const id = (val === 'null' || val === null) ? null : Number(val);
    this.contaService.selectedContaId.set(id);
  }

  categoriaSelecionada = signal<string>('Todas');
  dataInicio = signal<string>('');
  dataFim = signal<string>('');

  currentBank = computed(() => {
    const selectedId = this.contaSelecionadaId;
    if (!selectedId) return 'GERAL';
    const conta = this.contas().find(c => c.id === Number(selectedId));
    return conta?.banco?.toUpperCase() || 'GERAL';
  });

  saldoTotal = computed(() => {
    const list = this.transacoesFiltradas();
    const allContas = this.contas();
    const selectedId = this.contaSelecionadaId;

    if (selectedId) {
      // Pega o saldo do lançamento mais recente da conta selecionada (dentro do filtro)
      const gastosDaConta = list
        .filter(t => (t.contaId === Number(selectedId) || t.conta?.id === Number(selectedId)))
        .sort((a, b) => new Date(b.dataGasto).getTime() - new Date(a.dataGasto).getTime());

      return gastosDaConta.length > 0 ? (gastosDaConta[0].saldo || 0) : 0;
    } else {
      // Soma o saldo mais recente de cada conta
      let total = 0;
      allContas.forEach(conta => {
        const gastosDaConta = list
          .filter(t => (t.contaId === conta.id || t.conta?.id === conta.id))
          .sort((a, b) => new Date(b.dataGasto).getTime() - new Date(a.dataGasto).getTime());

        if (gastosDaConta.length > 0) {
          total += (gastosDaConta[0].saldo || 0);
        }
      });
      return total;
    }
  });

  transacoesFiltradas = computed(() => {
    let list = this.transacoes();
    const cat = this.categoriaSelecionada();
    const inicio = this.dataInicio();
    const fim = this.dataFim();

    if (cat !== 'Todas') {
      list = list.filter(t => t.categoria === cat);
    }

    if (inicio) {
      const dateInicio = new Date(inicio);
      dateInicio.setHours(0, 0, 0, 0);
      list = list.filter(t => new Date(t.dataGasto).getTime() >= dateInicio.getTime());
    }

    if (fim) {
      const dateFim = new Date(fim);
      dateFim.setHours(23, 59, 59, 999);
      list = list.filter(t => new Date(t.dataGasto).getTime() <= dateFim.getTime());
    }

    return list;
  });

  showModal = false;
  isEditing = false;
  selectedExpenseId: number | null = null;

  novoGasto: any = {
    descricao: '',
    categoria: 'Outros',
    valor: 0,
    tipo: 'DESPESA',
    status: 'Pago',
    numeroParcelas: 1,
    valorParcela: 0,
    favorecido: '',
    nrDoc: '',
    cpfCnpj: '',
    formaPagamento: '',
    saldo: 0
  };

  ngOnInit() {
    this.userName = localStorage.getItem('username') || 'Usuário';
    this.loadContas();
  }

  loadContas() {
    this.contaService.getContas().subscribe({
      next: (res) => {
        this.contas.set(res);
        if (this.contaSelecionadaId === null && res.length > 0) {
          this.contaSelecionadaId = res[0].id ?? null;
        }
        this.loadTransacoes();
      },
      error: (err) => {
        console.error('Erro ao carregar contas:', err);
        this.loadTransacoes();
      }
    });
  }

  loadTransacoes() {
    const bank = this.currentBank();

    if (bank === 'NUBANK') {
      this.transactionService.getTransactions(this.contaSelecionadaId).subscribe({
        next: (res) => {
          const mapped = res.map(t => ({
            ...t,
            dataGasto: t.dataHora, // Compatibilidade com o template
            descricao: t.tituloExibicao,
            tipo: t.tipoMovimentacao,
            saldo: t.saldoMomento,
            favorecido: t.nomeContraparte,
            formaPagamento: t.formaPagamento
          }));
          this.sortAndSetTransacoes(mapped);
        },
        error: (err) => console.error('Erro ao carregar transações Nubank:', err)
      });
    } else {
      this.expenseService.getExpenses(this.contaSelecionadaId).subscribe({
        next: (res) => this.sortAndSetTransacoes(res),
        error: (err) => console.error('Erro ao carregar transações:', err)
      });
    }
  }

  private sortAndSetTransacoes(res: any[]) {
    const sorted = res.sort((a: any, b: any) => {
      const timeA = a.dataGasto ? new Date(a.dataGasto).getTime() : 0;
      const timeB = b.dataGasto ? new Date(b.dataGasto).getTime() : 0;
      return timeB - timeA;
    });
    this.transacoes.set(sorted);
  }

  onFileSelected(event: any) {
    const file: File = event.target.files[0];
    const contaId = this.contaSelecionadaId;

    if (file && contaId) {
      if (this.currentBank() === 'NUBANK') {
        this.transactionService.importNubank(file, contaId).subscribe({
          next: () => {
            alert('Extrato Nubank importado!');
            this.loadTransacoes();
          },
          error: (err) => alert('Erro ao importar Nubank: ' + err.message)
        });
      } else {
        this.expenseService.uploadExtrato(file, contaId.toString(), this.currentBank()).subscribe({
          next: () => {
            alert('Extrato importado!');
            this.loadTransacoes();
          },
          error: (err) => alert('Erro ao importar: ' + err.message)
        });
      }
    }
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
      valorParcela: gasto.valorParcela || 0,
      favorecido: gasto.favorecido || '',
      nrDoc: gasto.nrDoc || '',
      cpfCnpj: gasto.cpfCnpj || '',
      formaPagamento: gasto.formaPagamento || '',
      saldo: gasto.saldo || 0
    };
    this.showModal = true;
  }

  abrirModalParaNovo() {
    this.isEditing = false;
    this.selectedExpenseId = null;
    this.novoGasto = {
      descricao: '',
      categoria: 'Outros',
      valor: 0,
      tipo: 'DESPESA',
      status: 'Pago',
      numeroParcelas: 1,
      valorParcela: 0,
      favorecido: '',
      nrDoc: '',
      cpfCnpj: '',
      formaPagamento: '',
      saldo: 0
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
      const gastoParaSalvar: any = {
        ...this.novoGasto,
        descricao: descricaoFormatada,
        contaId: this.contaSelecionadaId
      };

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
    if (confirm('Tem certeza que deseja excluir esta transação?')) {
      if (this.currentBank() === 'NUBANK') {
        this.transactionService.deleteTransaction(id).subscribe({
          next: () => this.loadTransacoes(),
          error: (err) => alert('Erro ao excluir: ' + err.message)
        });
      } else {
        this.expenseService.deleteExpense(id).subscribe({
          next: () => this.loadTransacoes(),
          error: (err) => alert('Erro ao excluir: ' + err.message)
        });
      }
    }
  }

  private finalizarOperacao() {
    this.showModal = false;
    this.novoGasto = { descricao: '', categoria: 'Outros', valor: 0, tipo: 'DESPESA', status: 'Pago', numeroParcelas: 1, valorParcela: 0 };
    this.loadTransacoes();
  }

  toggleSidebar() {
    this.sidebarService.toggle();
  }

  logout() {
    this.authService.logout();
    this.router.navigate(['/login']);
  }
}
