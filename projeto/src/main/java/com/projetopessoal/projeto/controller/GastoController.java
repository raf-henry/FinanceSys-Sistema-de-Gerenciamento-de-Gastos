package com.projetopessoal.projeto.controller;

import com.projetopessoal.projeto.model.Gasto;
import com.projetopessoal.projeto.model.User;
import com.projetopessoal.projeto.repository.GastoRepository;
import com.projetopessoal.projeto.repository.UserRepository;
import com.projetopessoal.projeto.repository.ContaRepository;
import com.projetopessoal.projeto.model.Conta;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Map;
import com.projetopessoal.projeto.service.GeminiService;
import com.projetopessoal.projeto.dto.GastoRequest;
import com.projetopessoal.projeto.config.InputSanitizer;
import jakarta.validation.Valid;

@RestController
@RequestMapping("/api/gastos")
public class GastoController {

    @Autowired
    private GastoRepository gastoRepository;

    @Autowired
    private ContaRepository contaRepository;

    @Autowired
    private UserRepository userRepository;
    
    @Autowired
    private GeminiService geminiService;

    // Construtor padrão para o Spring
    public GastoController() {}

    /**
     * Busca a entidade User no banco com base no UserDetails do contexto de segurança.
     */
    private User getAuthenticatedUser(UserDetails userDetails) {
        if (userDetails == null) {
            throw new RuntimeException("Sessão inválida.");
        }
        return userRepository.findByUsername(userDetails.getUsername())
                .orElseThrow(() -> new RuntimeException("Usuário não encontrado."));
    }



    /**
     * Cria um novo registro de gasto (ou receita). 
     * Valida a conta associada para evitar IDOR e sanitiza a descrição para evitar XSS.
     */
    @PostMapping
    public ResponseEntity<?> criarGasto(@Valid @RequestBody GastoRequest payload, @AuthenticationPrincipal UserDetails userDetails) {
        try {
            User user = getAuthenticatedUser(userDetails);
            
            Gasto novoGasto = new Gasto();
            // Sanitização (VULN-16)
            novoGasto.setDescricao(InputSanitizer.sanitize(payload.getDescricao()));
            // Tipagem forte do DTO evita NumberFormatException (VULN-13)
            novoGasto.setValor(payload.getValor());
            novoGasto.setStatus(payload.getStatus() != null ? payload.getStatus() : "Pago");
            novoGasto.setTipo(payload.getTipo() != null ? payload.getTipo() : "DESPESA");
            
            if ("Parcelado".equalsIgnoreCase(novoGasto.getStatus())) {
                novoGasto.setNumeroParcelas(payload.getNumeroParcelas() != null ? payload.getNumeroParcelas() : 1);
                novoGasto.setValorParcela(payload.getValorParcela() != null ? payload.getValorParcela() : payload.getValor());
            }

            if (payload.getFavorecido() != null) novoGasto.setFavorecido(InputSanitizer.sanitize(payload.getFavorecido()));
            if (payload.getNrDoc() != null) novoGasto.setNrDoc(InputSanitizer.sanitize(payload.getNrDoc()));
            if (payload.getCpfCnpj() != null) novoGasto.setCpfCnpj(InputSanitizer.sanitize(payload.getCpfCnpj()));
            if (payload.getSaldo() != null) novoGasto.setSaldo(payload.getSaldo());
            if (payload.getCategoria() != null) novoGasto.setCategoria(InputSanitizer.sanitize(payload.getCategoria()));
            if (payload.getFormaPagamento() != null) novoGasto.setFormaPagamento(InputSanitizer.sanitize(payload.getFormaPagamento()));

            if (payload.getContaId() != null) {
                Long contaId = payload.getContaId();
                Conta conta = contaRepository.findById(contaId).orElse(null);
                
                // Correção de Vulnerabilidade IDOR: Verifica se a conta pertence ao usuário
                if (conta != null && !conta.getUsuario().getId().equals(user.getId())) {
                    return ResponseEntity.status(403).body(Map.of("error", "Acesso negado a esta conta."));
                }
                
                novoGasto.setConta(conta);
            }

            novoGasto.setUsuario(user);
            
            Gasto salvo = gastoRepository.save(novoGasto);
            return ResponseEntity.ok(salvo);
        } catch (Exception e) {
            return ResponseEntity.status(500).body(Map.of(
                "error", "Falha interna ao salvar gasto"
            ));
        }
    }

