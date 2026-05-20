package com.projetopessoal.projeto.model;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "transacoes")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Transacao {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne
    @JoinColumn(name = "conta_id", nullable = false)
    private Conta conta;

    @ManyToOne
    @JoinColumn(name = "user_id", nullable = false)
    private User usuario;

    @Column(nullable = false)
    private LocalDateTime dataHora = LocalDateTime.now();

    @Column(nullable = false)
    private Double valor;

    @Column(nullable = false)
    private String tipoMovimentacao; // ENTRADA, SAIDA, RENDIMENTO

    private String categoria; // PIX, PAGAMENTO_FATURA, RENDIMENTO, TED, etc.

    private String tituloExibicao; // Ex: "Transferência recebida pelo Pix"

    private String nomeContraparte;
    private String documentoContraparte;
    private String instituicaoContraparte;
    private String agenciaContraparte;
    private String contaContraparte;
    private String formaPagamento;

    private Double saldoMomento;
}
