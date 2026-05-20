# FinanceSys

![Java](https://img.shields.io/badge/java-%23ED8B00.svg?style=for-the-badge&logo=openjdk&logoColor=white)
![TypeScript](https://img.shields.io/badge/typescript-%23007ACC.svg?style=for-the-badge&logo=typescript&logoColor=white)
![Angular](https://img.shields.io/badge/Angular-DD0031?style=for-the-badge&logo=angular&logoColor=white)
![Spring Boot](https://img.shields.io/badge/Spring_Boot-6DB33F?style=for-the-badge&logo=spring-boot&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/postgres-%23316192.svg?style=for-the-badge&logo=postgresql&logoColor=white)
![Google Gemini](https://img.shields.io/badge/Google_Gemini-4285F4?style=for-the-badge&logo=google&logoColor=white)
![Vercel](https://img.shields.io/badge/vercel-%23000000.svg?style=for-the-badge&logo=vercel&logoColor=white)
![Render](https://img.shields.io/badge/Render-%2346E3B7.svg?style=for-the-badge&logo=render&logoColor=white)

FinanceSys é uma plataforma de gestão financeira de alto nível que combina a robustez do ecossistema Java (Spring Boot) com a modernidade do Angular. Projetado com uma estética Premium SaaS, o sistema oferece uma experiência fluida, responsiva e inteligente para o controle total das suas finanças.

## 🚀 Live Demo (Teste Online)
Acesse a aplicação completa e pronta para teste através do link:
👉 **[https://finance-sys-front-end.vercel.app](https://finance-sys-front-end.vercel.app/)**

## Key Features

- **Importação Inteligente com IA:** Faça o upload do seu extrato bancário em PDF e deixe a IA extrair transações automaticamente (identificando categorias, favorecidos e valores).
- **Dashboards Dinâmicos:** Visão 360º das suas finanças com gráficos interativos e responsivos.
- **Gestão Multi-Contas:** Gerencie Nubank, Itaú, Caixa, PicPay, e outras contas em um único lugar, com categorização de despesas.
- **Controle de Patrimônio:** Acompanhe saldos reais e futuros, exporte relatórios e mantenha seu dinheiro organizado.
- **Interface Mobile-First:** Design premium, com sidebar retrátil, micro-interações, dark/light mode e feedback visual imediato.

---

## Tech Stack

- **Language**: Java 17+ (Backend) & TypeScript (Frontend)
- **Framework (Backend)**: Spring Boot 4.x
- **Framework (Frontend)**: Angular 21+
- **Database**: PostgreSQL (Neon.tech)
- **Database Migrations**: Flyway
- **Styling**: Tailwind CSS v4
- **Security**: Autenticação JWT, Proteção IDOR e Criptografia
- **Deployment**: Vercel (Frontend) & Render (Backend)

---

## Prerequisites

- Node.js 20 or higher
- Java 17 or higher (JDK)
- Maven (ou usar o Wrapper embutido)
- PostgreSQL 15+ (local ou Docker)
- Conta no Google Gemini (se quiser testar a funcionalidade de IA localmente)

---

## Getting Started

### 1. Clone the Repository

```bash
git clone https://github.com/seu-usuario/meu-primeiro-app.git
cd meu-primeiro-app
```

### 2. Install Frontend Dependencies

```bash
npm install
```

### 3. Install Backend Dependencies

Em um novo terminal, vá até a pasta do backend e rode a compilação:

```bash
cd projeto
./mvnw clean install -DskipTests
```

*(No Windows, utilize `mvnw.cmd`)*

### 4. Environment Setup (Backend)

Dentro da pasta `projeto/`, crie o arquivo `.env` (ou `.env.local` dependendo da sua estrutura) e adicione as variáveis de ambiente necessárias.

Exemplo de `.env`:

```env
DB_URL=jdbc:postgresql://localhost:5432/financesys
DB_USER=postgres
DB_PASSWORD=sua_senha
JWT_SECRET=super_secret_key_change_me_in_production
GEMINI_API_KEY=sua_chave_aqui
```

### 5. Database Setup

O projeto utiliza **Flyway** para migrações de banco de dados. 
Quando a aplicação Spring Boot iniciar pela primeira vez, as tabelas serão criadas automaticamente desde que o banco exista.

Se você utilizar Docker para subir um Postgres local:

```bash
docker run --name postgres-financesys -e POSTGRES_PASSWORD=sua_senha -e POSTGRES_DB=financesys -p 5432:5432 -d postgres:15
```

### 6. Start Development Servers

Temos um script automatizado que sobe tanto o Angular quanto o Spring Boot.
Na **raiz do projeto**, basta executar:

```bash
npm run dev
```

Este comando utiliza `concurrently` para rodar `ng serve` (Angular) e `mvnw spring-boot:run` com as variáveis do `.env`.

- Frontend rodará em: [http://localhost:4200](http://localhost:4200)
- Backend (API) rodará em: [http://localhost:8080](http://localhost:8080)

---

## Architecture

O projeto adota uma arquitetura clássica **Monorepo / Fullstack** desacoplada.

### Directory Structure

```text
├── projeto/                 # BACKEND (Spring Boot)
│   ├── src/main/java/       # Código fonte Java (Controllers, Services, Repositories, DTOs, Security)
│   ├── src/main/resources/  # application.properties, Flyway migrations (db/migration/)
│   └── pom.xml              # Dependências do Maven
├── src/                     # FRONTEND (Angular)
│   ├── app/
│   │   ├── components/      # Componentes UI (Home, Transacoes, Relatorios, Auth, etc)
│   │   ├── services/        # Serviços de API e injeção (HTTP calls)
│   │   ├── store/           # Gerenciamento de estado (Signals)
│   │   └── guards/          # Route guards (Auth)
│   ├── styles.css           # Tailwind base & global styles
│   └── main.ts              # Entry point Angular
├── angular.json             # Configuração Angular CLI
└── package.json             # Dependências Node e Scripts
```

### Request Lifecycle

1. Usuário interage com o **Frontend Angular** (ex: Submeter Extrato).
2. Serviço Angular faz um POST HTTP interceptado pelo `AuthInterceptor` (adicionando token JWT se necessário).
3. Rota bate no **Spring Boot Controller** (`GastoController` / `ContaController`).
4. Controller delega a regra de negócio para a camada **Service**.
5. Se for extração de PDF, o serviço envia os dados à API do **Google Gemini**.
6. Dados processados são persistidos via **Spring Data JPA** no **PostgreSQL**.
7. Response retorna ao Frontend, atualizando os *Signals* (estado reativo) na UI instantaneamente.

### Key Components

**Autenticação (`AuthService` / `JwtUtils`)**
- Utiliza **JWT (JSON Web Tokens)**.
- Senhas são hasheadas (Bcrypt).
- O Frontend guarda o token em cache/localStorage e repassa nas chamadas privadas.

**State Management (Frontend)**
- Migrado intensamente para o sistema de **Angular Signals** (`signal()`, `computed()`), garantindo reatividade síncrona sem overhead do Zone.js.

**Importação de PDF**
- Serviço robusto do backend lê arquivos via `MultipartFile`.
- Usa IA multimodal (Gemini) com prompts complexos de engenharia para rotear despesas cruas em JSON tipado.

---

## Environment Variables

### Required (Backend)

| Variable           | Description                                  | How to Get                             |
| ------------------ | -------------------------------------------- | -------------------------------------- |
| `DB_URL`           | PostgreSQL connection string                 | Your database provider (e.g. Neon.tech)|
| `DB_USER`          | PostgreSQL user                              | Database credentials                   |
| `DB_PASSWORD`      | PostgreSQL password                          | Database credentials                   |
| `JWT_SECRET`       | Segredo para assinar os tokens JWT           | Gerar hash forte aleatório             |
| `GEMINI_API_KEY`   | Chave da API Google Gemini para PDFs         | Google AI Studio                       |

---

## Available Scripts

Na **raiz do projeto** (Node):

| Command                       | Description                                         |
| ----------------------------- | --------------------------------------------------- |
| `npm run dev`                 | Inicia o backend e o frontend simultaneamente       |
| `npm start`                   | Inicia apenas o Angular server                      |
| `npm run build`               | Compila o Angular para produção (`/dist`)           |

Na pasta `projeto/` (Maven):

| Command                       | Description                                         |
| ----------------------------- | --------------------------------------------------- |
| `./mvnw spring-boot:run`      | Roda o backend em ambiente de desenvolvimento       |
| `./mvnw clean install`        | Compila e empacota a aplicação num `.jar`           |
| `./mvnw test`                 | Executa os testes unitários/integrados do backend   |

---

## Deployment

A aplicação está atualmente provisionada de forma dividida:

### Frontend: Vercel

A configuração principal é feita via `vercel.json` na raiz do projeto (cuidando do roteamento SPA do Angular):

```json
{
  "rewrites": [
    {
      "source": "/(.*)",
      "destination": "/index.html"
    }
  ]
}
```

Para deploy, basta integrar a raiz do repositório na Vercel definindo os comandos:
- Build command: `npm run build`
- Output directory: `dist/meu-primeiro-app/browser`

### Backend: Render

O backend pode ser implantado usando Docker ou através de Buildpacks de Java (Spring Boot).
- Defina o Root Directory no Render como `projeto/`.
- Build Command: `./mvnw clean install -DskipTests`
- Start Command: `java -jar target/projeto-0.0.1-SNAPSHOT.jar`
- E configure todas as Variáveis de Ambiente necessárias (`DB_URL`, etc.).

---

## Troubleshooting

### O Backend não conecta no banco (`Connection refused`)
- Verifique se o Postgres está rodando.
- O Neon.tech precisa da string exata (incluindo `sslmode=require`).
- Garanta que as variáveis de ambiente `DB_URL` e `DB_PASSWORD` estão corretas.

### O Extrato PDF está falhando (`500 Internal Server Error`)
- Certifique-se de que `GEMINI_API_KEY` é válida e possui limite de quotas.
- A comunicação com Gemini pode retornar Timeout; verifique as chamadas no console do Render.

### Mudanças no Frontend não refletem (`Tailwind classes missing`)
- Certifique-se de não usar concatenações dinâmicas de strings para classes do Tailwind. O Tailwind JIT varre o código estaticamente. Em vez de `bg-[{{ cor }}]`, utilize estilos inline como `[style.background-color]="cor"`.

---
© 2026 FinanceSys. Transformando a gestão financeira com tecnologia de ponta.