    @PostMapping("/importar-caixa")
    public ResponseEntity<?> importarCaixa(
            @RequestParam("file") MultipartFile file, 
            @RequestParam("contaId") Long contaId,
            @AuthenticationPrincipal UserDetails userDetails) {
        return processarImportacao(file, contaId, userDetails, "CAIXA");
    }

    @PostMapping("/importar-picpay")
    public ResponseEntity<?> importarPicPay(
            @RequestParam("file") MultipartFile file, 
            @RequestParam("contaId") Long contaId,
            @AuthenticationPrincipal UserDetails userDetails) {
        return processarImportacao(file, contaId, userDetails, "PICPAY");
    }

    @PostMapping("/importar-nubank")
    public ResponseEntity<?> importarNubank(
            @RequestParam("file") MultipartFile file, 
            @RequestParam("contaId") Long contaId,
            @AuthenticationPrincipal UserDetails userDetails) {
        return processarImportacao(file, contaId, userDetails, "NUBANK");
    }

    private ResponseEntity<?> processarImportacao(MultipartFile file, Long contaId, UserDetails userDetails, String banco) {
        try {
            User user = getAuthenticatedUser(userDetails);
            Conta conta = contaRepository.findById(contaId)
                    .orElseThrow(() -> new RuntimeException("Conta não encontrada"));

            if (!conta.getUsuario().getId().equals(user.getId())) {
                return ResponseEntity.status(403).body(Map.of("error", "Acesso negado a esta conta."));
            }

            if (file.isEmpty()) {
                return ResponseEntity.badRequest().body(Map.of("error", "Arquivo vazio."));
            }

            String contentType = file.getContentType();
            if (contentType == null || !contentType.equals("application/pdf")) {
                return ResponseEntity.badRequest().body(Map.of("error", "Apenas arquivos PDF são aceitos."));
            }

            if (file.getSize() > 10 * 1024 * 1024) {
                return ResponseEntity.badRequest().body(Map.of("error", "O arquivo excede o tamanho máximo de 10MB."));
            }

            List<Map<String, Object>> gastosExtraidos;
            if ("PICPAY".equalsIgnoreCase(banco)) {
                gastosExtraidos = geminiService.processarExtratoPicPay(file.getBytes());
            } else if ("NUBANK".equalsIgnoreCase(banco)) {
                gastosExtraidos = geminiService.processarExtratoNubank(file.getBytes());
            } else {
                gastosExtraidos = geminiService.processarExtratoCaixa(file.getBytes());
            }

            int salvos = 0;
            for (Map<String, Object> dado : gastosExtraidos) {
                Gasto novoGasto = new Gasto();
                novoGasto.setUsuario(user);
                novoGasto.setConta(conta);
                
                String descricao = (String) dado.getOrDefault("descricao", dado.get("tituloExibicao"));
                novoGasto.setDescricao(InputSanitizer.sanitize(descricao));
                
                String favorecido = (String) dado.getOrDefault("favorecido", dado.get("nomeContraparte"));
                novoGasto.setFavorecido(InputSanitizer.sanitize(favorecido));

                if (dado.containsKey("tipo")) {
                    novoGasto.setTipo(InputSanitizer.sanitize((String) dado.get("tipo")));
                } else if (dado.containsKey("tipoMovimentacao")) {
                    String tipoMov = (String) dado.get("tipoMovimentacao");
                    novoGasto.setTipo("ENTRADA".equals(tipoMov) || "RENDIMENTO".equals(tipoMov) ? "RECEITA" : "DESPESA");
                }

                if (dado.containsKey("categoria")) {
                    novoGasto.setCategoria(InputSanitizer.sanitize((String) dado.get("categoria")));
                } else {
                    novoGasto.setCategoria("Outros");
                }

                if (dado.containsKey("formaPagamento")) {
                    novoGasto.setFormaPagamento(InputSanitizer.sanitize((String) dado.get("formaPagamento")));
                }

                if (dado.containsKey("nrDoc")) {
                    novoGasto.setNrDoc(InputSanitizer.sanitize((String) dado.get("nrDoc")));
                }

                if (dado.containsKey("cpfCnpj")) {
                    novoGasto.setCpfCnpj(InputSanitizer.sanitize((String) dado.get("cpfCnpj")));
                }

                if (dado.containsKey("saldo") && dado.get("saldo") != null) {
                    try {
                        novoGasto.setSaldo(Double.parseDouble(dado.get("saldo").toString()));
                    } catch (Exception ignored) {}
                }
                
                Object valorObj = dado.get("valor");
                if (valorObj instanceof Number) {
                    novoGasto.setValor(Math.abs(((Number) valorObj).doubleValue()));
                } else if (valorObj instanceof String) {
                    novoGasto.setValor(Math.abs(Double.parseDouble(valorObj.toString().replace(",", "."))));
                }

                if (dado.containsKey("dataGasto") && dado.get("dataGasto") != null) {
                    String dateStr = dado.get("dataGasto").toString();
                    try {
                        novoGasto.setDataGasto(LocalDateTime.parse(dateStr));
                    } catch (Exception e1) {
                        try {
                            novoGasto.setDataGasto(LocalDate.parse(dateStr, DateTimeFormatter.ofPattern("dd/MM/yyyy")).atStartOfDay());
                        } catch (Exception e2) {
                            try {
                                novoGasto.setDataGasto(LocalDate.parse(dateStr, DateTimeFormatter.ofPattern("yyyy-MM-dd")).atStartOfDay());
                            } catch (Exception e3) {
                                novoGasto.setDataGasto(LocalDateTime.now());
                            }
                        }
                    }
                } else {
                    novoGasto.setDataGasto(LocalDateTime.now());
                }

                novoGasto.setStatus("Pago");
                gastoRepository.save(novoGasto);
                salvos++;
            }

            return ResponseEntity.ok(Map.of("message", "Importação concluída", "count", salvos));
        } catch (Exception e) {
            return ResponseEntity.status(500).body(Map.of("error", "Falha ao processar extrato: " + e.getMessage()));
        }
    }


