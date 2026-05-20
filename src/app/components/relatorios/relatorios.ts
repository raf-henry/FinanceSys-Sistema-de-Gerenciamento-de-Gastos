import { Component, inject, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../services/auth.service';
import { SidebarService } from '../../services/sidebar.service';
import { FinanceStoreService } from '../../services/finance-store.service';

import { BaseChartDirective } from 'ng2-charts';
import { ChartConfiguration } from 'chart.js';

@Component({
  selector: 'app-relatorios',
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule, BaseChartDirective],
  templateUrl: './relatorios.html',
  styleUrls: ['./relatorios.css']
})
export class Relatorios implements OnInit {
  private router = inject(Router);
  private authService = inject(AuthService);
  public sidebarService = inject(SidebarService);
  public financeStore = inject(FinanceStoreService);

  userName = localStorage.getItem('username') || 'Usuário';

  // Opções e filtros locais
  periodos = ['Esta Semana', 'Este Mês', 'Este Ano', 'Todos'];

  // Vinculações diretas aos signals da store
  get loading() { return this.financeStore.loading; }
  get error() { return this.financeStore.error; }
  get contas() { return this.financeStore.contas; }
  get transacoes() { return this.financeStore.expenses; }
  get transacoesFiltradasPeriodo() { return this.financeStore.transacoesFiltradasPeriodo; }
  get totalEntradas() { return this.financeStore.totalEntradas; }
  get totalSaidas() { return this.financeStore.totalSaidas; }
  get saldoLiquido() { return this.financeStore.saldoLiquido; }

  // Filtros vinculados ao ngModel do template
  get periodoFiltro() { return this.financeStore.periodoFiltro; }
  get searchText() { return this.financeStore.searchText; }

  get contaSelecionadaId() {
    return this.financeStore.selectedContaId();
  }

  set contaSelecionadaId(val: any) {
    const id = (val === 'null' || val === null) ? null : Number(val);
    this.financeStore.setSelectedContaId(id);
  }

  get currentBank() {
    return this.financeStore.currentBank();
  }

