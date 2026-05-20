import { Component, inject, signal, OnInit, computed } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { ExpenseService } from '../../services/expense.service';
import { ContaService, Conta } from '../../services/conta.service';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SidebarService } from '../../services/sidebar.service';

@Component({
  selector: 'app-contas',
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule],
  templateUrl: './contas.html',
  styleUrls: ['./contas.css']
})
export class Contas implements OnInit {
  private router = inject(Router);
  private authService = inject(AuthService);
  private expenseService = inject(ExpenseService);
  private contaService = inject(ContaService);
  public sidebarService = inject(SidebarService);

  userName = localStorage.getItem('username') || 'Usuário';

  expenses = signal<any[]>([]);
  contas = this.contaService.contas;

  exibirModalNovaConta = signal(false);
  novaConta: Conta = {
    nome: '',
    banco: 'CAIXA',
    tipo: 'Conta Corrente',
    cor: '#005CA9',
    icone: 'account_balance'
  };

  // Somatório Total (Soma o último saldo de cada conta)
  totalEmBancos = computed(() => {
    let total = 0;
    this.contas().forEach(conta => {
      const gastosDaConta = this.expenses()
        .filter((g: any) => g.conta?.id === conta.id)
        .sort((a: any, b: any) => new Date(b.dataGasto).getTime() - new Date(a.dataGasto).getTime());

      if (gastosDaConta.length > 0) {
        total += gastosDaConta[0].saldo || 0;
      }
    });
    return total;
  });

  // Lista de contas com seus saldos atuais
  bancos = computed(() => {
    return this.contas().map(conta => {
      const gastosDaConta = this.expenses()
        .filter((g: any) => g.conta?.id === conta.id)
        .sort((a: any, b: any) => new Date(b.dataGasto).getTime() - new Date(a.dataGasto).getTime());

      return {
        id: conta.id,
        nome: conta.nome,
        banco: conta.banco,
        saldo: gastosDaConta.length > 0 ? (gastosDaConta[0].saldo || 0) : 0,
        cor: conta.cor,
        icone: conta.icone
      };
    });
  });

  ngOnInit() {
    this.userName = localStorage.getItem('username') || 'Usuário';
    this.expenseService.getExpenses().subscribe({
      next: (res) => this.expenses.set(res)
    });
    this.contaService.getContas().subscribe();
  }

  abrirModal() {
    this.exibirModalNovaConta.set(true);
  }

  fecharModal() {
    this.exibirModalNovaConta.set(false);
  }

  salvarConta() {
    if (this.novaConta.nome) {
      // Define a cor baseada no banco selecionado
      switch (this.novaConta.banco) {
        case 'NUBANK':
          this.novaConta.cor = '#8A05BE'; // Roxo Nubank
          break;
        case 'PICPAY':
          this.novaConta.cor = '#2EDB6C'; // Verde PicPay
          break;
        case 'ITAÚ':
          this.novaConta.cor = '#FF8200'; // Laranja Itaú
          break;
        case 'CAIXA':
          this.novaConta.cor = '#005CA9'; // Azul Caixa
          break;
        default:
          this.novaConta.cor = '#475569'; // Cinza padrão
      }

      this.contaService.criarConta(this.novaConta).subscribe({
        next: () => {
          this.fecharModal();
          this.novaConta = { nome: '', banco: 'CAIXA', tipo: 'Conta Corrente', cor: '#005CA9', icone: 'account_balance' };
        }
      });
    }
  }

  deletarConta(id: number) {
    if (confirm('Deseja realmente excluir este perfil de conta?')) {
      this.contaService.deletarConta(id).subscribe();
    }
  }

  toggleSidebar() {
    this.sidebarService.toggle();
  }

  logout() {
    this.authService.logout();
    this.router.navigate(['/login']);
  }
}
