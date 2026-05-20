import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../services/auth.service';
import { SidebarService } from '../../services/sidebar.service';
import { SettingsService } from '../../services/settings.service';

@Component({
  selector: 'app-configuracoes',
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule],
  templateUrl: './configuracoes.html',
  styleUrls: ['./configuracoes.css']
})
export class Configuracoes {
  private router = inject(Router);
  private authService = inject(AuthService);
  public sidebarService = inject(SidebarService);
  private settingsService = inject(SettingsService);

  userName = localStorage.getItem('username') || 'Usuário';

  // State
  activeSection = signal<'menu' | 'password' | 'email'>('menu');

  // Password form
  currentPasswordForPw = '';
  newPassword = '';
  confirmPassword = '';
  passwordLoading = signal(false);
  passwordMessage = signal<{ type: 'success' | 'error'; text: string } | null>(null);
  showCurrentPw = false;
  showNewPw = false;
  showConfirmPw = false;

  // Email form
  currentPasswordForEmail = '';
  newEmail = '';
  confirmEmail = '';
  emailLoading = signal(false);
  emailMessage = signal<{ type: 'success' | 'error'; text: string } | null>(null);

  checkingEmail = signal(false);
  emailError = signal<string | null>(null);

  changePassword() {
    this.passwordMessage.set(null);

    if (!this.currentPasswordForPw || !this.newPassword || !this.confirmPassword) {
      this.passwordMessage.set({ type: 'error', text: 'Preencha todos os campos.' });
      return;
    }

    if (this.newPassword.length < 6) {
      this.passwordMessage.set({ type: 'error', text: 'A nova senha deve ter pelo menos 6 caracteres.' });
      return;
    }

    if (this.newPassword !== this.confirmPassword) {
      this.passwordMessage.set({ type: 'error', text: 'As senhas não coincidem.' });
      return;
    }

    this.passwordLoading.set(true);
    this.settingsService.changePassword(this.currentPasswordForPw, this.newPassword).subscribe({
      next: () => {
        this.passwordMessage.set({ type: 'success', text: 'Senha alterada com sucesso!' });
        this.currentPasswordForPw = '';
        this.newPassword = '';
        this.confirmPassword = '';
        this.passwordLoading.set(false);
      },
      error: (err) => {
        const msg = err.error?.error || 'Erro ao alterar a senha.';
        this.passwordMessage.set({ type: 'error', text: msg });
        this.passwordLoading.set(false);
      }
    });
  }

  changeEmail() {
    this.emailMessage.set(null);

    if (!this.currentPasswordForEmail || !this.newEmail || !this.confirmEmail) {
      this.emailMessage.set({ type: 'error', text: 'Preencha todos os campos.' });
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(this.newEmail)) {
      this.emailMessage.set({ type: 'error', text: 'E-mail inválido.' });
      return;
    }

    if (this.newEmail !== this.confirmEmail) {
      this.emailMessage.set({ type: 'error', text: 'Os e-mails não coincidem.' });
      return;
    }

    this.emailLoading.set(true);
    this.settingsService.changeEmail(this.currentPasswordForEmail, this.newEmail).subscribe({
      next: (res) => {
        if (res.token) {
          localStorage.setItem('auth_token', res.token);
        }
        if (res.username) {
          localStorage.setItem('username', res.username);
          this.userName = res.username;
        }
        this.emailMessage.set({ type: 'success', text: 'E-mail alterado com sucesso!' });
        this.currentPasswordForEmail = '';
        this.newEmail = '';
        this.confirmEmail = '';
        this.emailLoading.set(false);
      },
      error: (err) => {
        const msg = err.error?.error || 'Erro ao alterar o e-mail.';
        this.emailMessage.set({ type: 'error', text: msg });
        this.emailLoading.set(false);
      }
    });
  }

  checkEmailAvailability() {
    this.emailError.set(null);
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!this.newEmail) {
      return;
    }

    if (!emailRegex.test(this.newEmail)) {
      this.emailError.set('Formato de e-mail inválido.');
      return;
    }

    if (this.newEmail === this.userName) {
      this.emailError.set('Este já é o seu e-mail atual.');
      return;
    }

    this.checkingEmail.set(true);
    this.settingsService.checkEmail(this.newEmail).subscribe({
      next: (res) => {
        if (res.exists) {
          this.emailError.set('Este e-mail já está em uso por outra conta.');
        }
        this.checkingEmail.set(false);
      },
      error: () => {
        this.checkingEmail.set(false);
      }
    });
  }

  goBack() {
    this.activeSection.set('menu');
    this.passwordMessage.set(null);
    this.emailMessage.set(null);
  }

  toggleSidebar() {
    this.sidebarService.toggle();
  }

  logout() {
    this.authService.logout();
    this.router.navigate(['/login']);
  }
}