    /**
     * Retorna a lista de transações (gastos/receitas) do usuário.
     * Pode ser filtrada por contaId via Query Parameter.
     */
    @GetMapping
    public ResponseEntity<?> getGastos(@RequestParam(required = false) Long contaId, @AuthenticationPrincipal UserDetails userDetails) {
        User user = getAuthenticatedUser(userDetails);
        if (contaId != null) {
            Conta conta = contaRepository.findById(contaId).orElseThrow(() -> new RuntimeException("Conta não encontrada"));
            // Verifica se a conta pertence ao usuário autenticado (previne IDOR)
            if (!conta.getUsuario().getId().equals(user.getId())) {
                return ResponseEntity.status(403).body(Map.of("error", "Acesso negado a esta conta."));
            }
            return ResponseEntity.ok(gastoRepository.findByUsuarioAndConta(user, conta));
        }
        return ResponseEntity.ok(gastoRepository.findByUsuario(user));
    }

    @PutMapping("/{id}")
    public ResponseEntity<?> atualizarGasto(@PathVariable Long id, @RequestBody Map<String, Object> payload, @AuthenticationPrincipal UserDetails userDetails) {
        try {
            User user = getAuthenticatedUser(userDetails);
            return gastoRepository.findById(id).map(gasto -> {
                if (!gasto.getUsuario().getId().equals(user.getId())) {
                    return ResponseEntity.status(403).body(Map.of("error", "Não autorizado"));
                }
                if (payload.containsKey("descricao")) {
                    gasto.setDescricao((String) payload.get("descricao"));
                }
                if (payload.containsKey("valor")) {
                    gasto.setValor(Double.parseDouble(payload.get("valor").toString()));
                }
                if (payload.containsKey("status")) {
                    gasto.setStatus((String) payload.get("status"));
                }
                if (payload.containsKey("tipo")) {
                    gasto.setTipo((String) payload.get("tipo"));
                }
                if (payload.containsKey("numeroParcelas")) {
                    gasto.setNumeroParcelas(Integer.parseInt(payload.get("numeroParcelas").toString()));
                }
                if (payload.containsKey("valorParcela")) {
                    gasto.setValorParcela(Double.parseDouble(payload.get("valorParcela").toString()));
                }
                if (payload.containsKey("favorecido")) {
                    gasto.setFavorecido(InputSanitizer.sanitize((String) payload.get("favorecido")));
                }
                if (payload.containsKey("nrDoc")) {
                    gasto.setNrDoc(InputSanitizer.sanitize((String) payload.get("nrDoc")));
                }
                if (payload.containsKey("cpfCnpj")) {
                    gasto.setCpfCnpj(InputSanitizer.sanitize((String) payload.get("cpfCnpj")));
                }
                if (payload.containsKey("saldo")) {
                    gasto.setSaldo(Double.parseDouble(payload.get("saldo").toString()));
                }
                if (payload.containsKey("categoria")) {
                    gasto.setCategoria(InputSanitizer.sanitize((String) payload.get("categoria")));
                }
                if (payload.containsKey("formaPagamento")) {
                    gasto.setFormaPagamento(InputSanitizer.sanitize((String) payload.get("formaPagamento")));
                }
                return ResponseEntity.ok(gastoRepository.save(gasto));
            }).orElse(ResponseEntity.notFound().build());
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", "Falha ao atualizar transação."));
        }
    }

