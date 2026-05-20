package com.projetopessoal.projeto.repository;

import com.projetopessoal.projeto.model.Transacao;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface TransacaoRepository extends JpaRepository<Transacao, Long> {
    List<Transacao> findByUsuarioId(Long userId);
    List<Transacao> findByContaId(Long contaId);
}
