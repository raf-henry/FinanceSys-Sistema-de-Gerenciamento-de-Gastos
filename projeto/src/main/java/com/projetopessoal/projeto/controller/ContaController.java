package com.projetopessoal.projeto.controller;

import com.projetopessoal.projeto.model.Conta;
import com.projetopessoal.projeto.model.User;
import com.projetopessoal.projeto.repository.ContaRepository;
import com.projetopessoal.projeto.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import com.projetopessoal.projeto.dto.ContaRequest;
import com.projetopessoal.projeto.config.InputSanitizer;
import jakarta.validation.Valid;

@RestController
@RequestMapping("/api/contas")
public class ContaController {

    @Autowired
    private ContaRepository contaRepository;

    @Autowired
    private UserRepository userRepository;

    /**
     * Retorna todas as contas vinculadas ao usuário autenticado.
     */
    @GetMapping
    public List<Conta> getContas(@AuthenticationPrincipal UserDetails userDetails) {
        User user = userRepository.findByUsername(userDetails.getUsername()).orElseThrow();
        return contaRepository.findByUsuario(user);
    }

    /**
     * Cria uma nova conta bancária para o usuário autenticado.
     * Sanitiza o nome e banco para evitar XSS e atribui cores padrão se necessário.
     */
    @PostMapping
    public ResponseEntity<?> criarConta(@Valid @RequestBody ContaRequest contaDto, @AuthenticationPrincipal UserDetails userDetails) {
        User user = userRepository.findByUsername(userDetails.getUsername()).orElseThrow();
        
        Conta conta = new Conta();
        // Sanitização (VULN-16)
        conta.setNome(InputSanitizer.sanitize(contaDto.getNome()));
        conta.setBanco(InputSanitizer.sanitize(contaDto.getBanco()));
        conta.setTipo(contaDto.getTipo());
        conta.setCor(contaDto.getCor());
        conta.setIcone(contaDto.getIcone());
        conta.setUsuario(user);
        
        // Atribui cores padrões baseadas no banco se não enviadas ou vazias
        if (conta.getCor() == null || conta.getCor().trim().isEmpty()) {
            if (conta.getBanco().equalsIgnoreCase("CAIXA")) conta.setCor("#005CA9");
            else if (conta.getBanco().equalsIgnoreCase("NUBANK")) conta.setCor("#8A05BE");
            else if (conta.getBanco().equalsIgnoreCase("ITAÚ")) conta.setCor("#FF8200");
            else if (conta.getBanco().equalsIgnoreCase("PICPAY")) conta.setCor("#2EDB6C");
            else conta.setCor("bg-gray-600");
        }

        Conta salva = contaRepository.save(conta);
        return ResponseEntity.ok(salva);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<?> deletarConta(@PathVariable Long id, @AuthenticationPrincipal UserDetails userDetails) {
        Conta conta = contaRepository.findById(id).orElseThrow();
        if (!conta.getUsuario().getUsername().equals(userDetails.getUsername())) {
            return ResponseEntity.status(403).build();
        }
        contaRepository.delete(conta);
        return ResponseEntity.ok().build();
    }
}
