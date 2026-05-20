package com.projetopessoal.projeto.controller;

import com.projetopessoal.projeto.model.Transacao;
import com.projetopessoal.projeto.model.User;
import com.projetopessoal.projeto.model.Conta;
import com.projetopessoal.projeto.repository.TransacaoRepository;
import com.projetopessoal.projeto.repository.UserRepository;
import com.projetopessoal.projeto.repository.ContaRepository;
import com.projetopessoal.projeto.service.GeminiService;
import com.projetopessoal.projeto.config.InputSanitizer;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/transacoes")
public class TransacaoController {

    @Autowired
    private TransacaoRepository transacaoRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private ContaRepository contaRepository;

    @Autowired
    private GeminiService geminiService;

    private User getAuthenticatedUser(UserDetails userDetails) {
        return userRepository.findByUsername(userDetails.getUsername())
                .orElseThrow(() -> new RuntimeException("Usuário não encontrado."));
    }

    @GetMapping
    public ResponseEntity<?> getTransacoes(@RequestParam(required = false) Long contaId, @AuthenticationPrincipal UserDetails userDetails) {
        User user = getAuthenticatedUser(userDetails);
        if (contaId != null) {
            Conta conta = contaRepository.findById(contaId).orElse(null);
            if (conta != null && !conta.getUsuario().getId().equals(user.getId())) {
                return ResponseEntity.status(403).body(Map.of("error", "Acesso negado."));
            }
            return ResponseEntity.ok(transacaoRepository.findByContaId(contaId));
        }
        return ResponseEntity.ok(transacaoRepository.findByUsuarioId(user.getId()));
    }

    @PostMapping("/importar-nubank")
    public ResponseEntity<?> importarNubank(
            @RequestParam("file") MultipartFile file, 
            @RequestParam("contaId") Long contaId,
            @AuthenticationPrincipal UserDetails userDetails) {
        try {
            User user = getAuthenticatedUser(userDetails);
            Conta conta = contaRepository.findById(contaId)
                    .orElseThrow(() -> new RuntimeException("Conta não encontrada"));

            if (!conta.getUsuario().getId().equals(user.getId())) {
                return ResponseEntity.status(403).body(Map.of("error", "Acesso negado."));
            }

            List<Map<String, Object>> dados = geminiService.processarExtratoNubank(file.getBytes());
            
            for (Map<String, Object> item : dados) {
                Transacao t = new Transacao();
                t.setUsuario(user);
                t.setConta(conta);
                
                t.setTituloExibicao(InputSanitizer.sanitize((String) item.get("tituloExibicao")));
                t.setCategoria(InputSanitizer.sanitize((String) item.get("categoria")));
                t.setFormaPagamento(InputSanitizer.sanitize((String) item.get("formaPagamento")));
                t.setTipoMovimentacao((String) item.get("tipoMovimentacao"));
                
                Object valorObj = item.get("valor");
                if (valorObj != null) {
                    try {
                        t.setValor(Double.parseDouble(valorObj.toString().replace(",", ".")));
                    } catch (Exception e) {
                        t.setValor(0.0);
                    }
                }
                
                t.setNomeContraparte(InputSanitizer.sanitize((String) item.get("nomeContraparte")));
                t.setDocumentoContraparte((String) item.get("documentoContraparte"));
                t.setInstituicaoContraparte((String) item.get("instituicaoContraparte"));
                t.setAgenciaContraparte((String) item.get("agenciaContraparte"));
                t.setContaContraparte((String) item.get("contaContraparte"));
                
                if (item.containsKey("dataHora") && item.get("dataHora") != null) {
                    try {
                        t.setDataHora(LocalDateTime.parse(item.get("dataHora").toString()));
                    } catch (Exception e) {
                        t.setDataHora(LocalDateTime.now());
                    }
                } else {
                    t.setDataHora(LocalDateTime.now());
                }
                
                if (item.containsKey("saldoMomento") && item.get("saldoMomento") != null) {
                    try {
                        t.setSaldoMomento(Double.parseDouble(item.get("saldoMomento").toString()));
                    } catch (Exception ignored) {}
                }

                transacaoRepository.save(t);
            }

            return ResponseEntity.ok(Map.of("message", "Importado com sucesso", "count", dados.size()));
        } catch (Exception e) {
            return ResponseEntity.status(500).body(Map.of("error", "Falha ao processar: " + e.getMessage()));
        }
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<?> deletar(@PathVariable Long id, @AuthenticationPrincipal UserDetails userDetails) {
        User user = getAuthenticatedUser(userDetails);
        return transacaoRepository.findById(id).map(t -> {
            if (!t.getUsuario().getId().equals(user.getId())) {
                return ResponseEntity.status(403).body(Map.of("error", "Não autorizado"));
            }
            transacaoRepository.delete(t);
            return ResponseEntity.ok(Map.of("message", "Removido"));
        }).orElse(ResponseEntity.notFound().build());
    }
}
