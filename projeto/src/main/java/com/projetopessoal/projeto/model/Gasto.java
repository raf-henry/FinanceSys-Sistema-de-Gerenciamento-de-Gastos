package com.projetopessoal.projeto.model;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;
import com.fasterxml.jackson.annotation.JsonProperty;

@Entity
@Table(name = "gastos")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class Gasto {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String descricao;

    @Column(nullable = false)
    private Double valor;

    @Column(nullable = false)
    private String status = "Pago"; // Valor padrão para registros novos e antigos

    private Integer numeroParcelas;
    private Double valorParcela;

    private LocalDateTime dataGasto = LocalDateTime.now();

    // Novos campos baseados no extrato da Caixa
    @Column(nullable = false)
    private String tipo = "DESPESA"; // "RECEITA" ou "DESPESA"

    private String categoria = "Outros";

    private String nrDoc;
    private String favorecido;
    private String cpfCnpj;
    private Double saldo;
    private String formaPagamento; // Pix, Crédito, Débito, etc.

    @ManyToOne
    @JoinColumn(name = "conta_id")
    private Conta conta;

    @ManyToOne
    @JoinColumn(name = "user_id", nullable = false)
    private User usuario;

    @JsonProperty("contaId")
    public Long getContaId() {
        return conta != null ? conta.getId() : null;
    }
}