    @DeleteMapping("/{id}")
    @Transactional
    public ResponseEntity<?> deletarGasto(@PathVariable Long id, @AuthenticationPrincipal UserDetails userDetails) {
        try {
            User user = getAuthenticatedUser(userDetails);
            return gastoRepository.findById(id).map(gasto -> {
                if (!gasto.getUsuario().getId().equals(user.getId())) {
                    return ResponseEntity.status(403).body(Map.of("error", "Não autorizado"));
                }
                gastoRepository.deleteById(id);
                return ResponseEntity.ok(Map.of("message", "Gasto removido com sucesso"));
            }).orElse(ResponseEntity.notFound().build());
        } catch (Exception e) {
            return ResponseEntity.internalServerError().body(Map.of("error", "Falha ao remover transação."));
        }
    }

    @GetMapping("/stats")
    public ResponseEntity<?> getStats(@RequestParam(required = false) Long contaId, @AuthenticationPrincipal UserDetails userDetails) {
        User user = getAuthenticatedUser(userDetails);
        List<Gasto> gastos;
        if (contaId != null) {
            Conta conta = contaRepository.findById(contaId).orElseThrow(() -> new RuntimeException("Conta não encontrada"));
            // Verifica se a conta pertence ao usuário autenticado (previne IDOR)
            if (!conta.getUsuario().getId().equals(user.getId())) {
                return ResponseEntity.status(403).body(Map.of("error", "Acesso negado a esta conta."));
            }
            gastos = gastoRepository.findByUsuarioAndConta(user, conta);
        } else {
            gastos = gastoRepository.findByUsuario(user);
        }
        
        long totalGastos = gastos.size();
        double valorTotal = gastos.stream().mapToDouble(Gasto::getValor).sum();
        
        // Calcula o gasto fixo mensal (soma das parcelas de gastos parcelados)
        double gastoFixoMensal = gastos.stream()
            .filter(g -> "Parcelado".equalsIgnoreCase(g.getStatus()))
            .mapToDouble(g -> g.getValorParcela() != null ? g.getValorParcela() : 0.0)
            .sum();
        
        return ResponseEntity.ok(Map.of(
            "totalGastos", totalGastos,
            "valorTotal", valorTotal,
            "gastoFixoMensal", gastoFixoMensal
        ));
    }
}
