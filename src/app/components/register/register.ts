import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './register.html',
  styleUrl: './register.css',
})
export class Register {
  private authService = inject(AuthService);
  private router = inject(Router);

  isModalOpen = signal(false);
  isLoading = signal(false);
  errorMessage = signal('');
  demoCode = signal('');

  registerData = {
    email: '',
    code: '',
    password: '',
    confirmPassword: ''
  };

  /**
   * Verifica se a senha tem o tamanho mínimo de 8 caracteres.
   */
  checkMinLength(): boolean {
    return this.registerData.password.length >= 8;
  }

  /**
   * Verifica se a senha possui ao menos um número e um símbolo.
   */
  checkNumberSymbol(): boolean {
    const p = this.registerData.password;
    return /\d/.test(p) && /[#@$!%*?&]/.test(p);
  }

  sendCode() {
    if (!this.registerData.email || !this.registerData.password) {
      this.errorMessage.set('Preencha todos os campos.');
      return;
    }

    const emailPattern = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!emailPattern.test(this.registerData.email)) {
      this.errorMessage.set('Por favor, insira um e-mail válido (ex: seu@email.com).');
      return;
    }

    // Validação de senha simplificada (deve coincidir com o Backend)
    const passwordPattern = /^(?=.*\d)(?=.*[#@$!%*?&])[A-Za-z\d#@$!%*?&]{8,}$/;
    if (!passwordPattern.test(this.registerData.password)) {
      this.errorMessage.set('A senha deve ter pelo menos 8 caracteres, incluindo um número e um caractere especial (#@$!%*?&).');
      return;
    }

    if (this.registerData.password !== this.registerData.confirmPassword) {
      this.errorMessage.set('As senhas não coincidem!');
      return;
    }

    this.isLoading.set(true);
    this.errorMessage.set('');

    this.authService.sendVerificationCode(this.registerData.email).subscribe({
      next: (res: any) => {
        console.log('Resposta do servidor (send-code):', res);
        if (res.demoCode) {
          this.demoCode.set(res.demoCode);
          console.log('Código de demonstração definido:', res.demoCode);
        }
        this.isModalOpen.set(true);
        this.isLoading.set(false);
      },
      error: (err) => {
        console.error('Erro ao enviar código:', err);
        this.errorMessage.set(err.error?.error || 'Erro ao enviar código. Tente novamente.');
        this.isLoading.set(false);
      }
    });
  }

  onSubmit() {
    this.isLoading.set(true);
    this.errorMessage.set('');

    const { email, password, code } = this.registerData;
    console.log('Finalizando registro para:', email);

    this.authService.register({ email, password, code }).subscribe({
      next: (response) => {
        this.isModalOpen.set(false);
        alert('Cadastro realizado e autenticado com sucesso!');
        this.router.navigate(['/home']);
      },
      error: (err) => {
        this.errorMessage.set(err.error?.error || 'Código inválido. Verifique e tente novamente.');
        this.isLoading.set(false);
      }
    });
  }
}