  chartOptions: ChartConfiguration['options'] = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        mode: 'index',
        intersect: false,
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        titleFont: { size: 14, family: "'Inter', sans-serif" },
        bodyFont: { size: 13, family: "'Inter', sans-serif" },
        padding: 12,
        cornerRadius: 8,
        callbacks: {
          label: function (context) {
            let label = context.dataset.label || '';
            if (label) { label += ': '; }
            if (context.parsed.y !== null) {
              label += new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(context.parsed.y);
            }
            return label;
          }
        }
      }
    },
    scales: {
      x: { grid: { display: false }, ticks: { font: { family: "'Inter', sans-serif", weight: 'bold' }, color: '#64748b' } },
      y: { grid: { color: 'rgba(0, 0, 0, 0.05)' }, ticks: { font: { family: "'Inter', sans-serif" }, color: '#64748b' } }
    },
    interaction: { mode: 'index', intersect: false }
  };

  chartData = computed<ChartConfiguration['data']>(() => {
    const list = this.transacoesFiltradasPeriodo();
    const periodo = this.periodoFiltro();
    let buckets: { label: string, entradas: number, saidas: number }[] = [];

    const isEntrada = (t: any) => {
      const tipo = (t.tipo || '').toUpperCase();
      const tipoMov = (t.tipoMovimentacao || '').toUpperCase();
      return tipo === 'RECEITA' || tipo === 'ENTRADA' || tipo === 'RENDIMENTO' ||
        tipoMov === 'ENTRADA' || tipoMov === 'RENDIMENTO';
    };

    if (periodo === 'Esta Semana') {
      const days = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
      buckets = days.map(d => ({ label: d, entradas: 0, saidas: 0 }));
      list.forEach(t => {
        const parsed = this.financeStore.parseDateSeguro(t.dataGasto);
        if (!parsed || isNaN(parsed.getTime())) return;
        const d = parsed.getDay();
        if (d >= 0 && d < buckets.length) {
          if (isEntrada(t)) buckets[d].entradas += this.financeStore.safeNumber(t.valor);
          else buckets[d].saidas += this.financeStore.safeNumber(t.valor);
        }
      });
    } else if (periodo === 'Este Mês') {
      buckets = [
        { label: 'Semana 1', entradas: 0, saidas: 0 },
        { label: 'Semana 2', entradas: 0, saidas: 0 },
        { label: 'Semana 3', entradas: 0, saidas: 0 },
        { label: 'Semana 4', entradas: 0, saidas: 0 },
        { label: 'Semana 5', entradas: 0, saidas: 0 },
      ];
      list.forEach(t => {
        const parsed = this.financeStore.parseDateSeguro(t.dataGasto);
        if (!parsed || isNaN(parsed.getTime())) return;
        const d = parsed.getDate();
        const week = Math.min(4, Math.floor((d - 1) / 7));
        if (week >= 0 && week < buckets.length) {
          if (isEntrada(t)) buckets[week].entradas += this.financeStore.safeNumber(t.valor);
          else buckets[week].saidas += this.financeStore.safeNumber(t.valor);
        }
      });
      if (buckets[4].entradas === 0 && buckets[4].saidas === 0) {
        buckets.pop();
      }
    } else if (periodo === 'Este Ano') {
      const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
      buckets = months.map(m => ({ label: m, entradas: 0, saidas: 0 }));
      list.forEach(t => {
        const parsed = this.financeStore.parseDateSeguro(t.dataGasto);
        if (!parsed || isNaN(parsed.getTime())) return;
        const m = parsed.getMonth();
        if (m >= 0 && m < buckets.length) {
          if (isEntrada(t)) buckets[m].entradas += this.financeStore.safeNumber(t.valor);
          else buckets[m].saidas += this.financeStore.safeNumber(t.valor);
        }
      });
    } else {
      const yearsMap = new Map<number, { entradas: number, saidas: number }>();
      list.forEach(t => {
        const parsed = this.financeStore.parseDateSeguro(t.dataGasto);
        if (!parsed || isNaN(parsed.getTime())) return;
        const y = parsed.getFullYear();
        if (!yearsMap.has(y)) yearsMap.set(y, { entradas: 0, saidas: 0 });
        if (isEntrada(t)) yearsMap.get(y)!.entradas += this.financeStore.safeNumber(t.valor);
        else yearsMap.get(y)!.saidas += this.financeStore.safeNumber(t.valor);
      });
      const sortedYears = Array.from(yearsMap.keys()).sort();
      buckets = sortedYears.map(y => ({
        label: y.toString(),
        entradas: yearsMap.get(y)!.entradas,
        saidas: yearsMap.get(y)!.saidas
      }));
      if (buckets.length === 0) {
        buckets.push({ label: new Date().getFullYear().toString(), entradas: 0, saidas: 0 });
      }
    }

    return {
      labels: buckets.map(b => b.label),
      datasets: [
        {
          data: buckets.map(b => b.entradas),
          label: 'Receitas',
          backgroundColor: '#10B981',
          hoverBackgroundColor: '#059669',
          borderRadius: 6,
          barPercentage: 0.6,
          categoryPercentage: 0.8
        },
        {
          data: buckets.map(b => b.saidas),
          label: 'Despesas',
          backgroundColor: '#EF4444',
          hoverBackgroundColor: '#DC2626',
          borderRadius: 6,
          barPercentage: 0.6,
          categoryPercentage: 0.8
        }
      ]
    };
  });

  ngOnInit() {
    this.userName = localStorage.getItem('username') || 'Usuário';
    this.financeStore.init();
  }

  loadTransacoes() {
    this.financeStore.loadExpenses();
  }

  retryLoad() {
    this.financeStore.loadContas();
  }

  toggleSidebar() {
    this.sidebarService.toggle();
  }

  logout() {
    this.authService.logout();
    this.router.navigate(['/login']);
  }
}

